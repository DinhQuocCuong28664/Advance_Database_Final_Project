/**
 * 
 * [09] INVOICES API  Playwright Tests
 * Endpoints:
 *   GET  /api/invoices
 *   POST /api/invoices
 *   GET  /api/invoices/:id
 *   POST /api/invoices/:id/issue
 * 
 */
const { test, expect } = require('@playwright/test');
const { SEED, futureDate } = require('./helpers');

let testReservationId   = null;
let testReservationCode = null;
let createdInvoiceId    = null;

async function findAvailableRoom(request, hotelId, checkin, checkout) {
  const res = await request.get('/api/rooms/availability', {
    params: { hotel_id: hotelId, checkin, checkout },
  });
  const body = await res.json();
  return (body.data && body.data.length > 0) ? body.data[0] : null;
}

test.describe(' Invoices API', () => {

  // Setup: Create a fresh reservation
  test.beforeAll(async ({ request }) => {
    const cin  = futureDate(120);
    const cout = futureDate(122);
    const room = await findAvailableRoom(request, SEED.hotel.id, cin, cout);
    if (!room) return;

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
      const data = (await res.json()).data;
      testReservationId   = data.reservation_id;
      testReservationCode = data.reservation_code;
    }
  });

  //  GET /invoices 
  test('GET /invoices  returns invoice list', async ({ request }) => {
    const res = await request.get('/api/invoices');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body).toHaveProperty('count');
  });

  test('GET /invoices?reservation_id=  filter by reservation', async ({ request }) => {
    if (!testReservationId) return test.skip();
    const res = await request.get('/api/invoices', {
      params: { reservation_id: testReservationId },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  //  POST /invoices  Validation 
  test('POST /invoices  missing reservation_id  400', async ({ request }) => {
    const res = await request.post('/api/invoices', {
      data: { invoice_type: 'FINAL' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /invoices  reservation not found  404', async ({ request }) => {
    const res = await request.post('/api/invoices', {
      data: { reservation_id: 99999 },
    });
    expect(res.status()).toBe(404);
  });

  //  POST /invoices  Success 
  test('POST /invoices  create FINAL invoice from vw_ReservationTotal', async ({ request }) => {
    if (!testReservationId) return test.skip();
    const res = await request.post('/api/invoices', {
      data: {
        reservation_id: testReservationId,
        invoice_type: 'FINAL',
        billing_name: 'Playwright Test Client',
        billing_address: '123 Test St, Ho Chi Minh City',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('invoice_id');
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.invoice_no).toContain(testReservationCode);
    expect(body.reservation_summary).toHaveProperty('grand_total');
    createdInvoiceId = body.data.invoice_id;
  });

  test('POST /invoices  duplicate FINAL invoice  409', async ({ request }) => {
    if (!testReservationId) return test.skip();
    const res = await request.post('/api/invoices', {
      data: { reservation_id: testReservationId, invoice_type: 'FINAL' },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.existing_invoice).toBeDefined();
  });

  //  GET /invoices/:id 
  test('GET /invoices/:id  returns invoice with line items', async ({ request }) => {
    if (!createdInvoiceId) return test.skip();
    const res = await request.get(`/api/invoices/${createdInvoiceId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.invoice_id).toBe(createdInvoiceId);
    expect(body.data.line_items).toHaveProperty('rooms');
    expect(body.data.line_items).toHaveProperty('services');
    expect(body.data).toHaveProperty('payments');
  });

  test('GET /invoices/:id  not found  404', async ({ request }) => {
    const res = await request.get('/api/invoices/99999');
    expect(res.status()).toBe(404);
  });

  test('GET /invoices/:id  invalid ID  400', async ({ request }) => {
    const res = await request.get('/api/invoices/not-a-number');
    expect(res.status()).toBe(400);
  });

  //  POST /invoices/:id/issue 
  test('POST /invoices/:id/issue  DRAFT  ISSUED', async ({ request }) => {
    if (!createdInvoiceId) return test.skip();
    const res = await request.post(`/api/invoices/${createdInvoiceId}/issue`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ISSUED');
    expect(body.data.issued_at).toBeTruthy();
  });

  test('POST /invoices/:id/issue  already ISSUED  409', async ({ request }) => {
    if (!createdInvoiceId) return test.skip();
    const res = await request.post(`/api/invoices/${createdInvoiceId}/issue`);
    expect(res.status()).toBe(409);
  });

  test('POST /invoices/:id/issue  not found  409', async ({ request }) => {
    const res = await request.post('/api/invoices/99999/issue');
    expect(res.status()).toBe(409);
  });

  test('POST /invoices/:id/issue  invalid ID  400', async ({ request }) => {
    const res = await request.post('/api/invoices/not-a-number/issue');
    expect(res.status()).toBe(400);
  });

});
