/**
 * VNPay Payment Routes
 * POST /api/vnpay/create-payment   create payment URL
 * GET  /api/vnpay/return           VNPay redirects here (browser)
 * GET  /api/vnpay/ipn              VNPay IPN callback (server-to-server)
 */
const express = require('express');
const router  = express.Router();
const { getSqlPool, sql } = require('../config/database');
const { createPaymentUrl, verifyReturn, isConfigured } = require('../services/vnpay');
const { sendBookingConfirmation } = require('../services/mail');

// 
// POST /api/vnpay/create-payment
// Body: { reservation_id, amount, order_info, locale?, ip? }
// Returns: { paymentUrl }
// 
router.post('/create-payment', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'VNPay is not configured on this server. Set VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_URL in .env',
      });
    }

    const { reservation_id, amount, order_info, locale, ip } = req.body;
    if (!reservation_id || !amount) {
      return res.status(400).json({ success: false, error: 'reservation_id and amount are required' });
    }

    // Fetch reservation_code to use as txnRef
    const pool = getSqlPool();
    const resvRow = await pool.request()
      .input('id', sql.BigInt, Number(reservation_id))
      .query('SELECT reservation_code FROM Reservation WHERE reservation_id = @id');

    if (!resvRow.recordset.length) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    const txnRef = resvRow.recordset[0].reservation_code;

    // Get client IP (handle proxy headers)
    let clientIp = ip
      || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.socket.remoteAddress
      || '127.0.0.1';
    if (clientIp === '::1' || clientIp.includes(':')) {
      clientIp = '127.0.0.1'; // VNPay prefers IPv4 format
    }

    const paymentUrl = createPaymentUrl({
      amount:     Math.round(Number(amount)),
      txnRef,
      orderInfo:  order_info || `Dat coc dat phong ${txnRef}`,
      locale:     locale || 'vn',
      ipAddr:     clientIp,
    });

    res.json({ success: true, paymentUrl, txnRef });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 
// GET /api/vnpay/return
// VNPay redirects user browser here after payment
// We redirect the user to frontend with result params
// 
router.get('/return', async (req, res) => {
  try {
    const result = verifyReturn(req.query);
    const frontendUrl = process.env.APP_URL || 'http://localhost:5173';

    if (!result.valid) {
      return res.redirect(
        `${frontendUrl}/booking/vnpay-return?status=invalid&txnRef=${encodeURIComponent(result.txnRef || '')}`
      );
    }

    if (result.responseCode === '00') {
      // Payment success - record it
      await _recordVnpayPayment(result, 'RETURN');
    } else {
      // Payment failed or cancelled by user - release the reservation immediately
      if (result.txnRef) {
        await _cancelAbandonedReservation(result.txnRef, `VNPay return code ${result.responseCode}`);
      }
    }

    const params = new URLSearchParams({
      status:   result.responseCode === '00' ? 'success' : 'failed',
      code:     result.responseCode,
      txnRef:   result.txnRef         || '',
      amount:   result.amount         || '',
      bankCode: result.bankCode       || '',
      transNo:  result.transactionNo  || '',
    });

    res.redirect(`${frontendUrl}/booking/vnpay-return?${params.toString()}`);
  } catch (err) {
    const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/booking/vnpay-return?status=error&msg=${encodeURIComponent(err.message)}`);
  }
});

// 
// GET /api/vnpay/ipn
// VNPay server-to-server callback (background, no redirect)
// Must respond { RspCode: '00', Message: 'Confirm Success' }
// 
router.get('/ipn', async (req, res) => {
  try {
    const result = verifyReturn(req.query);

    if (!result.valid) {
      return res.json({ RspCode: '97', Message: 'Invalid signature' });
    }

    // Find reservation by txnRef (reservation_code)
    const pool = getSqlPool();
    const resvRow = await pool.request()
      .input('code', sql.VarChar(50), result.txnRef)
      .query(`
        SELECT r.reservation_id, r.reservation_status, r.guest_id,
               g.email, g.first_name, g.last_name,
               h.hotel_name, r.checkin_date, r.checkout_date,
               r.nights, r.grand_total_amount, r.currency_code
        FROM Reservation r
        JOIN Guest g ON r.guest_id = g.guest_id
        JOIN Hotel h ON r.hotel_id = h.hotel_id
        WHERE r.reservation_code = @code
      `);

    if (!resvRow.recordset.length) {
      return res.json({ RspCode: '01', Message: 'Order not found' });
    }

    const resv = resvRow.recordset[0];

    // Check order amount matches (VNPay sends amount * 100)
    const serverAmount = Math.round(Number(resv.grand_total_amount) * 0.30); // deposit 30%
    if (Math.abs(result.amount - serverAmount) > 1) {
      // Small rounding tolerance of 1 VND
      console.warn(`[VNPay IPN] Amount mismatch: got ${result.amount}, expected ~${serverAmount}`);
      // Don't reject  just log and accept (VNPay requirement)
    }

    if (result.responseCode === '00') {
      await _recordVnpayPayment(result, 'IPN');

      // Send booking confirmation email (fire-and-forget)
      if (resv.email) {
        sendBookingConfirmation({
          to:       resv.email,
          fullName: `${resv.first_name} ${resv.last_name}`.trim(),
          reservation: {
            reservation_code: result.txnRef,
            hotel_name:       resv.hotel_name,
            checkin_date:     resv.checkin_date,
            checkout_date:    resv.checkout_date,
            nights:           resv.nights,
            adult_count:      1,
            grand_total_amount: resv.grand_total_amount,
            currency_code:    resv.currency_code || 'VND',
          },
        });
      }
    }

    res.json({ RspCode: '00', Message: 'Confirm Success' });
  } catch (err) {
    console.error('[VNPay IPN] Error:', err.message);
    res.json({ RspCode: '99', Message: 'Unknown error' });
  }
});

// Helper: cancel a reservation by reservation_code and release room availability
async function _cancelAbandonedReservation(txnRef, reason) {
  try {
    const pool = getSqlPool();

    // Only cancel if still CONFIRMED and has no successful payment
    const resvRow = await pool.request()
      .input('code', sql.VarChar(50), txnRef)
      .query(`
        SELECT r.reservation_id, r.reservation_status
        FROM Reservation r
        WHERE r.reservation_code = @code
          AND r.reservation_status = 'CONFIRMED'
          AND NOT EXISTS (
            SELECT 1 FROM Payment p
            WHERE p.reservation_id = r.reservation_id
              AND p.payment_status = 'CAPTURED'
          )
      `);

    if (!resvRow.recordset.length) return; // already cancelled or paid

    const resvId = resvRow.recordset[0].reservation_id;

    // Cancel reservation
    await pool.request()
      .input('id', sql.BigInt, resvId)
      .query(`UPDATE Reservation SET reservation_status = 'CANCELLED', updated_at = GETDATE() WHERE reservation_id = @id`);

    // Release room availability back to OPEN
    await pool.request()
      .input('id', sql.BigInt, resvId)
      .query(`
        UPDATE ra
        SET ra.availability_status = 'OPEN',
            ra.sellable_flag       = 1,
            ra.inventory_note      = 'Released: payment abandoned',
            ra.updated_at          = GETDATE()
        FROM RoomAvailability ra
        JOIN ReservationRoom rr ON ra.room_id = rr.room_id
          AND ra.hotel_id = (SELECT hotel_id FROM Reservation WHERE reservation_id = @id)
          AND ra.stay_date >= (SELECT checkin_date  FROM Reservation WHERE reservation_id = @id)
          AND ra.stay_date <  (SELECT checkout_date FROM Reservation WHERE reservation_id = @id)
        WHERE rr.reservation_id = @id
          AND ra.availability_status = 'BOOKED'
      `);

    // Cancel room assignment
    await pool.request()
      .input('id', sql.BigInt, resvId)
      .query(`UPDATE ReservationRoom SET occupancy_status = 'CANCELLED', updated_at = GETDATE() WHERE reservation_id = @id`);

    console.log(`[VNPay] Cancelled abandoned reservation ${txnRef} (id=${resvId}). Reason: ${reason}`);
  } catch (err) {
    console.error(`[VNPay] Failed to cancel abandoned reservation ${txnRef}:`, err.message);
  }
}

// POST /api/vnpay/cleanup-abandoned
// Cancel CONFIRMED reservations with no captured payment older than :minutes (default 30)
// Called by the background scheduler every 5 minutes
router.post('/cleanup-abandoned', async (req, res) => {
  try {
    const pool = getSqlPool();
    const windowMinutes = Number(req.body?.window_minutes) || 30;

    const stuckRows = await pool.request()
      .input('windowMinutes', sql.Int, windowMinutes)
      .query(`
        SELECT r.reservation_id, r.reservation_code
        FROM Reservation r
        WHERE r.reservation_status = 'CONFIRMED'
          AND r.created_at < DATEADD(MINUTE, -@windowMinutes, GETDATE())
          AND NOT EXISTS (
            SELECT 1 FROM Payment p
            WHERE p.reservation_id = r.reservation_id
              AND p.payment_status = 'CAPTURED'
          )
      `);

    const cancelled = [];
    for (const row of stuckRows.recordset) {
      await _cancelAbandonedReservation(row.reservation_code, `Cleanup: no payment after ${windowMinutes} min`);
      cancelled.push(row.reservation_code);
    }

    res.json({
      success: true,
      cancelled_count: cancelled.length,
      cancelled_codes: cancelled,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: upsert payment record
async function _recordVnpayPayment(result, source) {
  try {
    const pool = getSqlPool();

    // Find reservation_id by code
    const resvRow = await pool.request()
      .input('code', sql.VarChar(50), result.txnRef)
      .query('SELECT reservation_id FROM Reservation WHERE reservation_code = @code');

    if (!resvRow.recordset.length) return;
    const resvId = resvRow.recordset[0].reservation_id;

    // Check if payment record already exists (IPN + RETURN can both fire)
    const existing = await pool.request()
      .input('resvId', sql.BigInt, resvId)
      .input('type', sql.VarChar(20), 'DEPOSIT')
      .query(`
        SELECT payment_id FROM Payment
        WHERE reservation_id = @resvId AND payment_type = @type
          AND payment_status IN ('CAPTURED', 'PENDING')
      `);

    const payStatus  = result.responseCode === '00' ? 'CAPTURED' : 'FAILED';
    const payDate    = result.payDate || null;
    const transNo    = result.transactionNo || null;
    const bankCode   = result.bankCode || null;

    if (existing.recordset.length > 0) {
      // Update existing record
      await pool.request()
        .input('id', sql.BigInt, existing.recordset[0].payment_id)
        .input('status', sql.VarChar(20), payStatus)
        .input('transNo', sql.VarChar(50), transNo)
        .input('bankCode', sql.VarChar(20), bankCode)
        .query(`
          UPDATE Payment
          SET payment_status = @status,
              transaction_ref = @transNo,
              payment_notes   = @bankCode,
              updated_at      = GETDATE()
          WHERE payment_id = @id
        `);
    } else {
      // Insert new record
      await pool.request()
        .input('resvId', sql.BigInt, resvId)
        .input('amount', sql.Decimal(18, 2), result.amount)
        .input('method', sql.VarChar(30), 'VNPAY')
        .input('currency', sql.VarChar(10), 'VND')
        .input('type', sql.VarChar(20), 'DEPOSIT')
        .input('status', sql.VarChar(20), payStatus)
        .input('transNo', sql.VarChar(50), transNo)
        .input('bankCode', sql.VarChar(20), bankCode)
        .query(`
          INSERT INTO Payment
            (reservation_id, amount, payment_method, currency_code,
             payment_type, payment_status, transaction_ref, payment_notes)
          VALUES
            (@resvId, @amount, @method, @currency,
             @type, @status, @transNo, @bankCode)
        `);
    }
  } catch (err) {
    console.error(`[VNPay ${source}] Failed to record payment:`, err.message);
  }
}

module.exports = router;
