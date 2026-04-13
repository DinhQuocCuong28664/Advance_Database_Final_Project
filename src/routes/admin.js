/**
 * LuxeReserve — Admin Routes
 * Rate management (triggers Price Guard), reports (Window Functions)
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');
const { requireSystemUser } = require('../middleware/auth');

router.use(requireSystemUser);

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

// ═══════════════════════════════════════════════
// GET /api/admin/reports/revenue-by-brand
// Revenue Analytics grouped by Brand & Chain (Window Functions)
// Demonstrates: HotelChain → Brand → Hotel hierarchy utilization
// ═══════════════════════════════════════════════
router.get('/reports/revenue-by-brand', async (req, res) => {
  try {
    const pool = getSqlPool();
    const result = await pool.request().query(`
      SELECT
        hc.chain_name,
        b.brand_name,
        h.hotel_name,
        DATEPART(YEAR, r.checkin_date)      AS year,
        DATEPART(QUARTER, r.checkin_date)   AS quarter,
        COUNT(*)                            AS booking_count,
        SUM(rr.final_amount)               AS total_revenue,
        AVG(rr.nightly_rate_snapshot)       AS avg_nightly_rate,

        -- Window Functions: Ranking within Brand
        DENSE_RANK() OVER (
          PARTITION BY b.brand_id
          ORDER BY SUM(rr.final_amount) DESC
        ) AS revenue_rank_in_brand,

        -- Window Functions: Cumulative revenue per Brand over time
        SUM(SUM(rr.final_amount)) OVER (
          PARTITION BY b.brand_id
          ORDER BY DATEPART(YEAR, r.checkin_date), DATEPART(QUARTER, r.checkin_date)
        ) AS cumulative_brand_revenue,

        -- Window Functions: Revenue share % within the entire Chain
        SUM(rr.final_amount) * 100.0 / NULLIF(SUM(SUM(rr.final_amount)) OVER (PARTITION BY hc.chain_id), 0)
          AS revenue_share_in_chain_pct,

        -- Window Functions: Revenue share % within Brand
        SUM(rr.final_amount) * 100.0 / NULLIF(SUM(SUM(rr.final_amount)) OVER (PARTITION BY b.brand_id), 0)
          AS revenue_share_in_brand_pct

      FROM Reservation r
      JOIN ReservationRoom rr ON r.reservation_id = rr.reservation_id
      JOIN Hotel h ON r.hotel_id = h.hotel_id
      JOIN Brand b ON h.brand_id = b.brand_id
      JOIN HotelChain hc ON b.chain_id = hc.chain_id
      JOIN RoomType rt ON rr.room_type_id = rt.room_type_id
      WHERE r.reservation_status NOT IN ('CANCELLED', 'NO_SHOW')
      GROUP BY hc.chain_id, hc.chain_name, b.brand_id, b.brand_name,
               h.hotel_id, h.hotel_name,
               DATEPART(YEAR, r.checkin_date), DATEPART(QUARTER, r.checkin_date)
      ORDER BY hc.chain_name, b.brand_name, year, quarter
    `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════
// PUT /api/admin/availability/:id — Optimistic Locking
// Update room availability with version check
// Uses version_no column for conflict detection
// ═══════════════════════════════════════════════
router.put('/availability/:id', async (req, res) => {
  try {
    const pool = getSqlPool();
    const availId = parseInt(req.params.id);
    const { availability_status, expected_version, inventory_note } = req.body;

    if (isNaN(availId)) {
      return res.status(400).json({ success: false, error: 'Invalid availability ID' });
    }
    if (!availability_status) {
      return res.status(400).json({ success: false, error: 'availability_status is required' });
    }
    if (expected_version === undefined || expected_version === null) {
      return res.status(400).json({
        success: false,
        error: 'expected_version is required for Optimistic Locking. Get current version from GET /api/rooms/availability first.'
      });
    }

    // ═══════════════════════════════════════════
    // OPTIMISTIC LOCKING pattern:
    // UPDATE ... WHERE id = @id AND version_no = @expectedVersion
    // If rowsAffected = 0 → someone else modified it → CONFLICT
    // ═══════════════════════════════════════════
    const result = await pool.request()
      .input('id', sql.BigInt, availId)
      .input('status', sql.VarChar(10), availability_status)
      .input('version', sql.Int, expected_version)
      .input('note', sql.NVarChar(255), inventory_note || null)
      .query(`
        UPDATE RoomAvailability
        SET availability_status = @status,
            sellable_flag = CASE WHEN @status = 'OPEN' THEN 1 ELSE 0 END,
            version_no = version_no + 1,
            inventory_note = @note,
            updated_at = GETDATE()
        OUTPUT INSERTED.availability_id, INSERTED.room_id, INSERTED.stay_date,
               INSERTED.availability_status, INSERTED.version_no AS new_version,
               DELETED.version_no AS old_version
        WHERE availability_id = @id
          AND version_no = @version
      `);

    if (result.recordset.length === 0) {
      // Conflict detected — get current version to help client
      const current = await pool.request()
        .input('id', sql.BigInt, availId)
        .query('SELECT availability_id, availability_status, version_no FROM RoomAvailability WHERE availability_id = @id');

      if (current.recordset.length === 0) {
        return res.status(404).json({ success: false, error: 'Availability record not found' });
      }

      return res.status(409).json({
        success: false,
        error: 'OPTIMISTIC LOCK CONFLICT: This record was modified by another user since you last read it. Please re-read and retry.',
        your_expected_version: expected_version,
        current_version: current.recordset[0].version_no,
        current_status: current.recordset[0].availability_status
      });
    }

    const updated = result.recordset[0];
    res.json({
      success: true,
      message: 'Updated with Optimistic Locking',
      data: {
        availability_id: updated.availability_id,
        room_id: updated.room_id,
        stay_date: updated.stay_date,
        availability_status: updated.availability_status,
        old_version: updated.old_version,
        new_version: updated.new_version
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
