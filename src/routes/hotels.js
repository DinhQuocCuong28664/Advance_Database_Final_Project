/**
 * LuxeReserve - Hotel Routes
 * HYBRID: SQL Server (operational) + MongoDB (rich content)
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql, getMongoDb } = require('../config/database');
const { requireAdminUser, requireAuth } = require('../middleware/auth');

// GET /api/v1/hotels  List all hotels (Hybrid merge)
router.get('/', async (req, res) => {
  try {
    const pool = getSqlPool();
    const mongo = getMongoDb();

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size, 10) || 20));
    const offset = (page - 1) * pageSize;

    // Count total
    const countResult = await pool.request().query(`SELECT COUNT(*) AS total FROM Hotel WHERE status = 'ACTIVE'`);
    const totalCount = countResult.recordset[0].total;

    // SQL: operational data
    const sqlResult = await pool.request()
      .input('offset', sql.BigInt, offset)
      .input('pageSize', sql.BigInt, pageSize)
      .query(`
      WITH LocationAncestors AS (
        SELECT
          h.hotel_id,
          l.location_id,
          l.parent_location_id,
          l.location_name,
          l.location_type,
          0 AS depth
        FROM Hotel h
        JOIN Location l ON h.location_id = l.location_id

        UNION ALL

        SELECT
          a.hotel_id,
          p.location_id,
          p.parent_location_id,
          p.location_name,
          p.location_type,
          a.depth + 1
        FROM LocationAncestors a
        JOIN Location p ON a.parent_location_id = p.location_id
      )
      SELECT h.hotel_id, h.hotel_code, h.hotel_name, h.hotel_type,
             h.star_rating, h.status, h.currency_code,
             h.latitude, h.longitude,
             h.check_in_time, h.check_out_time, h.total_rooms,
             b.brand_name, c.chain_name,
             city.location_name AS city_name,
             country.location_name AS country_name,
             district.location_name AS district_name
      FROM Hotel h
      JOIN Brand b ON h.brand_id = b.brand_id
      JOIN HotelChain c ON b.chain_id = c.chain_id
      JOIN Location district ON h.location_id = district.location_id
      OUTER APPLY (
        SELECT TOP 1 location_name
        FROM LocationAncestors
        WHERE hotel_id = h.hotel_id AND location_type = 'CITY'
        ORDER BY depth ASC
      ) city
      OUTER APPLY (
        SELECT TOP 1 location_name
        FROM LocationAncestors
        WHERE hotel_id = h.hotel_id AND location_type = 'COUNTRY'
        ORDER BY depth ASC
      ) country
      WHERE h.status = 'ACTIVE'
      ORDER BY h.hotel_name
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      OPTION (MAXRECURSION 10)
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

    res.json({ success: true, count: hotels.length, total: totalCount, page, page_size: pageSize, data: hotels });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/hotels/:id  Hotel detail (Full hybrid)
router.get('/:id', async (req, res) => {
  try {
    const hotelId = parseInt(req.params.id);
    if (isNaN(hotelId)) {
      return res.status(400).json({ success: false, message: 'Invalid hotel ID' });
    }
    const pool = getSqlPool();
    const mongo = getMongoDb();

    // SQL: hotel + policies + amenities (operational)
    const sqlHotel = await pool.request()
      .input('hotelId', sql.BigInt, hotelId)
      .query(`
        WITH LocationAncestors AS (
          SELECT
            h.hotel_id,
            l.location_id,
            l.parent_location_id,
            l.location_name,
            l.location_type,
            0 AS depth
          FROM Hotel h
          JOIN Location l ON h.location_id = l.location_id
          WHERE h.hotel_id = @hotelId

          UNION ALL

          SELECT
            a.hotel_id,
            p.location_id,
            p.parent_location_id,
            p.location_name,
            p.location_type,
            a.depth + 1
          FROM LocationAncestors a
          JOIN Location p ON a.parent_location_id = p.location_id
        )
        SELECT h.*, b.brand_name, b.brand_positioning, c.chain_name, c.chain_code,
               city.location_name AS city_name,
               country.location_name AS country_name,
               district.location_name AS district_name
        FROM Hotel h
        JOIN Brand b ON h.brand_id = b.brand_id
        JOIN HotelChain c ON b.chain_id = c.chain_id
        JOIN Location district ON h.location_id = district.location_id
        OUTER APPLY (
          SELECT TOP 1 location_name
          FROM LocationAncestors
          WHERE hotel_id = h.hotel_id AND location_type = 'CITY'
          ORDER BY depth ASC
        ) city
        OUTER APPLY (
          SELECT TOP 1 location_name
          FROM LocationAncestors
          WHERE hotel_id = h.hotel_id AND location_type = 'COUNTRY'
          ORDER BY depth ASC
        ) country
        WHERE h.hotel_id = @hotelId
        OPTION (MAXRECURSION 10)
      `);

    if (sqlHotel.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Hotel not found' });
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/hotels/:id/reviews  Public hotel reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const hotelId = parseInt(req.params.id, 10);
    const limit = Math.min(parseInt(req.query.limit, 10) || 12, 50);
    if (isNaN(hotelId)) {
      return res.status(400).json({ success: false, message: 'Invalid hotel ID' });
    }

    const pool = getSqlPool();
    const [summaryResult, reviewsResult] = await Promise.all([
      pool.request()
        .input('hotelId', sql.BigInt, hotelId)
        .query(`
          SELECT
            COUNT(*) AS review_count,
            CAST(AVG(CAST(rating_score AS DECIMAL(10,2))) AS DECIMAL(10,2)) AS average_rating
          FROM HotelReview
          WHERE hotel_id = @hotelId
            AND public_visible_flag = 1
            AND moderation_status = 'PUBLISHED'
        `),
      pool.request()
        .input('hotelId', sql.BigInt, hotelId)
        .input('revLimit', sql.Int, limit)
        .query(`
          SELECT TOP (@revLimit)
            hr.hotel_review_id,
            hr.rating_score,
            hr.review_title,
            hr.review_text,
            hr.created_at,
            hr.reservation_id,
            g.full_name AS guest_name,
            r.reservation_code
          FROM HotelReview hr
          JOIN Guest g ON hr.guest_id = g.guest_id
          JOIN Reservation r ON hr.reservation_id = r.reservation_id
          WHERE hr.hotel_id = @hotelId
            AND hr.public_visible_flag = 1
            AND hr.moderation_status = 'PUBLISHED'
          ORDER BY hr.created_at DESC, hr.hotel_review_id DESC
        `),
    ]);

    const summary = summaryResult.recordset[0] || { review_count: 0, average_rating: null };
    return res.json({
      success: true,
      summary: {
        review_count: Number(summary.review_count || 0),
        average_rating: summary.average_rating == null ? null : Number(summary.average_rating),
      },
      count: reviewsResult.recordset.length,
      data: reviewsResult.recordset,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/hotels/:id/reviews  Guest review after completed stay
router.post('/:id/reviews', requireAuth, async (req, res) => {
  try {
    if (req.auth?.user_type !== 'GUEST') {
      return res.status(403).json({ success: false, message: 'Guest account required to submit a hotel review' });
    }

    const hotelId = parseInt(req.params.id, 10);
    const reservationId = parseInt(req.body?.reservation_id, 10);
    const ratingScore = parseInt(req.body?.rating_score, 10);
    const reviewTitle = String(req.body?.review_title || '').trim();
    const reviewText = String(req.body?.review_text || '').trim();
    const guestId = Number(req.auth.sub);

    if (isNaN(hotelId) || isNaN(reservationId)) {
      return res.status(400).json({ success: false, message: 'Valid hotel_id and reservation_id are required' });
    }
    if (!Number.isInteger(ratingScore) || ratingScore < 1 || ratingScore > 5) {
      return res.status(400).json({ success: false, message: 'rating_score must be an integer between 1 and 5' });
    }
    if (!reviewText) {
      return res.status(400).json({ success: false, message: 'review_text is required' });
    }

    const pool = getSqlPool();

    const reservationResult = await pool.request()
      .input('hotelId', sql.BigInt, hotelId)
      .input('reservationId', sql.BigInt, reservationId)
      .input('guestId', sql.BigInt, guestId)
      .query(`
        SELECT TOP 1
          r.reservation_id,
          r.reservation_code,
          r.reservation_status,
          r.hotel_id,
          r.guest_id
        FROM Reservation r
        WHERE r.reservation_id = @reservationId
          AND r.hotel_id = @hotelId
          AND r.guest_id = @guestId
          AND r.reservation_status = 'CHECKED_OUT'
      `);

    if (reservationResult.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Only completed stays at this hotel can be reviewed',
      });
    }

    const existingReview = await pool.request()
      .input('reservationId', sql.BigInt, reservationId)
      .query(`
        SELECT hotel_review_id
        FROM HotelReview
        WHERE reservation_id = @reservationId
      `);

    if (existingReview.recordset.length > 0) {
      return res.status(409).json({ success: false, message: 'A review has already been submitted for this reservation' });
    }

    const insertResult = await pool.request()
      .input('hotelId', sql.BigInt, hotelId)
      .input('guestId', sql.BigInt, guestId)
      .input('reservationId', sql.BigInt, reservationId)
      .input('ratingScore', sql.Int, ratingScore)
      .input('reviewTitle', sql.NVarChar(150), reviewTitle || null)
      .input('reviewText', sql.NVarChar(1500), reviewText)
      .query(`
        INSERT INTO HotelReview (
          hotel_id, guest_id, reservation_id, rating_score, review_title, review_text,
          public_visible_flag, moderation_status
        )
        OUTPUT INSERTED.*
        VALUES (
          @hotelId, @guestId, @reservationId, @ratingScore, @reviewTitle, @reviewText,
          1, 'PUBLISHED'
        )
      `);

    return res.status(201).json({
      success: true,
      message: 'Thank you. Your review is now visible on the hotel page.',
      data: insertResult.recordset[0],
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 
// GET /api/v1/hotels/:id/features  List all RoomFeatures for a hotel
// 
router.get('/:id/features', requireAdminUser, async (req, res) => {
  try {
    const hotelId = parseInt(req.params.id, 10);
    if (isNaN(hotelId)) {
      return res.status(400).json({ success: false, message: 'Invalid hotel ID' });
    }
    const pool = getSqlPool();

    // Verify hotel exists
    const hotelCheck = await pool.request()
      .input('hid', sql.BigInt, hotelId)
      .query('SELECT hotel_id FROM Hotel WHERE hotel_id = @hid');
    if (hotelCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Hotel not found' });
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// 
// POST /api/v1/hotels/:id/features  Add a RoomFeature
// 
const VALID_FEATURE_CATEGORIES = ['VIEW', 'BED', 'BATH', 'TECH', 'AMENITY', 'SPACE'];

router.post('/:id/features', requireAdminUser, async (req, res) => {
  try {
    const hotelId = parseInt(req.params.id, 10);
    if (isNaN(hotelId)) {
      return res.status(400).json({ success: false, message: 'Invalid hotel ID' });
    }

    const { room_type_id, room_id, feature_code, feature_name, feature_category, feature_value, is_premium } = req.body;

    // Validate required fields
    if (!feature_code || !feature_name) {
      return res.status(400).json({ success: false, message: 'feature_code and feature_name are required' });
    }
    if (!room_type_id && !room_id) {
      return res.status(400).json({ success: false, message: 'room_type_id or room_id is required' });
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
      return res.status(404).json({ success: false, message: 'Hotel not found' });
    }

    // Verify room_type belongs to this hotel if provided
    if (room_type_id) {
      const rtCheck = await pool.request()
        .input('rtid', sql.BigInt, room_type_id)
        .input('hid', sql.BigInt, hotelId)
        .query('SELECT room_type_id FROM RoomType WHERE room_type_id = @rtid AND hotel_id = @hid');
      if (rtCheck.recordset.length === 0) {
        return res.status(404).json({ success: false, message: 'RoomType not found for this hotel' });
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// 
// DELETE /api/v1/hotels/:id/features/:fid  Remove a RoomFeature
// 
router.delete('/:id/features/:fid', requireAdminUser, async (req, res) => {
  try {
    const hotelId  = parseInt(req.params.id, 10);
    const featureId = parseInt(req.params.fid, 10);

    if (isNaN(hotelId) || isNaN(featureId)) {
      return res.status(400).json({ success: false, message: 'Invalid hotel or feature ID' });
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
      return res.status(404).json({ success: false, message: 'Room feature not found for this hotel' });
    }

    await pool.request()
      .input('fid', sql.BigInt, featureId)
      .query('DELETE FROM RoomFeature WHERE room_feature_id = @fid');

    res.json({ success: true, message: 'Room feature deleted', room_feature_id: featureId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
