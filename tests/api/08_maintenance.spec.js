/**
 * 
 * [08] MAINTENANCE API  Playwright Tests
 * Endpoints:
 *   GET /api/maintenance
 *   POST /api/maintenance
 *   PUT  /api/maintenance/:id
 * 
 */
const { test, expect } = require('@playwright/test');
const { SEED } = require('./helpers');

let createdTicketId = null;

test.describe(' Maintenance API', () => {

  //  GET /maintenance 
  test('GET /maintenance?hotel_id=  returns ticket list', async ({ request }) => {
    const res = await request.get('/api/maintenance', {
      params: { hotel_id: SEED.hotel.id },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /maintenance  filter by status', async ({ request }) => {
    const res = await request.get('/api/maintenance', {
      params: { hotel_id: SEED.hotel.id, status: 'OPEN' },
    });
    expect(res.status()).toBe(200);
  });

  test('GET /maintenance  filter by severity', async ({ request }) => {
    const res = await request.get('/api/maintenance', {
      params: { hotel_id: SEED.hotel.id, severity: 'HIGH' },
    });
    expect(res.status()).toBe(200);
  });

  test('GET /maintenance  missing hotel_id  400', async ({ request }) => {
    const res = await request.get('/api/maintenance');
    expect(res.status()).toBe(400);
  });

  //  POST /maintenance 
  test('POST /maintenance  create LOW severity ticket (room status unchanged)', async ({ request }) => {
    const res = await request.post('/api/maintenance', {
      data: {
        hotel_id: SEED.hotel.id,
        room_id: SEED.room.id,
        reported_by: SEED.staff.id,
        issue_category: 'ELECTRICAL',
        issue_description: 'Light bulb flickering  Playwright test',
        severity_level: 'LOW',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('maintenance_ticket_id');
    expect(body.data.issue_category).toBe('ELECTRICAL');
    createdTicketId = body.data.maintenance_ticket_id;
  });

  test('POST /maintenance  missing hotel_id  400', async ({ request }) => {
    const res = await request.post('/api/maintenance', {
      data: { issue_category: 'PLUMBING', issue_description: 'Leak' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /maintenance  missing issue_category  400', async ({ request }) => {
    const res = await request.post('/api/maintenance', {
      data: { hotel_id: SEED.hotel.id, issue_description: 'Something broken' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /maintenance  missing issue_description  400', async ({ request }) => {
    const res = await request.post('/api/maintenance', {
      data: { hotel_id: SEED.hotel.id, issue_category: 'HVAC' },
    });
    expect(res.status()).toBe(400);
  });

  //  PUT /maintenance/:id 
  test('PUT /maintenance/:id  assign and update status', async ({ request }) => {
    if (!createdTicketId) return test.skip();
    const res = await request.put(`/api/maintenance/${createdTicketId}`, {
      data: {
        status: 'IN_PROGRESS',
        assigned_to: SEED.staff.id,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('IN_PROGRESS');
  });

  test('PUT /maintenance/:id  resolve ticket', async ({ request }) => {
    if (!createdTicketId) return test.skip();
    const res = await request.put(`/api/maintenance/${createdTicketId}`, {
      data: {
        status: 'RESOLVED',
        resolution_note: 'Replaced light bulb  Playwright test resolved',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('RESOLVED');
  });

  test('PUT /maintenance/:id  missing status  400', async ({ request }) => {
    if (!createdTicketId) return test.skip();
    const res = await request.put(`/api/maintenance/${createdTicketId}`, {
      data: { resolution_note: 'No status provided' },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /maintenance/:id  ticket not found  404', async ({ request }) => {
    const res = await request.put('/api/maintenance/99999', {
      data: { status: 'CLOSED' },
    });
    expect(res.status()).toBe(404);
  });

  test('PUT /maintenance/:id  invalid ID  400', async ({ request }) => {
    const res = await request.put('/api/maintenance/not-a-number', {
      data: { status: 'CLOSED' },
    });
    expect(res.status()).toBe(400);
  });

});
