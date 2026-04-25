/**
 * 
 * [07] HOUSEKEEPING API  Playwright Tests
 * Endpoints:
 *   GET /api/housekeeping
 *   POST /api/housekeeping
 *   PUT  /api/housekeeping/:id/assign
 *   PUT  /api/housekeeping/:id/status
 * 
 */
const { test, expect } = require('@playwright/test');
const { SEED } = require('./helpers');

let createdTaskId = null;

test.describe(' Housekeeping API', () => {

  //  GET /housekeeping 
  test('GET /housekeeping?hotel_id=  returns tasks with summary', async ({ request }) => {
    const res = await request.get('/api/housekeeping', {
      params: { hotel_id: SEED.hotel.id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.summary).toBeDefined();
  });

  test('GET /housekeeping  filter by status', async ({ request }) => {
    const res = await request.get('/api/housekeeping', {
      params: { hotel_id: SEED.hotel.id, status: 'OPEN' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('GET /housekeeping  missing hotel_id  400', async ({ request }) => {
    const res = await request.get('/api/housekeeping');
    expect(res.status()).toBe(400);
  });

  //  POST /housekeeping 
  test('POST /housekeeping  create OPEN task (no staff)', async ({ request }) => {
    const res = await request.post('/api/housekeeping', {
      data: {
        hotel_id: SEED.hotel.id,
        room_id: SEED.room.id,
        task_type: 'DEEP_CLEAN',   // valid DB constraint value
        priority_level: 'MEDIUM',
        note: 'Created by Playwright test',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.task_status).toBe('OPEN');
    createdTaskId = body.data.hk_task_id; // actual field name
  });

  test('POST /housekeeping  create ASSIGNED task (with staff)', async ({ request }) => {
    const res = await request.post('/api/housekeeping', {
      data: {
        hotel_id: SEED.hotel.id,
        room_id: SEED.room.id,
        task_type: 'DEEP_CLEAN',
        assigned_staff_id: SEED.staff.id,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    // When staff is provided, status should be ASSIGNED
    expect(body.data.task_status).toBe('ASSIGNED');
  });

  test('POST /housekeeping  missing hotel_id  400', async ({ request }) => {
    const res = await request.post('/api/housekeeping', {
      data: { room_id: 1, task_type: 'STANDARD_CLEAN' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /housekeeping  missing room_id  400', async ({ request }) => {
    const res = await request.post('/api/housekeeping', {
      data: { hotel_id: SEED.hotel.id, task_type: 'STANDARD_CLEAN' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /housekeeping  missing task_type  400', async ({ request }) => {
    const res = await request.post('/api/housekeeping', {
      data: { hotel_id: SEED.hotel.id, room_id: 1 },
    });
    expect(res.status()).toBe(400);
  });

  //  PUT /housekeeping/:id/assign 
  test('PUT /housekeeping/:id/assign  assign staff to OPEN task', async ({ request }) => {
    if (!createdTaskId) return test.skip();
    const res = await request.put(`/api/housekeeping/${createdTaskId}/assign`, {
      data: { staff_id: SEED.staff.id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.task_status).toBe('ASSIGNED');
    expect(body.data.assigned_staff_id).toBe(SEED.staff.id);
  });

  test('PUT /housekeeping/:id/assign  missing staff_id  400', async ({ request }) => {
    if (!createdTaskId) return test.skip();
    const res = await request.put(`/api/housekeeping/${createdTaskId}/assign`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /housekeeping/:id/assign  task not found  404', async ({ request }) => {
    const res = await request.put('/api/housekeeping/99999/assign', {
      data: { staff_id: 1 },
    });
    expect(res.status()).toBe(404);
  });

  //  PUT /housekeeping/:id/status 
  test('PUT /housekeeping/:id/status  ASSIGNED  IN_PROGRESS', async ({ request }) => {
    if (!createdTaskId) return test.skip();
    const res = await request.put(`/api/housekeeping/${createdTaskId}/status`, {
      data: { status: 'IN_PROGRESS' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.task_status).toBe('IN_PROGRESS');
  });

  test('PUT /housekeeping/:id/status  IN_PROGRESS  DONE', async ({ request }) => {
    if (!createdTaskId) return test.skip();
    const res = await request.put(`/api/housekeeping/${createdTaskId}/status`, {
      data: { status: 'DONE', note: 'Room cleaned - Playwright test' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.task_status).toBe('DONE');
  });

  test('PUT /housekeeping/:id/status  DONE  VERIFIED', async ({ request }) => {
    if (!createdTaskId) return test.skip();
    const res = await request.put(`/api/housekeeping/${createdTaskId}/status`, {
      data: { status: 'VERIFIED' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.task_status).toBe('VERIFIED');
  });

  test('PUT /housekeeping/:id/status  invalid status  400', async ({ request }) => {
    if (!createdTaskId) return test.skip();
    const res = await request.put(`/api/housekeeping/${createdTaskId}/status`, {
      data: { status: 'INVALID' },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /housekeeping/:id/status  invalid transition  409', async ({ request }) => {
    if (!createdTaskId) return test.skip();
    // Already VERIFIED, try to go to IN_PROGRESS  invalid transition
    const res = await request.put(`/api/housekeeping/${createdTaskId}/status`, {
      data: { status: 'IN_PROGRESS' },
    });
    expect(res.status()).toBe(409);
  });

});
