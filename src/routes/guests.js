/**
 * LuxeReserve — Guest Routes
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');

// GET /api/guests
router.get('/', async (req, res) => {
  try {
    const pool = getSqlPool();
    const result = await pool.request().query(`
      SELECT guest_id, guest_code, title, first_name, last_name, full_name,
             email, phone_number, nationality_country_code, vip_flag
      FROM Guest ORDER BY full_name
    `);
    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/guests/:id — Full profile
router.get('/:id', async (req, res) => {
  try {
    const pool = getSqlPool();
    const guestId = parseInt(req.params.id);

    const guest = await pool.request()
      .input('id', sql.BigInt, guestId)
      .query('SELECT * FROM Guest WHERE guest_id = @id');

    if (guest.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Guest not found' });
    }

    const preferences = await pool.request()
      .input('id', sql.BigInt, guestId)
      .query('SELECT * FROM GuestPreference WHERE guest_id = @id ORDER BY priority_level');

    const loyalty = await pool.request()
      .input('id', sql.BigInt, guestId)
      .query(`
        SELECT la.*, c.chain_name
        FROM LoyaltyAccount la
        JOIN HotelChain c ON la.chain_id = c.chain_id
        WHERE la.guest_id = @id
      `);

    const addresses = await pool.request()
      .input('id', sql.BigInt, guestId)
      .query('SELECT * FROM GuestAddress WHERE guest_id = @id');

    res.json({
      success: true,
      data: {
        ...guest.recordset[0],
        preferences: preferences.recordset,
        loyalty_accounts: loyalty.recordset,
        addresses: addresses.recordset,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/guests — Create guest
router.post('/', async (req, res) => {
  try {
    const { guest_code, title, first_name, middle_name, last_name, gender, email, phone_country_code, phone_number, nationality_country_code } = req.body;

    if (!guest_code || !first_name || !last_name) {
      return res.status(400).json({ success: false, error: 'guest_code, first_name, last_name are required' });
    }

    const pool = getSqlPool();
    const result = await pool.request()
      .input('guest_code', sql.VarChar(50), guest_code)
      .input('title', sql.NVarChar(20), title || null)
      .input('first_name', sql.NVarChar(100), first_name)
      .input('middle_name', sql.NVarChar(100), middle_name || null)
      .input('last_name', sql.NVarChar(100), last_name)
      .input('gender', sql.VarChar(15), gender || null)
      .input('email', sql.VarChar(150), email || null)
      .input('phone_cc', sql.VarChar(10), phone_country_code || null)
      .input('phone', sql.VarChar(30), phone_number || null)
      .input('nationality', sql.Char(2), nationality_country_code || null)
      .query(`
        INSERT INTO Guest (guest_code, title, first_name, middle_name, last_name, gender, email, phone_country_code, phone_number, nationality_country_code)
        OUTPUT INSERTED.guest_id, INSERTED.guest_code, INSERTED.full_name
        VALUES (@guest_code, @title, @first_name, @middle_name, @last_name, @gender, @email, @phone_cc, @phone, @nationality)
      `);

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
