/**
 * LuxeReserve - Admin Routes
 * Rate management (triggers Price Guard), reports (Window Functions)
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');
const { requireSystemUser, requireAdminUser, requireAdminOrManagerUser } = require('../middleware/auth');

router.use(requireSystemUser);

// PUT /api/admin/rates/:id  Update room rate (triggers Price Integrity Guard)
router.put('/rates/:id', requireAdminOrManagerUser, async (req, res) => {
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

    // Update  this will FIRE the trigger if change > 50%
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

// GET /api/admin/rates/alerts  View Price Guard alerts
router.get('/rates/alerts', requireAdminOrManagerUser, async (req, res) => {
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

// GET /api/admin/accounts  Admin account management snapshot
router.get('/accounts', requireAdminUser, async (req, res) => {
  try {
    const pool = getSqlPool();

    const [systemUsers, guestAccounts] = await Promise.all([
      pool.request().query(`
        SELECT su.user_id, su.username, su.full_name, su.email, su.department,
               sr.role_code,
               su.account_status, su.last_login_at
        FROM SystemUser su
        OUTER APPLY (
          SELECT STRING_AGG(r.role_code, ', ') AS role_code
          FROM UserRole ur
          JOIN Role r ON ur.role_id = r.role_id
          WHERE ur.user_id = su.user_id
        ) sr
        ORDER BY su.user_id
      `),
      pool.request().query(`
        SELECT ga.guest_auth_id, ga.login_email, ga.account_status, ga.last_login_at,
               g.guest_id, g.guest_code, g.full_name, g.email, g.vip_flag,
               la.tier_code, la.points_balance
        FROM GuestAuth ga
        JOIN Guest g ON ga.guest_id = g.guest_id
        LEFT JOIN LoyaltyAccount la ON ga.guest_id = la.guest_id AND la.status = 'ACTIVE'
        ORDER BY ga.guest_auth_id
      `),
    ]);

    res.json({
      success: true,
      data: {
        system_users: systemUsers.recordset,
        guest_accounts: guestAccounts.recordset,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/admin/accounts/system/:id  update system user account status
router.put('/accounts/system/:id', requireAdminUser, async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { account_status } = req.body;

    if (isNaN(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid system user ID' });
    }

    if (!['ACTIVE', 'LOCKED', 'DISABLED'].includes(account_status)) {
      return res.status(400).json({ success: false, error: 'account_status must be ACTIVE, LOCKED, or DISABLED' });
    }

    if (String(req.auth.sub) === String(userId) && account_status !== 'ACTIVE') {
      return res.status(400).json({ success: false, error: 'You cannot disable or lock the account currently in use' });
    }

    const pool = getSqlPool();
    const result = await pool.request()
      .input('id', sql.BigInt, userId)
      .input('status', sql.VarChar(10), account_status)
      .query(`
        UPDATE SystemUser
        SET account_status = @status,
            updated_at = GETDATE()
        OUTPUT INSERTED.user_id, INSERTED.username, INSERTED.full_name, INSERTED.account_status
        WHERE user_id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'System user not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/admin/accounts/guest/:id  update guest login account status
router.put('/accounts/guest/:id', requireAdminUser, async (req, res) => {
  try {
    const guestAuthId = parseInt(req.params.id, 10);
    const { account_status } = req.body;

    if (isNaN(guestAuthId)) {
      return res.status(400).json({ success: false, error: 'Invalid guest auth ID' });
    }

    if (!['ACTIVE', 'LOCKED', 'DISABLED'].includes(account_status)) {
      return res.status(400).json({ success: false, error: 'account_status must be ACTIVE, LOCKED, or DISABLED' });
    }

    const pool = getSqlPool();
    const result = await pool.request()
      .input('id', sql.BigInt, guestAuthId)
      .input('status', sql.VarChar(10), account_status)
      .query(`
        UPDATE GuestAuth
        SET account_status = @status,
            updated_at = GETDATE()
        OUTPUT INSERTED.guest_auth_id, INSERTED.login_email, INSERTED.account_status
        WHERE guest_auth_id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Guest account not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// GET /api/admin/reports/summary  Dashboard KPIs
// 
router.get('/reports/summary', requireAdminOrManagerUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const [overview, byStatus, topHotels, paymentStats] = await Promise.all([
      // Overall KPIs
      pool.request().query(`
        SELECT
          COUNT(*)                                          AS total_reservations,
          SUM(CASE WHEN reservation_status NOT IN ('CANCELLED','NO_SHOW') THEN 1 ELSE 0 END) AS active_reservations,
          COUNT(DISTINCT hotel_id)                          AS hotels_with_bookings
        FROM Reservation
      `),
      // Breakdown by status
      pool.request().query(`
        SELECT reservation_status, COUNT(*) AS count
        FROM Reservation
        GROUP BY reservation_status
        ORDER BY count DESC
      `),
      // Top 5 hotels by revenue
      pool.request().query(`
        SELECT TOP 5
          h.hotel_name,
          COUNT(r.reservation_id) AS bookings,
          SUM(rr.final_amount)    AS total_revenue
        FROM Reservation r
        JOIN ReservationRoom rr ON r.reservation_id = rr.reservation_id
        JOIN Hotel h ON r.hotel_id = h.hotel_id
        WHERE r.reservation_status NOT IN ('CANCELLED','NO_SHOW')
        GROUP BY h.hotel_id, h.hotel_name
        ORDER BY total_revenue DESC
      `),
      // Payment summary
      pool.request().query(`
        SELECT
          payment_method,
          COUNT(*)       AS count,
          SUM(amount)    AS total_amount
        FROM Payment
        WHERE payment_status = 'COMPLETED'
        GROUP BY payment_method
        ORDER BY total_amount DESC
      `),
    ]);

    res.json({
      success: true,
      data: {
        overview:      overview.recordset[0],
        by_status:     byStatus.recordset,
        top_hotels:    topHotels.recordset,
        payment_stats: paymentStats.recordset,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// GET /api/admin/reports/revenue  Revenue Intelligence (Window Functions)
router.get('/reports/revenue', requireAdminOrManagerUser, async (req, res) => {
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

// 
// GET /api/admin/reports/revenue-by-brand
// Revenue Analytics grouped by Brand & Chain (Window Functions)
// Demonstrates: HotelChain  Brand  Hotel hierarchy utilization
// 
router.get('/reports/revenue-by-brand', requireAdminOrManagerUser, async (req, res) => {
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

// 
// PUT /api/admin/availability/:id  Optimistic Locking
// Update room availability with version check
// Uses version_no column for conflict detection
// 
router.put('/availability/:id', requireAdminUser, async (req, res) => {
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

    // 
    // OPTIMISTIC LOCKING pattern:
    // UPDATE ... WHERE id = @id AND version_no = @expectedVersion
    // If rowsAffected = 0  someone else modified it  CONFLICT
    // 
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
      // Conflict detected  get current version to help client
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


// 
// GET /api/admin/rates?hotel_id=&date_from=&date_to=&room_type_id=
// List RoomRate rows for rate management UI
// 
router.get('/rates', requireAdminOrManagerUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const { hotel_id, date_from, date_to, room_type_id, limit = 300 } = req.query;

    const request = pool.request();
    const conditions = [];

    if (hotel_id) {
      request.input('hotelId', sql.BigInt, parseInt(hotel_id));
      conditions.push('h.hotel_id = @hotelId');
    }
    if (date_from) {
      request.input('dateFrom', sql.VarChar(30), date_from);
      conditions.push('rr.rate_date >= @dateFrom');
    }
    if (date_to) {
      request.input('dateTo', sql.VarChar(30), date_to);
      conditions.push('rr.rate_date <= @dateTo');
    }
    if (room_type_id) {
      request.input('roomTypeId', sql.BigInt, parseInt(room_type_id));
      conditions.push('rt.room_type_id = @roomTypeId');
    }

    request.input('limit', sql.Int, parseInt(limit));
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await request.query(`
      SELECT TOP (@limit)
        rr.room_rate_id, rr.rate_date,
        rr.base_rate, rr.final_rate,
        rr.price_source, rr.demand_level, rr.updated_at,
        CAST(CASE WHEN rr.price_source = 'MANUAL_OVERRIDE' THEN 1 ELSE 0 END AS BIT) AS is_override,
        rt.room_type_id, rt.room_type_name,
        h.hotel_id, h.hotel_name, h.currency_code,
        rp.rate_plan_code, rp.rate_plan_name,
        -- Count any RateChangeLog entries for this rate (all entries = price guard triggered)
        (SELECT COUNT(*) FROM RateChangeLog rcl
         WHERE rcl.room_rate_id = rr.room_rate_id) AS alert_count
      FROM RoomRate rr
      JOIN RoomType rt ON rr.room_type_id = rt.room_type_id
      JOIN Hotel h     ON rr.hotel_id     = h.hotel_id
      JOIN RatePlan rp ON rr.rate_plan_id = rp.rate_plan_id
      ${whereClause}
      ORDER BY rr.rate_date ASC, rt.room_type_name ASC
    `);

    // Group by room_type for easier frontend rendering
    const rates = result.recordset;
    const byRoomType = rates.reduce((acc, r) => {
      const key = r.room_type_id;
      if (!acc[key]) {
        acc[key] = {
          room_type_id: r.room_type_id,
          room_type_name: r.room_type_name,
          hotel_id: r.hotel_id,
          hotel_name: r.hotel_name,
          currency_code: r.currency_code,
          rates: [],
        };
      }
      acc[key].rates.push({
        room_rate_id: r.room_rate_id,
        rate_date: r.rate_date,
        base_rate: r.base_rate,
        final_rate: r.final_rate,
        is_override: r.is_override,
        price_source: r.price_source,
        updated_at: r.updated_at,
        alert_count: r.alert_count,
      });
      return acc;
    }, {});

    res.json({
      success: true,
      count: rates.length,
      room_types: Object.values(byRoomType),
      data: rates,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// 
// GET /api/admin/history
// Reservation Status History  audit/timeline view
// Filters: hotel_id, reservation_id, status, date_from, date_to, limit
// 
router.get('/history', requireAdminUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const {
      hotel_id, reservation_id, old_status, new_status,
      date_from, date_to, limit = 100,
    } = req.query;

    const request = pool.request();
    const conditions = [];

    if (hotel_id) {
      request.input('hotelId', sql.BigInt, parseInt(hotel_id));
      conditions.push('h.hotel_id = @hotelId');
    }
    if (reservation_id) {
      request.input('resvId', sql.BigInt, parseInt(reservation_id));
      conditions.push('rsh.reservation_id = @resvId');
    }
    if (old_status) {
      request.input('oldStatus', sql.VarChar(20), old_status.toUpperCase());
      conditions.push('rsh.old_status = @oldStatus');
    }
    if (new_status) {
      request.input('newStatus', sql.VarChar(20), new_status.toUpperCase());
      conditions.push('rsh.new_status = @newStatus');
    }
    if (date_from) {
      request.input('dateFrom', sql.VarChar(30), date_from);
      conditions.push('CAST(rsh.changed_at AS DATE) >= @dateFrom');
    }
    if (date_to) {
      request.input('dateTo', sql.VarChar(30), date_to);
      conditions.push('CAST(rsh.changed_at AS DATE) <= @dateTo');
    }

    request.input('limit', sql.Int, parseInt(limit));
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await request.query(`
      SELECT TOP (@limit)
        rsh.status_history_id AS history_id, rsh.reservation_id, rsh.old_status, rsh.new_status,
        rsh.changed_by, rsh.change_reason, rsh.changed_at,
        r.reservation_code, r.checkin_date, r.checkout_date,
        g.first_name + ' ' + g.last_name AS guest_name,
        g.email AS guest_email,
        su.full_name AS agent_name, sr.role_code,
        h.hotel_id, h.hotel_name,
        rm.room_number
      FROM ReservationStatusHistory rsh
      JOIN Reservation r         ON rsh.reservation_id = r.reservation_id
      JOIN Guest g               ON r.guest_id          = g.guest_id
      LEFT JOIN SystemUser su    ON rsh.changed_by      = su.user_id
      OUTER APPLY (
        SELECT STRING_AGG(r2.role_code, ', ') AS role_code
        FROM UserRole ur2
        JOIN Role r2 ON ur2.role_id = r2.role_id
        WHERE ur2.user_id = su.user_id
      ) sr
      LEFT JOIN ReservationRoom rr ON rr.reservation_id = r.reservation_id
      LEFT JOIN Room rm            ON rr.room_id        = rm.room_id
      LEFT JOIN Hotel h            ON rm.hotel_id       = h.hotel_id
      ${whereClause}
      ORDER BY rsh.changed_at DESC, rsh.status_history_id DESC
    `);

    // Stats summary
    const rows = result.recordset;
    const byTransition = rows.reduce((acc, r) => {
      const key = (r.old_status || 'NEW') + ' -> ' + r.new_status;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      count: rows.length,
      summary: { by_transition: byTransition },
      data: rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// GET /api/admin/operations-log
// Hotel-level reservation lifecycle log: booking created, cancelled, check-in, check-out
// 
router.get('/operations-log', requireAdminUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const { hotel_id, event_type, date_from, date_to, reservation_code, limit = 150 } = req.query;

    const request = pool.request();
    const filters = [];

    if (hotel_id) {
      request.input('hotelId', sql.BigInt, parseInt(hotel_id));
      filters.push('events.hotel_id = @hotelId');
    }
    if (event_type) {
      request.input('eventType', sql.VarChar(30), event_type.toUpperCase());
      filters.push('events.event_type = @eventType');
    }
    if (date_from) {
      request.input('dateFrom', sql.VarChar(10), String(date_from).slice(0, 10));
      filters.push('CAST(events.event_at AS DATE) >= @dateFrom');
    }
    if (date_to) {
      request.input('dateTo', sql.VarChar(10), String(date_to).slice(0, 10));
      filters.push('CAST(events.event_at AS DATE) <= @dateTo');
    }
    if (reservation_code) {
      request.input('reservationCode', sql.VarChar(50), `%${String(reservation_code).trim()}%`);
      filters.push('events.reservation_code LIKE @reservationCode');
    }

    request.input('limit', sql.Int, Math.min(parseInt(limit) || 150, 500));
    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const result = await request.query(`
      WITH events AS (
        SELECT
          r.reservation_id,
          r.reservation_code,
          r.hotel_id,
          h.hotel_name,
          g.first_name + ' ' + g.last_name AS guest_name,
          g.email AS guest_email,
          rr.room_id,
          rm.room_number,
          r.checkin_date,
          r.checkout_date,
          r.reservation_status,
          'BOOKED' AS event_type,
          r.created_at AS event_at,
          CAST('Reservation created successfully' AS NVARCHAR(255)) AS event_note,
          CAST(NULL AS NVARCHAR(255)) AS agent_name
        FROM Reservation r
        JOIN Hotel h ON r.hotel_id = h.hotel_id
        JOIN Guest g ON r.guest_id = g.guest_id
        LEFT JOIN ReservationRoom rr ON rr.reservation_id = r.reservation_id
        LEFT JOIN Room rm ON rr.room_id = rm.room_id

        UNION ALL

        SELECT
          r.reservation_id,
          r.reservation_code,
          r.hotel_id,
          h.hotel_name,
          g.first_name + ' ' + g.last_name AS guest_name,
          g.email AS guest_email,
          rr.room_id,
          rm.room_number,
          r.checkin_date,
          r.checkout_date,
          r.reservation_status,
          CASE rsh.new_status
            WHEN 'CANCELLED' THEN 'CANCELLED'
            WHEN 'CHECKED_IN' THEN 'CHECKED_IN'
            WHEN 'CHECKED_OUT' THEN 'CHECKED_OUT'
          END AS event_type,
          rsh.changed_at AS event_at,
          rsh.change_reason AS event_note,
          su.full_name AS agent_name
        FROM ReservationStatusHistory rsh
        JOIN Reservation r ON rsh.reservation_id = r.reservation_id
        JOIN Hotel h ON r.hotel_id = h.hotel_id
        JOIN Guest g ON r.guest_id = g.guest_id
        LEFT JOIN SystemUser su ON rsh.changed_by = su.user_id
        LEFT JOIN ReservationRoom rr ON rr.reservation_id = r.reservation_id
        LEFT JOIN Room rm ON rr.room_id = rm.room_id
        WHERE rsh.new_status IN ('CANCELLED', 'CHECKED_IN', 'CHECKED_OUT')
      )
      SELECT TOP (@limit) *
      FROM events
      ${whereClause}
      ORDER BY event_at DESC, reservation_id DESC
    `);

    const rows = result.recordset;
    const byEventType = rows.reduce((acc, row) => {
      acc[row.event_type] = (acc[row.event_type] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      count: rows.length,
      summary: { by_event_type: byEventType },
      data: rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// 
// GET /api/admin/channels
// BookingChannel list + reservation/revenue stats
// 
router.get('/channels', requireAdminUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const result = await pool.request().query(`
      SELECT
        bc.booking_channel_id, bc.channel_code, bc.channel_name,
        bc.channel_type, bc.commission_percent, bc.contact_email, bc.status,
        COUNT(r.reservation_id)     AS total_reservations,
        COUNT(CASE WHEN r.reservation_status NOT IN ('CANCELLED','NO_SHOW') THEN 1 END) AS active_reservations,
        SUM(rr.final_amount)        AS total_revenue,
        AVG(rr.nightly_rate_snapshot) AS avg_nightly_rate
      FROM BookingChannel bc
      LEFT JOIN Reservation r  ON bc.booking_channel_id = r.booking_channel_id
      LEFT JOIN ReservationRoom rr ON rr.reservation_id = r.reservation_id
      GROUP BY bc.booking_channel_id, bc.channel_code, bc.channel_name,
               bc.channel_type, bc.commission_percent, bc.contact_email, bc.status
      ORDER BY total_reservations DESC
    `);

    const totalRev = result.recordset.reduce((s, r) => s + (Number(r.total_revenue) || 0), 0);
    const data = result.recordset.map(r => ({
      ...r,
      revenue_share_pct: totalRev > 0
        ? ((Number(r.total_revenue) || 0) / totalRev * 100).toFixed(1)
        : '0.0',
    }));

    res.json({ success: true, count: data.length, total_revenue: totalRev, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// GET /api/admin/location-tree
// Full location hierarchy with hotel counts
// Uses Recursive CTE (from Location table)
// 
router.get('/location-tree', requireAdminUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const result = await pool.request().query(`
      WITH LocationTree AS (
        SELECT location_id, parent_location_id, location_code,
               location_name, location_type, level, iso_code, 0 AS depth
        FROM Location WHERE parent_location_id IS NULL
        UNION ALL
        SELECT c.location_id, c.parent_location_id, c.location_code,
               c.location_name, c.location_type, c.level, c.iso_code, p.depth + 1
        FROM Location c
        INNER JOIN LocationTree p ON c.parent_location_id = p.location_id
      )
      SELECT
        lt.location_id, lt.parent_location_id, lt.location_code,
        lt.location_name, lt.location_type, lt.level AS schema_level,
        lt.depth AS tree_depth, lt.iso_code,
        COUNT(h.hotel_id) AS hotel_count
      FROM LocationTree lt
      LEFT JOIN Hotel h ON h.city_location_id = lt.location_id
      GROUP BY lt.location_id, lt.parent_location_id, lt.location_code,
               lt.location_name, lt.location_type, lt.level, lt.iso_code, lt.depth
      ORDER BY lt.depth, lt.location_name
    `);

    // Build nested tree structure
    const rows = result.recordset;
    const map = {};
    rows.forEach(r => { map[r.location_id] = { ...r, children: [] }; });
    const roots = [];
    rows.forEach(r => {
      if (r.parent_location_id && map[r.parent_location_id]) {
        map[r.parent_location_id].children.push(map[r.location_id]);
      } else {
        roots.push(map[r.location_id]);
      }
    });

    res.json({ success: true, count: rows.length, data: roots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// 
// GET /api/admin/rate-plans  List rate plans (filterable by hotel)
// 
router.get('/rate-plans', requireAdminOrManagerUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const { hotel_id, status, type } = req.query;

    const request = pool.request();
    const conditions = [];

    if (hotel_id) {
      request.input('hotelId', sql.BigInt, parseInt(hotel_id, 10));
      conditions.push('rp.hotel_id = @hotelId');
    }
    if (status) {
      request.input('status', sql.VarChar(10), status.toUpperCase());
      conditions.push('rp.status = @status');
    }
    if (type) {
      request.input('type', sql.VarChar(20), type.toUpperCase());
      conditions.push('rp.rate_plan_type = @type');
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await request.query(`
      SELECT
        rp.rate_plan_id, rp.hotel_id, rp.rate_plan_code, rp.rate_plan_name,
        rp.rate_plan_type, rp.meal_inclusion, rp.is_refundable,
        rp.requires_prepayment, rp.min_advance_booking_days, rp.max_advance_booking_days,
        rp.status, rp.effective_from, rp.effective_to,
        rp.cancellation_policy_id, rp.created_at, rp.updated_at,
        h.hotel_name,
        COUNT(rr.room_rate_id) AS rate_count
      FROM RatePlan rp
      JOIN Hotel h ON rp.hotel_id = h.hotel_id
      LEFT JOIN RoomRate rr ON rr.rate_plan_id = rp.rate_plan_id
      ${where}
      GROUP BY
        rp.rate_plan_id, rp.hotel_id, rp.rate_plan_code, rp.rate_plan_name,
        rp.rate_plan_type, rp.meal_inclusion, rp.is_refundable,
        rp.requires_prepayment, rp.min_advance_booking_days, rp.max_advance_booking_days,
        rp.status, rp.effective_from, rp.effective_to,
        rp.cancellation_policy_id, rp.created_at, rp.updated_at,
        h.hotel_name
      ORDER BY h.hotel_name, rp.rate_plan_type, rp.rate_plan_name
    `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// GET /api/admin/rate-plans/:id  Get single rate plan
// 
router.get('/rate-plans/:id', requireAdminOrManagerUser, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid rate plan ID' });

    const pool = getSqlPool();
    const result = await pool.request()
      .input('id', sql.BigInt, id)
      .query(`
        SELECT rp.*, h.hotel_name,
               COUNT(rr.room_rate_id) AS rate_count
        FROM RatePlan rp
        JOIN Hotel h ON rp.hotel_id = h.hotel_id
        LEFT JOIN RoomRate rr ON rr.rate_plan_id = rp.rate_plan_id
        WHERE rp.rate_plan_id = @id
        GROUP BY rp.rate_plan_id, rp.hotel_id, rp.rate_plan_code, rp.rate_plan_name,
                 rp.rate_plan_type, rp.meal_inclusion, rp.is_refundable,
                 rp.requires_prepayment, rp.min_advance_booking_days, rp.max_advance_booking_days,
                 rp.status, rp.effective_from, rp.effective_to,
                 rp.cancellation_policy_id, rp.created_at, rp.updated_at, h.hotel_name
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Rate plan not found' });
    }
    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// POST /api/admin/rate-plans  Create a new rate plan
// 
const VALID_RATE_PLAN_TYPES = ['BAR', 'NON_REFUNDABLE', 'MEMBER', 'PACKAGE', 'CORPORATE', 'PROMO'];
const VALID_MEAL_INCLUSIONS = ['ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD', 'ALL_INCLUSIVE'];

router.post('/rate-plans', requireAdminOrManagerUser, async (req, res) => {
  try {
    const {
      hotel_id, rate_plan_code, rate_plan_name, rate_plan_type,
      meal_inclusion = 'ROOM_ONLY', is_refundable = true, requires_prepayment = false,
      min_advance_booking_days, max_advance_booking_days,
      cancellation_policy_id, effective_from, effective_to,
    } = req.body;

    // Required field validation
    if (!hotel_id || !rate_plan_code || !rate_plan_name || !rate_plan_type) {
      return res.status(400).json({
        success: false,
        error: 'hotel_id, rate_plan_code, rate_plan_name and rate_plan_type are required',
      });
    }
    if (!VALID_RATE_PLAN_TYPES.includes(rate_plan_type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `rate_plan_type must be one of: ${VALID_RATE_PLAN_TYPES.join(', ')}`,
      });
    }
    if (!VALID_MEAL_INCLUSIONS.includes(meal_inclusion.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `meal_inclusion must be one of: ${VALID_MEAL_INCLUSIONS.join(', ')}`,
      });
    }

    const pool = getSqlPool();

    // Verify hotel exists
    const hotelCheck = await pool.request()
      .input('hid', sql.BigInt, parseInt(hotel_id, 10))
      .query('SELECT hotel_id FROM Hotel WHERE hotel_id = @hid');
    if (hotelCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Hotel not found' });
    }

    const insertResult = await pool.request()
      .input('hotelId',        sql.BigInt,     parseInt(hotel_id, 10))
      .input('code',           sql.VarChar(50),  rate_plan_code.toUpperCase())
      .input('name',           sql.NVarChar(150), rate_plan_name)
      .input('type',           sql.VarChar(20),  rate_plan_type.toUpperCase())
      .input('meal',           sql.VarChar(20),  meal_inclusion.toUpperCase())
      .input('refundable',     sql.Int,          is_refundable ? 1 : 0)
      .input('prepay',         sql.Int,          requires_prepayment ? 1 : 0)
      .input('minDays',        sql.Int,          min_advance_booking_days ?? null)
      .input('maxDays',        sql.Int,          max_advance_booking_days ?? null)
      .input('policyId',       sql.BigInt,       cancellation_policy_id || null)
      .input('effectiveFrom',  sql.VarChar(30),  effective_from || new Date().toISOString().slice(0, 10))
      .input('effectiveTo',    sql.VarChar(30),  effective_to || null)
      .query(`
        INSERT INTO RatePlan
          (hotel_id, rate_plan_code, rate_plan_name, rate_plan_type, meal_inclusion,
           is_refundable, requires_prepayment, min_advance_booking_days, max_advance_booking_days,
           cancellation_policy_id, effective_from, effective_to, status)
        OUTPUT INSERTED.*
        VALUES (@hotelId, @code, @name, @type, @meal,
                IIF(@refundable=1,1,0), IIF(@prepay=1,1,0), @minDays, @maxDays,
                @policyId,
                CONVERT(DATETIME, @effectiveFrom, 120),
                CONVERT(DATETIME, @effectiveTo, 120),
                'ACTIVE')
      `);

    res.status(201).json({
      success: true,
      message: 'Rate plan created',
      data: insertResult.recordset[0],
    });
  } catch (err) {
    // Unique constraint violation (duplicate code per hotel)
    if (err.message?.includes('UQ_RatePlan_Code') || err.number === 2627) {
      return res.status(409).json({ success: false, error: 'Rate plan code already exists for this hotel' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// PUT /api/admin/rate-plans/:id  Update rate plan
// 
router.put('/rate-plans/:id', requireAdminOrManagerUser, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid rate plan ID' });

    const {
      rate_plan_name, rate_plan_type, meal_inclusion, is_refundable,
      requires_prepayment, min_advance_booking_days, max_advance_booking_days,
      cancellation_policy_id, effective_from, effective_to, status,
    } = req.body;

    // Validate enums if provided
    if (rate_plan_type && !VALID_RATE_PLAN_TYPES.includes(rate_plan_type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `rate_plan_type must be one of: ${VALID_RATE_PLAN_TYPES.join(', ')}`,
      });
    }
    if (meal_inclusion && !VALID_MEAL_INCLUSIONS.includes(meal_inclusion.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `meal_inclusion must be one of: ${VALID_MEAL_INCLUSIONS.join(', ')}`,
      });
    }
    if (status && !['ACTIVE', 'INACTIVE'].includes(status.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'status must be ACTIVE or INACTIVE' });
    }

    const pool = getSqlPool();
    const check = await pool.request()
      .input('id', sql.BigInt, id)
      .query('SELECT rate_plan_id FROM RatePlan WHERE rate_plan_id = @id');
    if (check.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Rate plan not found' });
    }

    const updateResult = await pool.request()
      .input('id',        sql.BigInt,     id)
      .input('name',      sql.NVarChar(150), rate_plan_name ?? null)
      .input('type',      sql.VarChar(20),   rate_plan_type ? rate_plan_type.toUpperCase() : null)
      .input('meal',      sql.VarChar(20),   meal_inclusion ? meal_inclusion.toUpperCase() : null)
      .input('refund',    sql.Int,           is_refundable != null ? (is_refundable ? 1 : 0) : null)
      .input('prepay',    sql.Int,           requires_prepayment != null ? (requires_prepayment ? 1 : 0) : null)
      .input('minDays',   sql.Int,           min_advance_booking_days ?? null)
      .input('maxDays',   sql.Int,           max_advance_booking_days ?? null)
      .input('policyId',  sql.BigInt,        cancellation_policy_id ?? null)
      .input('effFrom',   sql.VarChar(30),   effective_from || null)
      .input('effTo',     sql.VarChar(30),   effective_to || null)
      .input('status',    sql.VarChar(10),   status ? status.toUpperCase() : null)
      .query(`
        UPDATE RatePlan SET
          rate_plan_name           = COALESCE(@name,     rate_plan_name),
          rate_plan_type           = COALESCE(@type,     rate_plan_type),
          meal_inclusion           = COALESCE(@meal,     meal_inclusion),
          is_refundable            = COALESCE(CAST(@refund AS BIT),  is_refundable),
          requires_prepayment      = COALESCE(CAST(@prepay AS BIT), requires_prepayment),
          min_advance_booking_days = COALESCE(@minDays,  min_advance_booking_days),
          max_advance_booking_days = COALESCE(@maxDays,  max_advance_booking_days),
          cancellation_policy_id   = COALESCE(@policyId, cancellation_policy_id),
          effective_from           = COALESCE(CONVERT(DATETIME,@effFrom,120), effective_from),
          effective_to             = COALESCE(CONVERT(DATETIME,@effTo,120),   effective_to),
          status                   = COALESCE(@status,   status),
          updated_at               = GETDATE()
        OUTPUT INSERTED.*
        WHERE rate_plan_id = @id
      `);

    res.json({ success: true, message: 'Rate plan updated', data: updateResult.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// DELETE /api/admin/rate-plans/:id  Soft-delete (INACTIVE)
// 
router.delete('/rate-plans/:id', requireAdminOrManagerUser, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid rate plan ID' });

    const pool = getSqlPool();
    const check = await pool.request()
      .input('id', sql.BigInt, id)
      .query('SELECT rate_plan_id, status FROM RatePlan WHERE rate_plan_id = @id');
    if (check.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Rate plan not found' });
    }

    // Prevent deleting if it has active room rates linked
    const rateCount = await pool.request()
      .input('id', sql.BigInt, id)
      .query('SELECT COUNT(*) AS cnt FROM RoomRate WHERE rate_plan_id = @id');
    const cnt = rateCount.recordset[0].cnt;
    if (cnt > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot deactivate: rate plan has ${cnt} linked room rate(s). Remove the rates first.`,
        linked_rate_count: cnt,
      });
    }

    await pool.request()
      .input('id', sql.BigInt, id)
      .query("UPDATE RatePlan SET status='INACTIVE', updated_at=GETDATE() WHERE rate_plan_id=@id");

    res.json({ success: true, message: 'Rate plan deactivated', rate_plan_id: id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
