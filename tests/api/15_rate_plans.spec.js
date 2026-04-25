/**
 * 
 * [15] RATE PLANS API  CRUD Tests
 * Endpoints:
 *   GET    /api/admin/rate-plans
 *   GET    /api/admin/rate-plans/:id
 *   POST   /api/admin/rate-plans
 *   PUT    /api/admin/rate-plans/:id
 *   DELETE /api/admin/rate-plans/:id
 *
 * Also covers existing endpoints:
 *   GET    /api/admin/rates
 *   PUT    /api/admin/rates/:id  (Price Guard)
 *   GET    /api/admin/rates/alerts
 * 
 */
const { test, expect } = require('@playwright/test');
const { SEED } = require('./helpers');

//  Admin auth token (requireSystemUser on all /admin/* routes) 
let adminToken = null;

test.describe(' Rate Plans API', () => {

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/auth/admin/login', {
      data: { username: SEED.admin.username, password: SEED.admin.password },
    });
    expect(res.status(), 'Admin login must succeed').toBe(200);
    const body = await res.json();
    adminToken = body.token;
    expect(adminToken).toBeTruthy();
  });

  // Helper: auth header
  const auth = () => ({ Authorization: `Bearer ${adminToken}` });

  //  Track created plan for cleanup 
  let createdPlanId = null;
  const TEST_CODE = `PW_TEST_${Date.now().toString(36).toUpperCase()}`.slice(0, 20);

  // 
  // Existing RoomRate endpoints
  // 

  test.describe('RoomRate  GET /admin/rates', () => {
    test('returns room_types array with rate rows', async ({ request }) => {
      const res = await request.get('/api/admin/rates', {
        headers: auth(),
        params: { hotel_id: SEED.hotel.id, date_from: '2026-01-01', date_to: '2026-01-31' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.room_types)).toBe(true);
      expect(body).toHaveProperty('count');
    });

    test('no hotel_id filter  returns all hotels rates', async ({ request }) => {
      const res = await request.get('/api/admin/rates', { headers: auth() });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.room_types.length).toBeGreaterThan(0);
    });

    test('rate row shape is correct', async ({ request }) => {
      const res = await request.get('/api/admin/rates', {
        headers: auth(),
        params: { hotel_id: SEED.hotel.id, date_from: '2026-01-01', date_to: '2026-01-05' },
      });
      const body = await res.json();
      if (!body.room_types?.[0]?.rates?.[0]) return test.skip();
      const r = body.room_types[0].rates[0];
      expect(r).toHaveProperty('room_rate_id');
      expect(r).toHaveProperty('rate_date');
      expect(r).toHaveProperty('base_rate');
      expect(r).toHaveProperty('final_rate');
      expect(r).toHaveProperty('is_override');
      expect(r).toHaveProperty('price_source');
      expect(r).toHaveProperty('alert_count');
    });
  });

  test.describe('RoomRate  GET /admin/rates/alerts', () => {
    test('returns alert list', async ({ request }) => {
      const res = await request.get('/api/admin/rates/alerts', { headers: auth() });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  test.describe('RoomRate  PUT /admin/rates/:id', () => {
    let rateId = null;
    let originalRate = null;

    test.beforeAll(async ({ request }) => {
      const res = await request.get('/api/admin/rates', {
        headers: auth(),
        params: { hotel_id: SEED.hotel.id, date_from: '2026-01-01', date_to: '2026-01-31' },
      });
      const body = await res.json();
      const firstRate = body.room_types?.[0]?.rates?.[0];
      rateId = firstRate?.room_rate_id;
      originalRate = firstRate?.final_rate;
    });

    test('PUT /rates/:id  invalid ID  400', async ({ request }) => {
      const res = await request.put('/api/admin/rates/not-a-number', {
        headers: auth(),
        data: { final_rate: 500000 },
      });
      expect(res.status()).toBe(400);
    });

    test('PUT /rates/:id  nonexistent  404', async ({ request }) => {
      const res = await request.put('/api/admin/rates/999999', {
        headers: auth(),
        data: { final_rate: 500000, price_source: 'MANUAL_OVERRIDE' },
      });
      expect(res.status()).toBe(404);
    });

    test('PUT /rates/:id  update rate  200 with change_percent', async ({ request }) => {
      if (!rateId) return test.skip();
      const newRate = parseFloat(originalRate) * 1.1; // +10%
      const res = await request.put(`/api/admin/rates/${rateId}`, {
        headers: auth(),
        data: {
          final_rate: Math.round(newRate),
          price_source: 'MANUAL_OVERRIDE',
          updated_by: 'playwright',
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('change_percent');
      expect(body.price_guard_triggered).toBe(false); // <50%
    });

    test('PUT /rates/:id  >50% change triggers price_guard_triggered=true', async ({ request }) => {
      if (!rateId) return test.skip();
      const bigRate = parseFloat(originalRate) * 2.5; // +150%
      const res = await request.put(`/api/admin/rates/${rateId}`, {
        headers: auth(),
        data: {
          final_rate: Math.round(bigRate),
          price_source: 'MANUAL_OVERRIDE',
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.price_guard_triggered).toBe(true);
      expect(body.change_percent).toBeGreaterThan(50);
    });
  });

  // 
  // RatePlan CRUD
  // 

  test.describe('GET /admin/rate-plans', () => {
    test('returns list with correct shape', async ({ request }) => {
      const res = await request.get('/api/admin/rate-plans', { headers: auth() });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.count).toBe(body.data.length);
      expect(body.data.length).toBeGreaterThan(0);

      const plan = body.data[0];
      expect(plan).toHaveProperty('rate_plan_id');
      expect(plan).toHaveProperty('rate_plan_code');
      expect(plan).toHaveProperty('rate_plan_name');
      expect(plan).toHaveProperty('rate_plan_type');
      expect(plan).toHaveProperty('meal_inclusion');
      expect(plan).toHaveProperty('is_refundable');
      expect(plan).toHaveProperty('status');
      expect(plan).toHaveProperty('rate_count');
      expect(plan).toHaveProperty('hotel_name');
    });

    test('hotel_id filter only returns that hotel plans', async ({ request }) => {
      const res = await request.get('/api/admin/rate-plans', {
        headers: auth(),
        params: { hotel_id: SEED.hotel.id },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      body.data.forEach(p => expect(p.hotel_id).toBe(SEED.hotel.id));
    });

    test('status=ACTIVE filter works', async ({ request }) => {
      const res = await request.get('/api/admin/rate-plans', {
        headers: auth(),
        params: { status: 'ACTIVE' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      body.data.forEach(p => expect(p.status).toBe('ACTIVE'));
    });

    test('type=BAR filter works', async ({ request }) => {
      const res = await request.get('/api/admin/rate-plans', {
        headers: auth(),
        params: { type: 'BAR' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      body.data.forEach(p => expect(p.rate_plan_type).toBe('BAR'));
    });
  });

  test.describe('GET /admin/rate-plans/:id', () => {
    test('invalid ID  400', async ({ request }) => {
      const res = await request.get('/api/admin/rate-plans/abc', { headers: auth() });
      expect(res.status()).toBe(400);
    });

    test('nonexistent  404', async ({ request }) => {
      const res = await request.get('/api/admin/rate-plans/999999', { headers: auth() });
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    test('valid ID  returns plan with rate_count', async ({ request }) => {
      const listRes = await request.get('/api/admin/rate-plans', {
        headers: auth(),
        params: { hotel_id: SEED.hotel.id },
      });
      const first = (await listRes.json()).data?.[0];
      if (!first) return test.skip();

      const res = await request.get(`/api/admin/rate-plans/${first.rate_plan_id}`, { headers: auth() });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.rate_plan_id).toBe(first.rate_plan_id);
      expect(body.data).toHaveProperty('rate_count');
      expect(body.data).toHaveProperty('hotel_name');
    });
  });

  test.describe('POST /admin/rate-plans', () => {
    test('missing required fields  400', async ({ request }) => {
      const res = await request.post('/api/admin/rate-plans', {
        headers: auth(),
        data: { hotel_id: SEED.hotel.id, rate_plan_code: 'X' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/required/i);
    });

    test('invalid rate_plan_type  400', async ({ request }) => {
      const res = await request.post('/api/admin/rate-plans', {
        headers: auth(),
        data: {
          hotel_id: SEED.hotel.id,
          rate_plan_code: 'INVALID',
          rate_plan_name: 'Bad Type',
          rate_plan_type: 'SUPREME',
        },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/rate_plan_type/i);
    });

    test('invalid meal_inclusion  400', async ({ request }) => {
      const res = await request.post('/api/admin/rate-plans', {
        headers: auth(),
        data: {
          hotel_id: SEED.hotel.id,
          rate_plan_code: 'MEAL_BAD',
          rate_plan_name: 'Bad Meal',
          rate_plan_type: 'BAR',
          meal_inclusion: 'PIZZA',
        },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/meal_inclusion/i);
    });

    test('nonexistent hotel  404', async ({ request }) => {
      const res = await request.post('/api/admin/rate-plans', {
        headers: auth(),
        data: {
          hotel_id: 999999,
          rate_plan_code: 'GHOST',
          rate_plan_name: 'Ghost Plan',
          rate_plan_type: 'BAR',
        },
      });
      expect(res.status()).toBe(404);
    });

    test('valid payload  201 with created plan', async ({ request }) => {
      const res = await request.post('/api/admin/rate-plans', {
        headers: auth(),
        data: {
          hotel_id: SEED.hotel.id,
          rate_plan_code: TEST_CODE,
          rate_plan_name: 'Playwright BAR Test Rate',
          rate_plan_type: 'BAR',
          meal_inclusion: 'BREAKFAST',
          is_refundable: true,
          requires_prepayment: false,
          min_advance_booking_days: 1,
          max_advance_booking_days: 365,
          effective_from: '2026-01-01',
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toMatch(/created/i);
      expect(body.data.rate_plan_code).toBe(TEST_CODE);
      expect(body.data.rate_plan_type).toBe('BAR');
      expect(body.data.meal_inclusion).toBe('BREAKFAST');
      expect(body.data.status).toBe('ACTIVE');
      expect(body.data.is_refundable).toBe(true);

      createdPlanId = body.data.rate_plan_id;
    });

    test('duplicate code for same hotel  409', async ({ request }) => {
      if (!createdPlanId) return test.skip();
      const res = await request.post('/api/admin/rate-plans', {
        headers: auth(),
        data: {
          hotel_id: SEED.hotel.id,
          rate_plan_code: TEST_CODE,
          rate_plan_name: 'Duplicate',
          rate_plan_type: 'PROMO',
        },
      });
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/already exists/i);
    });

    // All 6 valid plan types
    const TYPES = ['BAR', 'NON_REFUNDABLE', 'MEMBER', 'PACKAGE', 'CORPORATE', 'PROMO'];
    TYPES.forEach(type => {
      test(`POST  valid type '${type}'  201`, async ({ request }) => {
        const code = `PW_${type}_${Date.now().toString(36).slice(-4).toUpperCase()}`.slice(0, 20);
        const res = await request.post('/api/admin/rate-plans', {
          headers: auth(),
          data: {
            hotel_id: SEED.hotel.id,
            rate_plan_code: code,
            rate_plan_name: `Playwright ${type} Plan`,
            rate_plan_type: type,
          },
        });
        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body.data.rate_plan_type).toBe(type);
        // Clean up: deactivate if no linked rates
        await request.delete(`/api/admin/rate-plans/${body.data.rate_plan_id}`, { headers: auth() });
      });
    });

    // All 5 meal inclusions
    const MEALS = ['ROOM_ONLY', 'BREAKFAST', 'HALF_BOARD', 'FULL_BOARD', 'ALL_INCLUSIVE'];
    MEALS.forEach(meal => {
      test(`POST  valid meal_inclusion '${meal}'  201`, async ({ request }) => {
        const code = `PW_M_${meal.slice(0, 3)}_${Date.now().toString(36).slice(-3).toUpperCase()}`.slice(0, 20);
        const res = await request.post('/api/admin/rate-plans', {
          headers: auth(),
          data: {
            hotel_id: SEED.hotel.id,
            rate_plan_code: code,
            rate_plan_name: `Playwright ${meal} Plan`,
            rate_plan_type: 'BAR',
            meal_inclusion: meal,
          },
        });
        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body.data.meal_inclusion).toBe(meal);
        await request.delete(`/api/admin/rate-plans/${body.data.rate_plan_id}`, { headers: auth() });
      });
    });
  });

  test.describe('PUT /admin/rate-plans/:id', () => {
    test('invalid ID  400', async ({ request }) => {
      const res = await request.put('/api/admin/rate-plans/abc', {
        headers: auth(),
        data: { rate_plan_name: 'X' },
      });
      expect(res.status()).toBe(400);
    });

    test('nonexistent  404', async ({ request }) => {
      const res = await request.put('/api/admin/rate-plans/999999', {
        headers: auth(),
        data: { status: 'INACTIVE' },
      });
      expect(res.status()).toBe(404);
    });

    test('invalid status  400', async ({ request }) => {
      if (!createdPlanId) return test.skip();
      const res = await request.put(`/api/admin/rate-plans/${createdPlanId}`, {
        headers: auth(),
        data: { status: 'DELETED' },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/status/i);
    });

    test('patch name + meal_inclusion  200', async ({ request }) => {
      if (!createdPlanId) return test.skip();
      const res = await request.put(`/api/admin/rate-plans/${createdPlanId}`, {
        headers: auth(),
        data: {
          rate_plan_name: 'Updated Playwright Rate Plan',
          meal_inclusion: 'HALF_BOARD',
        },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.rate_plan_name).toBe('Updated Playwright Rate Plan');
      expect(body.data.meal_inclusion).toBe('HALF_BOARD');
    });

    test('toggle status ACTIVE  INACTIVE  200', async ({ request }) => {
      if (!createdPlanId) return test.skip();
      const res = await request.put(`/api/admin/rate-plans/${createdPlanId}`, {
        headers: auth(),
        data: { status: 'INACTIVE' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('INACTIVE');
    });

    test('toggle status INACTIVE  ACTIVE  200', async ({ request }) => {
      if (!createdPlanId) return test.skip();
      const res = await request.put(`/api/admin/rate-plans/${createdPlanId}`, {
        headers: auth(),
        data: { status: 'ACTIVE' },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('ACTIVE');
    });
  });

  test.describe('DELETE /admin/rate-plans/:id', () => {
    test('invalid ID  400', async ({ request }) => {
      const res = await request.delete('/api/admin/rate-plans/abc', { headers: auth() });
      expect(res.status()).toBe(400);
    });

    test('nonexistent  404', async ({ request }) => {
      const res = await request.delete('/api/admin/rate-plans/999999', { headers: auth() });
      expect(res.status()).toBe(404);
    });

    test('plan with linked rates  409', async ({ request }) => {
      // Get first existing plan that has rate_count > 0
      const listRes = await request.get('/api/admin/rate-plans', { headers: auth() });
      const planWithRates = (await listRes.json()).data?.find(p => p.rate_count > 0);
      if (!planWithRates) return test.skip();

      const res = await request.delete(`/api/admin/rate-plans/${planWithRates.rate_plan_id}`, { headers: auth() });
      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/Cannot deactivate/i);
      expect(body.linked_rate_count).toBeGreaterThan(0);
    });

    test('soft-delete plan with no linked rates  200', async ({ request }) => {
      if (!createdPlanId) return test.skip();
      const res = await request.delete(`/api/admin/rate-plans/${createdPlanId}`, { headers: auth() });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.rate_plan_id).toBe(createdPlanId);

      // Verify it's INACTIVE now
      const check = await request.get(`/api/admin/rate-plans/${createdPlanId}`, { headers: auth() });
      const checkBody = await check.json();
      expect(checkBody.data.status).toBe('INACTIVE');
    });
  });
});
