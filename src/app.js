/**
 * LuxeReserve — Express Application Entry Point
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
const adminRoutes = require('./routes/admin');
const locationRoutes = require('./routes/locations');
const serviceRoutes = require('./routes/services');
const housekeepingRoutes = require('./routes/housekeeping');
const maintenanceRoutes = require('./routes/maintenance');
const invoiceRoutes = require('./routes/invoices');

const app = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════
// Middleware
// ═══════════════════════════════════
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ═══════════════════════════════════
// Routes
// ═══════════════════════════════════
app.get('/api', (req, res) => {
  res.json({
    name: 'LuxeReserve API',
    version: '1.0.0',
    description: 'Global Luxury Hotel Reservation Engine — Polyglot Persistence',
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
      reservations: {
        'POST /api/reservations': 'Create reservation with direct pessimistic locking on RoomAvailability (body: hotel_id, guest_id, room_id, checkin_date, checkout_date, nightly_rate, ...)',
        'GET /api/reservations/:code': 'Get reservation by confirmation code',
        'POST /api/reservations/:id/checkin': 'Check-in process (body: agent_id)',
        'POST /api/reservations/:id/checkout': 'Check-out process (body: agent_id)',
        'POST /api/reservations/:id/guest-cancel': 'Guest cancellation — forfeit deposit, no refund (body: reason)',
        'POST /api/reservations/:id/hotel-cancel': 'Hotel cancellation — full refund issued (body: reason, agent_id)',
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
        'PUT /api/admin/rates/:id': 'Update room rate — triggers Price Guard if change > 50% (body: final_rate)',
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
        'POST /api/maintenance': 'Create ticket → auto Room.maintenance_status (body: hotel_id, room_id, issue_category, issue_description)',
        'PUT /api/maintenance/:id': 'Update ticket — resolve restores Room status (body: status, resolution_note)',
      },
      invoices: {
        'POST /api/invoices': 'Generate invoice from vw_ReservationTotal (body: reservation_id)',
        'GET /api/invoices/:id': 'Get invoice with line items (rooms + services + payments)',
        'POST /api/invoices/:id/issue': 'Issue invoice: DRAFT → ISSUED',
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
app.use('/api/reservations', reservationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/housekeeping', housekeepingRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/invoices', invoiceRoutes);

// ═══════════════════════════════════
// Error Handler
// ═══════════════════════════════════
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// ═══════════════════════════════════
// Startup
// ═══════════════════════════════════
async function start() {
  try {
    await connectSQL();
    await connectMongo();

    app.listen(PORT, () => {
      console.log(`\n🏨 LuxeReserve API running at http://localhost:${PORT}/api\n`);
    });
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await closeAll();
  process.exit(0);
});

start();
