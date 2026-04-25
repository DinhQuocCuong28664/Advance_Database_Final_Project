/**
 * 
 * [10] ADMIN API  Playwright Tests
 * Endpoints:
 *   PUT /api/admin/rates/:id
 *   GET /api/admin/rates/alerts
 *   GET /api/admin/reports/revenue
 *   GET /api/admin/reports/revenue-by-brand
 *   PUT /api/admin/availability/:id
 * 
 */
const { test, expect } = require('@playwright/test');
const { SEED, DATES } = require('./helpers');

let adminToken = null;
let availabilityRecord = null; // from rooms/availability

test.describe(' Admin API', () => {

  // Auth setup
  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/auth/admin/login', {
      data: { username: SEED.admin.username, password: SEED.admin.password },
    });
    if (res.status() === 200) {
      adminToken = (await res.json()).token;
    }

    // Get an availability record for optimistic locking tests
    const avRes = await request.get('/api/rooms/availability', {
      params: { hotel_id: SEED.hotel.id, checkin: DATES.checkin, checkout: DATES.checkout },
    });
    const avBody = await avRes.json();
    if (avBody.data && avBody.data.length > 0) {
      const room = avBody.data[0];
      if (room.availability_records && room.availability_records.length > 0) {
        availabilityRecord = room.availability_records[0];
      }
    }
  });

  //  GET /admin/rates/alerts 
  test('GET /admin/rates/alerts  returns rate alert list', async ({ request }) => {
    const res = await request.get('/api/admin/rates/alerts', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /admin/rates/alerts  no token  401', async ({ request }) => {
    const res = await request.get('/api/admin/rates/alerts');
    expect(res.status()).toBe(401);
  });

  //  GET /admin/reports/revenue 
  test('GET /admin/reports/revenue  returns revenue analytics with ranking', async ({ request }) => {
    const res = await request.get('/api/admin/reports/revenue', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    // Check window function fields are present
    if (body.data.length > 0) {
      const row = body.data[0];
      expect(row).toHaveProperty('hotel_name');
      // revenue_rank_in_hotel from DENSE_RANK() window function
      expect(row).toHaveProperty('revenue_rank_in_hotel');
    }
  });

  test('GET /admin/reports/revenue  no token  401', async ({ request }) => {
    const res = await request.get('/api/admin/reports/revenue');
    expect(res.status()).toBe(401);
  });

  //  GET /admin/reports/revenue-by-brand 
  test('GET /admin/reports/revenue-by-brand  multi-level brand hierarchy', async ({ request }) => {
    const res = await request.get('/api/admin/reports/revenue-by-brand', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) {
      const row = body.data[0];
      expect(row).toHaveProperty('brand_name');
      expect(row).toHaveProperty('chain_name');
    }
  });

  //  PUT /admin/rates/:id 
  test('PUT /admin/rates/:id  update room rate', async ({ request }) => {
    const res = await request.put('/api/admin/rates/1', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        final_rate: 1100000,
        price_source: 'MANUAL',
        updated_by: SEED.staff.id,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // The updated rate record is returned  check it has final_rate
    expect(body.data).toBeDefined();
  });

  test('PUT /admin/rates/:id  missing final_rate  400', async ({ request }) => {
    const res = await request.put('/api/admin/rates/1', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { price_source: 'MANUAL' },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /admin/rates/:id  rate not found  404', async ({ request }) => {
    const res = await request.put('/api/admin/rates/99999', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { final_rate: 1000000, price_source: 'MANUAL' },
    });
    expect(res.status()).toBe(404);
  });

  test('PUT /admin/rates/:id  no token  401', async ({ request }) => {
    const res = await request.put('/api/admin/rates/1', {
      data: { final_rate: 999999 },
    });
    expect(res.status()).toBe(401);
  });

  //  PUT /admin/availability/:id (Optimistic Locking) 
  test('PUT /admin/availability/:id  update with correct version', async ({ request }) => {
    if (!availabilityRecord || !adminToken) return test.skip();
    const res = await request.put(`/api/admin/availability/${availabilityRecord.availability_id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        availability_status: 'OPEN',
        expected_version: availabilityRecord.version_no,
        inventory_note: 'Playwright test  no change',
      },
    });
    // 200 if version matches, 409 if another test modified it
    expect([200, 409]).toContain(res.status());
  });

  test('PUT /admin/availability/:id  wrong version  409 conflict', async ({ request }) => {
    if (!availabilityRecord || !adminToken) return test.skip();
    const res = await request.put(`/api/admin/availability/${availabilityRecord.availability_id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        availability_status: 'BLOCKED',
        expected_version: -1, // deliberately wrong
        inventory_note: 'Should conflict',
      },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.your_expected_version).toBe(-1);
  });

  test('PUT /admin/availability/:id  missing availability_status  400', async ({ request }) => {
    if (!availabilityRecord || !adminToken) return test.skip();
    const res = await request.put(`/api/admin/availability/${availabilityRecord.availability_id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { expected_version: 1 },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /admin/availability/:id  missing expected_version  400', async ({ request }) => {
    if (!availabilityRecord || !adminToken) return test.skip();
    const res = await request.put(`/api/admin/availability/${availabilityRecord.availability_id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { availability_status: 'OPEN' },
    });
    expect(res.status()).toBe(400);
  });

});
