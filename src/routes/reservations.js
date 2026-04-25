/**
 * LuxeReserve  Reservation Routes
 * Core flow: Booking with Pessimistic Locking
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');
const { sendBookingConfirmation, sendCancellationNotice, sendCheckinReminder } = require('../services/mail');
const { requireAuth } = require('../middleware/auth');

async function generateGuestCode(pool) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `G-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const exists = await pool.request()
      .input('guestCode', sql.VarChar(50), candidate)
      .query('SELECT guest_id FROM Guest WHERE guest_code = @guestCode');

    if (exists.recordset.length === 0) {
      return candidate;
    }
  }

  throw new Error('Unable to generate unique guest code');
}

// POST /api/reservations  Create Reservation (calls sp_ReserveRoom)
router.post('/', async (req, res) => {
  try {
    const {
      hotel_id, guest_id, guest_profile, room_id, room_type_id, rate_plan_id,
      booking_channel_id, booking_source,
      checkin_date, checkout_date, nights,
      adult_count, child_count, nightly_rate,
      currency_code, guarantee_type, purpose_of_stay, booking_email_otp,
      special_request_text
    } = req.body;

    // Validation
    if (!hotel_id || !room_id || !checkin_date || !checkout_date) {
      return res.status(400).json({ success: false, error: 'Missing required fields: hotel_id, room_id, checkin_date, checkout_date' });
    }

    if (!guest_id) {
      const firstName = String(guest_profile?.first_name || '').trim();
      const lastName = String(guest_profile?.last_name || '').trim();
      const email = String(guest_profile?.email || '').trim();
      if (!firstName || !lastName || !email) {
        return res.status(400).json({
          success: false,
          error: 'Provide guest_id or guest_profile with first_name, last_name, and email',
        });
      }
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
      let resolvedGuestId = guest_id ? Number(guest_id) : null;
      const reservationCode = `RES-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // 
      // STEP 1: Call sp_ReserveRoom for EACH night (Pessimistic Lock)
      // 
      // [FIX] TC_BND_001: Limit max nights to prevent Pessimistic Lock timeout
      const MAX_NIGHTS = 90;
      if (nightCount <= 0 || nightCount > MAX_NIGHTS) {
        await transaction.rollback();
        return res.status(400).json({ success: false, error: `Invalid stay duration. Must be 1-${MAX_NIGHTS} nights. Got: ${nightCount}` });
      }

      if (resolvedGuestId) {
        const existingGuest = await new sql.Request(transaction)
          .input('guestId', sql.BigInt, resolvedGuestId)
          .query('SELECT guest_id FROM Guest WHERE guest_id = @guestId');

        if (existingGuest.recordset.length === 0) {
          await transaction.rollback();
          return res.status(404).json({ success: false, error: 'Guest not found' });
        }

        if (guest_profile) {
          await new sql.Request(transaction)
            .input('guestId', sql.BigInt, resolvedGuestId)
            .input('firstName', sql.NVarChar(100), String(guest_profile.first_name || '').trim() || null)
            .input('lastName', sql.NVarChar(100), String(guest_profile.last_name || '').trim() || null)
            .input('email', sql.VarChar(150), String(guest_profile.email || '').trim() || null)
            .input('phoneCountryCode', sql.VarChar(10), guest_profile.phone_country_code || null)
            .input('phoneNumber', sql.VarChar(30), guest_profile.phone_number || null)
            .query(`
              UPDATE Guest
              SET first_name = COALESCE(@firstName, first_name),
                  last_name = COALESCE(@lastName, last_name),
                  email = COALESCE(@email, email),
                  phone_country_code = @phoneCountryCode,
                  phone_number = @phoneNumber,
                  updated_at = GETDATE()
              WHERE guest_id = @guestId
            `);
        }
      } else {
        const existingGuestAuth = await new sql.Request(transaction)
          .input('loginEmail', sql.VarChar(150), String(guest_profile.email).trim())
          .query(`
            SELECT TOP 1 guest_auth_id, guest_id, account_status, email_verified_at
            FROM GuestAuth
            WHERE login_email = @loginEmail
          `);

        if (existingGuestAuth.recordset.length > 0) {
          const account = existingGuestAuth.recordset[0];

          if (!booking_email_otp) {
            await transaction.rollback();
            return res.status(409).json({
              success: false,
              error: 'This email already exists in the system. Enter the verification code sent to that email to continue this booking.',
            });
          }

          const otpMatch = await new sql.Request(transaction)
            .input('guestAuthId', sql.BigInt, account.guest_auth_id)
            .input('otpCode', sql.VarChar(10), String(booking_email_otp).trim())
            .query(`
              SELECT TOP 1 email_otp_id
              FROM EmailVerificationOtp
              WHERE guest_auth_id = @guestAuthId
                AND otp_code = @otpCode
                AND purpose = 'BOOKING_ACCESS'
                AND consumed_at IS NULL
                AND expires_at >= GETDATE()
              ORDER BY created_at DESC
            `);

          if (otpMatch.recordset.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
              success: false,
              error: 'Invalid or expired booking verification code.',
            });
          }

          await new sql.Request(transaction)
            .input('otpId', sql.BigInt, otpMatch.recordset[0].email_otp_id)
            .query(`
              UPDATE EmailVerificationOtp
              SET consumed_at = GETDATE()
              WHERE email_otp_id = @otpId
            `);

          resolvedGuestId = account.guest_id;

          await new sql.Request(transaction)
            .input('guestId', sql.BigInt, resolvedGuestId)
            .input('firstName', sql.NVarChar(100), String(guest_profile.first_name || '').trim() || null)
            .input('lastName', sql.NVarChar(100), String(guest_profile.last_name || '').trim() || null)
            .input('email', sql.VarChar(150), String(guest_profile.email || '').trim() || null)
            .input('phoneCountryCode', sql.VarChar(10), guest_profile.phone_country_code || null)
            .input('phoneNumber', sql.VarChar(30), guest_profile.phone_number || null)
            .query(`
              UPDATE Guest
              SET first_name = COALESCE(@firstName, first_name),
                  last_name = COALESCE(@lastName, last_name),
                  email = COALESCE(@email, email),
                  phone_country_code = @phoneCountryCode,
                  phone_number = @phoneNumber,
                  updated_at = GETDATE()
              WHERE guest_id = @guestId
            `);
        } else {
          const guestCode = await generateGuestCode(pool);
          const createdGuest = await new sql.Request(transaction)
            .input('guestCode', sql.VarChar(50), guestCode)
            .input('firstName', sql.NVarChar(100), String(guest_profile.first_name).trim())
            .input('lastName', sql.NVarChar(100), String(guest_profile.last_name).trim())
            .input('email', sql.VarChar(150), String(guest_profile.email).trim())
            .input('phoneCountryCode', sql.VarChar(10), guest_profile.phone_country_code || null)
            .input('phoneNumber', sql.VarChar(30), guest_profile.phone_number || null)
            .query(`
              INSERT INTO Guest (
                guest_code, first_name, last_name, email, phone_country_code, phone_number
              )
              OUTPUT INSERTED.guest_id
              VALUES (
                @guestCode, @firstName, @lastName, @email, @phoneCountryCode, @phoneNumber
              )
            `);

          resolvedGuestId = createdGuest.recordset[0].guest_id;
        }
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

      // 
      // STEP 2: Create Reservation header
      // 
      const resvRequest = new sql.Request(transaction);
      const resvResult = await resvRequest
        .input('code', sql.VarChar(50), reservationCode)
        .input('hotel_id', sql.BigInt, hotel_id)
        .input('guest_id', sql.BigInt, resolvedGuestId)
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

      // 
      // STEP 3: Create ReservationRoom line item
      // 
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

      // 
      // STEP 4: Status history
      // 
      const histRequest = new sql.Request(transaction);
      await histRequest
        .input('resv_id', sql.BigInt, reservation.reservation_id)
        .query(`
          INSERT INTO ReservationStatusHistory (reservation_id, old_status, new_status, change_reason)
          VALUES (@resv_id, NULL, 'CONFIRMED', 'Reservation created via API  rooms locked successfully')
        `);

      await transaction.commit();

      const responseData = {
        reservation_id: reservation.reservation_id,
        reservation_code: reservation.reservation_code,
        status: 'CONFIRMED',
        hotel_id,
        room_id,
        checkin_date,
        checkout_date,
        nights: nightCount,
        total: reservationTotal,
        grand_total_amount: reservationTotal,
        deposit_required: requiresDeposit,
        deposit_amount: depositAmount,
        guest_id: resolvedGuestId,
      };

      res.status(201).json({ success: true, data: responseData });

      //  Fire-and-forget: booking confirmation email 
      try {
        const guestEmail = guest_profile?.email ||
          (resolvedGuestId
            ? (await getSqlPool().request()
                .input('gid', sql.BigInt, resolvedGuestId)
                .query('SELECT email, first_name, last_name FROM Guest WHERE guest_id = @gid')
              ).recordset[0]?.email
            : null);

        const guestName = [
          guest_profile?.first_name,
          guest_profile?.last_name,
        ].filter(Boolean).join(' ') || 'Guest';

        // Fetch hotel name for email
        const hotelRow = await getSqlPool().request()
          .input('hid', sql.BigInt, hotel_id)
          .query('SELECT hotel_name FROM Hotel WHERE hotel_id = @hid');
        const hotelName = hotelRow.recordset[0]?.hotel_name || 'Your Hotel';

        if (guestEmail) {
          sendBookingConfirmation({
            to: guestEmail,
            fullName: guestName,
            reservation: {
              ...responseData,
              hotel_name: hotelName,
              currency_code: currency_code || 'VND',
              special_request_text,
            },
          });
        }
      } catch (mailErr) {
        console.error('[Mail] Booking confirmation error:', mailErr.message);
      }

    } catch (innerErr) {
      try { await transaction.rollback(); } catch (_) { /* transaction already aborted by SQL Server */ }
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// GET /api/reservations  List reservations
// Query params: guest_id, email, status, limit (default 20)
// 
router.get('/', async (req, res) => {
  try {
    const pool = getSqlPool();
    const {
      guest_id,
      email,
      status,
      hotel_id,
      checkin_date,
      checkout_date,
      reservation_code,
      limit = 20,
    } = req.query;

    let where = [];
    const request = pool.request();

    if (guest_id) {
      where.push('r.guest_id = @guestId');
      request.input('guestId', sql.BigInt, parseInt(guest_id));
    }
    if (email) {
      where.push('g.email = @email');
      request.input('email', sql.VarChar(150), email.toLowerCase());
    }
    if (status) {
      where.push('r.reservation_status = @status');
      request.input('status', sql.VarChar(20), status.toUpperCase());
    }
    if (hotel_id) {
      where.push('r.hotel_id = @hotelId');
      request.input('hotelId', sql.BigInt, parseInt(hotel_id, 10));
    }
    if (checkin_date) {
      where.push('CAST(r.checkin_date AS date) = @checkinDate');
      request.input('checkinDate', sql.VarChar(10), String(checkin_date).slice(0, 10));
    }
    if (checkout_date) {
      where.push('CAST(r.checkout_date AS date) = @checkoutDate');
      request.input('checkoutDate', sql.VarChar(10), String(checkout_date).slice(0, 10));
    }
    if (reservation_code) {
      where.push('r.reservation_code = @reservationCode');
      request.input('reservationCode', sql.VarChar(50), String(reservation_code).trim());
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const result = await request.query(`
      SELECT TOP (${Math.min(parseInt(limit) || 20, 100)})
        r.reservation_id, r.reservation_code, r.reservation_status,
        r.checkin_date, r.checkout_date, r.nights,
        r.adult_count, r.currency_code,
        r.grand_total_amount, r.deposit_amount, r.deposit_required_flag,
        r.guarantee_type, r.special_request_text, r.created_at,
        g.guest_id, g.guest_code,
        g.first_name + ' ' + g.last_name AS guest_name,
        g.email AS guest_email,
        h.hotel_id, h.hotel_name, h.hotel_code,
        rr.room_id, rr.nightly_rate_snapshot,
        rt.room_type_name, r2.room_number, r2.floor_number
      FROM Reservation r
      JOIN Guest g ON r.guest_id = g.guest_id
      JOIN Hotel h ON r.hotel_id = h.hotel_id
      LEFT JOIN ReservationRoom rr ON rr.reservation_id = r.reservation_id
      LEFT JOIN RoomType rt ON rr.room_type_id = rt.room_type_id
      LEFT JOIN Room r2 ON rr.room_id = r2.room_id
      ${whereClause}
      ORDER BY r.created_at DESC
    `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// GET /api/reservations/by-guest/:guestCode  By guest code
// 
router.get('/by-guest/:guestCode', async (req, res) => {
  try {
    const pool = getSqlPool();
    const { guestCode } = req.params;

    const result = await pool.request()
      .input('guestCode', sql.VarChar(50), guestCode)
      .query(`
        SELECT
          r.reservation_id, r.reservation_code, r.reservation_status,
          r.checkin_date, r.checkout_date, r.nights,
          r.adult_count, r.currency_code,
          r.grand_total_amount, r.created_at,
          h.hotel_id, h.hotel_name,
          rt.room_type_name, r2.room_number
        FROM Reservation r
        JOIN Guest g ON r.guest_id = g.guest_id
        JOIN Hotel h ON r.hotel_id = h.hotel_id
        LEFT JOIN ReservationRoom rr ON rr.reservation_id = r.reservation_id
        LEFT JOIN RoomType rt ON rr.room_type_id = rt.room_type_id
        LEFT JOIN Room r2 ON rr.room_id = r2.room_id
        WHERE g.guest_code = @guestCode
        ORDER BY r.created_at DESC
      `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/reservations/:code  Get by reservation code
router.get('/:code', async (req, res) => {
  try {
    const pool = getSqlPool();
    const code = req.params.code;

    const result = await pool.request()
      .input('code', sql.VarChar(50), code)
      .query(`
        SELECT
          v.reservation_id, v.reservation_code, v.reservation_status,
          v.checkin_date, v.checkout_date, v.nights, v.currency_code,
          v.grand_total        AS grand_total_amount,
          v.total_paid, v.balance_due,
          v.room_subtotal, v.service_subtotal,
          g.guest_id, g.full_name AS guest_name, g.email AS guest_email,
          g.first_name, g.last_name,
          h.hotel_id, h.hotel_name, h.currency_code AS hotel_currency
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

// POST /api/reservations/:id/checkin  Check-in
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

      // [FIX] BUG-1: Check rowsAffected  reject if reservation not in CONFIRMED status
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

// POST /api/reservations/:id/checkout  Check-out
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

// 
// POST /api/reservations/:id/guest-cancel
// Guest initiates cancellation  FORFEIT DEPOSIT (no refund)
// 
router.post('/:id/guest-cancel', requireAuth, async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(resvId)) {
      return res.status(400).json({ success: false, error: 'Invalid reservation ID' });
    }

    //  Auth: only the guest who owns this reservation can cancel 
    if (req.auth.user_type !== 'GUEST') {
      return res.status(403).json({ success: false, error: 'Only guests can use guest-cancel. Admins use hotel-cancel.' });
    }

    const ownerCheck = await pool.request()
      .input('resvId', sql.BigInt, resvId)
      .input('guestId', sql.BigInt, req.auth.sub)
      .query('SELECT 1 AS ok FROM Reservation WHERE reservation_id = @resvId AND guest_id = @guestId');

    if (ownerCheck.recordset.length === 0) {
      return res.status(403).json({ success: false, error: 'You are not authorised to cancel this reservation.' });
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

      // STEP 2: Update reservation  CANCELLED
      const req2 = new sql.Request(transaction);
      await req2.input('id', sql.BigInt, resvId).query(`
        UPDATE Reservation
        SET reservation_status = 'CANCELLED', updated_at = GETDATE()
        WHERE reservation_id = @id
      `);

      // STEP 3: Release RoomAvailability  OPEN
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

      //  Fire-and-forget: cancellation email 
      try {
        const guestRow = await pool.request().input('id', sql.BigInt, resvId).query(`
          SELECT g.email, g.first_name, g.last_name, h.hotel_name
          FROM Reservation r
          JOIN Guest g ON r.guest_id = g.guest_id
          JOIN Hotel h ON r.hotel_id = h.hotel_id
          WHERE r.reservation_id = @id
        `);
        const gr = guestRow.recordset[0];
        if (gr?.email) {
          sendCancellationNotice({
            to: gr.email,
            fullName: `${gr.first_name} ${gr.last_name}`.trim(),
            reservation: { ...resv, hotel_name: gr.hotel_name },
            cancelledBy: 'guest',
            reason: reason || 'Guest requested cancellation',
          });
        }
      } catch (mailErr) {
        console.error('[Mail] Cancellation email error:', mailErr.message);
      }

    } catch (innerErr) {
      try { await transaction.rollback(); } catch (_) { /* transaction already aborted by SQL Server */ }
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// POST /api/reservations/:id/hotel-cancel
// Hotel initiates cancellation  FULL REFUND (hotel's fault)
// 
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

      // STEP 3: Update reservation  CANCELLED
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

// 
// POST /api/reservations/:id/transfer
// Room Transfer  calls sp_TransferRoom (Pessimistic Locking)
// 
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


// 
// GET /api/reservations/:id/guests
// List additional guests for a reservation
// 
router.get('/:id/guests', async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    if (isNaN(resvId)) return res.status(400).json({ success: false, error: 'Invalid reservation ID' });

    const result = await pool.request()
      .input('resvId', sql.BigInt, resvId)
      .query(`
        SELECT rg.*, g.email AS linked_email, g.guest_code
        FROM ReservationGuest rg
        LEFT JOIN Guest g ON rg.guest_id = g.guest_id
        WHERE rg.reservation_id = @resvId
        ORDER BY rg.is_primary_guest DESC, rg.created_at ASC
      `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// POST /api/reservations/:id/guests
// Add an additional guest to a reservation
// Body: full_name, age_category, nationality_country_code, document_type, document_no, special_note
// 
router.post('/:id/guests', async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    if (isNaN(resvId)) return res.status(400).json({ success: false, error: 'Invalid reservation ID' });

    const {
      full_name, age_category = 'ADULT',
      nationality_country_code = null,
      document_type = null, document_no = null,
      special_note = null,
    } = req.body;

    if (!full_name?.trim()) {
      return res.status(400).json({ success: false, error: 'full_name is required' });
    }
    const validAges = ['ADULT', 'CHILD', 'INFANT'];
    if (!validAges.includes(age_category.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'age_category must be ADULT, CHILD, or INFANT' });
    }

    // Check reservation exists
    const check = await pool.request()
      .input('resvId', sql.BigInt, resvId)
      .query('SELECT reservation_id FROM Reservation WHERE reservation_id = @resvId');
    if (!check.recordset.length) return res.status(404).json({ success: false, error: 'Reservation not found' });

    const insert = await pool.request()
      .input('resvId',      sql.BigInt,     resvId)
      .input('fullName',    sql.NVarChar(220), full_name.trim())
      .input('ageCat',      sql.VarChar(10),   age_category.toUpperCase())
      .input('natCode',     sql.Char(2),        nationality_country_code)
      .input('docType',     sql.VarChar(30),    document_type)
      .input('docNo',       sql.VarChar(80),    document_no)
      .input('note',        sql.NVarChar(255),  special_note)
      .query(`
        INSERT INTO ReservationGuest
          (reservation_id, full_name, is_primary_guest, age_category,
           nationality_country_code, document_type, document_no, special_note)
        OUTPUT INSERTED.*
        VALUES (@resvId, @fullName, 0, @ageCat, @natCode, @docType, @docNo, @note)
      `);

    res.json({ success: true, data: insert.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// DELETE /api/reservations/:id/guests/:guestId
// Remove an additional guest (non-primary only)
// 
router.delete('/:id/guests/:guestId', async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId   = parseInt(req.params.id);
    const guestRowId = parseInt(req.params.guestId);
    if (isNaN(resvId) || isNaN(guestRowId)) {
      return res.status(400).json({ success: false, error: 'Invalid IDs' });
    }

    // Cannot delete primary guest
    const check = await pool.request()
      .input('id', sql.BigInt, guestRowId)
      .input('resvId', sql.BigInt, resvId)
      .query('SELECT is_primary_guest FROM ReservationGuest WHERE reservation_guest_id = @id AND reservation_id = @resvId');

    if (!check.recordset.length) return res.status(404).json({ success: false, error: 'Guest record not found' });
    if (check.recordset[0].is_primary_guest) return res.status(400).json({ success: false, error: 'Cannot remove the primary guest' });

    await pool.request()
      .input('id', sql.BigInt, guestRowId)
      .query('DELETE FROM ReservationGuest WHERE reservation_guest_id = @id');

    res.json({ success: true, message: 'Additional guest removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
