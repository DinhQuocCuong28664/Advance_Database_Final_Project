/**
 * 
 * [02] HOTELS & ROOMS API  Playwright Tests
 * Endpoints:
 *   GET /api/hotels
 *   GET /api/hotels/:id
 *   GET /api/rooms/availability
 * 
 */
const { test, expect } = require('@playwright/test');
const { SEED, DATES } = require('./helpers');

test.describe(' Hotels & Rooms API', () => {

  //  GET /hotels 
  test('GET /hotels  returns list with count', async ({ request }) => {
    const res = await request.get('/api/hotels');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('GET /hotels  each hotel has required fields', async ({ request }) => {
    const res = await request.get('/api/hotels');
    const body = await res.json();
    const hotel = body.data[0];
    expect(hotel).toHaveProperty('hotel_id');
    expect(hotel).toHaveProperty('hotel_name');
    expect(hotel).toHaveProperty('hotel_type');
    expect(hotel).toHaveProperty('currency_code');
  });

  //  GET /hotels/:id 
  test('GET /hotels/:id  returns hotel details with room_types', async ({ request }) => {
    const res = await request.get(`/api/hotels/${SEED.hotel.id}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.hotel_id).toBe(SEED.hotel.id);
    expect(Array.isArray(body.data.room_types)).toBe(true);
  });

  test('GET /hotels/:id  has amenities array', async ({ request }) => {
    const res = await request.get(`/api/hotels/${SEED.hotel.id}`);
    const body = await res.json();
    expect(body.data).toHaveProperty('amenities');
  });

  test('GET /hotels/:id  hotel not found  404', async ({ request }) => {
    const res = await request.get('/api/hotels/99999');
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  //  GET /rooms/availability 
  test('GET /rooms/availability  returns available rooms', async ({ request }) => {
    const res = await request.get('/api/rooms/availability', {
      params: {
        hotel_id: SEED.hotel.id,
        checkin: DATES.checkin,
        checkout: DATES.checkout,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /rooms/availability  each room has availability_records', async ({ request }) => {
    const res = await request.get('/api/rooms/availability', {
      params: { hotel_id: SEED.hotel.id, checkin: DATES.checkin, checkout: DATES.checkout },
    });
    const body = await res.json();
    if (body.data.length > 0) {
      const room = body.data[0];
      expect(room).toHaveProperty('room_id');
      expect(room).toHaveProperty('room_number');
      expect(Array.isArray(room.availability_records)).toBe(true);
    }
  });

  test('GET /rooms/availability  missing hotel_id  400', async ({ request }) => {
    const res = await request.get('/api/rooms/availability', {
      params: { checkin: DATES.checkin, checkout: DATES.checkout },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /rooms/availability  missing checkin  400', async ({ request }) => {
    const res = await request.get('/api/rooms/availability', {
      params: { hotel_id: SEED.hotel.id, checkout: DATES.checkout },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /rooms/availability  missing checkout  400', async ({ request }) => {
    const res = await request.get('/api/rooms/availability', {
      params: { hotel_id: SEED.hotel.id, checkin: DATES.checkin },
    });
    expect(res.status()).toBe(400);
  });

});
