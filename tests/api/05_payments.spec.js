/**
 * ══════════════════════════════════════════════════════════════
 * [05] PAYMENTS API — Playwright Tests
 * Endpoints:
 *   POST /api/payments
 *   GET  /api/payments
 * ══════════════════════════════════════════════════════════════
 */
const { test, expect } = require('@playwright/test');
const { SEED, DATES, futureDate } = require('./helpers');

let testReservation = null;
let depositAmount = 0;

async function findAvailableRoom(request, hotelId, checkin, checkout) {
  const res = await request.get('/api/rooms/availability', {
    params: { hotel_id: hotelId, checkin, checkout },
  });
  const body = await res.json();
  return (body.data && body.data.length > 0) ? body.data[0] : null;
}

test.describe('💳 Payments API', () => {

  // Setup: Create a fresh reservation to pay against
  test.beforeAll(async ({ request }) => {
    const cin  = futureDate(100);
    const cout = futureDate(102);
    const room = await findAvailableRoom(request, SEED.hotel.id, cin, cout);
    if (!room) return;

    const rate = room.min_nightly_rate || 1000000;
    const res = await request.post('/api/reservations', {
      data: {
        hotel_id: SEED.hotel.id,
        guest_id: SEED.guest.id,
        room_id: room.room_id,
        checkin_date: cin,
        checkout_date: cout,
        nightly_rate: rate,
        currency_code: 'VND',
        guarantee_type: 'DEPOSIT',
      },
    });
    if (res.status() === 201) {
      testReservation = (await res.json()).data;
      depositAmount = Math.round(testReservation.total * 0.3);
    }
  });

  // ── GET /payments ──────────────────────────────────────────
  test('GET /payments — returns all payments', async ({ request }) => {
    const res = await request.get('/api/payments');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /payments?reservation_id= — filter by reservation', async ({ request }) => {
    if (!testReservation) return test.skip();
    const res = await request.get('/api/payments', {
      params: { reservation_id: testReservation.reservation_id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  // ── POST /payments — Validation ────────────────────────────
  test('POST /payments — missing reservation_id → 400', async ({ request }) => {
    const res = await request.post('/api/payments', {
      data: { amount: 100000 },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /payments — missing amount → 400', async ({ request }) => {
    const res = await request.post('/api/payments', {
      data: { reservation_id: 1 },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /payments — amount <= 0 → 400', async ({ request }) => {
    const res = await request.post('/api/payments', {
      data: { reservation_id: 1, amount: 0 },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /payments — reservation not found → 404', async ({ request }) => {
    const res = await request.post('/api/payments', {
      data: { reservation_id: 99999, amount: 100000 },
    });
    expect(res.status()).toBe(404);
  });

  // ── POST /payments — DEPOSIT ───────────────────────────────
  test('POST /payments — pay DEPOSIT (30%)', async ({ request }) => {
    if (!testReservation || depositAmount <= 0) return test.skip();
    const res = await request.post('/api/payments', {
      data: {
        reservation_id: testReservation.reservation_id,
        payment_type: 'DEPOSIT',
        payment_method: 'CREDIT_CARD',
        amount: depositAmount,
        currency_code: 'VND',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.payment_type).toBe('DEPOSIT');
    expect(body.data.payment_status).toBe('CAPTURED');
    expect(body.data).toHaveProperty('payment_reference');
    expect(body.payment_summary).toHaveProperty('remaining_balance');
  });

  test('POST /payments — DEPOSIT exceeding allowed → 400 or 409', async ({ request }) => {
    if (!testReservation || depositAmount <= 0) return test.skip();
    // Try to pay deposit again (would exceed deposit_amount)
    const res = await request.post('/api/payments', {
      data: {
        reservation_id: testReservation.reservation_id,
        payment_type: 'DEPOSIT',
        payment_method: 'CREDIT_CARD',
        amount: depositAmount,
        currency_code: 'VND',
      },
    });
    expect([400, 409]).toContain(res.status());
  });

  // ── POST /payments — FULL_PAYMENT ──────────────────────────
  test('POST /payments — pay remaining FULL_PAYMENT', async ({ request }) => {
    if (!testReservation) return test.skip();

    // Get current balance
    const checkRes = await request.get(`/api/reservations/${testReservation.reservation_code}`);
    const fin = (await checkRes.json()).data;
    const remaining = parseFloat(fin.balance_due);
    if (remaining <= 0) return test.skip();

    const res = await request.post('/api/payments', {
      data: {
        reservation_id: testReservation.reservation_id,
        payment_type: 'FULL_PAYMENT',
        payment_method: 'BANK_TRANSFER',
        amount: remaining,
        currency_code: 'VND',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.payment_summary.remaining_balance).toBe(0);
  });

});
