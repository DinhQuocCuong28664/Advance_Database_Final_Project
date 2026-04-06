/**
 * LuxeReserve — Service Routes
 * Manage hotel services & incidental charges during stay
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');

// ═══════════════════════════════════════════════
// GET /api/services?hotel_id=1
// List available services for a hotel
// ═══════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const pool = getSqlPool();
    const { hotel_id } = req.query;

    if (!hotel_id) {
      return res.status(400).json({ success: false, error: 'hotel_id query parameter is required' });
    }

    const result = await pool.request()
      .input('hotelId', sql.BigInt, parseInt(hotel_id))
      .query(`
        SELECT sc.service_id, sc.hotel_id, sc.service_code, sc.service_name,
               sc.service_category, sc.pricing_model, sc.base_price,
               sc.is_active, sc.requires_advance_booking, sc.description_short,
               h.currency_code
        FROM ServiceCatalog sc
        JOIN Hotel h ON sc.hotel_id = h.hotel_id
        WHERE sc.hotel_id = @hotelId AND sc.is_active = 1
        ORDER BY sc.service_category, sc.service_name
      `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════
// POST /api/services/order
// Order a service (incidental charge) for a reservation
// ═══════════════════════════════════════════════
router.post('/order', async (req, res) => {
  try {
    const { reservation_id, service_id, quantity, special_instruction, scheduled_at } = req.body;

    if (!reservation_id || !service_id) {
      return res.status(400).json({
        success: false,
        error: 'reservation_id and service_id are required'
      });
    }

    const pool = getSqlPool();

    // Validate reservation exists and is in a valid state (CONFIRMED or CHECKED_IN)
    const resvCheck = await pool.request()
      .input('resvId', sql.BigInt, reservation_id)
      .query(`
        SELECT r.reservation_id, r.reservation_status, r.hotel_id,
               rr.reservation_room_id
        FROM Reservation r
        LEFT JOIN ReservationRoom rr ON r.reservation_id = rr.reservation_id
        WHERE r.reservation_id = @resvId
      `);

    if (resvCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    const reservation = resvCheck.recordset[0];

    if (!['CONFIRMED', 'CHECKED_IN'].includes(reservation.reservation_status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot order services for reservation with status: ${reservation.reservation_status}. Must be CONFIRMED or CHECKED_IN.`
      });
    }

    // Validate service exists and belongs to the same hotel
    const svcCheck = await pool.request()
      .input('svcId', sql.BigInt, service_id)
      .input('hotelId', sql.BigInt, reservation.hotel_id)
      .query(`
        SELECT service_id, service_name, base_price, is_active, service_category, pricing_model
        FROM ServiceCatalog
        WHERE service_id = @svcId AND hotel_id = @hotelId
      `);

    if (svcCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Service not found or does not belong to this hotel'
      });
    }

    const service = svcCheck.recordset[0];

    if (!service.is_active) {
      return res.status(400).json({ success: false, error: 'This service is currently unavailable' });
    }

    // Calculate amounts
    const qty = quantity || 1;
    const unitPrice = parseFloat(service.base_price);
    const finalAmount = unitPrice * qty;

    // Insert into ReservationService
    const result = await pool.request()
      .input('resvId', sql.BigInt, reservation_id)
      .input('resvRoomId', sql.BigInt, reservation.reservation_room_id || null)
      .input('svcId', sql.BigInt, service_id)
      .input('scheduledAt', sql.DateTime, scheduled_at ? new Date(scheduled_at) : null)
      .input('qty', sql.Int, qty)
      .input('unitPrice', sql.Decimal(18, 2), unitPrice)
      .input('finalAmount', sql.Decimal(18, 2), finalAmount)
      .input('instruction', sql.NVarChar(255), special_instruction || null)
      .query(`
        INSERT INTO ReservationService
          (reservation_id, reservation_room_id, service_id, scheduled_at,
           quantity, unit_price, final_amount, service_status, special_instruction)
        OUTPUT INSERTED.*
        VALUES (@resvId, @resvRoomId, @svcId, @scheduledAt,
                @qty, @unitPrice, @finalAmount, 'REQUESTED', @instruction)
      `);

    res.status(201).json({
      success: true,
      data: {
        ...result.recordset[0],
        service_name: service.service_name,
        service_category: service.service_category
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════
// GET /api/services/orders?reservation_id=1
// List all service orders for a reservation
// ═══════════════════════════════════════════════
router.get('/orders', async (req, res) => {
  try {
    const pool = getSqlPool();
    const { reservation_id } = req.query;

    if (!reservation_id) {
      return res.status(400).json({ success: false, error: 'reservation_id query parameter is required' });
    }

    const result = await pool.request()
      .input('resvId', sql.BigInt, parseInt(reservation_id))
      .query(`
        SELECT rs.reservation_service_id, rs.reservation_id,
               rs.service_id, sc.service_name, sc.service_category, sc.pricing_model,
               rs.scheduled_at, rs.quantity, rs.unit_price, rs.discount_amount,
               rs.final_amount, rs.service_status, rs.special_instruction,
               rs.created_at
        FROM ReservationService rs
        JOIN ServiceCatalog sc ON rs.service_id = sc.service_id
        WHERE rs.reservation_id = @resvId
        ORDER BY rs.created_at DESC
      `);

    // Calculate totals
    const orders = result.recordset;
    const totalAmount = orders.reduce((sum, o) => sum + parseFloat(o.final_amount), 0);
    const activeOrders = orders.filter(o => o.service_status !== 'CANCELLED');
    const activeTotal = activeOrders.reduce((sum, o) => sum + parseFloat(o.final_amount), 0);

    res.json({
      success: true,
      count: orders.length,
      summary: {
        total_orders: orders.length,
        active_orders: activeOrders.length,
        total_amount: totalAmount,
        active_amount: activeTotal
      },
      data: orders
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════
// PUT /api/services/orders/:id/status
// Update service order status (CONFIRMED, DELIVERED, CANCELLED)
// ═══════════════════════════════════════════════
router.put('/orders/:id/status', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, error: 'Invalid order ID' });
    }

    const validStatuses = ['CONFIRMED', 'DELIVERED', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const pool = getSqlPool();

    const result = await pool.request()
      .input('orderId', sql.BigInt, orderId)
      .input('status', sql.VarChar(15), status)
      .query(`
        UPDATE ReservationService
        SET service_status = @status, updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE reservation_service_id = @orderId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Service order not found' });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════
// POST /api/services/orders/:id/pay
// Pay for a specific incidental service order
// ═══════════════════════════════════════════════
router.post('/orders/:id/pay', async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const { payment_method } = req.body;

    if (isNaN(orderId)) {
      return res.status(400).json({ success: false, error: 'Invalid order ID' });
    }

    const pool = getSqlPool();

    // Get service order details
    const orderCheck = await pool.request()
      .input('orderId', sql.BigInt, orderId)
      .query(`
        SELECT rs.reservation_service_id, rs.reservation_id, rs.final_amount,
               rs.service_status, sc.service_name, r.currency_code
        FROM ReservationService rs
        JOIN ServiceCatalog sc ON rs.service_id = sc.service_id
        JOIN Reservation r ON rs.reservation_id = r.reservation_id
        WHERE rs.reservation_service_id = @orderId
      `);

    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Service order not found' });
    }

    const order = orderCheck.recordset[0];

    if (order.service_status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot pay for a cancelled service order'
      });
    }

    // Check if already paid (look for existing INCIDENTAL_HOLD payment referencing this order)
    const existingPayment = await pool.request()
      .input('resvId', sql.BigInt, order.reservation_id)
      .input('ref', sql.VarChar(80), `INCIDENTAL-ORDER-${orderId}`)
      .query(`
        SELECT payment_id FROM Payment
        WHERE reservation_id = @resvId AND payment_reference = @ref
          AND payment_status = 'CAPTURED'
      `);

    if (existingPayment.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Service order #${orderId} has already been paid`
      });
    }

    // Create payment for this incidental service
    const payRef = `INCIDENTAL-ORDER-${orderId}`;
    const result = await pool.request()
      .input('resvId', sql.BigInt, order.reservation_id)
      .input('ref', sql.VarChar(80), payRef)
      .input('method', sql.VarChar(20), payment_method || 'CREDIT_CARD')
      .input('amount', sql.Decimal(18, 2), order.final_amount)
      .input('currency', sql.Char(3), order.currency_code)
      .query(`
        INSERT INTO Payment
          (reservation_id, payment_reference, payment_type, payment_method,
           payment_status, amount, currency_code, paid_at)
        OUTPUT INSERTED.*
        VALUES (@resvId, @ref, 'INCIDENTAL_HOLD', @method,
                'CAPTURED', @amount, @currency, GETDATE())
      `);

    // Update service status to DELIVERED if not already
    if (order.service_status !== 'DELIVERED') {
      await pool.request()
        .input('orderId', sql.BigInt, orderId)
        .query(`
          UPDATE ReservationService
          SET service_status = 'DELIVERED', updated_at = GETDATE()
          WHERE reservation_service_id = @orderId
        `);
    }

    res.status(201).json({
      success: true,
      message: `Payment captured for service: ${order.service_name}`,
      data: {
        payment: result.recordset[0],
        service_order_id: orderId,
        service_name: order.service_name
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
