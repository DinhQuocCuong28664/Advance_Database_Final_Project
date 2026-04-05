/**
 * LuxeReserve — Admin Routes
 * Rate management (triggers Price Guard), reports (Window Functions)
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');

// PUT /api/admin/rates/:id — Update room rate (triggers Price Integrity Guard)
router.put('/rates/:id', async (req, res) => {
  try {
    const pool = getSqlPool();
    const rateId = parseInt(req.params.id);
    if (isNaN(rateId)) {
      return res.status(400).json({ success: false, error: 'Invalid rate ID' });
    }
    const { final_rate, price_source, updated_by } = req.body;

    if (!final_rate) {
      return res.status(400).json({ success: false, error: 'final_rate is required' });
    }

    // Get old rate for response
    const oldRate = await pool.request()
      .input('id', sql.BigInt, rateId)
      .query('SELECT final_rate FROM RoomRate WHERE room_rate_id = @id');

    if (oldRate.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Rate not found' });
    }

    const oldValue = oldRate.recordset[0].final_rate;

    // Update — this will FIRE the trigger if change > 50%
    await pool.request()
      .input('id', sql.BigInt, rateId)
      .input('rate', sql.Decimal(18, 2), final_rate)
      .input('source', sql.VarChar(20), price_source || 'MANUAL')
      .input('updater', sql.BigInt, updated_by || null)
      .query(`
        UPDATE RoomRate
        SET final_rate = @rate,
            price_source = @source,
            updated_by = @updater,
            updated_at = GETDATE()
        WHERE room_rate_id = @id
      `);

    const changePercent = oldValue > 0 ? Math.abs(final_rate - oldValue) * 100 / oldValue : 0;

    // Check if trigger created a log entry
    let triggerAlert = null;
    if (changePercent > 50) {
      const log = await pool.request()
        .input('id', sql.BigInt, rateId)
        .query(`
          SELECT TOP 1 * FROM RateChangeLog
          WHERE room_rate_id = @id
          ORDER BY triggered_at DESC
        `);
      triggerAlert = log.recordset[0] || null;
    }

    res.json({
      success: true,
      data: {
        room_rate_id: rateId,
        old_rate: oldValue,
        new_rate: final_rate,
        change_percent: Math.round(changePercent * 100) / 100,
        price_guard_triggered: changePercent > 50,
        trigger_alert: triggerAlert,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/rates/alerts — View Price Guard alerts
router.get('/rates/alerts', async (req, res) => {
  try {
    const pool = getSqlPool();
    const result = await pool.request().query(`
      SELECT rcl.*, rr.rate_date, rt.room_type_name, h.hotel_name,
             su.full_name AS triggered_by_name
      FROM RateChangeLog rcl
      JOIN RoomRate rr ON rcl.room_rate_id = rr.room_rate_id
      JOIN RoomType rt ON rr.room_type_id = rt.room_type_id
      JOIN Hotel h ON rr.hotel_id = h.hotel_id
      LEFT JOIN SystemUser su ON rcl.triggered_by = su.user_id
      ORDER BY rcl.triggered_at DESC
    `);
    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/reports/revenue — Revenue Intelligence (Window Functions)
router.get('/reports/revenue', async (req, res) => {
  try {
    const pool = getSqlPool();
    const result = await pool.request().query(`
      SELECT
        h.hotel_name,
        rt.room_type_name,
        DATEPART(QUARTER, r.checkin_date)   AS quarter,
        DATEPART(YEAR, r.checkin_date)      AS year,
        COUNT(*)                            AS booking_count,
        SUM(rr.final_amount)               AS total_revenue,
        AVG(rr.nightly_rate_snapshot)       AS avg_nightly_rate,

        -- Window Functions
        DENSE_RANK() OVER (
          PARTITION BY h.hotel_id
          ORDER BY SUM(rr.final_amount) DESC
        ) AS revenue_rank_in_hotel,

        SUM(SUM(rr.final_amount)) OVER (
          PARTITION BY h.hotel_id
          ORDER BY DATEPART(YEAR, r.checkin_date), DATEPART(QUARTER, r.checkin_date)
        ) AS cumulative_revenue,

        SUM(rr.final_amount) * 100.0 / NULLIF(SUM(SUM(rr.final_amount)) OVER (PARTITION BY h.hotel_id), 0)
          AS revenue_share_pct

      FROM Reservation r
      JOIN ReservationRoom rr ON r.reservation_id = rr.reservation_id
      JOIN Hotel h ON r.hotel_id = h.hotel_id
      JOIN RoomType rt ON rr.room_type_id = rt.room_type_id
      WHERE r.reservation_status NOT IN ('CANCELLED', 'NO_SHOW')
      GROUP BY h.hotel_id, h.hotel_name, rt.room_type_name,
               DATEPART(QUARTER, r.checkin_date), DATEPART(YEAR, r.checkin_date)
      ORDER BY h.hotel_name, year, quarter
    `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
