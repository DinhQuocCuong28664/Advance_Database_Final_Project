/**
 * ══════════════════════════════════════════════════════════════
 * [01] AUTH API — Playwright Tests
 * Endpoints:
 *   POST /api/auth/login
 *   POST /api/auth/admin/login
 *   POST /api/auth/guest/register
 *   POST /api/auth/guest/login
 *   GET  /api/auth/me
 * ══════════════════════════════════════════════════════════════
 */
const { test, expect } = require('@playwright/test');
const { SEED } = require('./helpers');

let adminToken = null;
let guestToken = null;
const testEmail = `playwright_${Date.now()}@test.com`;

test.describe('🔐 Auth API', () => {

  // ── Admin Login ────────────────────────────────────────────
  test('POST /auth/admin/login — success', async ({ request }) => {
    const res = await request.post('/api/auth/admin/login', {
      data: { username: SEED.admin.username, password: SEED.admin.password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.token).toBeTruthy();
    expect(body.user.user_type).toBe('SYSTEM_USER');
    adminToken = body.token;
  });

  test('POST /auth/admin/login — wrong password → 401', async ({ request }) => {
    const res = await request.post('/api/auth/admin/login', {
      data: { username: SEED.admin.username, password: 'wrongpass' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /auth/admin/login — missing fields → 400', async ({ request }) => {
    const res = await request.post('/api/auth/admin/login', {
      data: { username: SEED.admin.username },
    });
    expect(res.status()).toBe(400);
  });

  // ── Guest Register ─────────────────────────────────────────
  test('POST /auth/guest/register — create new guest + account', async ({ request }) => {
    const res = await request.post('/api/auth/guest/register', {
      data: {
        login_email: testEmail,
        password: 'Test12345',
        first_name: 'Playwright',
        last_name: 'Tester',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.token).toBeTruthy();
    expect(body.user.user_type).toBe('GUEST');
    guestToken = body.token;
  });

  test('POST /auth/guest/register — duplicate email → 409', async ({ request }) => {
    const res = await request.post('/api/auth/guest/register', {
      data: { login_email: testEmail, password: 'Test12345', first_name: 'X', last_name: 'Y' },
    });
    expect(res.status()).toBe(409);
  });

  test('POST /auth/guest/register — missing password → 400', async ({ request }) => {
    const res = await request.post('/api/auth/guest/register', {
      data: { login_email: 'another@test.com', first_name: 'A', last_name: 'B' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /auth/guest/register — password too short → 400', async ({ request }) => {
    const res = await request.post('/api/auth/guest/register', {
      data: { login_email: 'short@test.com', password: '123', first_name: 'A', last_name: 'B' },
    });
    expect(res.status()).toBe(400);
  });

  // ── Guest Login ────────────────────────────────────────────
  test('POST /auth/guest/login — success', async ({ request }) => {
    const res = await request.post('/api/auth/guest/login', {
      data: { login: testEmail, password: 'Test12345' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.token).toBeTruthy();
    expect(body.user.user_type).toBe('GUEST');
  });

  test('POST /auth/guest/login — wrong password → 401', async ({ request }) => {
    const res = await request.post('/api/auth/guest/login', {
      data: { login: testEmail, password: 'wrongpass' },
    });
    expect(res.status()).toBe(401);
  });

  // ── Universal Login ────────────────────────────────────────
  test('POST /auth/login — admin via universal endpoint', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { login: SEED.admin.username, password: SEED.admin.password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.user_type).toBe('SYSTEM_USER');
  });

  test('POST /auth/login — guest via universal endpoint', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { login: testEmail, password: 'Test12345' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.user_type).toBe('GUEST');
  });

  test('POST /auth/login — missing fields → 400', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: { login: 'admin' } });
    expect(res.status()).toBe(400);
  });

  // ── GET /auth/me ───────────────────────────────────────────
  test('GET /auth/me — returns current admin user', async ({ request }) => {
    const res = await request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.user_type).toBe('SYSTEM_USER');
  });

  test('GET /auth/me — no token → 401', async ({ request }) => {
    const res = await request.get('/api/auth/me');
    expect(res.status()).toBe(401);
  });

});
