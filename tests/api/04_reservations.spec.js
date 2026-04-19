/**
 * ══════════════════════════════════════════════════════════════
 * [04] RESERVATIONS API — Full Lifecycle Test
 * Endpoints:
 *   POST /api/reservations
 *   GET  /api/reservations/:code
 *   POST /api/reservations/:id/checkin
 *   POST /api/reservations/:id/checkout
 *   POST /api/reservations/:id/guest-cancel
 *   POST /api/reservations/:id/hotel-cancel
 *   POST /api/reservations/:id/transfer
 * ══════════════════════════════════════════════════════════════
 */
const { test, expect } = require('@playwright/test');
const { SEED, DATES, futureDate } = require('./helpers');

// Shared state across lifecycle tests
let reservation = null;       // created in first test, used by all
let cancelReservation = null; // for guest-cancel test
let hotelCancelReservation = null; // for hotel-cancel test

// ─────────────────────────────────────────────────────────────
// Helper: find an available room for the given hotel + dates
// ─────────────────────────────────────────────────────────────
async function findAvailableRoom(request, hotelId, checkin, checkout) {
  const res = await request.get('/api/rooms/availability', {
    params: { hotel_id: hotelId, checkin, checkout },
  });
  const body = await res.json();
  if (!body.data || body.data.length === 0) return null;
  return body.data[0];
}

test.describe('📋 Reservations API — Full Lifecycle', () => {

  // ── POST /reservations — Validation ───────────────────────
  test('POST /reservations — missing required fields → 400', async ({ request }) => {
    const res = await request.post('/api/reservations', {
      data: { hotel_id: SEED.hotel.id, guest_id: SEED.guest.id }, // missing room, dates
    });
    expect(res.status()).toBe(400);
  });

  test('POST /reservations — nightly_rate <= 0 → 400', async ({ request }) => {
    const res = await request.post('/api/reservations', {
      data: {
        hotel_id: SEED.hotel.id,
        guest_id: SEED.guest.id,
        room_id: 1,
        checkin_date: DATES.checkin,
        checkout_date: DATES.checkout,
        nightly_rate: 0,
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /reservations — checkout before checkin → 400', async ({ request }) => {
    const res = await request.post('/api/reservations', {
      data: {
        hotel_id: SEED.hotel.id,
        guest_id: SEED.guest.id,
        room_id: 1,
        checkin_date: DATES.checkout,
        checkout_date: DATES.checkin,
        nightly_rate: 500000,
      },
    });
    expect(res.status()).toBe(400);
  });

  // ── POST /reservations — Success ───────────────────────────
  test('POST /reservations — create reservation (pessimistic locking)', async ({ request }) => {
    const room = await findAvailableRoom(request, SEED.hotel.id, DATES.checkin, DATES.checkout);
    if (!room) return test.skip();

    const res = await request.post('/api/reservations', {
      data: {
        hotel_id: SEED.hotel.id,
        guest_id: SEED.guest.id,
        room_id: room.room_id,
        room_type_id: room.room_type_id,
        checkin_date: DATES.checkin,
        checkout_date: DATES.checkout,
        adult_count: 2,
        nightly_rate: room.min_nightly_rate || 1000000,
        currency_code: 'VND',
        guarantee_type: 'DEPOSIT',
        purpose_of_stay: 'LEISURE',
        special_request_text: 'Playwright test reservation',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.reservation_code).toMatch(/^RES-/);
    expect(body.data.status).toBe('CONFIRMED');
    expect(body.data.deposit_required).toBe(true);
    reservation = body.data;
  });

  // ── GET /reservations/:code ────────────────────────────────
  test('GET /reservations/:code — fetch by code', async ({ request }) => {
    if (!reservation) return test.skip();
    const res = await request.get(`/api/reservations/${reservation.reservation_code}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.reservation_code).toBe(reservation.reservation_code);
    expect(body.data).toHaveProperty('rooms');
    expect(body.data).toHaveProperty('status_history');
    // vw_ReservationTotal fields
    expect(body.data).toHaveProperty('grand_total');
    expect(body.data).toHaveProperty('total_paid');
    expect(body.data).toHaveProperty('balance_due');
  });

  test('GET /reservations/:code — not found → 404', async ({ request }) => {
    const res = await request.get('/api/reservations/RES-NOTEXIST-999');
    expect(res.status()).toBe(404);
  });

  // ── POST /reservations/:id/checkin ─────────────────────────
  test('POST /reservations/:id/checkin — check in', async ({ request }) => {
    if (!reservation) return test.skip();
    const res = await request.post(`/api/reservations/${reservation.reservation_id}/checkin`, {
      data: { agent_id: SEED.staff.id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.reservation_status).toBe('CHECKED_IN');
  });

  test('POST /checkin — already checked in → 409', async ({ request }) => {
    if (!reservation) return test.skip();
    const res = await request.post(`/api/reservations/${reservation.reservation_id}/checkin`, {
      data: { agent_id: SEED.staff.id },
    });
    expect(res.status()).toBe(409);
  });

  // ── POST /reservations/:id/checkout ────────────────────────
  test('POST /reservations/:id/checkout — check out + auto housekeeping task', async ({ request }) => {
    if (!reservation) return test.skip();
    const res = await request.post(`/api/reservations/${reservation.reservation_id}/checkout`, {
      data: { agent_id: SEED.staff.id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.reservation_status).toBe('CHECKED_OUT');
    // vw_ReservationTotal should be in financials
    expect(body.financials).toHaveProperty('grand_total');
  });

  test('POST /checkout — already checked out → 409', async ({ request }) => {
    if (!reservation) return test.skip();
    const res = await request.post(`/api/reservations/${reservation.reservation_id}/checkout`, {
      data: { agent_id: SEED.staff.id },
    });
    expect(res.status()).toBe(409);
  });

  // ── POST /reservations/:id/guest-cancel ───────────────────
  test('POST /reservations — create reservation for guest-cancel', async ({ request }) => {
    const cin  = futureDate(80);
    const cout = futureDate(82);
    const room = await findAvailableRoom(request, SEED.hotel.id, cin, cout);
    if (!room) return test.skip();

    const res = await request.post('/api/reservations', {
      data: {
        hotel_id: SEED.hotel.id,
        guest_id: SEED.guest2.id,
        room_id: room.room_id,
        checkin_date: cin,
        checkout_date: cout,
        nightly_rate: room.min_nightly_rate || 800000,
        currency_code: 'VND',
        guarantee_type: 'CARD',
      },
    });
    if (res.status() === 201) cancelReservation = (await res.json()).data;
  });

  test('POST /reservations/:id/guest-cancel — cancel and forfeit deposit', async ({ request }) => {
    if (!cancelReservation) return test.skip();
    const res = await request.post(`/api/reservations/${cancelReservation.reservation_id}/guest-cancel`, {
      data: { reason: 'Change of travel plans - Playwright test' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.reservation_status).toBe('CANCELLED');
  });

  test('POST /guest-cancel — not in CONFIRMED → 409', async ({ request }) => {
    if (!cancelReservation) return test.skip();
    // Already cancelled, try again
    const res = await request.post(`/api/reservations/${cancelReservation.reservation_id}/guest-cancel`, {
      data: { reason: 'Again' },
    });
    expect(res.status()).toBe(409);
  });

  // ── POST /reservations/:id/hotel-cancel ──────────────────
  test('POST /reservations — create reservation for hotel-cancel', async ({ request }) => {
    const cin  = futureDate(90);
    const cout = futureDate(92);
    const room = await findAvailableRoom(request, SEED.hotel.id, cin, cout);
    if (!room) return test.skip();

    const res = await request.post('/api/reservations', {
      data: {
        hotel_id: SEED.hotel.id,
        guest_id: SEED.guest.id,
        room_id: room.room_id,
        checkin_date: cin,
        checkout_date: cout,
        nightly_rate: room.min_nightly_rate || 800000,
        currency_code: 'VND',
        guarantee_type: 'CARD',
      },
    });
    if (res.status() === 201) hotelCancelReservation = (await res.json()).data;
  });

  test('POST /reservations/:id/hotel-cancel — cancel by hotel', async ({ request }) => {
    if (!hotelCancelReservation) return test.skip();
    const res = await request.post(`/api/reservations/${hotelCancelReservation.reservation_id}/hotel-cancel`, {
      data: { reason: 'Room issue - Playwright test', agent_id: SEED.staff.id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.reservation_status).toBe('CANCELLED');
  });

  test('POST /hotel-cancel — missing reason → 400', async ({ request }) => {
    if (!hotelCancelReservation) return test.skip();
    const res = await request.post(`/api/reservations/${hotelCancelReservation.reservation_id}/hotel-cancel`, {
      data: { agent_id: 1 }, // missing reason
    });
    expect(res.status()).toBe(400);
  });

  // ── POST /reservations/:id/transfer ───────────────────────
  test('POST /reservations/:id/transfer — invalid reservation → 404', async ({ request }) => {
    const res = await request.post('/api/reservations/99999/transfer', {
      data: { new_room_id: 2, reason: 'Test', agent_id: 1 },
    });
    expect(res.status()).toBe(404);
  });

  test('POST /transfer — missing new_room_id → 400', async ({ request }) => {
    const res = await request.post('/api/reservations/1/transfer', {
      data: { reason: 'Test', agent_id: 1 },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /transfer — missing reason → 400', async ({ request }) => {
    const res = await request.post('/api/reservations/1/transfer', {
      data: { new_room_id: 2, agent_id: 1 },
    });
    expect(res.status()).toBe(400);
  });

});
