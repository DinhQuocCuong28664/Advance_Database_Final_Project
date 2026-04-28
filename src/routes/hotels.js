/**
 * LuxeReserve  Hotel Routes
 * HYBRID: SQL Server (operational) + MongoDB (rich content)
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql, getMongoDb } = require('../config/database');
const { requireAdminUser } = require('../middleware/auth');

// GET /api/hotels  List all hotels (Hybrid merge)
router.get('/', async (req, res) => {
  try {
    const pool = getSqlPool();
    const mongo = getMongoDb();

    // SQL: operational data
    const sqlResult = await pool.request().query(`
      SELECT h.hotel_id, h.hotel_code, h.hotel_name, h.hotel_type,
             h.star_rating, h.status, h.currency_code,
             h.latitude, h.longitude,
             h.check_in_time, h.check_out_time, h.total_rooms,
             b.brand_name, c.chain_name,
             l.location_name AS district_name,
             p.location_name AS city_name,
             c2.location_name AS country_name
      FROM Hotel h
      JOIN Brand b ON h.brand_id = b.brand_id
      JOIN HotelChain c ON b.chain_id = c.chain_id
      JOIN Location l ON h.location_id = l.location_id
      LEFT JOIN Location p ON l.parent_location_id = p.location_id
      LEFT JOIN Location c2 ON p.parent_location_id = c2.location_id
      WHERE h.status = 'ACTIVE'
    `);

    // MongoDB: rich content
    const mongoDocs = await mongo.collection('Hotel_Catalog')
      .find({}, { projection: { hotel_id: 1, description: 1, images: 1, amenities: 1, location: 1 } })
      .toArray();
    const mongoMap = {};
    mongoDocs.forEach(doc => { mongoMap[doc.hotel_id] = doc; });

    // Merge
    const hotels = sqlResult.recordset.map(h => ({
      ...h,
      description: mongoMap[h.hotel_id]?.description || null,
      hero_image: mongoMap[h.hotel_id]?.images?.find(i => i.is_hero)?.url || null,
      amenity_count: mongoMap[h.hotel_id]?.amenities?.length || 0,
      location_detail: mongoMap[h.hotel_id]?.location || null,
    }));

    res.json({ success: true, count: hotels.length, data: hotels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/hotels/:id  Hotel detail (Full hybrid)
router.get('/:id', async (req, res) => {
  try {
    const hotelId = parseInt(req.params.id);
    if (isNaN(hotelId)) {
      return res.status(400).json({ success: false, error: 'Invalid hotel ID' });
    }
    const pool = getSqlPool();
    const mongo = getMongoDb();

    // SQL: hotel + policies + amenities (operational)
    const sqlHotel = await pool.request()
      .input('hotelId', sql.BigInt, hotelId)
      .query(`
        SELECT h.*, b.brand_name, b.brand_positioning, c.chain_name, c.chain_code,
               l.location_name AS city_name, lp.location_name AS country_name
        FROM Hotel h
        JOIN Brand b ON h.brand_id = b.brand_id
        JOIN HotelChain c ON b.chain_id = c.chain_id
        JOIN Location l ON h.location_id = l.location_id
        LEFT JOIN Location lp ON l.parent_location_id = lp.location_id
        WHERE h.hotel_id = @hotelId
      `);

    if (sqlHotel.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Hotel not found' });
    }

    // SQL: room types with rates
    const roomTypes = await pool.request()
      .input('hotelId', sql.BigInt, hotelId)
      .query(`
        SELECT rt.room_type_id, rt.room_type_code, rt.room_type_name,
               rt.category, rt.bed_type, rt.max_adults, rt.max_occupancy,
               rt.room_size_sqm, rt.view_type,
               MIN(rr.final_rate) AS min_rate, MAX(rr.final_rate) AS max_rate
        FROM RoomType rt
        LEFT JOIN RoomRate rr ON rt.room_type_id = rr.room_type_id
          AND rr.rate_date >= CAST(GETDATE() AS DATE)
        WHERE rt.hotel_id = @hotelId AND rt.status = 'ACTIVE'
        GROUP BY rt.room_type_id, rt.room_type_code, rt.room_type_name,
                 rt.category, rt.bed_type, rt.max_adults, rt.max_occupancy,
                 rt.room_size_sqm, rt.view_type
      `);

    // SQL: room features (per room type)
    const roomFeatures = await pool.request()
      .input('hotelId2', sql.BigInt, hotelId)
      .query(`
        SELECT rf.room_type_id, rf.feature_code, rf.feature_name,
               rf.feature_category, rf.feature_value, rf.is_premium
        FROM RoomFeature rf
        JOIN RoomType rt ON rf.room_type_id = rt.room_type_id
        WHERE rt.hotel_id = @hotelId2
        ORDER BY rf.is_premium DESC, rf.feature_category, rf.feature_name
      `);
    // Group by room_type_id
    const featuresByType = {};
    roomFeatures.recordset.forEach(f => {
      if (!featuresByType[f.room_type_id]) featuresByType[f.room_type_id] = [];
      featuresByType[f.room_type_id].push({
        code: f.feature_code, name: f.feature_name,
        category: f.feature_category, value: f.feature_value,
        is_premium: f.is_premium,
      });
    });

    // SQL: amenities (operational)
    const amenities = await pool.request()
      .input('hotelId', sql.BigInt, hotelId)
      .query(`
        SELECT amenity_code, is_complimentary, is_chargeable, base_fee, operating_hours
        FROM HotelAmenity WHERE hotel_id = @hotelId
      `);

    // SQL: hotel policies (1 row per hotel, columnar schema)
    const policiesResult = await pool.request()
      .input('hotelId', sql.BigInt, hotelId)
      .query(`
        SELECT cancellation_policy_text, deposit_policy_text,
               child_policy_text, pet_policy_text, smoking_policy_text,
               extra_bed_policy_text, late_checkout_policy_text, early_checkin_policy_text,
               identity_document_required, minimum_checkin_age
        FROM HotelPolicy
        WHERE hotel_id = @hotelId AND (effective_to IS NULL OR effective_to >= GETDATE())
      `);

    // Flatten columnar policies into [{type, text}]
    const pRaw = policiesResult.recordset[0] || {};
    const policyLabels = {
      cancellation_policy_text:  'Cancellation',
      deposit_policy_text:       'Deposit',
      child_policy_text:         'Children',
      pet_policy_text:           'Pets',
      smoking_policy_text:       'Smoking',
      extra_bed_policy_text:     'Extra bed',
      late_checkout_policy_text: 'Late check-out',
      early_checkin_policy_text: 'Early check-in',
    };
    const policies = Object.entries(policyLabels)
      .filter(([col]) => pRaw[col])
      .map(([col, label]) => ({ type: label, text: pRaw[col] }));
    if (pRaw.identity_document_required) {
      policies.push({ type: 'ID Required', text: 'A valid government-issued photo ID is required at check-in.' });
    }
    if (pRaw.minimum_checkin_age) {
      policies.push({ type: 'Minimum age', text: `Guests must be at least ${pRaw.minimum_checkin_age} years old to check in.` });
    }

    // MongoDB: rich content
    const mongoCatalog = await mongo.collection('Hotel_Catalog')
      .findOne({ hotel_id: hotelId });

    // MongoDB: room type descriptions
    const roomTypeCodes = roomTypes.recordset.map(r => r.room_type_code);
    const mongoRoomTypes = await mongo.collection('room_type_catalog')
      .find({ room_type_code: { $in: roomTypeCodes } })
      .toArray();
    const rtMap = {};
    mongoRoomTypes.forEach(r => { rtMap[r.room_type_code] = r; });

    // MongoDB: amenity descriptions
    const amenityCodes = amenities.recordset.map(a => a.amenity_code);
    const mongoAmenities = await mongo.collection('amenity_master')
      .find({ amenity_code: { $in: amenityCodes } })
      .toArray();
    const amMap = {};
    mongoAmenities.forEach(a => { amMap[a.amenity_code] = a; });

    // Merge room types
    const mergedRoomTypes = roomTypes.recordset.map(rt => ({
      ...rt,
      description: rtMap[rt.room_type_code]?.description || null,
      features: rtMap[rt.room_type_code]?.features || null,
      sql_features: featuresByType[rt.room_type_id] || [],
      images: rtMap[rt.room_type_code]?.images || [],
      highlight: rtMap[rt.room_type_code]?.highlight || null,
    }));

    // Merge amenities
    const mergedAmenities = amenities.recordset.map(a => ({
      ...a,
      name: amMap[a.amenity_code]?.name || a.amenity_code,
      category: amMap[a.amenity_code]?.category || null,
      description: amMap[a.amenity_code]?.description || null,
      icon: amMap[a.amenity_code]?.icon || null,
      tags: amMap[a.amenity_code]?.tags || [],
    }));

    res.json({
      success: true,
      data: {
        ...sqlHotel.recordset[0],
        description: mongoCatalog?.description || null,
        images: mongoCatalog?.images || [],
        contact: mongoCatalog?.contact || null,
        room_types: mergedRoomTypes,
        amenities: mergedAmenities,
        policies: policies,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// GET /api/hotels/:id/features  List all RoomFeatures for a hotel
// 
router.get('/:id/features', requireAdminUser, async (req, res) => {
  try {
    const hotelId = parseInt(req.params.id, 10);
    if (isNaN(hotelId)) {
      return res.status(400).json({ success: false, error: 'Invalid hotel ID' });
    }
    const pool = getSqlPool();

    // Verify hotel exists
    const hotelCheck = await pool.request()
      .input('hid', sql.BigInt, hotelId)
      .query('SELECT hotel_id FROM Hotel WHERE hotel_id = @hid');
    if (hotelCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Hotel not found' });
    }

    const result = await pool.request()
      .input('hid', sql.BigInt, hotelId)
      .query(`
        SELECT rf.room_feature_id, rf.room_type_id, rf.room_id,
               rf.feature_code, rf.feature_name, rf.feature_category,
               rf.feature_value, rf.is_premium, rf.created_at,
               rt.room_type_name, rt.room_type_code
        FROM RoomFeature rf
        LEFT JOIN RoomType rt ON rf.room_type_id = rt.room_type_id
        WHERE rt.hotel_id = @hid OR rf.room_id IN (
          SELECT room_id FROM Room WHERE hotel_id = @hid
        )
        ORDER BY rf.is_premium DESC, rf.feature_category, rf.feature_name
      `);

    res.json({
      success: true,
      hotel_id: hotelId,
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// POST /api/hotels/:id/features  Add a RoomFeature
// 
const VALID_FEATURE_CATEGORIES = ['VIEW', 'BED', 'BATH', 'TECH', 'AMENITY', 'SPACE'];

router.post('/:id/features', requireAdminUser, async (req, res) => {
  try {
    const hotelId = parseInt(req.params.id, 10);
    if (isNaN(hotelId)) {
      return res.status(400).json({ success: false, error: 'Invalid hotel ID' });
    }

    const { room_type_id, room_id, feature_code, feature_name, feature_category, feature_value, is_premium } = req.body;

    // Validate required fields
    if (!feature_code || !feature_name) {
      return res.status(400).json({ success: false, error: 'feature_code and feature_name are required' });
    }
    if (!room_type_id && !room_id) {
      return res.status(400).json({ success: false, error: 'room_type_id or room_id is required' });
    }
    if (feature_category && !VALID_FEATURE_CATEGORIES.includes(feature_category)) {
      return res.status(400).json({
        success: false,
        error: `feature_category must be one of: ${VALID_FEATURE_CATEGORIES.join(', ')}`,
      });
    }

    const pool = getSqlPool();

    // Verify hotel exists
    const hotelCheck = await pool.request()
      .input('hid', sql.BigInt, hotelId)
      .query('SELECT hotel_id FROM Hotel WHERE hotel_id = @hid');
    if (hotelCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Hotel not found' });
    }

    // Verify room_type belongs to this hotel if provided
    if (room_type_id) {
      const rtCheck = await pool.request()
        .input('rtid', sql.BigInt, room_type_id)
        .input('hid', sql.BigInt, hotelId)
        .query('SELECT room_type_id FROM RoomType WHERE room_type_id = @rtid AND hotel_id = @hid');
      if (rtCheck.recordset.length === 0) {
        return res.status(404).json({ success: false, error: 'RoomType not found for this hotel' });
      }
    }

    const insertResult = await pool.request()
      .input('rtid',     sql.BigInt,       room_type_id || null)
      .input('rid',      sql.BigInt,       room_id || null)
      .input('code',     sql.VarChar(50),  feature_code)
      .input('name',     sql.NVarChar(150),feature_name)
      .input('cat',      sql.VarChar(50),  feature_category || null)
      .input('val',      sql.NVarChar(255),feature_value || null)
      .input('premium',  sql.Bit,          is_premium ? 1 : 0)
      .query(`
        INSERT INTO RoomFeature
          (room_type_id, room_id, feature_code, feature_name, feature_category, feature_value, is_premium)
        OUTPUT INSERTED.*
        VALUES (@rtid, @rid, @code, @name, @cat, @val, @premium)
      `);

    res.status(201).json({
      success: true,
      message: 'Room feature created',
      data: insertResult.recordset[0],
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// DELETE /api/hotels/:id/features/:fid  Remove a RoomFeature
// 
router.delete('/:id/features/:fid', requireAdminUser, async (req, res) => {
  try {
    const hotelId  = parseInt(req.params.id, 10);
    const featureId = parseInt(req.params.fid, 10);

    if (isNaN(hotelId) || isNaN(featureId)) {
      return res.status(400).json({ success: false, error: 'Invalid hotel or feature ID' });
    }

    const pool = getSqlPool();

    // Verify feature belongs to this hotel (via room_type or room)
    const check = await pool.request()
      .input('fid', sql.BigInt, featureId)
      .input('hid', sql.BigInt, hotelId)
      .query(`
        SELECT rf.room_feature_id
        FROM RoomFeature rf
        LEFT JOIN RoomType rt ON rf.room_type_id = rt.room_type_id
        LEFT JOIN Room r ON rf.room_id = r.room_id
        WHERE rf.room_feature_id = @fid
          AND (rt.hotel_id = @hid OR r.hotel_id = @hid)
      `);

    if (check.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Room feature not found for this hotel' });
    }

    await pool.request()
      .input('fid', sql.BigInt, featureId)
      .query('DELETE FROM RoomFeature WHERE room_feature_id = @fid');

    res.json({ success: true, message: 'Room feature deleted', room_feature_id: featureId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
