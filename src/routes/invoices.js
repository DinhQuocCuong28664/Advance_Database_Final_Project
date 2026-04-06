/**
 * LuxeReserve — Invoice Routes
 * Generate invoices from vw_ReservationTotal
 * Activates: Invoice (12 cols)
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');

// ═══════════════════════════════════════════════
// POST /api/invoices
// Generate invoice from reservation (using vw_ReservationTotal)
// ═══════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { reservation_id, invoice_type, billing_name, billing_tax_no, billing_address } = req.body;

    if (!reservation_id) {
      return res.status(400).json({ success: false, error: 'reservation_id is required' });
    }

    const pool = getSqlPool();

    // STEP 1: Get reservation financial summary from vw_ReservationTotal
    const resvData = await pool.request()
      .input('resvId', sql.BigInt, reservation_id)
      .query(`
        SELECT v.*, g.full_name AS guest_name, h.hotel_name
        FROM vw_ReservationTotal v
        JOIN Guest g ON v.guest_id = g.guest_id
        JOIN Hotel h ON v.hotel_id = h.hotel_id
        WHERE v.reservation_id = @resvId
      `);

    if (resvData.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    const resv = resvData.recordset[0];

    // STEP 2: Check for existing invoice of same type
    const existingCheck = await pool.request()
      .input('resvId', sql.BigInt, reservation_id)
      .input('type', sql.VarChar(10), invoice_type || 'FINAL')
      .query(`
        SELECT invoice_id, invoice_no, status FROM Invoice
        WHERE reservation_id = @resvId AND invoice_type = @type AND status <> 'CANCELLED'
      `);

    if (existingCheck.recordset.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Invoice already exists for this reservation`,
        existing_invoice: existingCheck.recordset[0]
      });
    }

    // STEP 3: Generate invoice number
    const invoiceNo = `INV-${resv.reservation_code}-${(invoice_type || 'FINAL').charAt(0)}`;

    // STEP 4: Calculate financial breakdown
    const subtotal = parseFloat(resv.room_final) + parseFloat(resv.service_final);
    const taxAmount = parseFloat(resv.room_tax);
    const serviceCharge = 0;
    const totalAmount = parseFloat(resv.grand_total);

    // STEP 5: CREATE invoice
    const result = await pool.request()
      .input('resvId', sql.BigInt, reservation_id)
      .input('invoiceNo', sql.VarChar(50), invoiceNo)
      .input('type', sql.VarChar(10), invoice_type || 'FINAL')
      .input('billingName', sql.NVarChar(150), billing_name || resv.guest_name)
      .input('billingTax', sql.VarChar(50), billing_tax_no || null)
      .input('billingAddr', sql.NVarChar(sql.MAX), billing_address || null)
      .input('subtotal', sql.Decimal(18, 2), subtotal)
      .input('tax', sql.Decimal(18, 2), taxAmount)
      .input('serviceCharge', sql.Decimal(18, 2), serviceCharge)
      .input('total', sql.Decimal(18, 2), totalAmount)
      .input('currency', sql.Char(3), resv.currency_code)
      .query(`
        INSERT INTO Invoice
          (reservation_id, invoice_no, invoice_type, billing_name, billing_tax_no,
           billing_address, subtotal_amount, tax_amount, service_charge_amount,
           total_amount, currency_code, status)
        OUTPUT INSERTED.*
        VALUES (@resvId, @invoiceNo, @type, @billingName, @billingTax,
                @billingAddr, @subtotal, @tax, @serviceCharge,
                @total, @currency, 'DRAFT')
      `);

    res.status(201).json({
      success: true,
      data: result.recordset[0],
      reservation_summary: {
        room_subtotal: resv.room_subtotal,
        room_tax: resv.room_tax,
        service_total: resv.service_final,
        grand_total: resv.grand_total,
        total_paid: resv.total_paid,
        balance_due: resv.balance_due
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════
// GET /api/invoices/:id
// Get invoice detail
// ═══════════════════════════════════════════════
router.get('/:id', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ success: false, error: 'Invalid invoice ID' });
    }

    const pool = getSqlPool();
    const result = await pool.request()
      .input('id', sql.BigInt, invoiceId)
      .query(`
        SELECT i.*, r.reservation_code, r.checkin_date, r.checkout_date, r.nights,
               g.full_name AS guest_name, g.email AS guest_email,
               h.hotel_name, h.address_line_1 AS hotel_address
        FROM Invoice i
        JOIN Reservation r ON i.reservation_id = r.reservation_id
        JOIN Guest g ON r.guest_id = g.guest_id
        JOIN Hotel h ON r.hotel_id = h.hotel_id
        WHERE i.invoice_id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Get line items (rooms + services)
    const invoice = result.recordset[0];
    const rooms = await pool.request()
      .input('resvId', sql.BigInt, invoice.reservation_id)
      .query(`
        SELECT rr.nightly_rate_snapshot, rr.room_subtotal, rr.tax_amount, rr.final_amount,
               rt.room_type_name, rm.room_number,
               rr.stay_start_date, rr.stay_end_date
        FROM ReservationRoom rr
        JOIN RoomType rt ON rr.room_type_id = rt.room_type_id
        LEFT JOIN Room rm ON rr.room_id = rm.room_id
        WHERE rr.reservation_id = @resvId
      `);

    const services = await pool.request()
      .input('resvId', sql.BigInt, invoice.reservation_id)
      .query(`
        SELECT rs.quantity, rs.unit_price, rs.final_amount, rs.service_status,
               sc.service_name, sc.service_category
        FROM ReservationService rs
        JOIN ServiceCatalog sc ON rs.service_id = sc.service_id
        WHERE rs.reservation_id = @resvId AND rs.service_status <> 'CANCELLED'
      `);

    const payments = await pool.request()
      .input('resvId', sql.BigInt, invoice.reservation_id)
      .query(`
        SELECT payment_reference, payment_type, payment_method, amount, payment_status, paid_at
        FROM Payment WHERE reservation_id = @resvId AND payment_status = 'CAPTURED'
        ORDER BY paid_at
      `);

    res.json({
      success: true,
      data: {
        ...invoice,
        line_items: {
          rooms: rooms.recordset,
          services: services.recordset
        },
        payments: payments.recordset
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════
// POST /api/invoices/:id/issue
// Issue invoice: DRAFT → ISSUED
// ═══════════════════════════════════════════════
router.post('/:id/issue', async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ success: false, error: 'Invalid invoice ID' });
    }

    const pool = getSqlPool();
    const result = await pool.request()
      .input('id', sql.BigInt, invoiceId)
      .query(`
        UPDATE Invoice
        SET status = 'ISSUED', issued_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE invoice_id = @id AND status = 'DRAFT'
      `);

    if (result.recordset.length === 0) {
      return res.status(409).json({
        success: false,
        error: 'Invoice not found or not in DRAFT status'
      });
    }

    res.json({ success: true, message: 'Invoice issued', data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
