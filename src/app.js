/**
 * LuxeReserve - Express Application Entry Point
 * Global Luxury Hotel Reservation Engine
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectSQL, connectMongo, closeAll } = require('./config/database');

// Route imports
const hotelRoutes = require('./routes/hotels');
const roomRoutes = require('./routes/rooms');
const guestRoutes = require('./routes/guests');
const reservationRoutes = require('./routes/reservations');
const paymentRoutes = require('./routes/payments');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const promotionRoutes = require('./routes/promotions');
const locationRoutes = require('./routes/locations');
const serviceRoutes = require('./routes/services');
const housekeepingRoutes = require('./routes/housekeeping');
const maintenanceRoutes = require('./routes/maintenance');
const invoiceRoutes = require('./routes/invoices');
const vnpayRoutes  = require('./routes/vnpay');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// Middleware
// ============================================================
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ============================================================
// Routes
// ============================================================
app.get('/api', (req, res) => {
  res.json({
    name: 'LuxeReserve API',
    version: '1.0.0',
    description: 'Global Luxury Hotel Reservation Engine - Polyglot Persistence',
    engines: {
      sql: 'SQL Server 2022 Express (ACID transactions)',
      nosql: 'MongoDB Atlas (Flexible content)',
    },
    endpoints: {
      hotels: {
        'GET /api/hotels': 'List all hotels (Hybrid SQL + MongoDB merge)',
        'GET /api/hotels/:id': 'Get hotel detail with room types, amenities, images',
      },
      rooms: {
        'GET /api/rooms/availability?hotel_id&checkin&checkout': 'Check room availability by date range, including availability_records for optimistic locking',
      },
      guests: {
        'GET /api/guests': 'List all guests',
        'GET /api/guests/:id': 'Get guest profile with preferences, loyalty, addresses',
        'POST /api/guests': 'Create new guest (body: guest_code, first_name, last_name, ...)',
      },
      auth: {
        'POST /api/auth/login': 'Unified login that auto-detects system user vs guest account',
        'POST /api/auth/admin/login': 'System user login with username/password',
        'POST /api/auth/guest/register': 'Create a new guest account, or attach login credentials to an existing guest profile',
        'POST /api/auth/guest/login': 'Guest login with login_email or guest_code',
        'GET /api/auth/me': 'Resolve the currently authenticated user from bearer token',
      },
      promotions: {
        'GET /api/promotions?hotel_id=&guest_id=': 'List active promotions, with guest eligibility when a guest context is present',
      },
      reservations: {
        'GET /api/reservations': 'List reservations - filter by guest_id, email, status, limit',
        'GET /api/reservations/by-guest/:guestCode': 'List all reservations for a guest code (e.g. G-DQC)',
        'GET /api/reservations/:code': 'Get reservation by confirmation code',
        'POST /api/reservations': 'Create reservation with direct pessimistic locking on RoomAvailability (body: hotel_id, guest_id, room_id, checkin_date, checkout_date, nightly_rate, ...)',
        'POST /api/reservations/:id/checkin': 'Check-in process (body: agent_id)',
        'POST /api/reservations/:id/checkout': 'Check-out process (body: agent_id)',
        'POST /api/reservations/:id/guest-cancel': 'Guest cancellation - forfeit deposit, no refund (body: reason)',
        'POST /api/reservations/:id/hotel-cancel': 'Hotel cancellation - full refund issued (body: reason, agent_id)',
        'POST /api/reservations/:id/transfer': 'Room transfer via sp_TransferRoom with Pessimistic Locking (body: new_room_id, reason, agent_id)',
      },
      payments: {
        'POST /api/payments': 'Create payment with reservation-state and balance validation (body: reservation_id, amount, payment_type, payment_method, ...)',
        'GET /api/payments?reservation_id=': 'List payments, optionally filter by reservation',
      },
      services: {
        'GET /api/services?hotel_id=': 'List available services for a hotel',
        'POST /api/services/order': 'Order a service (body: reservation_id, service_id, quantity, ...)',
        'GET /api/services/orders?reservation_id=': 'List service orders for a reservation',
        'PUT /api/services/orders/:id/status': 'Update service order status (body: status)',
        'POST /api/services/orders/:id/pay': 'Pay for incidental service (body: payment_method)',
      },
      admin: {
        'PUT /api/admin/rates/:id': 'Update room rate - triggers Price Guard if change > 50% (body: final_rate)',
        'GET /api/admin/rates/alerts': 'View Price Integrity Guard alerts',
        'GET /api/admin/reports/revenue': 'Revenue analytics with Window Functions (per hotel)',
        'GET /api/admin/reports/revenue-by-brand': 'Revenue analytics by Brand & Chain hierarchy (Window Functions)',
        'PUT /api/admin/availability/:id': 'Update room availability with Optimistic Locking using expected_version from GET /api/rooms/availability',
      },
      housekeeping: {
        'GET /api/housekeeping?hotel_id=&status=': 'List housekeeping tasks with priority sorting',
        'POST /api/housekeeping': 'Create housekeeping task (body: hotel_id, room_id, task_type)',
        'PUT /api/housekeeping/:id/assign': 'Assign staff to task (body: staff_id)',
        'PUT /api/housekeeping/:id/status': 'Update status with Room sync (body: status)',
      },
      maintenance: {
        'GET /api/maintenance?hotel_id=&status=': 'List maintenance tickets',
        'POST /api/maintenance': 'Create ticket - auto Room.maintenance_status (body: hotel_id, room_id, issue_category, issue_description)',
        'PUT /api/maintenance/:id': 'Update ticket - resolve restores Room status (body: status, resolution_note)',
      },
      invoices: {
        'GET /api/invoices?reservation_id=': 'List invoices, optionally filtered by reservation',
        'POST /api/invoices': 'Generate invoice from vw_ReservationTotal (body: reservation_id)',
        'GET /api/invoices/:id': 'Get invoice with line items (rooms + services + payments)',
        'POST /api/invoices/:id/issue': 'Issue invoice: DRAFT -> ISSUED',
      },
      vnpay: {
        'POST /api/vnpay/create-payment': 'Create VNPay payment URL (body: reservation_id, amount, order_info)',
        'GET /api/vnpay/return': 'VNPay return URL - verifies signature and redirects to frontend',
        'GET /api/vnpay/ipn': 'VNPay IPN server callback - records payment status',
      },
      locations: {
        'GET /api/locations': 'List all locations (flat)',
        'GET /api/locations/tree?root=&root_id=': 'Location hierarchy tree (Recursive CTE)',
      },
    },
  });
});

app.use('/api/hotels', hotelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/housekeeping', housekeepingRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/vnpay',   vnpayRoutes);

// ============================================================
// Error Handler
// ============================================================
app.use((err, req, res, next) => {
  console.error('[ERROR] Unhandled Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// ============================================================
// Startup
// ============================================================
async function start() {
  try {
    await connectSQL();
    await connectMongo();

    app.listen(PORT, () => {
      console.log(`\n[OK] LuxeReserve API running at http://localhost:${PORT}/api\n`);
    });

    // Background job: cancel abandoned VNPay reservations every 5 minutes
    // Catches the case where user closes the browser tab without completing payment
    // (VNPay return URL never called, so we rely on this sweep)
    const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
    const ABANDON_WINDOW_MIN  = 30;             // cancel after 30 min unpaid

    setInterval(async () => {
      try {
        const { getSqlPool, sql } = require('./config/database');
        const pool = getSqlPool();

        const stuckRows = await pool.request()
          .input('windowMinutes', sql.Int, ABANDON_WINDOW_MIN)
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

        if (stuckRows.recordset.length === 0) return;

        for (const row of stuckRows.recordset) {
          // Cancel reservation
          await pool.request()
            .input('id', sql.BigInt, row.reservation_id)
            .query(`UPDATE Reservation SET reservation_status = 'CANCELLED', updated_at = GETDATE() WHERE reservation_id = @id`);

          // Release room availability
          await pool.request()
            .input('id', sql.BigInt, row.reservation_id)
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
            .input('id', sql.BigInt, row.reservation_id)
            .query(`UPDATE ReservationRoom SET occupancy_status = 'CANCELLED', updated_at = GETDATE() WHERE reservation_id = @id`);

          console.log(`[Cleanup] Cancelled abandoned reservation ${row.reservation_code}`);
        }

        console.log(`[Cleanup] Released ${stuckRows.recordset.length} abandoned reservation(s)`);
      } catch (cleanupErr) {
        console.error('[Cleanup] Error during abandoned reservation sweep:', cleanupErr.message);
      }
    }, CLEANUP_INTERVAL_MS);

    console.log(`[OK] Abandoned reservation cleanup scheduled every ${CLEANUP_INTERVAL_MS / 60000} min`);
  } catch (err) {
    console.error('[ERROR] Startup failed:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[OK] Shutting down...');
  await closeAll();
  process.exit(0);
});

start();
