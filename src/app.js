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
      hotels: '/api/hotels',
      rooms: '/api/rooms',
      guests: '/api/guests',
      reservations: '/api/reservations',
      payments: '/api/payments',
      admin: '/api/admin',
      locations: '/api/locations',
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
