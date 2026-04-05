/**
 * LuxeReserve — Reservation Routes
 * Core flow: Booking with Pessimistic Locking
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');

// POST /api/reservations — Create Reservation (calls sp_ReserveRoom)
router.post('/', async (req, res) => {
  try {
    const {
      hotel_id, guest_id, room_id, room_type_id, rate_plan_id,
      booking_channel_id, booking_source,
      checkin_date, checkout_date, nights,
      adult_count, child_count, nightly_rate,
      currency_code, guarantee_type, purpose_of_stay,
      special_request_text
    } = req.body;

    // Validation
    if (!hotel_id || !guest_id || !room_id || !checkin_date || !checkout_date) {
      return res.status(400).json({ success: false, error: 'Missing required fields: hotel_id, guest_id, room_id, checkin_date, checkout_date' });
    }

    // [FIX] LOGIC-2: Validate nightly_rate is positive
    if (!nightly_rate || nightly_rate <= 0) {
      return res.status(400).json({ success: false, error: 'nightly_rate must be a positive number' });
    }

    const pool = getSqlPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);
      const reservationCode = `RES-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // ═══════════════════════════════════
      // STEP 1: Call sp_ReserveRoom for EACH night (Pessimistic Lock)
      // ═══════════════════════════════════
      const checkin = new Date(checkin_date);
      const checkout = new Date(checkout_date);
      const nightCount = nights || Math.round((checkout - checkin) / (1000 * 60 * 60 * 24));

      for (let i = 0; i < nightCount; i++) {
        const stayDate = new Date(checkin);
        stayDate.setDate(stayDate.getDate() + i);
        const dateStr = stayDate.toISOString().slice(0, 10);

        const spRequest = new sql.Request(transaction);
        spRequest.input('room_id', sql.BigInt, room_id);
        spRequest.input('stay_date', sql.VarChar(10), dateStr);
        spRequest.input('reservation_code', sql.VarChar(50), reservationCode);
        spRequest.input('session_id', sql.VarChar(100), `API-${Date.now()}`);
        spRequest.output('result_status', sql.Int);
        spRequest.output('result_message', sql.NVarChar(500));

        const spResult = await spRequest.execute('sp_ReserveRoom');
        const status = spResult.output.result_status;

        if (status !== 0) {
          await transaction.rollback();
          return res.status(409).json({
            success: false,
            error: 'Booking failed: ' + spResult.output.result_message,
            failed_date: dateStr,
          });
        }
      }

      // ═══════════════════════════════════
      // STEP 2: Create Reservation header
      // ═══════════════════════════════════
      const resvRequest = new sql.Request(transaction);
      const resvResult = await resvRequest
        .input('code', sql.VarChar(50), reservationCode)
        .input('hotel_id', sql.BigInt, hotel_id)
        .input('guest_id', sql.BigInt, guest_id)
        .input('channel_id', sql.BigInt, booking_channel_id || 1)
        .input('source', sql.VarChar(20), booking_source || 'DIRECT_WEB')
        .input('checkin', sql.VarChar(10), checkin_date)
        .input('checkout', sql.VarChar(10), checkout_date)
        .input('nights', sql.Int, nightCount)
        .input('adults', sql.Int, adult_count || 2)
        .input('children', sql.Int, child_count || 0)
        .input('currency', sql.Char(3), currency_code || 'VND')
        .input('subtotal', sql.Decimal(18, 2), (nightly_rate || 0) * nightCount)
        .input('total', sql.Decimal(18, 2), (nightly_rate || 0) * nightCount)
        .input('guarantee', sql.VarChar(20), guarantee_type || 'CARD')
        .input('purpose', sql.VarChar(15), purpose_of_stay || 'LEISURE')
        .input('special', sql.NVarChar(sql.MAX), special_request_text || null)
        .query(`
          INSERT INTO Reservation (
            reservation_code, hotel_id, guest_id, booking_channel_id, booking_source,
            reservation_status, checkin_date, checkout_date, nights,
            adult_count, child_count, room_count, currency_code,
            subtotal_amount, grand_total_amount, guarantee_type, purpose_of_stay, special_request_text
          )
          OUTPUT INSERTED.reservation_id, INSERTED.reservation_code, INSERTED.reservation_status
          VALUES (
            @code, @hotel_id, @guest_id, @channel_id, @source,
            'CONFIRMED', @checkin, @checkout, @nights,
            @adults, @children, 1, @currency,
            @subtotal, @total, @guarantee, @purpose, @special
          )
        `);

      const reservation = resvResult.recordset[0];

      // ═══════════════════════════════════
      // STEP 3: Create ReservationRoom line item
      // ═══════════════════════════════════
      const rrRequest = new sql.Request(transaction);
      await rrRequest
        .input('resv_id', sql.BigInt, reservation.reservation_id)
        .input('room_id', sql.BigInt, room_id)
        .input('rt_id', sql.BigInt, room_type_id || 1)
        .input('rp_id', sql.BigInt, rate_plan_id || 1)
        .input('start', sql.VarChar(10), checkin_date)
        .input('end', sql.VarChar(10), checkout_date)
        .input('adults', sql.Int, adult_count || 2)
        .input('rate', sql.Decimal(18, 2), nightly_rate || 0)
        .input('subtotal', sql.Decimal(18, 2), (nightly_rate || 0) * nightCount)
        .input('final', sql.Decimal(18, 2), (nightly_rate || 0) * nightCount)
        .query(`
          INSERT INTO ReservationRoom (
            reservation_id, room_id, room_type_id, rate_plan_id,
            stay_start_date, stay_end_date, adult_count,
            nightly_rate_snapshot, room_subtotal, final_amount,
            assignment_status, occupancy_status
          )
          VALUES (
            @resv_id, @room_id, @rt_id, @rp_id,
            @start, @end, @adults,
            @rate, @subtotal, @final,
            'ASSIGNED', 'RESERVED'
          )
        `);

      // ═══════════════════════════════════
      // STEP 4: Status history
      // ═══════════════════════════════════
      const histRequest = new sql.Request(transaction);
      await histRequest
        .input('resv_id', sql.BigInt, reservation.reservation_id)
        .query(`
          INSERT INTO ReservationStatusHistory (reservation_id, old_status, new_status, change_reason)
          VALUES (@resv_id, NULL, 'CONFIRMED', 'Reservation created via API — rooms locked successfully')
        `);

      await transaction.commit();

      res.status(201).json({
        success: true,
        data: {
          reservation_id: reservation.reservation_id,
          reservation_code: reservation.reservation_code,
          status: 'CONFIRMED',
          hotel_id,
          room_id,
          checkin_date,
          checkout_date,
          nights: nightCount,
          total: (nightly_rate || 0) * nightCount,
        },
      });
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reservations/:code — Get by reservation code
router.get('/:code', async (req, res) => {
  try {
    const pool = getSqlPool();
    const code = req.params.code;

    const result = await pool.request()
      .input('code', sql.VarChar(50), code)
      .query(`
        SELECT v.*, g.full_name AS guest_name, g.email AS guest_email,
               h.hotel_name, h.currency_code AS hotel_currency
        FROM vw_ReservationTotal v
        JOIN Guest g ON v.guest_id = g.guest_id
        JOIN Hotel h ON v.hotel_id = h.hotel_id
        WHERE v.reservation_code = @code
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    // Get rooms
    const rooms = await pool.request()
      .input('resvId', sql.BigInt, result.recordset[0].reservation_id)
      .query(`
        SELECT rr.*, rt.room_type_name, r.room_number, r.floor_number
        FROM ReservationRoom rr
        JOIN RoomType rt ON rr.room_type_id = rt.room_type_id
        LEFT JOIN Room r ON rr.room_id = r.room_id
        WHERE rr.reservation_id = @resvId
      `);

    // Get status history
    const history = await pool.request()
      .input('resvId', sql.BigInt, result.recordset[0].reservation_id)
      .query(`
        SELECT rsh.*, su.full_name AS changed_by_name
        FROM ReservationStatusHistory rsh
        LEFT JOIN SystemUser su ON rsh.changed_by = su.user_id
        WHERE rsh.reservation_id = @resvId
        ORDER BY rsh.changed_at
      `);

    res.json({
      success: true,
      data: {
        ...result.recordset[0],
        rooms: rooms.recordset,
        status_history: history.recordset,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/reservations/:id/checkin — Check-in
router.post('/:id/checkin', async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    const { agent_id } = req.body;

    // [FIX] BUG-3: Validate parsed ID
    if (isNaN(resvId)) {
      return res.status(400).json({ success: false, error: 'Invalid reservation ID' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Update reservation status
      const reqUpdate = new sql.Request(transaction);
      const updateResult = await reqUpdate.input('id', sql.BigInt, resvId)
        .query(`UPDATE Reservation SET reservation_status = 'CHECKED_IN', updated_at = GETDATE() WHERE reservation_id = @id AND reservation_status = 'CONFIRMED'`);

      // [FIX] BUG-1: Check rowsAffected — reject if reservation not in CONFIRMED status
      if (updateResult.rowsAffected[0] === 0) {
        await transaction.rollback();
        return res.status(409).json({ success: false, error: 'Check-in failed: Reservation not found or not in CONFIRMED status' });
      }

      // Update room occupancy
      const reqRoom = new sql.Request(transaction);
      await reqRoom.input('id', sql.BigInt, resvId)
        .query(`UPDATE ReservationRoom SET occupancy_status = 'IN_HOUSE', updated_at = GETDATE() WHERE reservation_id = @id`);

      // Update physical room status
      const reqPhysical = new sql.Request(transaction);
      await reqPhysical.input('id', sql.BigInt, resvId)
        .query(`
          UPDATE Room SET room_status = 'OCCUPIED', updated_at = GETDATE()
          WHERE room_id IN (SELECT room_id FROM ReservationRoom WHERE reservation_id = @id AND room_id IS NOT NULL)
        `);

      // Create StayRecord
      const reqStay = new sql.Request(transaction);
      await reqStay.input('id', sql.BigInt, resvId)
        .input('agent', sql.BigInt, agent_id || null)
        .query(`
          INSERT INTO StayRecord (reservation_room_id, actual_checkin_at, frontdesk_agent_id, stay_status)
          SELECT reservation_room_id, GETDATE(), @agent, 'IN_HOUSE'
          FROM ReservationRoom WHERE reservation_id = @id
        `);

      // Status history
      const reqHist = new sql.Request(transaction);
      await reqHist.input('id', sql.BigInt, resvId)
        .input('agent', sql.BigInt, agent_id || null)
        .query(`INSERT INTO ReservationStatusHistory (reservation_id, old_status, new_status, changed_by, change_reason) VALUES (@id, 'CONFIRMED', 'CHECKED_IN', @agent, 'Guest checked in')`);

      await transaction.commit();
      res.json({ success: true, message: 'Check-in successful', reservation_id: resvId });
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/reservations/:id/checkout — Check-out
router.post('/:id/checkout', async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    const { agent_id } = req.body;

    // [FIX] BUG-3: Validate parsed ID
    if (isNaN(resvId)) {
      return res.status(400).json({ success: false, error: 'Invalid reservation ID' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // [FIX] BUG-2: Add WHERE status = 'CHECKED_IN' guard
      const req1 = new sql.Request(transaction);
      const updateResult = await req1.input('id', sql.BigInt, resvId)
        .query(`UPDATE Reservation SET reservation_status = 'CHECKED_OUT', updated_at = GETDATE() WHERE reservation_id = @id AND reservation_status = 'CHECKED_IN'`);

      // [FIX] BUG-2: Check rowsAffected
      if (updateResult.rowsAffected[0] === 0) {
        await transaction.rollback();
        return res.status(409).json({ success: false, error: 'Check-out failed: Reservation not found or not in CHECKED_IN status' });
      }

      // Update occupancy
      const req2 = new sql.Request(transaction);
      await req2.input('id', sql.BigInt, resvId)
        .query(`UPDATE ReservationRoom SET occupancy_status = 'COMPLETED', updated_at = GETDATE() WHERE reservation_id = @id`);

      // Release rooms
      const req3 = new sql.Request(transaction);
      await req3.input('id', sql.BigInt, resvId)
        .query(`
          UPDATE Room SET room_status = 'AVAILABLE', housekeeping_status = 'DIRTY', updated_at = GETDATE()
          WHERE room_id IN (SELECT room_id FROM ReservationRoom WHERE reservation_id = @id AND room_id IS NOT NULL)
        `);

      // Update StayRecord
      const req4 = new sql.Request(transaction);
      await req4.input('id', sql.BigInt, resvId)
        .query(`
          UPDATE StayRecord SET actual_checkout_at = GETDATE(), stay_status = 'COMPLETED', updated_at = GETDATE()
          WHERE reservation_room_id IN (SELECT reservation_room_id FROM ReservationRoom WHERE reservation_id = @id)
        `);

      // Create housekeeping task
      const req5 = new sql.Request(transaction);
      await req5.input('id', sql.BigInt, resvId)
        .query(`
          INSERT INTO HousekeepingTask (hotel_id, room_id, task_type, task_status, priority_level)
          SELECT r.hotel_id, r.room_id, 'CLEANING', 'OPEN', 'HIGH'
          FROM ReservationRoom rr
          JOIN Room r ON rr.room_id = r.room_id
          WHERE rr.reservation_id = @id AND rr.room_id IS NOT NULL
        `);

      // History
      const req6 = new sql.Request(transaction);
      await req6.input('id', sql.BigInt, resvId)
        .input('agent', sql.BigInt, agent_id || null)
        .query(`INSERT INTO ReservationStatusHistory (reservation_id, old_status, new_status, changed_by, change_reason) VALUES (@id, 'CHECKED_IN', 'CHECKED_OUT', @agent, 'Guest checked out')`);

      await transaction.commit();

      // [FIX] BUG-4: Query balance AFTER commit to avoid deadlock on vw_ReservationTotal
      const balanceReq = pool.request().input('id', sql.BigInt, resvId);
      const balance = await balanceReq.query(`SELECT grand_total, total_paid, balance_due FROM vw_ReservationTotal WHERE reservation_id = @id`);

      res.json({
        success: true,
        message: 'Check-out successful',
        reservation_id: resvId,
        financials: balance.recordset[0] || null,
      });
    } catch (innerErr) {
      await transaction.rollback();
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
