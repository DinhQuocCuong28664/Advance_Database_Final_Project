const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');
const { attachAuthContext, requireAuth, issueAuthToken } = require('../middleware/auth');
const { isMailConfigured, sendGuestVerificationOtp } = require('../services/mail');

function buildAuthResponse(token, user) {
  return {
    success: true,
    token,
    user,
  };
}

async function generateGuestCode(pool) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `G-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const exists = await pool.request()
      .input('guestCode', sql.VarChar(50), candidate)
      .query('SELECT guest_id FROM Guest WHERE guest_code = @guestCode');

    if (exists.recordset.length === 0) {
      return candidate;
    }
  }

  throw new Error('Unable to generate unique guest code');
}

async function authenticateSystemUser(pool, username, password) {
  const result = await pool.request()
    .input('username', sql.VarChar(80), username)
    .query(`
      SELECT user_id, username, password_hash, account_status
      FROM SystemUser
      WHERE username = @username
    `);

  if (result.recordset.length === 0) {
    return null;
  }

  const account = result.recordset[0];
  const validPassword = await bcrypt.compare(password, account.password_hash);

  if (!validPassword) {
    throw new Error('Invalid username or password');
  }

  if (account.account_status !== 'ACTIVE') {
    throw new Error(`Account is ${account.account_status}`);
  }

  await pool.request()
    .input('id', sql.BigInt, account.user_id)
    .query(`UPDATE SystemUser SET last_login_at = GETDATE(), updated_at = GETDATE() WHERE user_id = @id`);

  const user = await loadSystemUser(pool, account.user_id);
  const token = issueAuthToken({
    sub: String(account.user_id),
    user_type: 'SYSTEM_USER',
    username: user.username,
    roles: user.roles,
  });

  return buildAuthResponse(token, user);
}

async function authenticateGuest(pool, login, password) {
  const result = await pool.request()
    .input('login', sql.VarChar(150), login)
    .query(`
      SELECT ga.guest_auth_id, ga.guest_id, ga.login_email, ga.password_hash,
             ga.account_status, g.guest_code
      FROM GuestAuth ga
      JOIN Guest g ON ga.guest_id = g.guest_id
      WHERE ga.login_email = @login OR g.guest_code = @login
    `);

  if (result.recordset.length === 0) {
    return null;
  }

  const account = result.recordset[0];
  const validPassword = await bcrypt.compare(password, account.password_hash);

  if (!validPassword) {
    throw new Error('Invalid login or password');
  }

  if (account.account_status !== 'ACTIVE') {
    if (account.account_status === 'LOCKED') {
      const verificationPending = await pool.request()
        .input('id', sql.BigInt, account.guest_auth_id)
        .query(`
          SELECT guest_auth_id
          FROM GuestAuth
          WHERE guest_auth_id = @id
            AND email_verified_at IS NULL
            AND account_status = 'LOCKED'
        `);

      if (verificationPending.recordset.length > 0) {
        throw new Error('Email verification required');
      }
    }

    throw new Error(`Guest account is ${account.account_status}`);
  }

  await pool.request()
    .input('id', sql.BigInt, account.guest_auth_id)
    .query(`UPDATE GuestAuth SET last_login_at = GETDATE(), updated_at = GETDATE() WHERE guest_auth_id = @id`);

  const guestUser = await loadGuestUser(pool, account.guest_id);
  const token = issueAuthToken({
    sub: String(guestUser.guest_id),
    user_type: 'GUEST',
    guest_code: guestUser.guest_code,
    login_email: account.login_email,
  });

  return buildAuthResponse(token, guestUser);
}

async function loadSystemUser(pool, userId) {
  const userResult = await pool.request()
    .input('id', sql.BigInt, userId)
    .query(`
      SELECT su.user_id, su.hotel_id, su.username, su.full_name, su.email,
             su.department, su.account_status, su.last_login_at
      FROM SystemUser su
      WHERE su.user_id = @id
    `);

  if (userResult.recordset.length === 0) {
    return null;
  }

  const roleResult = await pool.request()
    .input('id', sql.BigInt, userId)
    .query(`
      SELECT r.role_code
      FROM UserRole ur
      JOIN Role r ON ur.role_id = r.role_id
      WHERE ur.user_id = @id
      ORDER BY r.role_code
    `);

  return {
    user_type: 'SYSTEM_USER',
    ...userResult.recordset[0],
    roles: roleResult.recordset.map((row) => row.role_code),
  };
}

async function loadGuestUser(pool, guestId) {
  const guestResult = await pool.request()
    .input('id', sql.BigInt, guestId)
    .query(`
      SELECT g.guest_id, g.guest_code, g.full_name, g.email, g.vip_flag,
             g.marketing_opt_in_flag, ga.email_verified_at, ga.account_status
      FROM Guest g
      LEFT JOIN GuestAuth ga ON g.guest_id = ga.guest_id
      WHERE g.guest_id = @id
    `);

  if (guestResult.recordset.length === 0) {
    return null;
  }

  const loyaltyResult = await pool.request()
    .input('id', sql.BigInt, guestId)
    .query(`
      SELECT la.loyalty_account_id, la.membership_no, la.tier_code,
             la.points_balance, la.status, hc.chain_name
      FROM LoyaltyAccount la
      JOIN HotelChain hc ON la.chain_id = hc.chain_id
      WHERE la.guest_id = @id
      ORDER BY hc.chain_name
    `);

  return {
    user_type: 'GUEST',
    ...guestResult.recordset[0],
    loyalty_accounts: loyaltyResult.recordset,
  };
}

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function createVerificationOtp(pool, guestAuthId) {
  const otpCode = generateOtpCode();
  await pool.request()
    .input('guestAuthId', sql.BigInt, guestAuthId)
    .query(`
      UPDATE EmailVerificationOtp
      SET consumed_at = GETDATE()
      WHERE guest_auth_id = @guestAuthId
        AND consumed_at IS NULL
    `);

  await pool.request()
    .input('guestAuthId', sql.BigInt, guestAuthId)
    .input('otpCode', sql.VarChar(10), otpCode)
    .query(`
      INSERT INTO EmailVerificationOtp (guest_auth_id, otp_code, purpose, expires_at)
      VALUES (@guestAuthId, @otpCode, 'ACTIVATE', DATEADD(MINUTE, 10, GETDATE()))
    `);

  return otpCode;
}

async function sendVerificationForGuestAuth(pool, guestAuthId) {
  if (!isMailConfigured()) {
    throw new Error('Mail service is not configured');
  }

  const result = await pool.request()
    .input('guestAuthId', sql.BigInt, guestAuthId)
    .query(`
      SELECT ga.guest_auth_id, ga.login_email, g.full_name
      FROM GuestAuth ga
      JOIN Guest g ON ga.guest_id = g.guest_id
      WHERE ga.guest_auth_id = @guestAuthId
    `);

  if (result.recordset.length === 0) {
    throw new Error('Guest account not found for verification');
  }

  const account = result.recordset[0];
  const otpCode = await createVerificationOtp(pool, guestAuthId);
  await sendGuestVerificationOtp({
    to: account.login_email,
    fullName: account.full_name,
    otpCode,
  });

  return account;
}

router.use(attachAuthContext);

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ success: false, error: 'login and password are required' });
    }

    const pool = getSqlPool();

    try {
      const systemAuth = await authenticateSystemUser(pool, login, password);
      if (systemAuth) {
        return res.json(systemAuth);
      }
    } catch (error) {
      return res.status(error.message.startsWith('Account is') ? 403 : 401).json({ success: false, error: error.message });
    }

    try {
      const guestAuth = await authenticateGuest(pool, login, password);
      if (guestAuth) {
        return res.json(guestAuth);
      }
    } catch (error) {
      return res.status(error.message.startsWith('Guest account is') ? 403 : 401).json({ success: false, error: error.message });
    }

    return res.status(401).json({ success: false, error: 'Invalid login or password' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'username and password are required' });
    }

    const pool = getSqlPool();
    const auth = await authenticateSystemUser(pool, username, password);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    res.json(auth);
  } catch (err) {
    res.status(err.message.startsWith('Account is') ? 403 : 401).json({ success: false, error: err.message });
  }
});

router.post('/guest/register', async (req, res) => {
  try {
    const {
      guest_id,
      login_email,
      password,
      first_name,
      last_name,
      title,
      middle_name,
      gender,
      phone_country_code,
      phone_number,
      nationality_country_code,
      preferred_language_code,
      marketing_opt_in_flag,
    } = req.body;

    if (!login_email || !password) {
      return res.status(400).json({ success: false, error: 'login_email and password are required' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ success: false, error: 'password must be at least 8 characters' });
    }

    const pool = getSqlPool();

    const existingAuth = await pool.request()
      .input('guestId', sql.BigInt, guest_id || null)
      .input('loginEmail', sql.VarChar(150), login_email)
      .query(`
        SELECT guest_auth_id, guest_id, login_email
        FROM GuestAuth
        WHERE guest_id = @guestId OR login_email = @loginEmail
      `);

    if (guest_id && existingAuth.recordset.some((row) => row.guest_id === guest_id)) {
      return res.status(409).json({ success: false, error: 'Guest already has login credentials' });
    }

    if (existingAuth.recordset.some((row) => row.login_email === login_email)) {
      return res.status(409).json({ success: false, error: 'login_email is already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      let resolvedGuestId = guest_id ? Number(guest_id) : null;

      if (resolvedGuestId) {
        const guestResult = await new sql.Request(transaction)
          .input('id', sql.BigInt, resolvedGuestId)
          .query(`
            SELECT guest_id
            FROM Guest
            WHERE guest_id = @id
          `);

        if (guestResult.recordset.length === 0) {
          await transaction.rollback();
          return res.status(404).json({ success: false, error: 'Guest not found' });
        }
      } else {
        if (!first_name || !last_name) {
          await transaction.rollback();
          return res.status(400).json({ success: false, error: 'first_name and last_name are required for self-registration' });
        }

        const guestCode = await generateGuestCode(pool);
        const createdGuest = await new sql.Request(transaction)
          .input('guestCode', sql.VarChar(50), guestCode)
          .input('title', sql.NVarChar(20), title || null)
          .input('firstName', sql.NVarChar(100), first_name)
          .input('middleName', sql.NVarChar(100), middle_name || null)
          .input('lastName', sql.NVarChar(100), last_name)
          .input('gender', sql.VarChar(15), gender || null)
          .input('email', sql.VarChar(150), login_email)
          .input('phoneCountryCode', sql.VarChar(10), phone_country_code || null)
          .input('phoneNumber', sql.VarChar(30), phone_number || null)
          .input('nationality', sql.Char(2), nationality_country_code || null)
          .input('languageCode', sql.VarChar(10), preferred_language_code || null)
          .input('marketingOptIn', sql.Bit, marketing_opt_in_flag ? 1 : 0)
          .query(`
            INSERT INTO Guest (
              guest_code, title, first_name, middle_name, last_name, gender,
              email, phone_country_code, phone_number, nationality_country_code,
              preferred_language_code, marketing_opt_in_flag
            )
            OUTPUT INSERTED.guest_id
            VALUES (
              @guestCode, @title, @firstName, @middleName, @lastName, @gender,
              @email, @phoneCountryCode, @phoneNumber, @nationality,
              @languageCode, @marketingOptIn
            )
          `);

        resolvedGuestId = createdGuest.recordset[0].guest_id;
      }

      const createdAuth = await new sql.Request(transaction)
        .input('guestId', sql.BigInt, resolvedGuestId)
        .input('loginEmail', sql.VarChar(150), login_email)
        .input('passwordHash', sql.VarChar(255), passwordHash)
        .query(`
          INSERT INTO GuestAuth (guest_id, login_email, password_hash, account_status)
          OUTPUT INSERTED.guest_auth_id
          VALUES (@guestId, @loginEmail, @passwordHash, 'LOCKED')
        `);

      await transaction.commit();
      await sendVerificationForGuestAuth(pool, createdAuth.recordset[0].guest_auth_id);

      res.status(201).json({
        success: true,
        verification_required: true,
        login_email,
        message: 'Account created. Check your email for the verification code.',
      });
    } catch (innerErr) {
      try { await transaction.rollback(); } catch (_) { /* ignore */ }
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/guest/resend-verification', async (req, res) => {
  try {
    const { login_email } = req.body;
    if (!login_email) {
      return res.status(400).json({ success: false, error: 'login_email is required' });
    }

    const pool = getSqlPool();
    const result = await pool.request()
      .input('loginEmail', sql.VarChar(150), login_email)
      .query(`
        SELECT guest_auth_id, email_verified_at, account_status
        FROM GuestAuth
        WHERE login_email = @loginEmail
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Guest account not found' });
    }

    const account = result.recordset[0];
    if (account.email_verified_at) {
      return res.status(400).json({ success: false, error: 'Email is already verified' });
    }

    await sendVerificationForGuestAuth(pool, account.guest_auth_id);

    res.json({
      success: true,
      message: 'A new verification code has been sent.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/guest/verify-email', async (req, res) => {
  try {
    const { login_email, otp_code } = req.body;

    if (!login_email || !otp_code) {
      return res.status(400).json({ success: false, error: 'login_email and otp_code are required' });
    }

    const pool = getSqlPool();
    const result = await pool.request()
      .input('loginEmail', sql.VarChar(150), login_email)
      .input('otpCode', sql.VarChar(10), String(otp_code).trim())
      .query(`
        SELECT TOP 1 ga.guest_auth_id, ga.guest_id, ga.login_email, evo.email_otp_id
        FROM GuestAuth ga
        JOIN EmailVerificationOtp evo ON ga.guest_auth_id = evo.guest_auth_id
        WHERE ga.login_email = @loginEmail
          AND evo.otp_code = @otpCode
          AND evo.purpose = 'ACTIVATE'
          AND evo.consumed_at IS NULL
          AND evo.expires_at >= GETDATE()
          AND ga.email_verified_at IS NULL
        ORDER BY evo.created_at DESC
      `);

    if (result.recordset.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification code' });
    }

    const account = result.recordset[0];
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await new sql.Request(transaction)
        .input('otpId', sql.BigInt, account.email_otp_id)
        .query(`
          UPDATE EmailVerificationOtp
          SET consumed_at = GETDATE()
          WHERE email_otp_id = @otpId
        `);

      await new sql.Request(transaction)
        .input('guestAuthId', sql.BigInt, account.guest_auth_id)
        .query(`
          UPDATE GuestAuth
          SET email_verified_at = GETDATE(),
              account_status = 'ACTIVE',
              updated_at = GETDATE()
          WHERE guest_auth_id = @guestAuthId
        `);

      await transaction.commit();
    } catch (innerErr) {
      try { await transaction.rollback(); } catch (_) { /* ignore */ }
      throw innerErr;
    }

    const guestUser = await loadGuestUser(pool, account.guest_id);
    const token = issueAuthToken({
      sub: String(guestUser.guest_id),
      user_type: 'GUEST',
      guest_code: guestUser.guest_code,
      login_email,
    });

    res.json(buildAuthResponse(token, guestUser));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/guest/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ success: false, error: 'login and password are required' });
    }

    const pool = getSqlPool();
    const auth = await authenticateGuest(pool, login, password);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Invalid login or password' });
    }

    res.json(auth);
  } catch (err) {
    res.status(err.message.startsWith('Guest account is') ? 403 : 401).json({ success: false, error: err.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const pool = getSqlPool();
    let user = null;

    if (req.auth.user_type === 'SYSTEM_USER') {
      user = await loadSystemUser(pool, Number(req.auth.sub));
    } else if (req.auth.user_type === 'GUEST') {
      user = await loadGuestUser(pool, Number(req.auth.sub));
    }

    if (!user) {
      return res.status(404).json({ success: false, error: 'Authenticated user not found' });
    }

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
