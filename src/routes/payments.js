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

// GET /api/payments?reservation_id=1
router.get('/', async (req, res) => {
  try {
    const pool = getSqlPool();
    const { reservation_id } = req.query;

    let query = 'SELECT * FROM Payment';
    const request = pool.request();

    if (reservation_id) {
      query += ' WHERE reservation_id = @resvId';
      request.input('resvId', sql.BigInt, parseInt(reservation_id));
    }

    query += ' ORDER BY created_at DESC';
    const result = await request.query(query);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
