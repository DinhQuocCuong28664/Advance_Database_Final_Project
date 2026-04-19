const express = require('express');
const router = express.Router();
const { getSqlPool, sql } = require('../config/database');
const { attachAuthContext } = require('../middleware/auth');

router.use(attachAuthContext);

router.get('/', async (req, res) => {
  try {
    const pool = getSqlPool();
    const { hotel_id, guest_id, member_only } = req.query;
    const effectiveGuestId = guest_id || (req.auth?.user_type === 'GUEST' ? req.auth.sub : null);

    const request = pool.request()
      .input('hotelId', sql.BigInt, hotel_id ? parseInt(hotel_id, 10) : null)
      .input('guestId', sql.BigInt, effectiveGuestId ? parseInt(effectiveGuestId, 10) : null)
      .input('memberOnly', sql.Bit, member_only === undefined ? null : member_only === 'true' ? 1 : 0);

    const result = await request.query(`
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
          p.status,
          p.hotel_id,
          p.brand_id,
          COALESCE(h.hotel_name, hb.hotel_name) AS scope_hotel_name,
          COALESCE(hb.hotel_id, h.hotel_id)     AS resolved_hotel_id,
          COALESCE(b.brand_id, bh.brand_id)     AS resolved_brand_id,
          COALESCE(b.brand_name, bh.brand_name) AS brand_name,
          COALESCE(hc.chain_id, hch.chain_id)   AS resolved_chain_id,
          COALESCE(hc.chain_name, hch.chain_name) AS chain_name
        FROM Promotion p
        LEFT JOIN Hotel h  ON p.hotel_id  = h.hotel_id
        LEFT JOIN Brand b  ON p.brand_id  = b.brand_id
        LEFT JOIN Hotel hb ON hb.brand_id = p.brand_id AND hb.status = 'ACTIVE'
        LEFT JOIN Brand bh ON h.brand_id  = bh.brand_id
        LEFT JOIN HotelChain hc  ON b.chain_id  = hc.chain_id
        LEFT JOIN HotelChain hch ON bh.chain_id = hch.chain_id
        WHERE p.status = 'ACTIVE'
          AND CAST(GETDATE() AS DATE) BETWEEN p.booking_start_date AND p.booking_end_date
      )
      -- ROW_NUMBER deduplication: brand promos fan-out one row per hotel in brand
      SELECT *
      FROM (
        SELECT
          ps.promotion_id, ps.promotion_code, ps.promotion_name, ps.promotion_type,
          ps.discount_value, ps.currency_code, ps.applies_to,
          ps.booking_start_date, ps.booking_end_date,
          ps.stay_start_date, ps.stay_end_date,
          ps.member_only_flag, ps.min_nights, ps.status, ps.hotel_id, ps.brand_id,
          ps.scope_hotel_name, ps.resolved_hotel_id, ps.resolved_brand_id,
          ps.brand_name, ps.resolved_chain_id, ps.chain_name,
          CASE
            WHEN ps.hotel_id IS NOT NULL THEN 'HOTEL'
            WHEN ps.brand_id IS NOT NULL THEN 'BRAND'
            ELSE 'GLOBAL'
          END AS scope_type,
          CASE
            WHEN @guestId IS NULL THEN NULL
            WHEN ps.member_only_flag = 0 THEN 1
            WHEN EXISTS (
              SELECT 1 FROM LoyaltyAccount la
              WHERE la.guest_id   = @guestId
                AND la.chain_id   = ps.resolved_chain_id
                AND la.status     = 'ACTIVE'
            ) THEN 1
            ELSE 0
          END AS eligible_for_guest,
          ROW_NUMBER() OVER (
            PARTITION BY ps.promotion_id
            ORDER BY ps.resolved_hotel_id
          ) AS rn
        FROM PromoScope ps
        WHERE (@hotelId IS NULL
               OR ps.hotel_id = @hotelId
               OR ps.resolved_brand_id = (SELECT brand_id FROM Hotel WHERE hotel_id = @hotelId))
          AND (@memberOnly IS NULL OR ps.member_only_flag = @memberOnly)
      ) AS deduped
      WHERE rn = 1
      ORDER BY member_only_flag DESC, discount_value DESC, promotion_name
    `);

    res.json({
      success: true,
      count: result.recordset.length,
      data: result.recordset,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
