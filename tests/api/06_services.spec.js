/**
 * ══════════════════════════════════════════════════════════════
 * [06] SERVICES API — Playwright Tests
 * Endpoints:
 *   GET  /api/services
 *   POST /api/services/order
 *   GET  /api/services/orders
 *   PUT  /api/services/orders/:id/status
 *   POST /api/services/orders/:id/pay
 * ══════════════════════════════════════════════════════════════
 */
const { test, expect } = require('@playwright/test');
const { SEED, futureDate } = require('./helpers');

let testReservationId = null;
let testServiceId = null;
let createdOrderId = null;

async function findAvailableRoom(request, hotelId, checkin, checkout) {
  const res = await request.get('/api/rooms/availability', {
    params: { hotel_id: hotelId, checkin, checkout },
  });
  const body = await res.json();
  return (body.data && body.data.length > 0) ? body.data[0] : null;
}

test.describe('🛎️ Services API', () => {

  // Setup: Create reservation + get service
  test.beforeAll(async ({ request }) => {
    const cin  = futureDate(110);
    const cout = futureDate(112);
    const room = await findAvailableRoom(request, SEED.hotel.id, cin, cout);
    if (room) {
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
      if (res.status() === 201) {
        testReservationId = (await res.json()).data.reservation_id;
      }
    }

    // Get a service for hotel 1
    const svcRes = await request.get('/api/services', {
      params: { hotel_id: SEED.hotel.id },
    });
    const svcBody = await svcRes.json();
    if (svcBody.data && svcBody.data.length > 0) {
      testServiceId = svcBody.data[0].service_id;
    }
  });

  // ── GET /services ──────────────────────────────────────────
  test('GET /services?hotel_id= — returns service catalog', async ({ request }) => {
    const res = await request.get('/api/services', {
      params: { hotel_id: SEED.hotel.id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) {
      expect(body.data[0]).toHaveProperty('service_id');
      expect(body.data[0]).toHaveProperty('service_name');
    }
  });

  test('GET /services — missing hotel_id → 400', async ({ request }) => {
    const res = await request.get('/api/services');
    expect(res.status()).toBe(400);
  });

  // ── POST /services/order — Validation ─────────────────────
  test('POST /services/order — missing reservation_id → 400', async ({ request }) => {
    const res = await request.post('/api/services/order', {
      data: { service_id: 1 },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /services/order — missing service_id → 400', async ({ request }) => {
    const res = await request.post('/api/services/order', {
      data: { reservation_id: 1 },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /services/order — reservation not found → 404', async ({ request }) => {
    const res = await request.post('/api/services/order', {
      data: { reservation_id: 99999, service_id: 1 },
    });
    expect(res.status()).toBe(404);
  });

  // ── POST /services/order — Success ────────────────────────
  test('POST /services/order — create service order', async ({ request }) => {
    if (!testReservationId || !testServiceId) return test.skip();
    const res = await request.post('/api/services/order', {
      data: {
        reservation_id: testReservationId,
        service_id: testServiceId,
        quantity: 1,
        special_instruction: 'Playwright test order',
        scheduled_at: `${futureDate(111)}T14:00:00`,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.service_status).toBe('REQUESTED');
    expect(body.data).toHaveProperty('reservation_service_id');
    createdOrderId = body.data.reservation_service_id;
  });

  // ── GET /services/orders ───────────────────────────────────
  test('GET /services/orders?reservation_id= — returns orders with summary', async ({ request }) => {
    if (!testReservationId) return test.skip();
    const res = await request.get('/api/services/orders', {
      params: { reservation_id: testReservationId },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.summary).toHaveProperty('total_orders');
    expect(body.summary).toHaveProperty('total_amount');
  });

  test('GET /services/orders — missing reservation_id → 400', async ({ request }) => {
    const res = await request.get('/api/services/orders');
    expect(res.status()).toBe(400);
  });

  // ── PUT /services/orders/:id/status ───────────────────────
  test('PUT /services/orders/:id/status — update to CONFIRMED', async ({ request }) => {
    if (!createdOrderId) return test.skip();
    const res = await request.put(`/api/services/orders/${createdOrderId}/status`, {
      data: { status: 'CONFIRMED' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.service_status).toBe('CONFIRMED');
  });

  test('PUT /services/orders/:id/status — invalid status → 400', async ({ request }) => {
    if (!createdOrderId) return test.skip();
    const res = await request.put(`/api/services/orders/${createdOrderId}/status`, {
      data: { status: 'INVALID_STATUS' },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /services/orders/:id/status — not found → 404', async ({ request }) => {
    const res = await request.put('/api/services/orders/99999/status', {
      data: { status: 'CONFIRMED' },
    });
    expect(res.status()).toBe(404);
  });

  // ── POST /services/orders/:id/pay ─────────────────────────
  test('POST /services/orders/:id/pay — pay for service', async ({ request }) => {
    if (!createdOrderId) return test.skip();
    // First mark as DELIVERED
    await request.put(`/api/services/orders/${createdOrderId}/status`, {
      data: { status: 'DELIVERED' },
    });
    const res = await request.post(`/api/services/orders/${createdOrderId}/pay`, {
      data: { payment_method: 'CREDIT_CARD' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.payment.payment_type).toBe('INCIDENTAL_HOLD');
  });

  test('POST /services/orders/:id/pay — already paid → 400', async ({ request }) => {
    if (!createdOrderId) return test.skip();
    const res = await request.post(`/api/services/orders/${createdOrderId}/pay`, {
      data: { payment_method: 'CREDIT_CARD' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /services/orders/:id/pay — not found → 404', async ({ request }) => {
    const res = await request.post('/api/services/orders/99999/pay', {
      data: { payment_method: 'CASH' },
    });
    expect(res.status()).toBe(404);
  });

});
