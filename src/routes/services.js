/**
 * LuxeReserve - Service Routes
 * Manage hotel services & incidental charges during stay
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');
const { requireAuth, requireSystemUser } = require('../middleware/auth');

function ensureReservationAccess(req, res, guestId) {
  if (req.auth?.user_type === 'SYSTEM_USER') {
    return true;
  }

  if (req.auth?.user_type === 'GUEST' && Number(req.auth.sub) === Number(guestId)) {
    return true;
  }

  res.status(403).json({ success: false, error: 'You are not authorised to access this reservation service data' });
  return false;
}

function normalizeSqlDateTime(value) {
  if (!value) return null;

  const raw = String(value).trim();
  const localDateTime = raw.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/);
  if (localDateTime) {
    return `${localDateTime[1]} ${localDateTime[2]}:${localDateTime[3] || '00'}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const pad = (n) => String(n).padStart(2, '0');
  return [
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`,
  ].join(' ');
}

// 
// GET /api/services?hotel_id=1
// List available services for a hotel
// 
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

// 
// POST /api/services/order
// Order a service (incidental charge) for a reservation
// 
router.post('/order', requireAuth, async (req, res) => {
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
        SELECT r.reservation_id, r.reservation_status, r.hotel_id, r.guest_id,
               rr.reservation_room_id
        FROM Reservation r
        LEFT JOIN ReservationRoom rr ON r.reservation_id = rr.reservation_id
        WHERE r.reservation_id = @resvId
      `);

    if (resvCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    const reservation = resvCheck.recordset[0];
    if (!ensureReservationAccess(req, res, reservation.guest_id)) {
      return;
    }

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

    const scheduledAtSql = normalizeSqlDateTime(scheduled_at);
    if (scheduled_at && !scheduledAtSql) {
      return res.status(400).json({ success: false, error: 'scheduled_at must be a valid date/time' });
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
      .input('scheduledAt', sql.VarChar(19), scheduledAtSql)
      .input('qty', sql.Int, qty)
      .input('unitPrice', sql.Decimal(18, 2), unitPrice)
      .input('finalAmount', sql.Decimal(18, 2), finalAmount)
      .input('instruction', sql.NVarChar(255), special_instruction || null)
      .query(`
        INSERT INTO ReservationService
          (reservation_id, reservation_room_id, service_id, scheduled_at,
           quantity, unit_price, final_amount, service_status, special_instruction)
        OUTPUT INSERTED.*
        VALUES (@resvId, @resvRoomId, @svcId, TRY_CONVERT(DATETIME, @scheduledAt, 120),
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

// 
// GET /api/services/orders?reservation_id=1
//   or /api/services/orders?hotel_id=1&status=REQUESTED
// List service orders (guest view or staff hotel-wide view)
// 
router.get('/orders', requireAuth, async (req, res) => {
  try {
    const pool = getSqlPool();
    const { reservation_id, hotel_id, status } = req.query;

    if (!reservation_id && !hotel_id) {
      return res.status(400).json({ success: false, error: 'Provide reservation_id or hotel_id' });
    }

    // Guest view: single reservation
    if (reservation_id) {
      const accessCheck = await pool.request()
        .input('resvId', sql.BigInt, parseInt(reservation_id))
        .query('SELECT reservation_id, guest_id FROM Reservation WHERE reservation_id = @resvId');

      if (accessCheck.recordset.length === 0) {
        return res.status(404).json({ success: false, error: 'Reservation not found' });
      }
      if (!ensureReservationAccess(req, res, accessCheck.recordset[0].guest_id)) {
        return;
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

      const orders = result.recordset;
      const totalAmount   = orders.reduce((s, o) => s + parseFloat(o.final_amount), 0);
      const activeOrders  = orders.filter(o => o.service_status !== 'CANCELLED');
      const activeTotal   = activeOrders.reduce((s, o) => s + parseFloat(o.final_amount), 0);

      return res.json({
        success: true,
        count: orders.length,
        summary: { total_orders: orders.length, active_orders: activeOrders.length, total_amount: totalAmount, active_amount: activeTotal },
        data: orders,
      });
    }

    // Staff view: all orders for a hotel (optional status filter)
    if (req.auth?.user_type !== 'SYSTEM_USER') {
      return res.status(403).json({ success: false, error: 'System user access required for hotel-wide service orders' });
    }
    const request = pool.request().input('hotelId', sql.BigInt, parseInt(hotel_id));
    let statusClause = '';
    if (status) {
      request.input('status', sql.VarChar(15), status.toUpperCase());
      statusClause = 'AND rs.service_status = @status';
    }

    const result = await request.query(`
      SELECT rs.reservation_service_id, rs.reservation_id,
             r.reservation_code, r.reservation_status,
             g.first_name + ' ' + g.last_name AS guest_name, g.email AS guest_email,
             rm.room_number, rm.floor_number,
             rs.service_id, sc.service_name, sc.service_category, sc.pricing_model,
             rs.scheduled_at, rs.quantity, rs.unit_price,
             rs.final_amount, rs.service_status, rs.special_instruction,
             rs.created_at, rs.updated_at,
             h.currency_code,
             CASE WHEN pay.payment_id IS NOT NULL THEN 1 ELSE 0 END AS is_paid,
             pay.paid_at,
             pay.payment_method AS paid_method
      FROM ReservationService rs
      JOIN ServiceCatalog sc   ON rs.service_id       = sc.service_id
      JOIN Reservation r       ON rs.reservation_id   = r.reservation_id
      JOIN Guest g             ON r.guest_id           = g.guest_id
      LEFT JOIN ReservationRoom rr ON rr.reservation_id = r.reservation_id
      LEFT JOIN Room rm            ON rr.room_id        = rm.room_id
      JOIN Hotel h             ON sc.hotel_id          = h.hotel_id
      LEFT JOIN Payment pay    ON pay.reservation_id   = r.reservation_id
                               AND pay.payment_reference = 'INCIDENTAL-ORDER-' + CAST(rs.reservation_service_id AS VARCHAR(20))
                               AND pay.payment_status  = 'CAPTURED'
      WHERE sc.hotel_id = @hotelId ${statusClause}
      ORDER BY
        CASE rs.service_status WHEN 'REQUESTED' THEN 0 WHEN 'CONFIRMED' THEN 1 ELSE 2 END,
        rs.created_at DESC
    `);

    const orders = result.recordset;
    return res.json({
      success: true,
      count: orders.length,
      data: orders,
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// 
// PUT /api/services/orders/:id/status
// Update service order status (CONFIRMED, DELIVERED, CANCELLED)
// 
router.put('/orders/:id/status', requireSystemUser, async (req, res) => {
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


    // Validate order and reservation status before allowing update
    const orderCheck = await pool.request()
      .input('orderId', sql.BigInt, orderId)
      .query(`
        SELECT rs.reservation_service_id, rs.service_status,
               r.reservation_id, r.reservation_status
        FROM ReservationService rs
        JOIN Reservation r ON rs.reservation_id = r.reservation_id
        WHERE rs.reservation_service_id = @orderId
      `);

    if (orderCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Service order not found' });
    }

    const orderRow = orderCheck.recordset[0];

    // Block CONFIRM/DELIVER if reservation is already closed
    if (['CONFIRMED', 'DELIVERED'].includes(status) &&
        ['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].includes(orderRow.reservation_status)) {
      return res.status(409).json({
        success: false,
        error: 'Cannot update service to ' + status + ': reservation is already ' + orderRow.reservation_status + '. Only CANCELLED is allowed.',
      });
    }
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

// 
// POST /api/services/orders/:id/pay
// Pay for a specific incidental service order
// 
router.post('/orders/:id/pay', requireSystemUser, async (req, res) => {
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

    // Block payment for orders that were never confirmed before checkout
    if (order.service_status === 'REQUESTED') {
      return res.status(409).json({
        success: false,
        error: 'Service order is still REQUESTED and was not confirmed. Please cancel it instead of charging.',
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
