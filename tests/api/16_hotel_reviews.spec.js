const { test, expect } = require('@playwright/test');
const { SEED } = require('./helpers');

let guestToken = null;
let reviewedReservation = null;
let ineligibleReservation = null;

test.describe(' Hotel Reviews API', () => {
  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post('/api/auth/login', {
      data: { login: SEED.guestLogin.email, password: SEED.guestLogin.password },
    });
    if (loginRes.status() === 200) {
      guestToken = (await loginRes.json()).token;
    }

    if (!guestToken) {
      return;
    }

    const reservationsRes = await request.get('/api/reservations', {
      headers: { Authorization: `Bearer ${guestToken}` },
    });
    if (reservationsRes.status() !== 200) {
      return;
    }
    const reservationList = (await reservationsRes.json()).data || [];
    reviewedReservation = reservationList.find((row) => row.reservation_code === 'RES-DEMO-COMPLETED-001') || null;
    ineligibleReservation = reservationList.find((row) => row.reservation_code === 'RES-DEMO-INHOUSE-001') || null;
  });

  test('GET /hotels/:id/reviews  returns public review list', async ({ request }) => {
    const res = await request.get(`/api/hotels/${SEED.hotel.id}/reviews`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('summary');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /guests/:id/reviews  guest can view own review history', async ({ request }) => {
    test.skip(!guestToken, 'Guest token unavailable');
    const res = await request.get(`/api/guests/${SEED.guest.id}/reviews`, {
      headers: { Authorization: `Bearer ${guestToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /hotels/:id/reviews  no token  401', async ({ request }) => {
    const res = await request.post(`/api/hotels/${SEED.hotel.id}/reviews`, {
      data: {
        reservation_id: 1,
        rating_score: 5,
        review_title: 'Unauthorized',
        review_text: 'This should not be accepted without authentication.',
      },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /hotels/:id/reviews  requires checked-out stay', async ({ request }) => {
    test.skip(!guestToken || !ineligibleReservation, 'No ineligible demo reservation available');
    const res = await request.post(`/api/hotels/${SEED.hotel.id}/reviews`, {
      headers: { Authorization: `Bearer ${guestToken}` },
      data: {
        reservation_id: ineligibleReservation.reservation_id,
        rating_score: 4,
        review_title: 'Too early',
        review_text: 'Attempting to review before the stay is fully completed should be rejected.',
      },
    });
    expect(res.status()).toBe(403);
  });

  test('POST /hotels/:id/reviews  duplicate review  409', async ({ request }) => {
    test.skip(!guestToken || !reviewedReservation, 'No reviewed demo reservation available');
    const res = await request.post(`/api/hotels/${SEED.hotel.id}/reviews`, {
      headers: { Authorization: `Bearer ${guestToken}` },
      data: {
        reservation_id: reviewedReservation.reservation_id,
        rating_score: 5,
        review_title: 'Duplicate review',
        review_text: 'Submitting a second public review for the same completed reservation must be blocked.',
      },
    });
    expect(res.status()).toBe(409);
  });
});
