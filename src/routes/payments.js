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

    const pool = getSqlPool();
    const payRef = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const result = await pool.request()
      .input('resv_id', sql.BigInt, reservation_id)
      .input('ref', sql.VarChar(80), payRef)
      .input('type', sql.VarChar(20), payment_type || 'FULL_PAYMENT')
      .input('method', sql.VarChar(20), payment_method || 'CREDIT_CARD')
      .input('amount', sql.Decimal(18, 2), amount)
      .input('currency', sql.Char(3), currency_code || 'VND')
      .query(`
        INSERT INTO Payment (reservation_id, payment_reference, payment_type, payment_method, payment_status, amount, currency_code, paid_at)
        OUTPUT INSERTED.*
        VALUES (@resv_id, @ref, @type, @method, 'CAPTURED', @amount, @currency, GETDATE())
      `);

    res.status(201).json({ success: true, data: result.recordset[0] });
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
