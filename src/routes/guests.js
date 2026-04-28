/**
 * LuxeReserve - Guest Routes
 */

const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');
const { requireAuth, requireSystemUser } = require('../middleware/auth');

function ensureGuestAccess(req, res, guestId) {
  if (req.auth?.user_type === 'SYSTEM_USER') {
    return true;
  }

  if (req.auth?.user_type === 'GUEST' && Number(req.auth.sub) === guestId) {
    return true;
  }

  res.status(403).json({ success: false, error: 'You are not authorised to access this guest resource' });
  return false;
}

async function markExpiredRedemptions(pool, guestId) {
  await pool.request()
    .input('guestId', sql.BigInt, guestId)
    .query(`
      UPDATE LoyaltyRedemption
      SET status = 'EXPIRED',
          updated_at = GETDATE()
      WHERE guest_id = @guestId
        AND status = 'ISSUED'
        AND expires_at < GETDATE()
    `);
}

async function generateRedemptionCode(requestFactory) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `LOYAL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const existing = await requestFactory()
      .input('promoCode', sql.VarChar(50), candidate)
      .query('SELECT loyalty_redemption_id FROM LoyaltyRedemption WHERE issued_promo_code = @promoCode');

    if (existing.recordset.length === 0) {
      return candidate;
    }
  }

  throw new Error('Unable to generate unique loyalty voucher code');
}

// GET /api/guests
router.get('/', requireSystemUser, async (req, res) => {
  try {
    const pool = getSqlPool();
    const result = await pool.request().query(`
      SELECT guest_id, guest_code, title, first_name, last_name, full_name,
             email, phone_number, nationality_country_code, vip_flag
      FROM Guest ORDER BY full_name
    `);
    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/guests/:id  Full profile
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const pool = getSqlPool();
    const guestId = parseInt(req.params.id);
    if (isNaN(guestId)) {
      return res.status(400).json({ success: false, error: 'Invalid guest ID' });
    }
    if (!ensureGuestAccess(req, res, guestId)) {
      return;
    }

    const guest = await pool.request()
      .input('id', sql.BigInt, guestId)
      .query('SELECT * FROM Guest WHERE guest_id = @id');

    if (guest.recordset.length === 0) {
      return res.status(404).json({ success: false, error: 'Guest not found' });
    }

    const preferences = await pool.request()
      .input('id', sql.BigInt, guestId)
      .query('SELECT * FROM GuestPreference WHERE guest_id = @id ORDER BY priority_level');

    const loyalty = await pool.request()
      .input('id', sql.BigInt, guestId)
      .query(`
        SELECT la.*, c.chain_name
        FROM LoyaltyAccount la
        JOIN HotelChain c ON la.chain_id = c.chain_id
        WHERE la.guest_id = @id
      `);

    const addresses = await pool.request()
      .input('id', sql.BigInt, guestId)
      .query('SELECT * FROM GuestAddress WHERE guest_id = @id');

    res.json({
      success: true,
      data: {
        ...guest.recordset[0],
        preferences: preferences.recordset,
        loyalty_accounts: loyalty.recordset,
        addresses: addresses.recordset,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/guests/:id/loyalty-rewards
router.get('/:id/loyalty-rewards', requireAuth, async (req, res) => {
  try {
    const pool = getSqlPool();
    const guestId = parseInt(req.params.id, 10);
    if (isNaN(guestId)) {
      return res.status(400).json({ success: false, error: 'Invalid guest ID' });
    }
    if (!ensureGuestAccess(req, res, guestId)) {
      return;
    }

    await markExpiredRedemptions(pool, guestId);

    const result = await pool.request()
      .input('guestId', sql.BigInt, guestId)
      .query(`
        WITH PromoScope AS (
          SELECT
            p.promotion_id,
            p.promotion_code,
            p.promotion_name,
            p.promotion_type,
            p.discount_value,
            p.currency_code,
            p.applies_to,
            p.booking_start_date,
            p.booking_end_date,
            p.stay_start_date,
            p.stay_end_date,
            p.member_only_flag,
            p.min_nights,
            p.redeemable_points_cost,
            p.voucher_valid_days,
            p.hotel_id,
            p.brand_id,
            COALESCE(h.hotel_name, hb.hotel_name) AS scope_hotel_name,
            COALESCE(hb.hotel_id, h.hotel_id)     AS resolved_hotel_id,
            COALESCE(b.brand_id, bh.brand_id)     AS resolved_brand_id,
            COALESCE(b.brand_name, bh.brand_name) AS brand_name,
            COALESCE(hc.chain_id, hch.chain_id)   AS resolved_chain_id,
            COALESCE(hc.chain_name, hch.chain_name) AS chain_name
          FROM Promotion p
          LEFT JOIN Hotel h  ON p.hotel_id = h.hotel_id
          LEFT JOIN Brand b  ON p.brand_id = b.brand_id
          LEFT JOIN Hotel hb ON hb.brand_id = p.brand_id AND hb.status = 'ACTIVE'
          LEFT JOIN Brand bh ON h.brand_id = bh.brand_id
          LEFT JOIN HotelChain hc  ON b.chain_id = hc.chain_id
          LEFT JOIN HotelChain hch ON bh.chain_id = hch.chain_id
          WHERE p.status = 'ACTIVE'
            AND p.member_only_flag = 1
            AND p.redeemable_points_cost IS NOT NULL
            AND p.redeemable_points_cost > 0
            AND CAST(GETDATE() AS DATE) BETWEEN p.booking_start_date AND p.booking_end_date
        )
        SELECT *
        FROM (
          SELECT
            la.loyalty_account_id,
            la.membership_no,
            la.chain_id AS loyalty_chain_id,
            la.points_balance,
            ps.promotion_id,
            ps.promotion_code,
            ps.promotion_name,
            ps.promotion_type,
            ps.discount_value,
            ps.currency_code,
            ps.applies_to,
            ps.booking_start_date,
            ps.booking_end_date,
            ps.stay_start_date,
            ps.stay_end_date,
            ps.member_only_flag,
            ps.min_nights,
            ps.redeemable_points_cost,
            ps.voucher_valid_days,
            ps.scope_hotel_name,
            ps.resolved_hotel_id,
            ps.resolved_brand_id,
            ps.brand_name,
            ps.resolved_chain_id,
            ps.chain_name,
            CASE WHEN la.points_balance >= ps.redeemable_points_cost THEN 1 ELSE 0 END AS can_redeem,
            (
              SELECT COUNT(*)
              FROM LoyaltyRedemption lr
              WHERE lr.guest_id = @guestId
                AND lr.promotion_id = ps.promotion_id
                AND lr.status = 'ISSUED'
                AND lr.expires_at >= GETDATE()
            ) AS active_voucher_count,
            ROW_NUMBER() OVER (
              PARTITION BY la.loyalty_account_id, ps.promotion_id
              ORDER BY ps.resolved_hotel_id
            ) AS rn
          FROM LoyaltyAccount la
          JOIN PromoScope ps ON ps.resolved_chain_id = la.chain_id
          WHERE la.guest_id = @guestId
            AND la.status = 'ACTIVE'
        ) rewards
        WHERE rn = 1
        ORDER BY can_redeem DESC, redeemable_points_cost ASC, promotion_name ASC
      `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/guests/:id/loyalty-redemptions
router.get('/:id/loyalty-redemptions', requireAuth, async (req, res) => {
  try {
    const pool = getSqlPool();
    const guestId = parseInt(req.params.id, 10);
    if (isNaN(guestId)) {
      return res.status(400).json({ success: false, error: 'Invalid guest ID' });
    }
    if (!ensureGuestAccess(req, res, guestId)) {
      return;
    }

    await markExpiredRedemptions(pool, guestId);

    const result = await pool.request()
      .input('guestId', sql.BigInt, guestId)
      .query(`
        SELECT
          lr.loyalty_redemption_id,
          lr.issued_promo_code,
          lr.points_spent,
          lr.status,
          lr.issued_at,
          lr.expires_at,
          lr.redeemed_at,
          lr.note,
          p.promotion_id,
          p.promotion_name,
          p.promotion_type,
          p.discount_value,
          p.currency_code,
          p.applies_to,
          r.reservation_id,
          r.reservation_code
        FROM LoyaltyRedemption lr
        JOIN Promotion p ON lr.promotion_id = p.promotion_id
        LEFT JOIN Reservation r ON lr.reservation_id = r.reservation_id
        WHERE lr.guest_id = @guestId
        ORDER BY lr.issued_at DESC, lr.loyalty_redemption_id DESC
      `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/guests/:id/loyalty-rewards/:promotionId/redeem
router.post('/:id/loyalty-rewards/:promotionId/redeem', requireAuth, async (req, res) => {
  try {
    const pool = getSqlPool();
    const guestId = parseInt(req.params.id, 10);
    const promotionId = parseInt(req.params.promotionId, 10);

    if (isNaN(guestId) || isNaN(promotionId)) {
      return res.status(400).json({ success: false, error: 'Invalid guest or promotion ID' });
    }
    if (!ensureGuestAccess(req, res, guestId)) {
      return;
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await new sql.Request(transaction)
        .input('guestId', sql.BigInt, guestId)
        .query(`
          UPDATE LoyaltyRedemption
          SET status = 'EXPIRED',
              updated_at = GETDATE()
          WHERE guest_id = @guestId
            AND status = 'ISSUED'
            AND expires_at < GETDATE()
        `);

      const rewardResult = await new sql.Request(transaction)
        .input('promotionId', sql.BigInt, promotionId)
        .query(`
          WITH PromoScope AS (
            SELECT
              p.promotion_id,
              p.promotion_code,
              p.promotion_name,
              p.promotion_type,
              p.discount_value,
              p.currency_code,
              p.applies_to,
              p.member_only_flag,
              p.redeemable_points_cost,
              p.voucher_valid_days,
              COALESCE(hc.chain_id, hch.chain_id)   AS resolved_chain_id,
              COALESCE(hc.chain_name, hch.chain_name) AS chain_name
            FROM Promotion p
            LEFT JOIN Hotel h  ON p.hotel_id = h.hotel_id
            LEFT JOIN Brand b  ON p.brand_id = b.brand_id
            LEFT JOIN Brand bh ON h.brand_id = bh.brand_id
            LEFT JOIN HotelChain hc  ON b.chain_id = hc.chain_id
            LEFT JOIN HotelChain hch ON bh.chain_id = hch.chain_id
            WHERE p.promotion_id = @promotionId
              AND p.status = 'ACTIVE'
              AND p.member_only_flag = 1
              AND p.redeemable_points_cost IS NOT NULL
              AND p.redeemable_points_cost > 0
              AND CAST(GETDATE() AS DATE) BETWEEN p.booking_start_date AND p.booking_end_date
          )
          SELECT TOP 1 *
          FROM PromoScope
        `);

      if (rewardResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ success: false, error: 'Reward promotion not found or not redeemable' });
      }

      const reward = rewardResult.recordset[0];

      const loyaltyResult = await new sql.Request(transaction)
        .input('guestId', sql.BigInt, guestId)
        .input('chainId', sql.BigInt, reward.resolved_chain_id)
        .query(`
          SELECT TOP 1 loyalty_account_id, membership_no, tier_code, points_balance, chain_id
          FROM LoyaltyAccount WITH (UPDLOCK, HOLDLOCK)
          WHERE guest_id = @guestId
            AND chain_id = @chainId
            AND status = 'ACTIVE'
        `);

      if (loyaltyResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(403).json({ success: false, error: 'No active loyalty account is eligible for this reward' });
      }

      const loyalty = loyaltyResult.recordset[0];

      const existingVoucher = await new sql.Request(transaction)
        .input('guestId', sql.BigInt, guestId)
        .input('promotionId', sql.BigInt, promotionId)
        .query(`
          SELECT TOP 1 loyalty_redemption_id, issued_promo_code, expires_at
          FROM LoyaltyRedemption
          WHERE guest_id = @guestId
            AND promotion_id = @promotionId
            AND status = 'ISSUED'
            AND expires_at >= GETDATE()
          ORDER BY issued_at DESC
        `);

      if (existingVoucher.recordset.length > 0) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          error: 'You already have an active voucher for this reward.',
          data: existingVoucher.recordset[0],
        });
      }

      if (Number(loyalty.points_balance) < Number(reward.redeemable_points_cost)) {
        await transaction.rollback();
        return res.status(409).json({ success: false, error: 'Not enough loyalty points to redeem this reward' });
      }

      const issuedPromoCode = await generateRedemptionCode(() => new sql.Request(transaction));

      await new sql.Request(transaction)
        .input('loyaltyAccountId', sql.BigInt, loyalty.loyalty_account_id)
        .input('pointsCost', sql.Decimal(18,2), reward.redeemable_points_cost)
        .query(`
          UPDATE LoyaltyAccount
          SET points_balance = points_balance - @pointsCost,
              updated_at = GETDATE()
          WHERE loyalty_account_id = @loyaltyAccountId
        `);

      const insertResult = await new sql.Request(transaction)
        .input('guestId', sql.BigInt, guestId)
        .input('loyaltyAccountId', sql.BigInt, loyalty.loyalty_account_id)
        .input('promotionId', sql.BigInt, promotionId)
        .input('issuedPromoCode', sql.VarChar(50), issuedPromoCode)
        .input('pointsSpent', sql.Decimal(18,2), reward.redeemable_points_cost)
        .input('voucherDays', sql.Int, reward.voucher_valid_days || 30)
        .input('note', sql.NVarChar(255), `Redeemed from ${loyalty.membership_no}`)
        .query(`
          INSERT INTO LoyaltyRedemption (
            guest_id, loyalty_account_id, promotion_id, issued_promo_code,
            points_spent, status, expires_at, note
          )
          OUTPUT INSERTED.*
          VALUES (
            @guestId, @loyaltyAccountId, @promotionId, @issuedPromoCode,
            @pointsSpent, 'ISSUED', DATEADD(DAY, @voucherDays, GETDATE()), @note
          )
        `);

      await transaction.commit();

      res.status(201).json({
        success: true,
        message: 'Reward redeemed successfully.',
        data: {
          ...insertResult.recordset[0],
          promotion_name: reward.promotion_name,
          current_points_balance: Number(loyalty.points_balance) - Number(reward.redeemable_points_cost),
        },
      });
    } catch (innerErr) {
      try { await transaction.rollback(); } catch (_) { /* ignore */ }
      throw innerErr;
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/guests  Create guest
router.post('/', requireSystemUser, async (req, res) => {
  try {
    const { guest_code, title, first_name, middle_name, last_name, gender, email, phone_country_code, phone_number, nationality_country_code } = req.body;

    if (!guest_code || !first_name || !last_name) {
      return res.status(400).json({ success: false, error: 'guest_code, first_name, last_name are required' });
    }

    const pool = getSqlPool();
    const result = await pool.request()
      .input('guest_code', sql.VarChar(50), guest_code)
      .input('title', sql.NVarChar(20), title || null)
      .input('first_name', sql.NVarChar(100), first_name)
      .input('middle_name', sql.NVarChar(100), middle_name || null)
      .input('last_name', sql.NVarChar(100), last_name)
      .input('gender', sql.VarChar(15), gender || null)
      .input('email', sql.VarChar(150), email || null)
      .input('phone_cc', sql.VarChar(10), phone_country_code || null)
      .input('phone', sql.VarChar(30), phone_number || null)
      .input('nationality', sql.Char(2), nationality_country_code || null)
      .query(`
        INSERT INTO Guest (guest_code, title, first_name, middle_name, last_name, gender, email, phone_country_code, phone_number, nationality_country_code)
        OUTPUT INSERTED.guest_id, INSERTED.guest_code, INSERTED.full_name
        VALUES (@guest_code, @title, @first_name, @middle_name, @last_name, @gender, @email, @phone_cc, @phone, @nationality)
      `);

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/guests/:id/stays  Stay history with hotel + room detail
router.get('/:id/stays', requireAuth, async (req, res) => {
  try {
    const pool    = getSqlPool();
    const guestId = parseInt(req.params.id);
    if (isNaN(guestId)) {
      return res.status(400).json({ success: false, error: 'Invalid guest ID' });
    }
    if (!ensureGuestAccess(req, res, guestId)) {
      return;
    }

    const result = await pool.request()
      .input('id', sql.BigInt, guestId)
      .query(`
        SELECT
          sr.stay_id, sr.stay_status,
          sr.actual_checkin_at, sr.actual_checkout_at,
          r.reservation_code, r.reservation_status,
          r.checkin_date, r.checkout_date, r.nights,
          r.grand_total_amount, r.currency_code,
          h.hotel_name,
          rm.room_number, rm.floor_number,
          rt.room_type_name
        FROM StayRecord sr
        JOIN ReservationRoom rr ON sr.reservation_room_id = rr.reservation_room_id
        JOIN Reservation     r  ON rr.reservation_id      = r.reservation_id
        JOIN Hotel           h  ON r.hotel_id             = h.hotel_id
        LEFT JOIN Room       rm ON rr.room_id             = rm.room_id
        LEFT JOIN RoomType   rt ON rr.room_type_id        = rt.room_type_id
        WHERE r.guest_id = @id
        ORDER BY sr.actual_checkin_at DESC, sr.stay_id DESC
      `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/guests/:id/reviews  Guest review history
router.get('/:id/reviews', requireAuth, async (req, res) => {
  try {
    const pool = getSqlPool();
    const guestId = parseInt(req.params.id, 10);
    if (isNaN(guestId)) {
      return res.status(400).json({ success: false, error: 'Invalid guest ID' });
    }
    if (!ensureGuestAccess(req, res, guestId)) {
      return;
    }

    const result = await pool.request()
      .input('guestId', sql.BigInt, guestId)
      .query(`
        SELECT
          hr.hotel_review_id,
          hr.hotel_id,
          hr.reservation_id,
          hr.rating_score,
          hr.review_title,
          hr.review_text,
          hr.public_visible_flag,
          hr.moderation_status,
          hr.created_at,
          h.hotel_name,
          r.reservation_code,
          r.checkin_date,
          r.checkout_date
        FROM HotelReview hr
        JOIN Hotel h ON hr.hotel_id = h.hotel_id
        JOIN Reservation r ON hr.reservation_id = r.reservation_id
        WHERE hr.guest_id = @guestId
        ORDER BY hr.created_at DESC, hr.hotel_review_id DESC
      `);

    res.json({ success: true, count: result.recordset.length, data: result.recordset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
