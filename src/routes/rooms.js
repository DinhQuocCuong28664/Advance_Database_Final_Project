/**
 * LuxeReserve — Room Routes
 * Room availability, search by date range
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');

// GET /api/rooms/availability?hotel_id=1&checkin=2026-04-05&checkout=2026-04-08
router.get('/availability', async (req, res) => {
  try {
    const { hotel_id, checkin, checkout } = req.query;
    if (!hotel_id || !checkin || !checkout) {
      return res.status(400).json({ success: false, error: 'Missing hotel_id, checkin, or checkout' });
    }

    const pool = getSqlPool();
    const result = await pool.request()
      .input('hotelId', sql.BigInt, parseInt(hotel_id))
      .input('checkin', sql.VarChar(10), checkin)
      .input('checkout', sql.VarChar(10), checkout)
      .query(`
        SELECT r.room_id, r.room_number, r.floor_number,
               rt.room_type_name, rt.category, rt.bed_type,
               rt.max_adults, rt.room_size_sqm, rt.view_type,
               rt.room_type_code,
               MIN(rr.final_rate) AS min_nightly_rate
        FROM Room r
        JOIN RoomType rt ON r.room_type_id = rt.room_type_id
        LEFT JOIN RoomRate rr ON rt.room_type_id = rr.room_type_id
          AND rr.rate_date >= @checkin AND rr.rate_date < @checkout
        WHERE r.hotel_id = @hotelId
          AND r.room_status = 'AVAILABLE'
          AND NOT EXISTS (
            SELECT 1 FROM RoomAvailability ra
            WHERE ra.room_id = r.room_id
              AND ra.stay_date >= @checkin AND ra.stay_date < @checkout
              AND ra.availability_status <> 'OPEN'
          )
        GROUP BY r.room_id, r.room_number, r.floor_number,
                 rt.room_type_name, rt.category, rt.bed_type,
                 rt.max_adults, rt.room_size_sqm, rt.view_type,
                 rt.room_type_code
        ORDER BY rt.category, r.floor_number
      `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
