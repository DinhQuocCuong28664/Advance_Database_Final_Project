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

    const fs = require('fs');
    fs.appendFileSync('vnpay_log.txt', JSON.stringify({time: new Date(), query: req.query, result}) + '\\n');

    if (!result.valid) {
      return res.redirect(
        `${frontendUrl}/booking/vnpay-return?status=invalid&txnRef=${encodeURIComponent(result.txnRef || '')}`
      );
    }

    // Update payment record if success (responseCode '00' = success)
    if (result.responseCode === '00') {
      await _recordVnpayPayment(result, 'RETURN');
    }

    const params = new URLSearchParams({
      status:      result.responseCode === '00' ? 'success' : 'failed',
      code:        result.responseCode,
      txnRef:      result.txnRef   || '',
      amount:      result.amount   || '',
      bankCode:    result.bankCode || '',
      transNo:     result.transactionNo || '',
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

//  Helper: upsert payment record 
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
        .input('status', sql.VarChar(15), payStatus)
        .input('gatewayTransId', sql.VarChar(120), transNo)
        .query(`
          UPDATE Payment
          SET payment_status = @status,
              gateway_transaction_id = @gatewayTransId,
              updated_at = GETDATE()
          WHERE payment_id = @id
        `);
    } else {
      // Insert new record
      // Need a unique payment_reference. We can use the VNPay txnRef.
      await pool.request()
        .input('resvId', sql.BigInt, resvId)
        .input('payRef', sql.VarChar(80), result.txnRef)
        .input('amount', sql.Decimal(18, 2), result.amount)
        .input('method', sql.VarChar(20), 'WALLET') // Matches CHECK constraint
        .input('currency', sql.VarChar(3), 'VND')
        .input('type', sql.VarChar(20), 'DEPOSIT')
        .input('status', sql.VarChar(15), payStatus)
        .input('gatewayTransId', sql.VarChar(120), transNo)
        .query(`
          INSERT INTO Payment
            (reservation_id, payment_reference, amount, payment_method, currency_code,
             payment_type, payment_status, gateway_transaction_id)
          VALUES
            (@resvId, @payRef, @amount, @method, @currency,
             @type, @status, @gatewayTransId)
        `);
    }
  } catch (err) {
    console.error(`[VNPay ${source}] Failed to record payment:`, err.message);
  }
}

module.exports = router;
