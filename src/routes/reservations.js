/**
 * LuxeReserve - Reservation Routes
 * Core flow: Booking with Pessimistic Locking
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');
const { sendBookingConfirmation, sendCancellationNotice, sendCheckinReminder } = require('../services/mail');
const { requireAuth, requireSystemUser } = require('../middleware/auth');

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

function computePromotionDiscount(promotionType, discountValue, subtotalAmount) {
  const promoType = String(promotionType || '').toUpperCase();
  const value = Number(discountValue || 0);
  const subtotal = Number(subtotalAmount || 0);

  if (subtotal <= 0 || value <= 0) {
    return 0;
  }

  if (['PERCENT_OFF', 'PERCENTAGE'].includes(promoType)) {
    return Math.min(subtotal, Math.round((subtotal * value) * 100) / 10000);
  }

  if (['VALUE_CREDIT', 'FIXED_AMOUNT'].includes(promoType)) {
    return Math.min(subtotal, value);
  }

  return 0;
}

async function loadLoyaltyVoucherForBooking(transaction, guestId, hotelId, loyaltyRedemptionCode) {
  const result = await new sql.Request(transaction)
    .input('guestId', sql.BigInt, guestId)
    .input('hotelId', sql.BigInt, hotelId)
    .input('voucherCode', sql.VarChar(50), String(loyaltyRedemptionCode || '').trim().toUpperCase())
    .query(`
      SELECT TOP 1
        lr.loyalty_redemption_id,
        lr.issued_promo_code,
        lr.points_spent,
        lr.expires_at,
        p.promotion_id,
        p.promotion_code,
        p.promotion_name,
        p.promotion_type,
        p.discount_value,
        p.currency_code,
        p.applies_to,
        p.hotel_id AS promotion_hotel_id,
        p.brand_id AS promotion_brand_id,
        requestedHotel.brand_id AS requested_brand_id,
        CASE
          WHEN p.hotel_id IS NOT NULL AND p.hotel_id = @hotelId THEN 1
          WHEN p.brand_id IS NOT NULL AND p.brand_id = requestedHotel.brand_id THEN 1
          WHEN p.hotel_id IS NULL AND p.brand_id IS NULL THEN 1
          ELSE 0
        END AS applies_to_hotel
      FROM LoyaltyRedemption lr
      JOIN Promotion p ON lr.promotion_id = p.promotion_id
      JOIN Hotel requestedHotel ON requestedHotel.hotel_id = @hotelId
      WHERE lr.guest_id = @guestId
        AND lr.issued_promo_code = @voucherCode
        AND lr.status = 'ISSUED'
        AND lr.expires_at >= GETDATE()
        AND p.status = 'ACTIVE'
    `);

  return result.recordset[0] || null;
}

// POST /api/v1/reservations  Create Reservation (calls sp_ReserveRoom)
router.post('/', async (req, res) => {
  try {
    const {
      hotel_id, guest_id, guest_profile, room_id, room_type_id, rate_plan_id,
      booking_channel_id, booking_source,
      checkin_date, checkout_date, nights,
      adult_count, child_count, nightly_rate,
      currency_code, guarantee_type, purpose_of_stay, booking_email_otp,
      special_request_text, loyalty_redemption_code
    } = req.body;

    // Validation
    if (!hotel_id || !room_id || !checkin_date || !checkout_date) {
      return res.status(400).json({ success: false, message: 'Missing required fields: hotel_id, room_id, checkin_date, checkout_date' });
    }

    // [FIX] Validate adult_count and child_count are non-negative integers
    if (adult_count !== undefined && adult_count !== null) {
      if (!Number.isInteger(Number(adult_count)) || Number(adult_count) < 0) {
        return res.status(400).json({ success: false, message: 'adult_count must be a non-negative integer' });
      }
    }
    if (child_count !== undefined && child_count !== null) {
      if (!Number.isInteger(Number(child_count)) || Number(child_count) < 0) {
        return res.status(400).json({ success: false, message: 'child_count must be a non-negative integer' });
      }
    }
    if ((adult_count || 0) + (child_count || 0) === 0) {
      return res.status(400).json({ success: false, message: 'At least one guest (adult or child) is required' });
    }

    if (!guest_id) {
      if (!guest_profile || typeof guest_profile !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Provide guest_id or guest_profile object with first_name, last_name, and email',
        });
      }
      const firstName = String(guest_profile.first_name || '').trim();
      const lastName = String(guest_profile.last_name || '').trim();
      const email = String(guest_profile.email || '').trim();
      if (!firstName || !lastName || !email) {
        return res.status(400).json({
          success: false,
          error: 'Provide guest_id or guest_profile with first_name, last_name, and email',
        });
      }
    }

    // [FIX] LOGIC-2: Validate nightly_rate is positive
    if (!nightly_rate || nightly_rate <= 0) {
      return res.status(400).json({ success: false, message: 'nightly_rate must be a positive number' });
    }

    // [FIX] TC_EDGE_002: Validate checkout_date > checkin_date to prevent negative nights/money
    const parsedCheckin = new Date(checkin_date);
    const parsedCheckout = new Date(checkout_date);
    if (isNaN(parsedCheckin.getTime()) || isNaN(parsedCheckout.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date format for checkin_date or checkout_date' });
    }
    if (parsedCheckout <= parsedCheckin) {
      return res.status(400).json({ success: false, message: 'checkout_date must be after checkin_date' });
    }

    const checkin = new Date(checkin_date);
    const checkout = new Date(checkout_date);
    const nightCount = nights || Math.round((checkout - checkin) / (1000 * 60 * 60 * 24));
    const reservationSubtotal = (nightly_rate || 0) * nightCount;

    const pool = getSqlPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      let resolvedGuestId = guest_id ? Number(guest_id) : null;
      const reservationCode = `RES-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      let appliedVoucher = null;
      let discountAmount = 0;
      const hotelCurrencyResult = await new sql.Request(transaction)
        .input('hotelId', sql.BigInt, hotel_id)
        .input('roomId', sql.BigInt, room_id)
        .query(`
          SELECT TOP 1 h.currency_code
          FROM Hotel h
          JOIN Room r ON r.hotel_id = h.hotel_id
          WHERE h.hotel_id = @hotelId
            AND r.room_id = @roomId
        `);

      if (hotelCurrencyResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Hotel or room not found, or room does not belong to selected hotel' });
      }

      // [FIX] Check room_status and maintenance_status before booking
      const roomStatusCheck = await new sql.Request(transaction)
        .input('roomId', sql.BigInt, room_id)
        .query(`
          SELECT room_status, maintenance_status
          FROM Room
          WHERE room_id = @roomId
        `);
      if (roomStatusCheck.recordset.length > 0) {
        const room = roomStatusCheck.recordset[0];
        if (room.room_status !== 'AVAILABLE') {
          await transaction.rollback();
          return res.status(409).json({ success: false, message: `Room is not available (status: ${room.room_status})` });
        }
        if (room.maintenance_status !== 'NORMAL') {
          await transaction.rollback();
          return res.status(409).json({ success: false, message: `Room is under maintenance (status: ${room.maintenance_status})` });
        }
      }

      const reservationCurrency = hotelCurrencyResult.recordset[0].currency_code || currency_code || 'VND';

      // 
      // STEP 1: Call sp_ReserveRoom for EACH night (Pessimistic Lock)
      // 
      // [FIX] TC_BND_001: Limit max nights to prevent Pessimistic Lock timeout
      const MAX_NIGHTS = 90;
      if (nightCount <= 0 || nightCount > MAX_NIGHTS) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `Invalid stay duration. Must be 1-${MAX_NIGHTS} nights. Got: ${nightCount}` });
      }

      if (resolvedGuestId) {
        const existingGuest = await new sql.Request(transaction)
          .input('guestId', sql.BigInt, resolvedGuestId)
          .query('SELECT guest_id FROM Guest WHERE guest_id = @guestId');

        if (existingGuest.recordset.length === 0) {
          await transaction.rollback();
          return res.status(404).json({ success: false, message: 'Guest not found' });
        }

        // Do NOT update the Guest profile from booking form data.
        // guest_profile in the request body is only a pre-fill hint for the booking form.
        // Profile changes must go through the dedicated endpoint: PUT /api/v1/guests/:id.
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

      if (loyalty_redemption_code) {
        appliedVoucher = await loadLoyaltyVoucherForBooking(transaction, resolvedGuestId, hotel_id, loyalty_redemption_code);

        if (!appliedVoucher) {
          await transaction.rollback();
          return res.status(404).json({ success: false, message: 'Loyalty voucher not found, expired, or already used' });
        }

        if (appliedVoucher.applies_to_hotel !== 1) {
          await transaction.rollback();
          return res.status(409).json({ success: false, message: 'This loyalty voucher does not apply to the selected hotel' });
        }

        if (String(appliedVoucher.applies_to || '').toUpperCase() === 'SERVICE_ONLY') {
          await transaction.rollback();
          return res.status(409).json({ success: false, message: 'This loyalty voucher can only be used for in-stay services' });
        }

        discountAmount = computePromotionDiscount(
          appliedVoucher.promotion_type,
          appliedVoucher.discount_value,
          reservationSubtotal,
        );
      }

      const reservationTotal = Math.max(0, reservationSubtotal - discountAmount);
      const requiresDeposit = guarantee_type === 'DEPOSIT';
      const depositAmount = requiresDeposit ? Math.round(reservationTotal * 0.3 * 100) / 100 : 0;

      // [FIX] CRITICAL: sp_ReserveRoom now runs INSIDE the transaction
      // Previously it ran outside, risking permanent locks if server crashed mid-transaction.
      // We use a savepoint approach: if any night fails, we rollback to savepoint
      // and the outer transaction handles the final rollback.
      const SAVEPOINT_NAME = 'sp_reserve_rooms';
      await new sql.Request(transaction).query(`SAVE TRAN ${SAVEPOINT_NAME}`);

      for (let i = 0; i < nightCount; i++) {
        const stayDate = new Date(checkin);
        stayDate.setDate(stayDate.getDate() + i);
        const dateStr = stayDate.toISOString().slice(0, 10);

        const spRequest = new sql.Request(transaction);
        spRequest.input('room_id', sql.BigInt, room_id);
        spRequest.input('stay_date', sql.VarChar(10), dateStr);
        spRequest.input('reservation_code', sql.VarChar(50), reservationCode);
        spRequest.input('session_id', sql.VarChar(100), req.headers['x-session-id'] || null);
        spRequest.output('result_status', sql.Int);
        spRequest.output('result_message', sql.NVarChar(500));

        const spResult = await spRequest.execute('sp_ReserveRoom');
        const lockStatus = spResult.output.result_status;
        const lockMessage = spResult.output.result_message;

        if (lockStatus !== 0) {
          // Rollback to savepoint to undo any partial locks
          await new sql.Request(transaction).query(`ROLLBACK TRAN ${SAVEPOINT_NAME}`);
          await transaction.rollback();
          const httpStatus = lockStatus === 2 ? 409 : 500;
          return res.status(httpStatus).json({
            success: false,
            error: `Booking failed: ${lockMessage}`,
            failed_date: dateStr,
          });
        }
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
        .input('currency', sql.Char(3), reservationCurrency)
        .input('subtotal', sql.Decimal(18, 2), reservationSubtotal)
        .input('discount', sql.Decimal(18, 2), discountAmount)
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
            subtotal_amount, discount_amount, grand_total_amount, deposit_required_flag, deposit_amount,
            guarantee_type, purpose_of_stay, special_request_text
          )
          OUTPUT INSERTED.reservation_id, INSERTED.reservation_code, INSERTED.reservation_status
          VALUES (
            @code, @hotel_id, @guest_id, @channel_id, @source,
            'CONFIRMED', @checkin, @checkout, @nights,
            @adults, @children, 1, @currency,
            @subtotal, @discount, @total, @depositRequired, @depositAmount, @guarantee, @purpose, @special
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
        .input('subtotal', sql.Decimal(18, 2), reservationSubtotal)
        .input('discount', sql.Decimal(18, 2), discountAmount)
        .input('final', sql.Decimal(18, 2), reservationTotal)
        .query(`
          INSERT INTO ReservationRoom (
            reservation_id, room_id, room_type_id, rate_plan_id,
            stay_start_date, stay_end_date, adult_count,
            nightly_rate_snapshot, room_subtotal, discount_amount, final_amount,
            assignment_status, occupancy_status
          )
          VALUES (
            @resv_id, @room_id, @rt_id, @rp_id,
            @start, @end, @adults,
            @rate, @subtotal, @discount, @final,
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

      if (appliedVoucher) {
        await new sql.Request(transaction)
          .input('redemptionId', sql.BigInt, appliedVoucher.loyalty_redemption_id)
          .input('reservationId', sql.BigInt, reservation.reservation_id)
          .query(`
            UPDATE LoyaltyRedemption
            SET reservation_id = @reservationId,
                status = 'REDEEMED',
                redeemed_at = GETDATE(),
                updated_at = GETDATE()
            WHERE loyalty_redemption_id = @redemptionId
          `);
      }

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
        subtotal_amount: reservationSubtotal,
        discount_amount: discountAmount,
        total: reservationTotal,
        grand_total_amount: reservationTotal,
        deposit_required: requiresDeposit,
        deposit_amount: depositAmount,
        currency_code: reservationCurrency,
        guest_id: resolvedGuestId,
        loyalty_redemption_code: appliedVoucher?.issued_promo_code || null,
        applied_promotion_code: appliedVoucher?.promotion_code || null,
      };

      res.status(201).json({ success: true, data: responseData });

      //  Fire-and-forget: booking confirmation email 
      try {
        let guestEmail = null;
        let guestName = 'Guest';

        if (guest_profile && typeof guest_profile === 'object') {
          guestEmail = guest_profile.email || null;
          guestName = [guest_profile.first_name, guest_profile.last_name].filter(Boolean).join(' ') || 'Guest';
        }

        if (!guestEmail && resolvedGuestId) {
          const guestRow = await getSqlPool().request()
            .input('gid', sql.BigInt, resolvedGuestId)
            .query('SELECT email, first_name, last_name FROM Guest WHERE guest_id = @gid');
          if (guestRow.recordset.length > 0) {
            guestEmail = guestRow.recordset[0].email;
            guestName = [guestRow.recordset[0].first_name, guestRow.recordset[0].last_name].filter(Boolean).join(' ') || 'Guest';
          }
        }

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
              currency_code: reservationCurrency,
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// 
// GET /api/v1/reservations  List reservations
// Query params: guest_id, email, status, limit (default 20)
// 
router.get('/', requireAuth, async (req, res) => {
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

    const isGuest = req.auth?.user_type === 'GUEST';
    const authGuestId = isGuest ? Number(req.auth.sub) : null;

    if (isGuest) {
      if (guest_id && Number(guest_id) !== authGuestId) {
        return res.status(403).json({ success: false, message: 'You are not authorised to view another guest\'s reservations' });
      }
      where.push('r.guest_id = @guestId');
      request.input('guestId', sql.BigInt, authGuestId);
    } else if (guest_id) {
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// 
// GET /api/v1/reservations/by-guest/:guestCode  By guest code
// 
router.get('/by-guest/:guestCode', requireAuth, async (req, res) => {
  try {
    const pool = getSqlPool();
    const { guestCode } = req.params;
    if (req.auth?.user_type === 'GUEST' && String(req.auth.guest_code || '').toUpperCase() !== String(guestCode || '').toUpperCase()) {
      return res.status(403).json({ success: false, message: 'You are not authorised to view another guest\'s reservation list' });
    }

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
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/reservations/:code  Get by reservation code
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
      return res.status(404).json({ success: false, message: 'Reservation not found' });
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
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/reservations/:id/checkin  Check-in
// [Rule 14] Uses sp_CheckIn stored procedure for atomicity
router.post('/:id/checkin', requireSystemUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    const { agent_id } = req.body;

    if (isNaN(resvId)) {
      return res.status(400).json({ success: false, message: 'Invalid reservation ID' });
    }

    const spRequest = pool.request();
    spRequest.input('reservation_id', sql.BigInt, resvId);
    spRequest.input('agent_id', sql.BigInt, agent_id || null);

    const result = await spRequest.execute('sp_CheckIn');

    res.json({
      success: true,
      message: 'Check-in successful',
      reservation_id: resvId,
      data: result.recordset[0] || null,
    });
  } catch (err) {
    // sp_CheckIn raises error if not CONFIRMED
    if (err.message?.includes('not found or not CONFIRMED')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/reservations/:id/checkout  Check-out
// [Rule 14] Uses sp_CheckOut stored procedure for atomicity
router.post('/:id/checkout', requireSystemUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    const { agent_id } = req.body;

    if (isNaN(resvId)) {
      return res.status(400).json({ success: false, message: 'Invalid reservation ID' });
    }

    const spRequest = pool.request();
    spRequest.input('reservation_id', sql.BigInt, resvId);
    spRequest.input('agent_id', sql.BigInt, agent_id || null);

    const result = await spRequest.execute('sp_CheckOut');

    res.json({
      success: true,
      message: 'Check-out successful',
      reservation_id: resvId,
      financials: result.recordset[0] || null,
    });
  } catch (err) {
    if (err.message?.includes('not found or not CHECKED_IN')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// 
// POST /api/v1/reservations/:id/guest-cancel
// Guest initiates cancellation  FORFEIT DEPOSIT (no refund)
// [Rule 14] Uses sp_GuestCancel stored procedure for atomicity
// 
router.post('/:id/guest-cancel', requireAuth, async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    const { reason } = req.body;

    if (isNaN(resvId)) {
      return res.status(400).json({ success: false, message: 'Invalid reservation ID' });
    }

    // Auth: only the guest who owns this reservation can cancel
    if (req.auth.user_type !== 'GUEST') {
      return res.status(403).json({ success: false, message: 'Only guests can use guest-cancel. Admins use hotel-cancel.' });
    }

    const ownerCheck = await pool.request()
      .input('resvId', sql.BigInt, resvId)
      .input('guestId', sql.BigInt, req.auth.sub)
      .query('SELECT 1 AS ok FROM Reservation WHERE reservation_id = @resvId AND guest_id = @guestId');

    if (ownerCheck.recordset.length === 0) {
      return res.status(403).json({ success: false, message: 'You are not authorised to cancel this reservation.' });
    }

    const spRequest = pool.request();
    spRequest.input('reservation_id', sql.BigInt, resvId);
    spRequest.input('reason', sql.NVarChar(255), reason || 'Guest requested cancellation');

    const result = await spRequest.execute('sp_GuestCancel');
    const data = result.recordset[0];

    res.json({
      success: true,
      message: 'Reservation cancelled by guest. Deposit forfeited (no refund).',
      data: {
        reservation_id: data.reservation_id,
        reservation_code: data.reservation_code,
        old_status: 'CONFIRMED',
        new_status: 'CANCELLED',
        cancelled_by: 'GUEST',
        deposit_forfeited: data.deposit_forfeited,
        refund_amount: data.refund_amount,
        reason: data.cancel_reason,
      }
    });

    // Fire-and-forget: cancellation email
    try {
      const guestRow = await pool.request().input('id', sql.BigInt, resvId).query(`
        SELECT g.email, g.first_name, g.last_name, h.hotel_name,
               r.reservation_code, r.checkin_date, r.checkout_date, r.nights,
               r.deposit_amount, r.grand_total_amount
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
          reservation: gr,
          cancelledBy: 'guest',
          reason: reason || 'Guest requested cancellation',
        });
      }
    } catch (mailErr) {
      console.error('[Mail] Cancellation email error:', mailErr.message);
    }

  } catch (err) {
    // sp_GuestCancel raises error for invalid status
    if (err.message?.includes('Cannot cancel') || err.message?.includes('not found')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// 
// POST /api/v1/reservations/:id/hotel-cancel
// Hotel initiates cancellation  FULL REFUND (hotel's fault)
// [Rule 14] Uses sp_HotelCancel stored procedure for atomicity
// 
router.post('/:id/hotel-cancel', requireSystemUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    const { reason, agent_id } = req.body;

    if (isNaN(resvId)) {
      return res.status(400).json({ success: false, message: 'Invalid reservation ID' });
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: 'reason is required for hotel-initiated cancellation' });
    }

    const spRequest = pool.request();
    spRequest.input('reservation_id', sql.BigInt, resvId);
    spRequest.input('agent_id', sql.BigInt, agent_id || null);
    spRequest.input('reason', sql.NVarChar(255), reason);

    const result = await spRequest.execute('sp_HotelCancel');
    const data = result.recordset[0];

    res.json({
      success: true,
      message: 'Reservation cancelled by hotel. Full refund issued.',
      data: {
        reservation_id: data.reservation_id,
        reservation_code: data.reservation_code,
        old_status: data.old_status,
        new_status: 'CANCELLED',
        cancelled_by: 'HOTEL',
        reason: data.cancel_reason,
        refund_amount: data.refund_amount,
      }
    });
  } catch (err) {
    if (err.message?.includes('Cannot cancel') || err.message?.includes('not found')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});


// 
// POST /api/v1/reservations/:id/transfer
// Room Transfer  calls sp_TransferRoom (Pessimistic Locking)
// 
router.post('/:id/transfer', requireSystemUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    const { new_room_id, reason, agent_id } = req.body;

    if (isNaN(resvId)) {
      return res.status(400).json({ success: false, message: 'Invalid reservation ID' });
    }
    if (!new_room_id) {
      return res.status(400).json({ success: false, message: 'new_room_id is required' });
    }
    if (!reason) {
      return res.status(400).json({ success: false, message: 'reason is required for room transfer' });
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
      return res.status(404).json({ success: false, message: 'Reservation not found' });
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
      return res.status(404).json({ success: false, message: 'New room not found in this hotel' });
    }

    const newRoom = newRoomCheck.recordset[0];

    // Call sp_TransferRoom (Pessimistic Locking)
    const spRequest = pool.request();
    spRequest.input('reservation_id', sql.BigInt, resvId);
    spRequest.input('old_room_id', sql.BigInt, resv.current_room_id);
    spRequest.input('new_room_id', sql.BigInt, new_room_id);
    spRequest.input('checkin_date', sql.VarChar(10), new Date(resv.checkin_date).toISOString().slice(0, 10));
    spRequest.input('checkout_date', sql.VarChar(10), new Date(resv.checkout_date).toISOString().slice(0, 10));
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
    res.status(500).json({ success: false, message: err.message });
  }
});


// 
// GET /api/v1/reservations/:id/guests
// List additional guests for a reservation
// 
router.get('/:id/guests', requireSystemUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    if (isNaN(resvId)) return res.status(400).json({ success: false, message: 'Invalid reservation ID' });

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
    res.status(500).json({ success: false, message: err.message });
  }
});

// 
// POST /api/v1/reservations/:id/guests
// Add an additional guest to a reservation
// Body: full_name, age_category, nationality_country_code, document_type, document_no, special_note
// 
router.post('/:id/guests', requireSystemUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId = parseInt(req.params.id);
    if (isNaN(resvId)) return res.status(400).json({ success: false, message: 'Invalid reservation ID' });

    const {
      full_name, age_category = 'ADULT',
      nationality_country_code = null,
      document_type = null, document_no = null,
      special_note = null,
    } = req.body;

    if (!full_name?.trim()) {
      return res.status(400).json({ success: false, message: 'full_name is required' });
    }
    const validAges = ['ADULT', 'CHILD', 'INFANT'];
    if (!validAges.includes(age_category.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'age_category must be ADULT, CHILD, or INFANT' });
    }

    // Check reservation exists
    const check = await pool.request()
      .input('resvId', sql.BigInt, resvId)
      .query('SELECT reservation_id FROM Reservation WHERE reservation_id = @resvId');
    if (!check.recordset.length) return res.status(404).json({ success: false, message: 'Reservation not found' });

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
    res.status(500).json({ success: false, message: err.message });
  }
});

// 
// DELETE /api/v1/reservations/:id/guests/:guestId
// Remove an additional guest (non-primary only)
// 
router.delete('/:id/guests/:guestId', requireSystemUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const resvId   = parseInt(req.params.id);
    const guestRowId = parseInt(req.params.guestId);
    if (isNaN(resvId) || isNaN(guestRowId)) {
      return res.status(400).json({ success: false, message: 'Invalid IDs' });
    }

    // Cannot delete primary guest
    const check = await pool.request()
      .input('id', sql.BigInt, guestRowId)
      .input('resvId', sql.BigInt, resvId)
      .query('SELECT is_primary_guest FROM ReservationGuest WHERE reservation_guest_id = @id AND reservation_id = @resvId');

    if (!check.recordset.length) return res.status(404).json({ success: false, message: 'Guest record not found' });
    if (check.recordset[0].is_primary_guest) return res.status(400).json({ success: false, message: 'Cannot remove the primary guest' });

    await pool.request()
      .input('id', sql.BigInt, guestRowId)
      .query('DELETE FROM ReservationGuest WHERE reservation_guest_id = @id');

    res.json({ success: true, message: 'Additional guest removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
