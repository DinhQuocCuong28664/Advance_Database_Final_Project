/**
 * LuxeReserve — Payment Routes
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');

// POST /api/payments — Create payment
router.post('/', async (req, res) => {
  try {
    const { reservation_id, payment_type, payment_method, amount, currency_code } = req.body;

    if (!reservation_id || !amount) {
      return res.status(400).json({ success: false, error: 'reservation_id and amount required' });
    }

    if (amount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be greater than 0' });
    }

    const pool = getSqlPool();
    const resolvedType = payment_type || 'FULL_PAYMENT';

    // [FIX] LOGIC-5: Validate reservation exists before creating payment
    const resvCheck = await pool.request()
      .input('resvId', sql.BigInt, reservation_id)
      .query(`SELECT reservation_id, reservation_status, grand_total_amount, deposit_amount
              FROM Reservation WHERE reservation_id = @resvId`);
    if (resvCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    const reservation = resvCheck.recordset[0];

    // [FIX] LOGIC-6: Prevent payment on cancelled/checked-out reservations
    if (['CANCELLED', 'CHECKED_OUT', 'NO_SHOW'].includes(reservation.reservation_status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot create payment for reservation with status: ${reservation.reservation_status}`
      });
    }

    // [FIX] LOGIC-7: Calculate total already paid (only CAPTURED payments, excluding REFUND)
    const paidResult = await pool.request()
      .input('resvId', sql.BigInt, reservation_id)
      .query(`
        SELECT
          ISNULL(SUM(CASE WHEN payment_type <> 'REFUND' THEN amount ELSE 0 END), 0) AS total_paid,
          ISNULL(SUM(CASE WHEN payment_type = 'DEPOSIT' AND payment_status = 'CAPTURED' THEN amount ELSE 0 END), 0) AS total_deposit_paid
        FROM Payment
        WHERE reservation_id = @resvId
          AND payment_status IN ('CAPTURED', 'AUTHORIZED')
      `);

    const totalPaid = parseFloat(paidResult.recordset[0].total_paid);
    const totalDepositPaid = parseFloat(paidResult.recordset[0].total_deposit_paid);
    const grandTotal = parseFloat(reservation.grand_total_amount);
    const depositRequired = parseFloat(reservation.deposit_amount);
    const newAmount = parseFloat(amount);

    // [FIX] LOGIC-8: Prevent total payments from exceeding grand total
    if (totalPaid + newAmount > grandTotal) {
      return res.status(400).json({
        success: false,
        error: `Payment would exceed reservation total. Grand total: ${grandTotal}, Already paid: ${totalPaid}, Attempted: ${newAmount}, Overage: ${(totalPaid + newAmount - grandTotal).toFixed(2)}`
      });
    }

    // [FIX] LOGIC-9: For DEPOSIT type, also check against deposit_amount limit
    if (resolvedType === 'DEPOSIT' && depositRequired > 0) {
      if (totalDepositPaid + newAmount > depositRequired) {
        return res.status(400).json({
          success: false,
          error: `Deposit would exceed required deposit amount. Deposit required: ${depositRequired}, Already deposited: ${totalDepositPaid}, Attempted: ${newAmount}, Overage: ${(totalDepositPaid + newAmount - depositRequired).toFixed(2)}`
        });
      }
    }

    // [FIX] LOGIC-10: FULL_PAYMENT must cover the entire remaining balance
    const remainingBalance = grandTotal - totalPaid;
    if (resolvedType === 'FULL_PAYMENT' && newAmount !== remainingBalance) {
      return res.status(400).json({
        success: false,
        error: `FULL_PAYMENT must cover the entire remaining balance. Remaining: ${remainingBalance}, Attempted: ${newAmount}. Use payment_type 'PREPAYMENT' for partial payments.`
      });
    }

    const payRef = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const result = await pool.request()
      .input('resv_id', sql.BigInt, reservation_id)
      .input('ref', sql.VarChar(80), payRef)
      .input('type', sql.VarChar(20), resolvedType)
      .input('method', sql.VarChar(20), payment_method || 'CREDIT_CARD')
      .input('amount', sql.Decimal(18, 2), amount)
      .input('currency', sql.Char(3), currency_code || 'VND')
      .query(`
        INSERT INTO Payment (reservation_id, payment_reference, payment_type, payment_method, payment_status, amount, currency_code, paid_at)
        OUTPUT INSERTED.*
        VALUES (@resv_id, @ref, @type, @method, 'CAPTURED', @amount, @currency, GETDATE())
      `);

    res.status(201).json({
      success: true,
      data: result.recordset[0],
      payment_summary: {
        grand_total: grandTotal,
        total_paid_after: totalPaid + newAmount,
        remaining_balance: grandTotal - (totalPaid + newAmount)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/payments
// Supports: reservation_id, hotel_id, date_from, date_to,
//           payment_type, payment_method, payment_status, limit
router.get('/', async (req, res) => {
  try {
    const pool = getSqlPool();
    const {
      reservation_id, hotel_id,
      date_from, date_to,
      payment_type, payment_method, payment_status,
      limit = 200,
    } = req.query;

    const request = pool.request();
    const conditions = [];

    if (reservation_id) {
      request.input('resvId', sql.BigInt, parseInt(reservation_id));
      conditions.push('p.reservation_id = @resvId');
    }
    if (hotel_id) {
      request.input('hotelId', sql.BigInt, parseInt(hotel_id));
      conditions.push('h.hotel_id = @hotelId');
    }
    if (date_from) {
      request.input('dateFrom', sql.Date, new Date(date_from));
      conditions.push('CAST(p.paid_at AS DATE) >= @dateFrom');
    }
    if (date_to) {
      request.input('dateTo', sql.Date, new Date(date_to));
      conditions.push('CAST(p.paid_at AS DATE) <= @dateTo');
    }
    if (payment_type) {
      request.input('payType', sql.VarChar(20), payment_type.toUpperCase());
      conditions.push('p.payment_type = @payType');
    }
    if (payment_method) {
      request.input('payMethod', sql.VarChar(20), payment_method.toUpperCase());
      conditions.push('p.payment_method = @payMethod');
    }
    if (payment_status) {
      request.input('payStatus', sql.VarChar(15), payment_status.toUpperCase());
      conditions.push('p.payment_status = @payStatus');
    }

    request.input('limit', sql.Int, parseInt(limit));
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await request.query(`
      SELECT TOP (@limit)
        p.payment_id, p.reservation_id, p.payment_reference,
        p.payment_type, p.payment_method, p.payment_status,
        p.amount, p.currency_code, p.paid_at, p.created_at,
        r.reservation_code, r.grand_total_amount,
        g.guest_id, g.first_name + ' ' + g.last_name AS guest_name,
        g.email AS guest_email,
        h.hotel_id, h.hotel_name,
        rm.room_number
      FROM Payment p
      JOIN Reservation r ON p.reservation_id = r.reservation_id
      JOIN Guest g       ON r.guest_id        = g.guest_id
      LEFT JOIN ReservationRoom rr ON rr.reservation_id = r.reservation_id
      LEFT JOIN Room rm            ON rr.room_id        = rm.room_id
      LEFT JOIN Hotel h            ON rm.hotel_id       = h.hotel_id
      ${whereClause}
      ORDER BY p.paid_at DESC, p.payment_id DESC
    `);

    const payments = result.recordset;
    const totalAmount = payments
      .filter(p => p.payment_status === 'CAPTURED' && p.payment_type !== 'REFUND')
      .reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const byType = payments.reduce((acc, p) => {
      acc[p.payment_type] = (acc[p.payment_type] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      count: payments.length,
      summary: { total_captured: totalAmount, by_type: byType },
      data: payments,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
