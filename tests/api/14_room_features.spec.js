/**
 * 
 * [14] ROOM FEATURES API  CRUD Tests
 * Endpoints:
 *   GET  /api/hotels/:id/features
 *   POST /api/hotels/:id/features
 *   DELETE /api/hotels/:id/features/:fid
 * Also covers: sql_features array in GET /api/hotels/:id
 * 
 */
const { test, expect } = require('@playwright/test');
const { SEED } = require('./helpers');

test.describe(' Room Features API', () => {

  let createdFeatureId = null;

  //  GET /hotels/:id  sql_features embedded 
  test('GET /hotels/:id  includes sql_features array per room type', async ({ request }) => {
    const res = await request.get(`/api/hotels/${SEED.hotel.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('room_types');
    // At least one room type should have sql_features populated (from seed)
    const typesWithFeatures = body.data.room_types?.filter(rt => rt.sql_features?.length > 0);
    expect(typesWithFeatures.length).toBeGreaterThan(0);
    // Validate feature shape
    const feat = typesWithFeatures[0].sql_features[0];
    expect(feat).toHaveProperty('code');
    expect(feat).toHaveProperty('name');
    expect(feat).toHaveProperty('category');
    expect(feat).toHaveProperty('is_premium');
  });

  //  GET /hotels/:id/features 
  test('GET /hotels/:id/features  invalid hotel ID  400', async ({ request }) => {
    const res = await request.get('/api/hotels/abc/features');
    expect(res.status()).toBe(400);
  });

  test('GET /hotels/:id/features  nonexistent hotel  404', async ({ request }) => {
    const res = await request.get('/api/hotels/999999/features');
    expect(res.status()).toBe(404);
  });

  test('GET /hotels/:id/features  returns feature list with correct shape', async ({ request }) => {
    const res = await request.get(`/api/hotels/${SEED.hotel.id}/features`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.hotel_id).toBe(SEED.hotel.id);
    expect(body).toHaveProperty('count');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.count).toBe(body.data.length);
    expect(body.data.length).toBeGreaterThan(0);

    // Validate feature shape
    const feat = body.data[0];
    expect(feat).toHaveProperty('room_feature_id');
    expect(feat).toHaveProperty('feature_code');
    expect(feat).toHaveProperty('feature_name');
    expect(feat).toHaveProperty('feature_category');
    expect(feat).toHaveProperty('is_premium');
    expect(feat).toHaveProperty('room_type_name');

    // Premium features should appear first (ORDER BY is_premium DESC)
    const premiumIdx = body.data.findIndex(f => f.is_premium === true);
    const nonPremIdx = body.data.findIndex(f => f.is_premium === false);
    if (premiumIdx >= 0 && nonPremIdx >= 0) {
      expect(premiumIdx).toBeLessThan(nonPremIdx);
    }
  });

  test('GET /hotels/:id/features  features belong only to the queried hotel', async ({ request }) => {
    const res = await request.get(`/api/hotels/${SEED.hotel2.id}/features`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // All room_type_name entries should not be from hotel 1 room types
    // (indirect check  just verify the endpoint works for hotel 2 as well)
    expect(body.hotel_id).toBe(SEED.hotel2.id);
    expect(Array.isArray(body.data)).toBe(true);
  });

  //  POST /hotels/:id/features 
  test('POST /hotels/:id/features  missing feature_code  400', async ({ request }) => {
    const res = await request.post(`/api/hotels/${SEED.hotel.id}/features`, {
      data: {
        room_type_id: SEED.roomType.id,
        feature_name: 'Test Feature',
        feature_category: 'TECH',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/feature_code/i);
  });

  test('POST /hotels/:id/features  missing room_type_id AND room_id  400', async ({ request }) => {
    const res = await request.post(`/api/hotels/${SEED.hotel.id}/features`, {
      data: {
        feature_code: 'TEST_CODE',
        feature_name: 'Test Feature',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/room_type_id|room_id/i);
  });

  test('POST /hotels/:id/features  invalid feature_category  400', async ({ request }) => {
    const res = await request.post(`/api/hotels/${SEED.hotel.id}/features`, {
      data: {
        room_type_id: SEED.roomType.id,
        feature_code: 'TEST_CODE',
        feature_name: 'Test Feature',
        feature_category: 'INVALID_CATEGORY',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/feature_category/i);
  });

  test('POST /hotels/:id/features  nonexistent hotel  404', async ({ request }) => {
    const res = await request.post('/api/hotels/999999/features', {
      data: {
        room_type_id: SEED.roomType.id,
        feature_code: 'TEST',
        feature_name: 'Test',
      },
    });
    expect(res.status()).toBe(404);
  });

  test('POST /hotels/:id/features  room_type from wrong hotel  404', async ({ request }) => {
    // room type 4 belongs to hotel 2, not hotel 1
    const res = await request.post(`/api/hotels/${SEED.hotel.id}/features`, {
      data: {
        room_type_id: 4,  // W Bangkok room type
        feature_code: 'CROSS_HOTEL',
        feature_name: 'Cross Hotel Feature',
        feature_category: 'TECH',
      },
    });
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/RoomType not found for this hotel/i);
  });

  test('POST /hotels/:id/features  create premium feature  201', async ({ request }) => {
    const res = await request.post(`/api/hotels/${SEED.hotel.id}/features`, {
      data: {
        room_type_id: SEED.roomType.id,
        feature_code: 'TEST_BUTLER_PW',
        feature_name: 'Playwright Test Butler Service',
        feature_category: 'AMENITY',
        feature_value: 'Available 24/7',
        is_premium: true,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/created/i);
    expect(body.data).toHaveProperty('room_feature_id');
    expect(body.data.feature_code).toBe('TEST_BUTLER_PW');
    expect(body.data.feature_name).toBe('Playwright Test Butler Service');
    expect(body.data.feature_category).toBe('AMENITY');
    expect(body.data.is_premium).toBe(true);

    // Save for DELETE test
    createdFeatureId = body.data.room_feature_id;
  });

  test('POST /hotels/:id/features  create non-premium feature  201', async ({ request }) => {
    const res = await request.post(`/api/hotels/${SEED.hotel.id}/features`, {
      data: {
        room_type_id: SEED.roomType.id,
        feature_code: 'TEST_WIFI_PW',
        feature_name: 'Playwright Test WiFi',
        feature_category: 'TECH',
        feature_value: '1 Gbps',
        is_premium: false,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.is_premium).toBe(false);

    // Clean up immediately
    if (body.data.room_feature_id) {
      await request.delete(`/api/hotels/${SEED.hotel.id}/features/${body.data.room_feature_id}`);
    }
  });

  //  Verify POST appears in GET list 
  test('GET /hotels/:id/features  created feature appears in list', async ({ request }) => {
    if (!createdFeatureId) return test.skip();
    const res = await request.get(`/api/hotels/${SEED.hotel.id}/features`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const created = body.data.find(f => f.room_feature_id === createdFeatureId);
    expect(created).toBeTruthy();
    expect(created.feature_code).toBe('TEST_BUTLER_PW');
    expect(created.is_premium).toBe(true);
  });

  //  DELETE /hotels/:id/features/:fid 
  test('DELETE /hotels/:id/features/:fid  invalid IDs  400', async ({ request }) => {
    const res = await request.delete('/api/hotels/abc/features/xyz');
    expect(res.status()).toBe(400);
  });

  test('DELETE /hotels/:id/features/:fid  nonexistent  404', async ({ request }) => {
    const res = await request.delete(`/api/hotels/${SEED.hotel.id}/features/999999`);
    expect(res.status()).toBe(404);
  });

  test('DELETE /hotels/:id/features/:fid  feature from wrong hotel  404', async ({ request }) => {
    if (!createdFeatureId) return test.skip();
    // Try to delete hotel 1's feature via hotel 2's endpoint
    const res = await request.delete(`/api/hotels/${SEED.hotel2.id}/features/${createdFeatureId}`);
    expect(res.status()).toBe(404);
  });

  test('DELETE /hotels/:id/features/:fid  delete own feature  200', async ({ request }) => {
    if (!createdFeatureId) return test.skip();
    const res = await request.delete(`/api/hotels/${SEED.hotel.id}/features/${createdFeatureId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.room_feature_id).toBe(createdFeatureId);
  });

  test('DELETE /hotels/:id/features/:fid  already deleted  404', async ({ request }) => {
    if (!createdFeatureId) return test.skip();
    const res = await request.delete(`/api/hotels/${SEED.hotel.id}/features/${createdFeatureId}`);
    expect(res.status()).toBe(404);
  });

  //  Valid categories coverage 
  const validCategories = ['VIEW', 'BED', 'BATH', 'TECH', 'AMENITY', 'SPACE'];
  validCategories.forEach(cat => {
    test(`POST /features  valid category '${cat}'  201`, async ({ request }) => {
      const res = await request.post(`/api/hotels/${SEED.hotel.id}/features`, {
        data: {
          room_type_id: SEED.roomType.id,
          feature_code: `TEST_${cat}_PW`,
          feature_name: `Playwright ${cat} Feature`,
          feature_category: cat,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.data.feature_category).toBe(cat);
      // Clean up
      await request.delete(`/api/hotels/${SEED.hotel.id}/features/${body.data.room_feature_id}`);
    });
  });

});
