-- ============================================================
-- LuxeReserve - 03: Views
-- [FIX-3] vw_ReservationTotal - Financial Source of Truth
-- ============================================================

USE LuxeReserve;
GO

CREATE OR ALTER VIEW dbo.vw_ReservationTotal
AS
SELECT
    r.reservation_id,
    r.reservation_code,
    r.hotel_id,
    r.guest_id,
    r.reservation_status,
    r.currency_code,
    r.checkin_date,
    r.checkout_date,
    r.nights,

    -- Room Revenue
    ISNULL(room_totals.room_subtotal, 0)    AS room_subtotal,
    ISNULL(room_totals.room_tax, 0)         AS room_tax,
    ISNULL(room_totals.room_discount, 0)    AS room_discount,
    ISNULL(room_totals.room_final, 0)       AS room_final,
    ISNULL(room_totals.room_count, 0)       AS actual_room_count,

    -- Service Revenue
    ISNULL(svc_totals.svc_subtotal, 0)      AS service_subtotal,
    ISNULL(svc_totals.svc_discount, 0)      AS service_discount,
    ISNULL(svc_totals.svc_final, 0)         AS service_final,
    ISNULL(svc_totals.svc_count, 0)         AS service_count,

    -- Grand Total
    ISNULL(room_totals.room_final, 0)
        + ISNULL(svc_totals.svc_final, 0)   AS grand_total,

    -- Payment Summary
    ISNULL(pay_totals.total_paid, 0)        AS total_paid,
    (ISNULL(room_totals.room_final, 0)
        + ISNULL(svc_totals.svc_final, 0))
        - ISNULL(pay_totals.total_paid, 0)  AS balance_due

FROM dbo.Reservation r

LEFT JOIN (
    SELECT reservation_id,
           SUM(room_subtotal)   AS room_subtotal,
           SUM(tax_amount)      AS room_tax,
           SUM(discount_amount) AS room_discount,
           SUM(final_amount)    AS room_final,
           COUNT(*)             AS room_count
    FROM dbo.ReservationRoom
    GROUP BY reservation_id
) room_totals ON r.reservation_id = room_totals.reservation_id

LEFT JOIN (
    SELECT reservation_id,
           SUM(unit_price * quantity) AS svc_subtotal,
           SUM(discount_amount)       AS svc_discount,
           SUM(final_amount)          AS svc_final,
           COUNT(*)                   AS svc_count
    FROM dbo.ReservationService
    GROUP BY reservation_id
) svc_totals ON r.reservation_id = svc_totals.reservation_id

LEFT JOIN (
    SELECT reservation_id,
           SUM(CASE WHEN payment_type <> 'REFUND' THEN amount ELSE -amount END) AS total_paid
    FROM dbo.Payment
    WHERE payment_status = 'CAPTURED'
    GROUP BY reservation_id
) pay_totals ON r.reservation_id = pay_totals.reservation_id;
GO

PRINT '[OK] VIEW vw_ReservationTotal created.';
GO

-- ============================================================
-- vw_LocationTree
-- Recursive CTE: flattens the self-referencing Location table
-- into a flat result set with depth, full path, and hotel count.
-- Demonstrates: RECURSIVE CTE + adjacency-list hierarchy traversal
-- ============================================================
CREATE OR ALTER VIEW dbo.vw_LocationTree
AS
WITH LocationTree AS (
    -- Anchor: root locations (no parent)
    SELECT
        location_id,
        parent_location_id,
        location_code,
        location_name,
        location_type,
        iso_code,
        0                               AS depth,
        CAST(location_name AS NVARCHAR(900)) AS full_path
    FROM dbo.Location
    WHERE parent_location_id IS NULL

    UNION ALL

    -- Recursive: children of each node
    SELECT
        c.location_id,
        c.parent_location_id,
        c.location_code,
        c.location_name,
        c.location_type,
        c.iso_code,
        p.depth + 1,
        CAST(p.full_path + N' > ' + c.location_name AS NVARCHAR(900))
    FROM dbo.Location c
    INNER JOIN LocationTree p ON c.parent_location_id = p.location_id
)
SELECT
    lt.location_id,
    lt.parent_location_id,
    lt.location_code,
    lt.location_name,
    lt.location_type,
    lt.iso_code,
    lt.depth,
    lt.full_path,
    COUNT(h.hotel_id)   AS hotel_count
FROM LocationTree lt
LEFT JOIN dbo.Hotel h ON h.location_id = lt.location_id
GROUP BY
    lt.location_id, lt.parent_location_id, lt.location_code,
    lt.location_name, lt.location_type, lt.iso_code,
    lt.depth, lt.full_path;
GO

PRINT '[OK] VIEW vw_LocationTree created.';
GO

-- ============================================================
-- vw_RevenueByHotel
-- Aggregates confirmed reservation revenue per hotel per month.
-- Demonstrates: Window Functions (RANK, SUM OVER, running total)
-- ============================================================
CREATE OR ALTER VIEW dbo.vw_RevenueByHotel
AS
SELECT
    h.hotel_id,
    h.hotel_name,
    hb.brand_id,
    hb.brand_name,
    YEAR(r.checkin_date)                        AS revenue_year,
    MONTH(r.checkin_date)                       AS revenue_month,

    -- Monthly revenue for this hotel
    SUM(rr.final_amount)                        AS monthly_revenue,

    -- Cumulative revenue for this hotel across all months (running total)
    SUM(SUM(rr.final_amount)) OVER (
        PARTITION BY h.hotel_id
        ORDER BY YEAR(r.checkin_date), MONTH(r.checkin_date)
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )                                           AS cumulative_revenue,

    -- Hotel rank within its brand for this month (by revenue)
    DENSE_RANK() OVER (
        PARTITION BY hb.brand_id, YEAR(r.checkin_date), MONTH(r.checkin_date)
        ORDER BY SUM(rr.final_amount) DESC
    )                                           AS hotel_rank_in_brand,

    -- This hotel's share of total brand revenue for the month
    ROUND(
        SUM(rr.final_amount) * 100.0 / NULLIF(
            SUM(SUM(rr.final_amount)) OVER (
                PARTITION BY hb.brand_id, YEAR(r.checkin_date), MONTH(r.checkin_date)
            ), 0
        ), 2
    )                                           AS brand_revenue_share_pct

FROM dbo.ReservationRoom rr
JOIN dbo.Reservation     r  ON rr.reservation_id = r.reservation_id
JOIN dbo.Hotel           h  ON r.hotel_id        = h.hotel_id
JOIN dbo.HotelBrand      hb ON h.brand_id         = hb.brand_id
WHERE r.reservation_status NOT IN ('CANCELLED', 'NO_SHOW')
GROUP BY
    h.hotel_id, h.hotel_name,
    hb.brand_id, hb.brand_name,
    YEAR(r.checkin_date), MONTH(r.checkin_date);
GO

PRINT '[OK] VIEW vw_RevenueByHotel created.';
GO

-- ============================================================
-- vw_BookingChannelStats
-- Aggregates reservation counts and revenue by booking source
-- per hotel. Useful for channel performance reporting.
-- Demonstrates: Aggregation with GROUP BY + ROLLUP-ready structure
-- ============================================================
CREATE OR ALTER VIEW dbo.vw_BookingChannelStats
AS
SELECT
    r.hotel_id,
    h.hotel_name,
    r.booking_source,
    COUNT(r.reservation_id)                     AS total_reservations,
    SUM(CASE WHEN r.reservation_status = 'CHECKED_OUT'  THEN 1 ELSE 0 END)  AS completed,
    SUM(CASE WHEN r.reservation_status = 'CANCELLED'    THEN 1 ELSE 0 END)  AS cancelled,
    SUM(CASE WHEN r.reservation_status = 'NO_SHOW'      THEN 1 ELSE 0 END)  AS no_shows,
    ISNULL(SUM(rr.final_amount), 0)             AS total_revenue,

    -- Channel share of all reservations for the same hotel
    ROUND(
        COUNT(r.reservation_id) * 100.0 / NULLIF(
            SUM(COUNT(r.reservation_id)) OVER (PARTITION BY r.hotel_id), 0
        ), 2
    )                                           AS channel_share_pct

FROM dbo.Reservation r
JOIN dbo.Hotel h ON r.hotel_id = h.hotel_id
LEFT JOIN dbo.ReservationRoom rr ON r.reservation_id = rr.reservation_id
GROUP BY
    r.hotel_id, h.hotel_name, r.booking_source;
GO

PRINT '[OK] VIEW vw_BookingChannelStats created.';
GO
