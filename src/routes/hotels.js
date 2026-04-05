/**
 * LuxeReserve — Hotel Routes
 * HYBRID: SQL Server (operational) + MongoDB (rich content)
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql, getMongoDb } = require('../config/database');

// GET /api/hotels — List all hotels (Hybrid merge)
router.get('/', async (req, res) => {
  try {
    const pool = getSqlPool();
    const mongo = getMongoDb();

    // SQL: operational data
    const sqlResult = await pool.request().query(`
      SELECT h.hotel_id, h.hotel_code, h.hotel_name, h.hotel_type,
             h.star_rating, h.status, h.currency_code,
             h.check_in_time, h.check_out_time, h.total_rooms,
             b.brand_name, c.chain_name,
             l.location_name AS city_name
      FROM Hotel h
      JOIN Brand b ON h.brand_id = b.brand_id
      JOIN HotelChain c ON b.chain_id = c.chain_id
      JOIN Location l ON h.location_id = l.location_id
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

// GET /api/hotels/:id — Hotel detail (Full hybrid)
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

    // SQL: amenities (operational)
    const amenities = await pool.request()
      .input('hotelId', sql.BigInt, hotelId)
      .query(`
        SELECT amenity_code, is_complimentary, is_chargeable, base_fee, operating_hours
        FROM HotelAmenity WHERE hotel_id = @hotelId
      `);

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
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
