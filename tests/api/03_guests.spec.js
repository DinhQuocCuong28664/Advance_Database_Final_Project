/**
 * 
 * [03] GUESTS API  Playwright Tests
 * Endpoints:
 *   GET  /api/guests
 *   GET  /api/guests/:id
 *   POST /api/guests
 * 
 */
const { test, expect } = require('@playwright/test');
const { SEED } = require('./helpers');

let createdGuestId = null;
let adminToken = null;

test.describe(' Guests API', () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/auth/admin/login', {
      data: { username: SEED.admin.username, password: SEED.admin.password },
    });
    if (res.status() === 200) {
      adminToken = (await res.json()).token;
    }
  });

  function auth() {
    return adminToken ? { Authorization: `Bearer ${adminToken}` } : {};
  }

  //  GET /guests 
  test('GET /guests  returns guest list', async ({ request }) => {
    const res = await request.get('/api/guests', { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('GET /guests  each guest has full_name (computed column)', async ({ request }) => {
    const res = await request.get('/api/guests', { headers: auth() });
    const body = await res.json();
    const guest = body.data[0];
    expect(guest).toHaveProperty('guest_id');
    expect(guest).toHaveProperty('full_name');
    expect(guest).toHaveProperty('guest_code');
  });

  //  GET /guests/:id 
  test('GET /guests/:id  returns full profile with preferences', async ({ request }) => {
    const res = await request.get(`/api/guests/${SEED.guest.id}`, { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.guest_id).toBe(SEED.guest.id);
    expect(body.data).toHaveProperty('preferences');
    expect(body.data).toHaveProperty('loyalty_accounts');
    expect(body.data).toHaveProperty('addresses');
  });

  test('GET /guests/:id  guest not found  404', async ({ request }) => {
    const res = await request.get('/api/guests/99999', { headers: auth() });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('GET /guests/:id  invalid ID  400', async ({ request }) => {
    const res = await request.get('/api/guests/not-a-number', { headers: auth() });
    expect(res.status()).toBe(400);
  });

  //  POST /guests 
  test('POST /guests  create a new guest', async ({ request }) => {
    const uniqueCode = `G-PLW-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const res = await request.post('/api/guests', {
      headers: auth(),
      data: {
        guest_code: uniqueCode,
        first_name: 'Playwright',
        last_name: 'Guest',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('guest_id');
    // full_name is a computed column  should be auto-calculated
    expect(body.data.full_name).toContain('Playwright');
    createdGuestId = body.data.guest_id;
  });

  test('POST /guests  missing first_name  400', async ({ request }) => {
    const res = await request.post('/api/guests', {
      headers: auth(),
      data: { guest_code: 'G-FAIL-1', last_name: 'Someone' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /guests  missing last_name  400', async ({ request }) => {
    const res = await request.post('/api/guests', {
      headers: auth(),
      data: { guest_code: 'G-FAIL-2', first_name: 'Someone' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /guests  missing guest_code  400', async ({ request }) => {
    const res = await request.post('/api/guests', {
      headers: auth(),
      data: { first_name: 'No', last_name: 'Code' },
    });
    expect(res.status()).toBe(400);
  });

  // Verify created guest is retrievable
  test('GET /guests/:id  created guest is retrievable', async ({ request }) => {
    if (!createdGuestId) return test.skip();
    const res = await request.get(`/api/guests/${createdGuestId}`, { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.guest_id).toBe(createdGuestId);
  });

});
