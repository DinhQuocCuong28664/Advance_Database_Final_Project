-- ============================================================
-- LuxeReserve — 03: Views
-- [FIX-3] vw_ReservationTotal — Financial Source of Truth
-- ============================================================

USE LuxeReserve;
GO

CREATE OR ALTER VIEW vw_ReservationTotal
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

FROM Reservation r

LEFT JOIN (
    SELECT reservation_id,
           SUM(room_subtotal)   AS room_subtotal,
           SUM(tax_amount)      AS room_tax,
           SUM(discount_amount) AS room_discount,
           SUM(final_amount)    AS room_final,
           COUNT(*)             AS room_count
    FROM ReservationRoom
    GROUP BY reservation_id
) room_totals ON r.reservation_id = room_totals.reservation_id

LEFT JOIN (
    SELECT reservation_id,
           SUM(unit_price * quantity) AS svc_subtotal,
           SUM(discount_amount)       AS svc_discount,
           SUM(final_amount)          AS svc_final,
           COUNT(*)                   AS svc_count
    FROM ReservationService
    GROUP BY reservation_id
) svc_totals ON r.reservation_id = svc_totals.reservation_id

LEFT JOIN (
    SELECT reservation_id,
           SUM(CASE WHEN payment_type <> 'REFUND' THEN amount ELSE -amount END) AS total_paid
    FROM Payment
    WHERE payment_status = 'CAPTURED'
    GROUP BY reservation_id
) pay_totals ON r.reservation_id = pay_totals.reservation_id;
GO

PRINT '✅ VIEW vw_ReservationTotal created.';
GO
