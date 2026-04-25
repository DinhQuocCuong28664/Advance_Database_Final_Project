/**
 * 
 * [04] RESERVATIONS API  Full Lifecycle Test
 * Endpoints:
 *   POST /api/reservations
 *   GET  /api/reservations/:code
 *   POST /api/reservations/:id/checkin
 *   POST /api/reservations/:id/checkout
 *   POST /api/reservations/:id/guest-cancel
 *   POST /api/reservations/:id/hotel-cancel
 *   POST /api/reservations/:id/transfer
 * 
 */
const { test, expect } = require('@playwright/test');
const { SEED, DATES, futureDate } = require('./helpers');

// Shared state across lifecycle tests
let reservation = null;       // created in first test, used by all
let cancelReservation = null; // for guest-cancel test
let hotelCancelReservation = null; // for hotel-cancel test
let guestToken = null;        // JWT for guest-cancel (requires auth)

// 
// Helper: find an available room for the given hotel + dates
// 
async function findAvailableRoom(request, hotelId, checkin, checkout) {
  const res = await request.get('/api/rooms/availability', {
    params: { hotel_id: hotelId, checkin, checkout },
  });
  const body = await res.json();
  if (!body.data || body.data.length === 0) return null;
  return body.data[0];
}

test.describe(' Reservations API  Full Lifecycle', () => {

  //  POST /reservations  Validation 
  test('POST /reservations  missing required fields  400', async ({ request }) => {
    const res = await request.post('/api/reservations', {
      data: { hotel_id: SEED.hotel.id, guest_id: SEED.guest.id }, // missing room, dates
    });
    expect(res.status()).toBe(400);
  });

  test('POST /reservations  nightly_rate <= 0  400', async ({ request }) => {
    const res = await request.post('/api/reservations', {
      data: {
        hotel_id: SEED.hotel.id,
        guest_id: SEED.guest.id,
        room_id: 1,
        checkin_date: DATES.checkin,
        checkout_date: DATES.checkout,
        nightly_rate: 0,
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /reservations  checkout before checkin  400', async ({ request }) => {
    const res = await request.post('/api/reservations', {
      data: {
        hotel_id: SEED.hotel.id,
        guest_id: SEED.guest.id,
        room_id: 1,
        checkin_date: DATES.checkout,
        checkout_date: DATES.checkin,
        nightly_rate: 500000,
      },
    });
    expect(res.status()).toBe(400);
  });

  //  POST /reservations  Success 
  test('POST /reservations  create reservation (pessimistic locking)', async ({ request }) => {
    const room = await findAvailableRoom(request, SEED.hotel.id, DATES.checkin, DATES.checkout);
    if (!room) return test.skip();

    const res = await request.post('/api/reservations', {
      data: {
        hotel_id: SEED.hotel.id,
        guest_id: SEED.guest.id,
        room_id: room.room_id,
        room_type_id: room.room_type_id,
        checkin_date: DATES.checkin,
        checkout_date: DATES.checkout,
        adult_count: 2,
        nightly_rate: room.min_nightly_rate || 1000000,
        currency_code: 'VND',
        guarantee_type: 'DEPOSIT',
        purpose_of_stay: 'LEISURE',
        special_request_text: 'Playwright test reservation',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.reservation_code).toMatch(/^RES-/);
    expect(body.data.status).toBe('CONFIRMED');
    expect(body.data.deposit_required).toBe(true);
    reservation = body.data;
  });

  //  GET /reservations/:code 
  test('GET /reservations/:code  fetch by code', async ({ request }) => {
    if (!reservation) return test.skip();
    const res = await request.get(`/api/reservations/${reservation.reservation_code}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.reservation_code).toBe(reservation.reservation_code);
    expect(body.data).toHaveProperty('rooms');
    expect(body.data).toHaveProperty('status_history');
    // vw_ReservationTotal fields (view uses grand_total_amount)
    expect(body.data).toHaveProperty('grand_total_amount');
    expect(body.data).toHaveProperty('total_paid');
    expect(body.data).toHaveProperty('balance_due');
  });

  test('GET /reservations/:code  not found  404', async ({ request }) => {
    const res = await request.get('/api/reservations/RES-NOTEXIST-999');
    expect(res.status()).toBe(404);
  });

  //  POST /reservations/:id/checkin 
  test('POST /reservations/:id/checkin  check in', async ({ request }) => {
    if (!reservation) return test.skip();
    const res = await request.post(`/api/reservations/${reservation.reservation_id}/checkin`, {
      data: { agent_id: SEED.staff.id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Response: { success, message, reservation_id }  no data field
    expect(body.success).toBe(true);
    expect(body.message).toBe('Check-in successful');
    expect(body.reservation_id).toBe(reservation.reservation_id);
    // Verify status via GET
    const det = await (await request.get(`/api/reservations/${reservation.reservation_code}`)).json();
    expect(det.data.reservation_status).toBe('CHECKED_IN');
  });

  test('POST /checkin  already checked in  409', async ({ request }) => {
    if (!reservation) return test.skip();
    const res = await request.post(`/api/reservations/${reservation.reservation_id}/checkin`, {
      data: { agent_id: SEED.staff.id },
    });
    expect(res.status()).toBe(409);
  });

  //  POST /reservations/:id/checkout 
  test('POST /reservations/:id/checkout  full checkout lifecycle', async ({ request }) => {
    if (!reservation) return test.skip();
    const res = await request.post(`/api/reservations/${reservation.reservation_id}/checkout`, {
      data: { agent_id: SEED.staff.id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    //  Response shape 
    expect(body.success).toBe(true);
    expect(body.message).toBe('Check-out successful');
    expect(body.reservation_id).toBe(reservation.reservation_id);

    //  Financial summary from vw_ReservationTotal 
    expect(body.financials).not.toBeNull();
    // checkout endpoint queries: grand_total, total_paid, balance_due
    expect(body.financials).toHaveProperty('grand_total');
    expect(body.financials).toHaveProperty('total_paid');
    expect(body.financials).toHaveProperty('balance_due');
    expect(Number(body.financials.grand_total)).toBeGreaterThanOrEqual(0);

    //  Verify: Reservation status changed to CHECKED_OUT 
    const detailRes = await request.get(`/api/reservations/${reservation.reservation_code}`);
    expect(detailRes.status()).toBe(200);
    const detail = await detailRes.json();
    expect(detail.data.reservation_status).toBe('CHECKED_OUT');

    //  Verify: Status history has CHECKED_IN  CHECKED_OUT 
    const history = detail.data.status_history || [];
    const checkoutEntry = history.find(
      h => h.old_status === 'CHECKED_IN' && h.new_status === 'CHECKED_OUT'
    );
    expect(checkoutEntry).toBeTruthy();
    expect(checkoutEntry.change_reason).toBe('Guest checked out');

    //  Verify: Housekeeping task auto-created (CLEANING/HIGH) 
    const hkRes = await request.get('/api/housekeeping', {
      params: { hotel_id: SEED.hotel.id },
    });
    expect(hkRes.status()).toBe(200);
    const hkBody = await hkRes.json();
    const autoTask = hkBody.data?.find(
      t => t.task_type === 'CLEANING' && t.priority_level === 'HIGH'
    );
    expect(autoTask).toBeTruthy();
  });

  test('POST /checkout  not in CHECKED_IN status  409', async ({ request }) => {
    if (!reservation) return test.skip();
    // Already CHECKED_OUT, attempt again
    const res = await request.post(`/api/reservations/${reservation.reservation_id}/checkout`, {
      data: { agent_id: SEED.staff.id },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/not in CHECKED_IN/i);
  });

  test('POST /checkout  invalid reservation ID  400', async ({ request }) => {
    const res = await request.post('/api/reservations/not-a-number/checkout', {
      data: { agent_id: SEED.staff.id },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /checkout  nonexistent ID  409', async ({ request }) => {
    const res = await request.post('/api/reservations/999999/checkout', {
      data: { agent_id: SEED.staff.id },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  //  POST /reservations/:id/guest-cancel 
  test('POST /reservations  create reservation for guest-cancel', async ({ request }) => {
    const cin  = futureDate(80);
    const cout = futureDate(82);
    const room = await findAvailableRoom(request, SEED.hotel.id, cin, cout);
    if (!room) return test.skip();

    // Get guest JWT token (guest-cancel requires requireAuth)
    if (!guestToken) {
      const loginRes = await request.post('/api/auth/guest/login', {
        data: { login: SEED.guestLogin.email, password: SEED.guestLogin.password },
      });
      expect(loginRes.status()).toBe(200);
      guestToken = (await loginRes.json()).token;
    }

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
    if (res.status() === 201) cancelReservation = (await res.json()).data;
  });

  test('POST /reservations/:id/guest-cancel  cancel and forfeit deposit', async ({ request }) => {
    if (!cancelReservation) return test.skip();
    // guest-cancel requires Bearer token (requireAuth middleware)
    const headers = guestToken ? { Authorization: `Bearer ${guestToken}` } : {};
    const res = await request.post(`/api/reservations/${cancelReservation.reservation_id}/guest-cancel`, {
      headers,
      data: { reason: 'Change of travel plans - Playwright test' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Response uses data.new_status (not data.reservation_status)
    expect(body.data.new_status).toBe('CANCELLED');
    expect(body.data.cancelled_by).toBe('GUEST');
    expect(body.data.refund_amount).toBe(0); // deposit forfeited
  });

  test('POST /guest-cancel  not in CONFIRMED  409', async ({ request }) => {
    if (!cancelReservation) return test.skip();
    // Already cancelled, try again (still needs auth)
    const headers = guestToken ? { Authorization: `Bearer ${guestToken}` } : {};
    const res = await request.post(`/api/reservations/${cancelReservation.reservation_id}/guest-cancel`, {
      headers,
      data: { reason: 'Again' },
    });
    expect(res.status()).toBe(409);
  });

  //  POST /reservations/:id/hotel-cancel 
  test('POST /reservations  create reservation for hotel-cancel', async ({ request }) => {
    const cin  = futureDate(90);
    const cout = futureDate(92);
    const room = await findAvailableRoom(request, SEED.hotel.id, cin, cout);
    if (!room) return test.skip();

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
    if (res.status() === 201) hotelCancelReservation = (await res.json()).data;
  });

  test('POST /reservations/:id/hotel-cancel  full cancellation lifecycle', async ({ request }) => {
    if (!hotelCancelReservation) return test.skip();
    const res = await request.post(`/api/reservations/${hotelCancelReservation.reservation_id}/hotel-cancel`, {
      data: { reason: 'Room issue - Playwright test', agent_id: SEED.staff.id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    //  Response shape 
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/cancelled by hotel/i);
    // Response uses data.new_status (not data.reservation_status)
    expect(body.data.new_status).toBe('CANCELLED');
    expect(body.data.old_status).toBe('CONFIRMED');
    expect(body.data.cancelled_by).toBe('HOTEL');
    expect(body.data.reason).toBe('Room issue - Playwright test');
    expect(body.data.reservation_id).toBe(hotelCancelReservation.reservation_id);
    expect(body.data).toHaveProperty('refund_amount');

    //  Verify: reservation now CANCELLED via GET 
    const detailRes = await request.get(`/api/reservations/${hotelCancelReservation.reservation_code}`);
    expect(detailRes.status()).toBe(200);
    const detail = (await detailRes.json()).data;
    expect(detail.reservation_status).toBe('CANCELLED');

    //  Verify: status history has CONFIRMED  CANCELLED with reason 
    const hcEntry = detail.status_history?.find(
      h => h.old_status === 'CONFIRMED' && h.new_status === 'CANCELLED'
    );
    expect(hcEntry).toBeTruthy();
    expect(hcEntry.change_reason).toMatch(/HOTEL CANCEL/i);
  });

  test('POST /hotel-cancel  missing reason  400', async ({ request }) => {
    if (!hotelCancelReservation) return test.skip();
    const res = await request.post(`/api/reservations/${hotelCancelReservation.reservation_id}/hotel-cancel`, {
      data: { agent_id: 1 }, // missing reason
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/reason/i);
  });

  test('POST /hotel-cancel  already CANCELLED  409', async ({ request }) => {
    if (!hotelCancelReservation) return test.skip();
    // Already cancelled above, try again
    const res = await request.post(`/api/reservations/${hotelCancelReservation.reservation_id}/hotel-cancel`, {
      data: { reason: 'Duplicate cancel attempt', agent_id: SEED.staff.id },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/Cannot cancel/i);
  });

  test('POST /hotel-cancel  invalid ID  400', async ({ request }) => {
    const res = await request.post('/api/reservations/not-a-number/hotel-cancel', {
      data: { reason: 'test', agent_id: 1 },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /hotel-cancel  nonexistent reservation  404', async ({ request }) => {
    const res = await request.post('/api/reservations/999999/hotel-cancel', {
      data: { reason: 'test', agent_id: 1 },
    });
    expect(res.status()).toBe(404);
  });

  //  POST /reservations/:id/transfer 
  test('POST /reservations/:id/transfer  invalid reservation  404', async ({ request }) => {
    const res = await request.post('/api/reservations/99999/transfer', {
      data: { new_room_id: 2, reason: 'Test', agent_id: 1 },
    });
    expect(res.status()).toBe(404);
  });

  test('POST /transfer  missing new_room_id  400', async ({ request }) => {
    const res = await request.post('/api/reservations/1/transfer', {
      data: { reason: 'Test', agent_id: 1 },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /transfer  missing reason  400', async ({ request }) => {
    const res = await request.post('/api/reservations/1/transfer', {
      data: { new_room_id: 2, agent_id: 1 },
    });
    expect(res.status()).toBe(400);
  });

});
