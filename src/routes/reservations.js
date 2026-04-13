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

    // [FIX] TC_EDGE_002: Validate checkout_date > checkin_date to prevent negative nights/money
    const parsedCheckin = new Date(checkin_date);
    const parsedCheckout = new Date(checkout_date);
    if (isNaN(parsedCheckin.getTime()) || isNaN(parsedCheckout.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date format for checkin_date or checkout_date' });
    }
    if (parsedCheckout <= parsedCheckin) {
      return res.status(400).json({ success: false, error: 'checkout_date must be after checkin_date' });
    }

    const checkin = new Date(checkin_date);
    const checkout = new Date(checkout_date);
    const nightCount = nights || Math.round((checkout - checkin) / (1000 * 60 * 60 * 24));
    const reservationTotal = (nightly_rate || 0) * nightCount;
    const requiresDeposit = guarantee_type === 'DEPOSIT';
    const depositAmount = requiresDeposit ? Math.round(reservationTotal * 0.3 * 100) / 100 : 0;

    const pool = getSqlPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const reservationCode = `RES-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // ═══════════════════════════════════
      // STEP 1: Call sp_ReserveRoom for EACH night (Pessimistic Lock)
      // ═══════════════════════════════════
      // [FIX] TC_BND_001: Limit max nights to prevent Pessimistic Lock timeout
      const MAX_NIGHTS = 90;
      if (nightCount <= 0 || nightCount > MAX_NIGHTS) {
        await transaction.rollback();
        return res.status(400).json({ success: false, error: `Invalid stay duration. Must be 1-${MAX_NIGHTS} nights. Got: ${nightCount}` });
      }

      for (let i = 0; i < nightCount; i++) {
        const stayDate = new Date(checkin);
        stayDate.setDate(stayDate.getDate() + i);
        const dateStr = stayDate.toISOString().slice(0, 10);
        const lockRequest = new sql.Request(transaction);
        const lockResult = await lockRequest
          .input('roomId', sql.BigInt, room_id)
          .input('stayDate', sql.VarChar(10), dateStr)
          .query(`
            SELECT availability_status
            FROM RoomAvailability WITH (UPDLOCK, HOLDLOCK)
            WHERE room_id = @roomId AND stay_date = @stayDate
          `);

        if (lockResult.recordset.length === 0) {
          await transaction.rollback();
          return res.status(409).json({
            success: false,
            error: `Booking failed: NOT_FOUND: No inventory record for room_id=${room_id}, date=${dateStr}`,
            failed_date: dateStr,
          });
        }

        const currentStatus = lockResult.recordset[0].availability_status;
        if (currentStatus !== 'OPEN') {
          await transaction.rollback();
          return res.status(409).json({
            success: false,
            error: `Booking failed: REJECTED: Room not available. Current status: ${currentStatus}`,
            failed_date: dateStr,
          });
        }

        await new sql.Request(transaction)
          .input('roomId', sql.BigInt, room_id)
          .input('stayDate', sql.VarChar(10), dateStr)
          .input('reservationCode', sql.VarChar(50), reservationCode)
          .query(`
            UPDATE RoomAvailability
            SET availability_status = 'BOOKED',
                sellable_flag = 0,
                version_no = version_no + 1,
                inventory_note = N'Reserved by API booking: ' + @reservationCode,
                updated_at = GETDATE()
            WHERE room_id = @roomId AND stay_date = @stayDate
          `);

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
        .input('subtotal', sql.Decimal(18, 2), reservationTotal)
        .input('total', sql.Decimal(18, 2), reservationTotal)
        .input('depositRequired', sql.Bit, requiresDeposit ? 1 : 0)
        .input('depositAmount', sql.Decimal(18, 2), depositAmount)
        .input('guarantee', sql.VarChar(20), guarantee_type || 'CARD')
        .input('purpose', sql.VarChar(15), purpose_of_stay || 'LEISURE')
        .input('special', sql.NVarChar(sql.MAX), special_request_text || null)
        .query(`
          INSERT INTO Reservation (
            reservation_code, hotel_id, guest_id, booking_channel_id, booking_source,
            reservation_status, checkin_date, checkout_date, nights,
            adult_count, child_count, room_count, currency_code,
            subtotal_amount, grand_total_amount, deposit_required_flag, deposit_amount,
            guarantee_type, purpose_of_stay, special_request_text
          )
          OUTPUT INSERTED.reservation_id, INSERTED.reservation_code, INSERTED.reservation_status
          VALUES (
            @code, @hotel_id, @guest_id, @channel_id, @source,
            'CONFIRMED', @checkin, @checkout, @nights,
            @adults, @children, 1, @currency,
            @subtotal, @total, @depositRequired, @depositAmount, @guarantee, @purpose, @special
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
        .input('subtotal', sql.Decimal(18, 2), reservationTotal)
        .input('final', sql.Decimal(18, 2), reservationTotal)
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
          total: reservationTotal,
          deposit_required: requiresDeposit,
          deposit_amount: depositAmount,
        },
      });
    } catch (innerErr) {
      try { await transaction.rollback(); } catch (_) { /* transaction already aborted by SQL Server */ }
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
      try { await transaction.rollback(); } catch (_) { /* transaction already aborted by SQL Server */ }
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
      try { await transaction.rollback(); } catch (_) { /* transaction already aborted by SQL Server */ }
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/reservations/:id/guest-cancel
// Guest initiates cancellation → FORFEIT DEPOSIT (no refund)
// ═══════════════════════════════════════════════════════════
router.post('/:id/guest-cancel', async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(resvId)) {
      return res.status(400).json({ success: false, error: 'Invalid reservation ID' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // STEP 1: Validate reservation is cancellable (only CONFIRMED allowed)
      const req1 = new sql.Request(transaction);
      const resvCheck = await req1.input('id', sql.BigInt, resvId).query(`
        SELECT reservation_id, reservation_status, reservation_code, hotel_id,
               checkin_date, checkout_date, nights, deposit_amount,
               grand_total_amount
        FROM Reservation WHERE reservation_id = @id
      `);

      if (resvCheck.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, error: 'Reservation not found' });
      }

      const resv = resvCheck.recordset[0];

      if (resv.reservation_status !== 'CONFIRMED') {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          error: `Cannot cancel: reservation is ${resv.reservation_status}. Only CONFIRMED reservations can be guest-cancelled.`
        });
      }

      // STEP 2: Update reservation → CANCELLED
      const req2 = new sql.Request(transaction);
      await req2.input('id', sql.BigInt, resvId).query(`
        UPDATE Reservation
        SET reservation_status = 'CANCELLED', updated_at = GETDATE()
        WHERE reservation_id = @id
      `);

      // STEP 3: Release RoomAvailability → OPEN
      const req3 = new sql.Request(transaction);
      await req3.input('id', sql.BigInt, resvId).query(`
        UPDATE RoomAvailability
        SET availability_status = 'OPEN', sellable_flag = 1,
            version_no = version_no + 1,
            inventory_note = N'Released by guest cancellation',
            updated_at = GETDATE()
        WHERE room_id IN (SELECT room_id FROM ReservationRoom WHERE reservation_id = @id)
          AND stay_date >= (SELECT checkin_date FROM Reservation WHERE reservation_id = @id)
          AND stay_date <  (SELECT checkout_date FROM Reservation WHERE reservation_id = @id)
          AND availability_status = 'BOOKED'
      `);

      // STEP 4: Update Room status
      const req4 = new sql.Request(transaction);
      await req4.input('id', sql.BigInt, resvId).query(`
        UPDATE Room SET room_status = 'AVAILABLE', updated_at = GETDATE()
        WHERE room_id IN (SELECT room_id FROM ReservationRoom WHERE reservation_id = @id AND room_id IS NOT NULL)
      `);

      // STEP 5: Update ReservationRoom
      const req5 = new sql.Request(transaction);
      await req5.input('id', sql.BigInt, resvId).query(`
        UPDATE ReservationRoom SET occupancy_status = 'CANCELLED', updated_at = GETDATE()
        WHERE reservation_id = @id
      `);

      // STEP 6: Status history
      const req6 = new sql.Request(transaction);
      await req6.input('id', sql.BigInt, resvId)
        .input('reason', sql.NVarChar(255), reason || 'Guest requested cancellation')
        .query(`
          INSERT INTO ReservationStatusHistory
            (reservation_id, old_status, new_status, change_reason)
          VALUES (@id, 'CONFIRMED', 'CANCELLED', @reason)
        `);

      await transaction.commit();

      // Calculate forfeited deposit
      const depositInfo = await pool.request().input('id', sql.BigInt, resvId).query(`
        SELECT ISNULL(SUM(amount), 0) AS deposit_forfeited
        FROM Payment
        WHERE reservation_id = @id AND payment_type = 'DEPOSIT'
          AND payment_status = 'CAPTURED'
      `);

      res.json({
        success: true,
        message: 'Reservation cancelled by guest. Deposit forfeited (no refund).',
        data: {
          reservation_id: resvId,
          reservation_code: resv.reservation_code,
          old_status: 'CONFIRMED',
          new_status: 'CANCELLED',
          cancelled_by: 'GUEST',
          deposit_forfeited: depositInfo.recordset[0].deposit_forfeited,
          refund_amount: 0,
          reason: reason || 'Guest requested cancellation'
        }
      });
    } catch (innerErr) {
      try { await transaction.rollback(); } catch (_) { /* transaction already aborted by SQL Server */ }
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/reservations/:id/hotel-cancel
// Hotel initiates cancellation → FULL REFUND (hotel's fault)
// ═══════════════════════════════════════════════════════════
router.post('/:id/hotel-cancel', async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    const { reason, agent_id } = req.body;

    if (isNaN(resvId)) {
      return res.status(400).json({ success: false, error: 'Invalid reservation ID' });
    }

    if (!reason) {
      return res.status(400).json({ success: false, error: 'reason is required for hotel-initiated cancellation' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // STEP 1: Validate reservation
      const req1 = new sql.Request(transaction);
      const resvCheck = await req1.input('id', sql.BigInt, resvId).query(`
        SELECT reservation_id, reservation_status, reservation_code, hotel_id,
               checkin_date, checkout_date, currency_code
        FROM Reservation WHERE reservation_id = @id
      `);

      if (resvCheck.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, error: 'Reservation not found' });
      }

      const resv = resvCheck.recordset[0];

      if (['CANCELLED', 'CHECKED_OUT', 'NO_SHOW'].includes(resv.reservation_status)) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          error: `Cannot cancel: reservation is ${resv.reservation_status}`
        });
      }

      // STEP 2: Calculate total paid (to refund)
      const req2 = new sql.Request(transaction);
      const paidResult = await req2.input('id', sql.BigInt, resvId).query(`
        SELECT ISNULL(SUM(amount), 0) AS total_paid
        FROM Payment
        WHERE reservation_id = @id AND payment_status = 'CAPTURED'
          AND payment_type <> 'REFUND'
      `);
      const totalPaid = parseFloat(paidResult.recordset[0].total_paid);

      // STEP 3: Update reservation → CANCELLED
      const req3 = new sql.Request(transaction);
      await req3.input('id', sql.BigInt, resvId).query(`
        UPDATE Reservation
        SET reservation_status = 'CANCELLED', updated_at = GETDATE()
        WHERE reservation_id = @id
      `);

      // STEP 4: Release RoomAvailability
      const req4 = new sql.Request(transaction);
      await req4.input('id', sql.BigInt, resvId).query(`
        UPDATE RoomAvailability
        SET availability_status = 'OPEN', sellable_flag = 1,
            version_no = version_no + 1,
            inventory_note = N'Released by hotel cancellation: ' + CAST(@id AS NVARCHAR),
            updated_at = GETDATE()
        WHERE room_id IN (SELECT room_id FROM ReservationRoom WHERE reservation_id = @id)
          AND stay_date >= (SELECT checkin_date FROM Reservation WHERE reservation_id = @id)
          AND stay_date <  (SELECT checkout_date FROM Reservation WHERE reservation_id = @id)
          AND availability_status = 'BOOKED'
      `);

      // STEP 5: Room + ReservationRoom status
      const req5 = new sql.Request(transaction);
      await req5.input('id', sql.BigInt, resvId).query(`
        UPDATE Room SET room_status = 'AVAILABLE', updated_at = GETDATE()
        WHERE room_id IN (SELECT room_id FROM ReservationRoom WHERE reservation_id = @id AND room_id IS NOT NULL);

        UPDATE ReservationRoom SET occupancy_status = 'CANCELLED', updated_at = GETDATE()
        WHERE reservation_id = @id;
      `);

      // STEP 6: Create REFUND payment if any amount was paid
      let refundPayment = null;
      if (totalPaid > 0) {
        const req6 = new sql.Request(transaction);
        const refundRef = `REFUND-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        const refundResult = await req6
          .input('resvId', sql.BigInt, resvId)
          .input('ref', sql.VarChar(80), refundRef)
          .input('amount', sql.Decimal(18, 2), totalPaid)
          .input('currency', sql.Char(3), resv.currency_code)
          .query(`
            INSERT INTO Payment
              (reservation_id, payment_reference, payment_type, payment_method,
               payment_status, amount, currency_code, paid_at)
            OUTPUT INSERTED.*
            VALUES (@resvId, @ref, 'REFUND', 'BANK_TRANSFER',
                    'CAPTURED', @amount, @currency, GETDATE())
          `);
        refundPayment = refundResult.recordset[0];
      }

      // STEP 7: Status history
      const req7 = new sql.Request(transaction);
      await req7.input('id', sql.BigInt, resvId)
        .input('agent', sql.BigInt, agent_id || null)
        .input('reason', sql.NVarChar(255), 'HOTEL CANCEL: ' + reason)
        .query(`
          INSERT INTO ReservationStatusHistory
            (reservation_id, old_status, new_status, changed_by, change_reason)
          VALUES (@id, '${resv.reservation_status}', 'CANCELLED', @agent, @reason)
        `);

      await transaction.commit();

      res.json({
        success: true,
        message: 'Reservation cancelled by hotel. Full refund issued.',
        data: {
          reservation_id: resvId,
          reservation_code: resv.reservation_code,
          old_status: resv.reservation_status,
          new_status: 'CANCELLED',
          cancelled_by: 'HOTEL',
          reason,
          refund_amount: totalPaid,
          refund_payment: refundPayment
        }
      });
    } catch (innerErr) {
      try { await transaction.rollback(); } catch (_) { /* transaction already aborted by SQL Server */ }
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/reservations/:id/transfer
// Room Transfer — calls sp_TransferRoom (Pessimistic Locking)
// ═══════════════════════════════════════════════════════════
router.post('/:id/transfer', async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    const { new_room_id, reason, agent_id } = req.body;

    if (isNaN(resvId)) {
      return res.status(400).json({ success: false, error: 'Invalid reservation ID' });
    }
    if (!new_room_id) {
      return res.status(400).json({ success: false, error: 'new_room_id is required' });
    }
    if (!reason) {
      return res.status(400).json({ success: false, error: 'reason is required for room transfer' });
    }

    // Validate reservation
    const resvCheck = await pool.request().input('id', sql.BigInt, resvId).query(`
      SELECT r.reservation_id, r.reservation_status, r.reservation_code,
             r.checkin_date, r.checkout_date, r.hotel_id,
             rr.room_id AS current_room_id, rr.room_type_id,
             rm.room_number AS current_room_number
      FROM Reservation r
      JOIN ReservationRoom rr ON r.reservation_id = rr.reservation_id
      JOIN Room rm ON rr.room_id = rm.room_id
      WHERE r.reservation_id = @id
    `);

    if (resvCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    const resv = resvCheck.recordset[0];

    if (!['CONFIRMED', 'CHECKED_IN'].includes(resv.reservation_status)) {
      return res.status(409).json({
        success: false,
        error: `Cannot transfer: reservation is ${resv.reservation_status}. Must be CONFIRMED or CHECKED_IN.`
      });
    }

    // Validate new room belongs to same hotel
    const newRoomCheck = await pool.request()
      .input('roomId', sql.BigInt, new_room_id)
      .input('hotelId', sql.BigInt, resv.hotel_id)
      .query(`
        SELECT room_id, room_number, room_type_id, room_status
        FROM Room
        WHERE room_id = @roomId AND hotel_id = @hotelId
      `);

    if (newRoomCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'New room not found in this hotel' });
    }

    const newRoom = newRoomCheck.recordset[0];

    // Call sp_TransferRoom (Pessimistic Locking)
    const spRequest = pool.request();
    spRequest.input('reservation_id', sql.BigInt, resvId);
    spRequest.input('old_room_id', sql.BigInt, resv.current_room_id);
    spRequest.input('new_room_id', sql.BigInt, new_room_id);
    spRequest.input('checkin_date', sql.Date, new Date(resv.checkin_date));
    spRequest.input('checkout_date', sql.Date, new Date(resv.checkout_date));
    spRequest.input('reason', sql.NVarChar(255), reason);
    spRequest.input('agent_id', sql.BigInt, agent_id || null);
    spRequest.output('result_status', sql.Int);
    spRequest.output('result_message', sql.NVarChar(500));

    const spResult = await spRequest.execute('sp_TransferRoom');
    const status = spResult.output.result_status;
    const message = spResult.output.result_message;

    if (status !== 0) {
      const httpStatus = status === 2 ? 409 : 500;
      return res.status(httpStatus).json({
        success: false,
        error: 'Room transfer failed: ' + message
      });
    }

    res.json({
      success: true,
      message: 'Room transferred successfully',
      data: {
        reservation_id: resvId,
        reservation_code: resv.reservation_code,
        old_room: {
          room_id: resv.current_room_id,
          room_number: resv.current_room_number
        },
        new_room: {
          room_id: new_room_id,
          room_number: newRoom.room_number
        },
        reason,
        sp_message: message
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
