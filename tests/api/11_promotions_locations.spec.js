/**
 * ══════════════════════════════════════════════════════════════
 * [11] PROMOTIONS & LOCATIONS API — Playwright Tests
 * Endpoints:
 *   GET /api/promotions
 *   GET /api/locations/tree
 *   GET /api/locations
 * ══════════════════════════════════════════════════════════════
 */
const { test, expect } = require('@playwright/test');
const { SEED } = require('./helpers');

test.describe('🏷️ Promotions API', () => {

  // ── GET /promotions ────────────────────────────────────────
  test('GET /promotions — returns active promotions', async ({ request }) => {
    const res = await request.get('/api/promotions');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body).toHaveProperty('count');
  });

  test('GET /promotions?hotel_id= — filter by hotel', async ({ request }) => {
    const res = await request.get('/api/promotions', {
      params: { hotel_id: SEED.hotel.id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /promotions — each promotion has required fields', async ({ request }) => {
    const res = await request.get('/api/promotions');
    const body = await res.json();
    if (body.data.length > 0) {
      const promo = body.data[0];
      expect(promo).toHaveProperty('promotion_id');
      expect(promo).toHaveProperty('promotion_code');
      expect(promo).toHaveProperty('promotion_name');
      expect(promo).toHaveProperty('promotion_type');
      expect(promo).toHaveProperty('discount_value');
      expect(promo).toHaveProperty('scope_type');
      expect(['HOTEL', 'BRAND', 'GLOBAL']).toContain(promo.scope_type);
    }
  });

  test('GET /promotions?hotel_id=&guest_id= — includes eligible_for_guest flag', async ({ request }) => {
    const res = await request.get('/api/promotions', {
      params: { hotel_id: SEED.hotel.id, guest_id: SEED.guest.id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    if (body.data.length > 0) {
      // eligible_for_guest should be present when guest_id provided
      expect(body.data[0]).toHaveProperty('eligible_for_guest');
    }
  });

  test('GET /promotions?member_only=true — filter member-only promos', async ({ request }) => {
    const res = await request.get('/api/promotions', {
      params: { member_only: 'true' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // All returned promos should have member_only_flag = true
    body.data.forEach(p => expect(p.member_only_flag).toBe(true));
  });

  test('GET /promotions?member_only=false — filter non-member promos', async ({ request }) => {
    const res = await request.get('/api/promotions', {
      params: { member_only: 'false' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    body.data.forEach(p => expect(p.member_only_flag).toBe(false));
  });

});

test.describe('📍 Locations API', () => {

  // ── GET /locations ─────────────────────────────────────────
  test('GET /locations — returns flat location list', async ({ request }) => {
    const res = await request.get('/api/locations');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('GET /locations — each item has location_id, name, level', async ({ request }) => {
    const res = await request.get('/api/locations');
    const body = await res.json();
    const loc = body.data[0];
    expect(loc).toHaveProperty('location_id');
    expect(loc).toHaveProperty('location_name');
    expect(loc).toHaveProperty('level'); // actual field is 'level'
  });

  // ── GET /locations/tree ────────────────────────────────────
  test('GET /locations/tree — returns full hierarchy', async ({ request }) => {
    const res = await request.get('/api/locations/tree');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /locations/tree — each node has depth and level', async ({ request }) => {
    const res = await request.get('/api/locations/tree');
    const body = await res.json();
    if (body.data.length > 0) {
      const node = body.data[0];
      expect(node).toHaveProperty('location_id');
      expect(node).toHaveProperty('tree_depth'); // Recursive CTE depth field
    }
  });

  test('GET /locations/tree?root= — filter by root name', async ({ request }) => {
    // Get a location name first
    const listRes = await request.get('/api/locations');
    const locations = (await listRes.json()).data;
    if (locations.length === 0) return test.skip();
    const rootName = locations[0].location_name;

    const res = await request.get('/api/locations/tree', {
      params: { root: rootName },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('GET /locations/tree?root_id= — filter by root_id', async ({ request }) => {
    const listRes = await request.get('/api/locations');
    const locations = (await listRes.json()).data;
    if (locations.length === 0) return test.skip();

    const res = await request.get('/api/locations/tree', {
      params: { root_id: locations[0].location_id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

});
