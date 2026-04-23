/**
 * LuxeReserve — Shared Test Helpers & Seed Data
 * Used across all API spec files.
 */

const BASE_URL = 'http://localhost:3000/api';

// ─── Known seed data (matches database/sql/06_seed_data.sql) ──────────────────
const SEED = {
  hotel: { id: 1 },           // LuxeReserve Saigon
  hotel2: { id: 2 },          // W Bangkok
  guest: { id: 1 },           // Quoc Anh Nguyen
  guest2: { id: 2 },          // Sakura Tanaka
  room: { id: 1 },            // A room in hotel 1
  room2: { id: 7 },           // A room in hotel 2 (W Bangkok)
  roomType: { id: 1 },
  ratePlan: { id: 1 },
  service: { id: 1 },         // A service in hotel 1
  staff: { id: 1 },           // SystemUser agent
  admin: { username: 'admin', password: 'admin123' },
  // Guest login credentials (actual GuestAuth login_email values in DB)
  guestLogin:  { email: 'dqc',  password: 'guest12345' },
  guestLogin2: { email: 'user', password: 'member12345' },
};

// Future dates to avoid conflicts with existing data
const TODAY = new Date();
function futureDate(offsetDays) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const DATES = {
  checkin:  futureDate(60),
  checkout: futureDate(62),
  checkin2: futureDate(70),
  checkout2: futureDate(72),
};

module.exports = { BASE_URL, SEED, DATES, futureDate };
