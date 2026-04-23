/**
 * ══════════════════════════════════════════════════════════════
 * [12] ADMIN ACCOUNTS API — Account Management Tests
 * Endpoints:
 *   GET /api/admin/accounts
 *   PUT /api/admin/accounts/system/:id
 *   PUT /api/admin/accounts/guest/:id
 * ══════════════════════════════════════════════════════════════
 */
const { test, expect } = require('@playwright/test');
const { SEED } = require('./helpers');

test.describe('👤 Admin Accounts API', () => {

  let adminToken       = null;
  let seedSystemUserId = null; // non-admin system user to test lock/unlock
  let seedGuestAuthId  = null; // guest to test lock/unlock

  // ── Setup: get admin token + collect IDs ──────────────────
  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/auth/admin/login', {
      data: { username: SEED.admin.username, password: SEED.admin.password },
    });
    if (res.status() === 200) {
      adminToken = (await res.json()).token;
    }

    // Fetch accounts list to get real IDs
    if (adminToken) {
      const acRes = await request.get('/api/admin/accounts', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (acRes.status() === 200) {
        const data = (await acRes.json()).data;
        const nonAdmin = data.system_users?.find(u => u.username !== SEED.admin.username);
        seedSystemUserId = nonAdmin?.user_id ?? data.system_users?.[0]?.user_id ?? null;
        seedGuestAuthId  = data.guest_accounts?.[0]?.guest_auth_id ?? null;
      }
    }
  });

  // ── GET /admin/accounts ──────────────────────────────────
  test('GET /admin/accounts — no token → 401', async ({ request }) => {
    const res = await request.get('/api/admin/accounts');
    expect([401, 403]).toContain(res.status());
  });

  test('GET /admin/accounts — returns system_users and guest_accounts', async ({ request }) => {
    const res = await request.get('/api/admin/accounts', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('system_users');
    expect(body.data).toHaveProperty('guest_accounts');
    expect(Array.isArray(body.data.system_users)).toBe(true);
    expect(Array.isArray(body.data.guest_accounts)).toBe(true);
    expect(body.data.system_users.length).toBeGreaterThan(0);
    expect(body.data.guest_accounts.length).toBeGreaterThan(0);

    // Check system user fields
    const sys = body.data.system_users[0];
    expect(sys).toHaveProperty('user_id');
    expect(sys).toHaveProperty('username');
    expect(sys).toHaveProperty('full_name');
    expect(sys).toHaveProperty('account_status');
    expect(['ACTIVE', 'LOCKED', 'DISABLED']).toContain(sys.account_status);

    // Check guest account fields
    const g = body.data.guest_accounts[0];
    expect(g).toHaveProperty('guest_auth_id');
    expect(g).toHaveProperty('login_email');
    expect(g).toHaveProperty('guest_code');
    expect(g).toHaveProperty('account_status');
    expect(['ACTIVE', 'LOCKED', 'DISABLED']).toContain(g.account_status);
  });

  // ── PUT /admin/accounts/system/:id ──────────────────────
  test('PUT /admin/accounts/system/:id — no token → 401', async ({ request }) => {
    const res = await request.put('/api/admin/accounts/system/1', {
      data: { account_status: 'LOCKED' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('PUT /admin/accounts/system/:id — invalid status → 400', async ({ request }) => {
    const res = await request.put('/api/admin/accounts/system/1', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { account_status: 'BANNED' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('PUT /admin/accounts/system/:id — invalid ID → 400', async ({ request }) => {
    const res = await request.put('/api/admin/accounts/system/not-a-number', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { account_status: 'LOCKED' },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /admin/accounts/system/:id — nonexistent → 404', async ({ request }) => {
    const res = await request.put('/api/admin/accounts/system/999999', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { account_status: 'LOCKED' },
    });
    expect(res.status()).toBe(404);
  });

  test('PUT /admin/accounts/system/:id — lock then restore non-admin user', async ({ request }) => {
    if (!adminToken || !seedSystemUserId) return test.skip();

    // Lock
    const lockRes = await request.put(`/api/admin/accounts/system/${seedSystemUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { account_status: 'LOCKED' },
    });
    expect(lockRes.status()).toBe(200);
    const lockBody = await lockRes.json();
    expect(lockBody.success).toBe(true);
    expect(lockBody.data.account_status).toBe('LOCKED');
    expect(lockBody.data.user_id).toBe(seedSystemUserId);

    // Restore to ACTIVE
    const restoreRes = await request.put(`/api/admin/accounts/system/${seedSystemUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { account_status: 'ACTIVE' },
    });
    expect(restoreRes.status()).toBe(200);
    expect((await restoreRes.json()).data.account_status).toBe('ACTIVE');
  });

  test('PUT /admin/accounts/system/:id — cannot lock own account → 400', async ({ request }) => {
    if (!adminToken) return test.skip();
    // Get admin user_id from /auth/me
    const meRes = await request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const me = await meRes.json();
    const adminUserId = me.user?.user_id;
    if (!adminUserId) return test.skip();

    const res = await request.put(`/api/admin/accounts/system/${adminUserId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { account_status: 'LOCKED' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/cannot|self|own|currently in use/i);
  });

  // ── PUT /admin/accounts/guest/:id ───────────────────────
  test('PUT /admin/accounts/guest/:id — no token → 401', async ({ request }) => {
    const res = await request.put('/api/admin/accounts/guest/1', {
      data: { account_status: 'LOCKED' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('PUT /admin/accounts/guest/:id — invalid status → 400', async ({ request }) => {
    const res = await request.put('/api/admin/accounts/guest/1', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { account_status: 'SUSPENDED' },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /admin/accounts/guest/:id — disable then restore guest', async ({ request }) => {
    if (!adminToken || !seedGuestAuthId) return test.skip();

    // Disable
    const disRes = await request.put(`/api/admin/accounts/guest/${seedGuestAuthId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { account_status: 'DISABLED' },
    });
    expect(disRes.status()).toBe(200);
    const disBody = await disRes.json();
    expect(disBody.success).toBe(true);
    expect(disBody.data.account_status).toBe('DISABLED');
    expect(disBody.data.guest_auth_id).toBe(seedGuestAuthId);

    // Restore to ACTIVE
    const restRes = await request.put(`/api/admin/accounts/guest/${seedGuestAuthId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { account_status: 'ACTIVE' },
    });
    expect(restRes.status()).toBe(200);
    expect((await restRes.json()).data.account_status).toBe('ACTIVE');
  });

  test('PUT /admin/accounts/guest/:id — nonexistent → 404', async ({ request }) => {
    const res = await request.put('/api/admin/accounts/guest/999999', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { account_status: 'LOCKED' },
    });
    expect(res.status()).toBe(404);
  });

});
