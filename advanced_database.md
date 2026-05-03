# LuxeReserve — Advanced Database Techniques

> **Project:** LuxeReserve Global Luxury Hotel Reservation Engine
> **Database Engine:** SQL Server 2022 Express (T-SQL) + MongoDB (Hybrid)
> **Total SQL Scripts:** 24 files covering schema, views, triggers, procedures, seed data

---

## Table of Contents

1. [Computed Column (PERSISTED)](#1-computed-column-persisted)
2. [Self-Referencing Foreign Key (Adjacency List)](#2-self-referencing-foreign-key-adjacency-list)
3. [CHECK Constraints for Data Integrity](#3-check-constraints-for-data-integrity)
4. [Recursive CTE for Hierarchy Traversal](#4-recursive-cte-for-hierarchy-traversal)
5. [Window Functions (RANK, SUM OVER, DENSE_RANK)](#5-window-functions-rank-sum-over-dense_rank)
6. [Views as Financial Source of Truth](#6-views-as-financial-source-of-truth)
7. [AFTER UPDATE Trigger — Price Integrity Guard](#7-after-update-trigger--price-integrity-guard)
8. [AFTER UPDATE Trigger — Cancellation Audit](#8-after-update-trigger--cancellation-audit)
9. [Pessimistic Locking (UPDLOCK + HOLDLOCK)](#9-pessimistic-locking-updlock--holdlock)
10. [Savepoint-based Nested Transaction Management](#10-savepoint-based-nested-transaction-management)
11. [Atomic Room Transfer Procedure](#11-atomic-room-transfer-procedure)
12. [Multi-Step Check-in / Check-out Stored Procedures](#12-multi-step-check-in--check-out-stored-procedures)
13. [Guest & Hotel Cancellation Stored Procedures](#13-guest--hotel-cancellation-stored-procedures)
14. [Cursor-based Cleanup Sweep Procedure](#14-cursor-based-cleanup-sweep-procedure)
15. [Auto-Status-History Trigger](#15-auto-status-history-trigger)
16. [Audit Triggers (Payment, Guest, GuestAuth)](#16-audit-triggers-payment-guest-guestauth)
17. [Hybrid SQL + MongoDB Architecture](#17-hybrid-sql--mongodb-architecture)
18. [MERGE (Upsert) for Idempotent Seeding](#18-merge-upsert-for-idempotent-seeding)
19. [Temporal Tables (effective_from / effective_to)](#19-temporal-tables-effective_from--effective_to)
20. [Composite Indexes for Query Performance](#20-composite-indexes-for-query-performance)

---

## 1. Computed Column (PERSISTED)

**File:** `database/sql/02_create_tables.sql` — Lines 318–326

**Description:** The `Guest.full_name` column is computed automatically from `first_name`, `middle_name`, and `last_name` using `CONCAT` and `RTRIM`. It is **PERSISTED**, meaning the computed value is physically stored in the table (not recalculated on every read), and can be indexed.

**SQL Code:**
```sql
full_name AS (
    RTRIM(
        CONCAT(
            COALESCE(first_name, N''), N' ',
            COALESCE(middle_name, N''), N' ',
            COALESCE(last_name, N'')
        )
    )
) PERSISTED,
```

**Benefit:** Eliminates the need for application-level name concatenation. The PERSISTED keyword ensures the value is stored physically, enabling index creation and faster queries.

---

## 2. Self-Referencing Foreign Key (Adjacency List)

**File:** `database/sql/02_create_tables.sql` — Lines 19–37

**Description:** The `Location` table uses a self-referencing foreign key (`parent_location_id` → `location_id`) to model a hierarchical location tree (Region → Country → State/Province → City → District).

**SQL Code:**
```sql
CREATE TABLE Location (
    location_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    parent_location_id  BIGINT          NULL,
    location_code       VARCHAR(50)     NOT NULL,
    location_name       NVARCHAR(150)   NOT NULL,
    location_type       VARCHAR(20)     NOT NULL,
    level               INT             NOT NULL,
    ...
    CONSTRAINT FK_Location_Parent FOREIGN KEY (parent_location_id) REFERENCES Location(location_id),
    CONSTRAINT CK_Location_Type   CHECK (location_type IN ('REGION','COUNTRY','STATE_PROVINCE','CITY','DISTRICT')),
    CONSTRAINT CK_Location_Level  CHECK (level BETWEEN 0 AND 4)
);
```

**Benefit:** Enables recursive queries (see Technique #4) to traverse the hierarchy. The `level` column (0–4) provides an additional constraint ensuring data consistency.

---

## 3. CHECK Constraints for Data Integrity

**Files:** Multiple — `02_create_tables.sql`, `20_loyalty_rewards.sql`, `22_add_hotel_reviews.sql`

**Description:** Extensive use of CHECK constraints to enforce domain integrity at the database level, preventing invalid data from being inserted regardless of the application layer.

**Examples:**

```sql
-- RoomFeature: at least one FK must be NOT NULL (02_create_tables.sql:268)
CONSTRAINT CK_RoomFeature_AtLeastOneFK CHECK (room_id IS NOT NULL OR room_type_id IS NOT NULL)

-- HotelReview: rating must be 1-5 (22_add_hotel_reviews.sql:27)
CONSTRAINT CK_HotelReview_Rating CHECK (rating_score BETWEEN 1 AND 5)

-- Promotion: voucher days must be >= 1 (20_loyalty_rewards.sql:29-31)
CONSTRAINT CK_Promo_VoucherDays CHECK (voucher_valid_days IS NULL OR voucher_valid_days >= 1)

-- Room: multiple status constraints (02_create_tables.sql:245-247)
CONSTRAINT CK_Room_Status  CHECK (room_status IN ('AVAILABLE','OCCUPIED','OOO','OOS','CLEANING','RESERVED','BLOCKED'))
CONSTRAINT CK_Room_HK      CHECK (housekeeping_status IN ('CLEAN','DIRTY','INSPECTED','IN_PROGRESS'))
CONSTRAINT CK_Room_Maint   CHECK (maintenance_status IN ('NORMAL','UNDER_REPAIR','BLOCKED'))
```

**Benefit:** 30+ CHECK constraints across the schema ensure data integrity at the database level, making the system robust against application bugs.

---

## 4. Recursive CTE for Hierarchy Traversal

**File:** `database/sql/03_create_views.sql` — Lines 86–136

**Description:** The `vw_LocationTree` view uses a **Recursive Common Table Expression (CTE)** to flatten the self-referencing `Location` table into a flat result set with depth, full path, and hotel count.

**SQL Code:**
```sql
CREATE OR ALTER VIEW dbo.vw_LocationTree
AS
WITH LocationTree AS (
    -- Anchor: root locations (no parent)
    SELECT
        location_id, parent_location_id, location_code,
        location_name, location_type, iso_code,
        0 AS depth,
        CAST(location_name AS NVARCHAR(900)) AS full_path
    FROM dbo.Location
    WHERE parent_location_id IS NULL

    UNION ALL

    -- Recursive: children of each node
    SELECT
        c.location_id, c.parent_location_id, c.location_code,
        c.location_name, c.location_type, c.iso_code,
        p.depth + 1,
        CAST(p.full_path + N' > ' + c.location_name AS NVARCHAR(900))
    FROM dbo.Location c
    INNER JOIN LocationTree p ON c.parent_location_id = p.location_id
)
SELECT
    lt.location_id, lt.parent_location_id, lt.location_code,
    lt.location_name, lt.location_type, lt.iso_code,
    lt.depth, lt.full_path,
    COUNT(h.hotel_id) AS hotel_count
FROM LocationTree lt
LEFT JOIN dbo.Hotel h ON h.location_id = lt.location_id
GROUP BY ...;
```

**Benefit:** Enables efficient traversal of the location hierarchy without application-level recursion. The `full_path` column (e.g., "Southeast Asia > Vietnam > Ho Chi Minh > District 1") is computed directly in SQL.

---

## 5. Window Functions (RANK, SUM OVER, DENSE_RANK)

**File:** `database/sql/03_create_views.sql` — Lines 143–187

**Description:** The `vw_RevenueByHotel` view demonstrates three advanced window functions:
- **`SUM(...) OVER (PARTITION BY ... ORDER BY ... ROWS BETWEEN ...)`** — Running total (cumulative revenue)
- **`DENSE_RANK() OVER (PARTITION BY ... ORDER BY ...)`** — Hotel rank within brand by monthly revenue
- **`SUM(...) OVER (PARTITION BY ...)`** — Brand total for calculating revenue share percentage

**SQL Code:**
```sql
CREATE OR ALTER VIEW dbo.vw_RevenueByHotel
AS
SELECT
    h.hotel_id, h.hotel_name, hb.brand_id, hb.brand_name,
    YEAR(r.checkin_date)  AS revenue_year,
    MONTH(r.checkin_date) AS revenue_month,

    -- Monthly revenue for this hotel
    SUM(rr.final_amount)  AS monthly_revenue,

    -- Cumulative revenue (running total)
    SUM(SUM(rr.final_amount)) OVER (
        PARTITION BY h.hotel_id
        ORDER BY YEAR(r.checkin_date), MONTH(r.checkin_date)
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_revenue,

    -- Hotel rank within its brand for this month
    DENSE_RANK() OVER (
        PARTITION BY hb.brand_id, YEAR(r.checkin_date), MONTH(r.checkin_date)
        ORDER BY SUM(rr.final_amount) DESC
    ) AS hotel_rank_in_brand,

    -- Revenue share percentage
    ROUND(
        SUM(rr.final_amount) * 100.0 / NULLIF(
            SUM(SUM(rr.final_amount)) OVER (
                PARTITION BY hb.brand_id, YEAR(r.checkin_date), MONTH(r.checkin_date)
            ), 0
        ), 2
    ) AS brand_revenue_share_pct
FROM dbo.ReservationRoom rr
JOIN dbo.Reservation r  ON rr.reservation_id = r.reservation_id
JOIN dbo.Hotel h ON r.hotel_id = h.hotel_id
JOIN dbo.Brand hb ON h.brand_id = hb.brand_id
WHERE r.reservation_status NOT IN ('CANCELLED', 'NO_SHOW')
GROUP BY ...;
```

**Benefit:** All revenue analytics (monthly, cumulative, ranking, share %) are computed in a single query without application-level processing.

---

## 6. Views as Financial Source of Truth

**File:** `database/sql/03_create_views.sql` — Lines 9–75

**Description:** The `vw_ReservationTotal` view aggregates room revenue, service revenue, payment totals, and calculates the balance due — serving as the single source of truth for all financial calculations.

**SQL Code:**
```sql
CREATE OR ALTER VIEW dbo.vw_ReservationTotal
AS
SELECT
    r.reservation_id, r.reservation_code, r.hotel_id,
    r.guest_id, r.reservation_status, r.currency_code,
    r.checkin_date, r.checkout_date, r.nights,

    -- Room Revenue (from ReservationRoom)
    ISNULL(room_totals.room_subtotal, 0) AS room_subtotal,
    ISNULL(room_totals.room_tax, 0)      AS room_tax,
    ISNULL(room_totals.room_discount, 0) AS room_discount,
    ISNULL(room_totals.room_final, 0)    AS room_final,

    -- Service Revenue (from ReservationService)
    ISNULL(svc_totals.svc_final, 0)      AS service_final,

    -- Grand Total
    ISNULL(room_totals.room_final, 0)
        + ISNULL(svc_totals.svc_final, 0) AS grand_total,

    -- Payment Summary
    ISNULL(pay_totals.total_paid, 0)     AS total_paid,
    (ISNULL(room_totals.room_final, 0)
        + ISNULL(svc_totals.svc_final, 0))
        - ISNULL(pay_totals.total_paid, 0) AS balance_due
FROM dbo.Reservation r
LEFT JOIN (SELECT reservation_id, SUM(final_amount) AS room_final, ...
           FROM dbo.ReservationRoom GROUP BY reservation_id) room_totals ...
LEFT JOIN (SELECT reservation_id, SUM(final_amount) AS svc_final, ...
           FROM dbo.ReservationService GROUP BY reservation_id) svc_totals ...
LEFT JOIN (SELECT reservation_id,
           SUM(CASE WHEN payment_type <> 'REFUND' THEN amount ELSE -amount END) AS total_paid
           FROM dbo.Payment WHERE payment_status = 'CAPTURED'
           GROUP BY reservation_id) pay_totals ...;
```

**Benefit:** Eliminates the need for application-level financial calculations. The view handles room revenue, service revenue, payment reconciliation, and balance due in one place.

---

## 7. AFTER UPDATE Trigger — Price Integrity Guard

**File:** `database/sql/04_create_triggers.sql` — Lines 9–62

**Description:** When `RoomRate.final_rate` is updated, this trigger automatically detects changes exceeding 50% and inserts a critical audit record into `RateChangeLog`.

**SQL Code:**
```sql
CREATE OR ALTER TRIGGER dbo.trg_RoomRate_PriceIntegrityGuard
ON dbo.RoomRate
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(final_rate)
        RETURN;

    BEGIN TRY
        INSERT INTO dbo.RateChangeLog (
            room_rate_id, old_rate, new_rate, change_amount,
            change_percent, change_reason, triggered_at,
            triggered_by, severity_level, review_status
        )
        SELECT
            i.room_rate_id,
            d.final_rate,
            i.final_rate,
            i.final_rate - d.final_rate,
            CASE
                WHEN d.final_rate = 0 THEN 100.0000
                ELSE CAST(ABS(i.final_rate - d.final_rate) * 100.0 / d.final_rate AS DECIMAL(9,4))
            END,
            N'[AUTO] Rate change > 50% - flagged by Price Integrity Guard',
            GETDATE(), i.updated_by, 'CRITICAL', 'OPEN'
        FROM inserted i
        INNER JOIN deleted d ON i.room_rate_id = d.room_rate_id
        WHERE d.final_rate > 0
          AND ABS(i.final_rate - d.final_rate) * 100.0 / d.final_rate > 50.0;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrMsg, 10, 1) WITH LOG;
    END CATCH
END;
```

**Benefit:** Automatic price change monitoring without application code. Any rate change > 50% is flagged as CRITICAL for review.

---

## 8. AFTER UPDATE Trigger — Cancellation Audit

**File:** `database/sql/04_create_triggers.sql` — Lines 73–125

**Description:** When a reservation status changes to `CANCELLED` or `NO_SHOW`, this trigger automatically logs the change to `AuditLog` with old/new values in JSON format.

**SQL Code:**
```sql
CREATE OR ALTER TRIGGER dbo.trg_Reservation_CancellationAudit
ON dbo.Reservation
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(reservation_status)
        RETURN;

    BEGIN TRY
        INSERT INTO dbo.AuditLog (
            entity_name, entity_pk, action_type,
            old_value_json, new_value_json, changed_by, changed_at, source_module
        )
        SELECT
            'Reservation',
            CAST(i.reservation_id AS VARCHAR(100)),
            'STATUS_CHANGE',
            N'{"reservation_status":"' + d.reservation_status
                + N'","deposit_amount":' + CAST(ISNULL(d.deposit_amount, 0) AS NVARCHAR)
                + N',"grand_total":' + CAST(ISNULL(d.grand_total_amount, 0) AS NVARCHAR)
                + N'}',
            N'{"reservation_status":"' + i.reservation_status
                + N'","reservation_code":"' + i.reservation_code
                + N'","guest_id":' + CAST(i.guest_id AS NVARCHAR)
                + N',"cancel_type":"' + CASE
                    WHEN i.reservation_status = 'CANCELLED' THEN 'CANCELLATION'
                    WHEN i.reservation_status = 'NO_SHOW' THEN 'NO_SHOW'
                    ELSE 'OTHER' END
                + N'"}',
            i.created_by_user_id, GETDATE(),
            'trg_Reservation_CancellationAudit'
        FROM inserted i
        INNER JOIN deleted d ON i.reservation_id = d.reservation_id
        WHERE i.reservation_status IN ('CANCELLED', 'NO_SHOW')
          AND d.reservation_status <> i.reservation_status;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrMsg, 10, 1) WITH LOG;
    END CATCH
END;
```

**Benefit:** Automatic audit trail for all cancellations with full before/after state captured as JSON.

---

## 9. Pessimistic Locking (UPDLOCK + HOLDLOCK)

**File:** `database/sql/05_create_procedures.sql` — Lines 31–34 (sp_ReserveRoom), Lines 161–162 (sp_TransferRoom)

**Description:** Uses SQL Server's `UPDLOCK` (update lock) and `HOLDLOCK` (serializable range lock) table hints to prevent double-booking of rooms under concurrent access.

**SQL Code (sp_ReserveRoom):**
```sql
SELECT @current_status = availability_status
FROM RoomAvailability WITH (UPDLOCK, HOLDLOCK)
WHERE room_id  = @room_id
  AND stay_date = @stay_date;
```

**SQL Code (sp_TransferRoom — locking old room):**
```sql
SELECT @old_status = availability_status
FROM RoomAvailability WITH (UPDLOCK, HOLDLOCK)
WHERE room_id = @old_room_id AND stay_date = @stay_date;
```

**Benefit:** Prevents phantom reads and ensures that only one transaction can modify a room's availability at a time. This is critical for a hotel booking system where two users might try to book the same room simultaneously.

---

## 10. Savepoint-based Nested Transaction Management

**File:** `database/sql/05_create_procedures.sql` — Lines 19–26 (sp_ReserveRoom)

**Description:** The `sp_ReserveRoom` procedure intelligently handles nested transactions. If called within an existing transaction (from Node.js), it uses `SAVE TRANSACTION` instead of `BEGIN TRANSACTION`, allowing partial rollback without aborting the outer transaction.

**SQL Code:**
```sql
DECLARE @TranCounter INT = @@TRANCOUNT;
DECLARE @SavePointName VARCHAR(32) = 'spReserveSave';

BEGIN TRY
    IF @TranCounter = 0
        BEGIN TRANSACTION;
    ELSE
        SAVE TRANSACTION @SavePointName;

    -- ... business logic ...

    -- On failure:
    IF @TranCounter = 0
        ROLLBACK TRANSACTION;
    ELSE IF XACT_STATE() <> -1
        ROLLBACK TRANSACTION @SavePointName;

    -- On success:
    IF @TranCounter = 0
        COMMIT TRANSACTION;
END TRY
```

**Benefit:** Enables safe composition of stored procedures. The procedure can be called independently or as part of a larger transaction without causing unintended rollbacks.

---

## 11. Atomic Room Transfer Procedure

**File:** `database/sql/05_create_procedures.sql` — Lines 124–328

**Description:** `sp_TransferRoom` atomically transfers a guest from one room to another across all nights of their stay. It uses pessimistic locking, loops over each night, and rolls back all changes if any step fails.

**SQL Code (key sections):**

```sql
-- PHASE 1: Validate & release OLD room (loop over nights)
WHILE @i < @night_count
BEGIN
    SET @stay_date = DATEADD(DAY, @i, @checkin_date);

    -- Lock old room row
    SELECT @old_status = availability_status
    FROM RoomAvailability WITH (UPDLOCK, HOLDLOCK)
    WHERE room_id = @old_room_id AND stay_date = @stay_date;

    -- Release old room -> OPEN
    UPDATE RoomAvailability
    SET availability_status = 'OPEN',
        sellable_flag = 1,
        version_no = version_no + 1,
        ...
    WHERE room_id = @old_room_id AND stay_date = @stay_date;

    SET @i = @i + 1;
END

-- PHASE 2: Lock & book NEW room (loop over nights)
SET @i = 0;
WHILE @i < @night_count
BEGIN
    SET @stay_date = DATEADD(DAY, @i, @checkin_date);

    SELECT @new_status = availability_status
    FROM RoomAvailability WITH (UPDLOCK, HOLDLOCK)
    WHERE room_id = @new_room_id AND stay_date = @stay_date;

    IF @new_status IS NULL OR @new_status <> 'OPEN'
    BEGIN
        ROLLBACK TRANSACTION;  -- Atomic: releases old room changes too
        RETURN;
    END

    -- Book new room
    UPDATE RoomAvailability
    SET availability_status = 'BOOKED',
        sellable_flag = 0,
        version_no = version_no + 1,
        ...
    WHERE room_id = @new_room_id AND stay_date = @stay_date;

    SET @i = @i + 1;
END

-- PHASE 3-5: Update ReservationRoom, Room status, StatusHistory
```

**Benefit:** The entire transfer is atomic — if the new room is unavailable on any night, all changes (including the old room release) are rolled back. This prevents data inconsistency.

---

## 12. Multi-Step Check-in / Check-out Stored Procedures

**File:** `database/sql/23_advanced_stored_procedures.sql`

### sp_CheckIn (Lines 20–82)

```sql
CREATE PROCEDURE dbo.sp_CheckIn
    @reservation_id  BIGINT,
    @agent_id        BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    -- STEP 1: Update reservation status (CONFIRMED -> CHECKED_IN)
    UPDATE Reservation
    SET reservation_status = 'CHECKED_IN', updated_at = GETDATE()
    WHERE reservation_id = @reservation_id
      AND reservation_status = 'CONFIRMED';

    -- STEP 2: Update room occupancy
    UPDATE ReservationRoom
    SET occupancy_status = 'IN_HOUSE', updated_at = GETDATE()
    WHERE reservation_id = @reservation_id;

    -- STEP 3: Update physical room status
    UPDATE Room
    SET room_status = 'OCCUPIED', updated_at = GETDATE()
    WHERE room_id IN (SELECT room_id FROM ReservationRoom
                      WHERE reservation_id = @reservation_id AND room_id IS NOT NULL);

    -- STEP 4: Create StayRecord for each room
    INSERT INTO StayRecord (reservation_room_id, actual_checkin_at, frontdesk_agent_id, stay_status)
    SELECT reservation_room_id, GETDATE(), @agent_id, 'IN_HOUSE'
    FROM ReservationRoom WHERE reservation_id = @reservation_id;

    -- STEP 5: Status history
    INSERT INTO ReservationStatusHistory (reservation_id, old_status, new_status, changed_by, change_reason)
    VALUES (@reservation_id, 'CONFIRMED', 'CHECKED_IN', @agent_id, 'Guest checked in');

    COMMIT TRANSACTION;
END
```

### sp_CheckOut (Lines 97–178)

```sql
CREATE PROCEDURE dbo.sp_CheckOut
    @reservation_id  BIGINT,
    @agent_id        BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;

    -- STEP 1: Update reservation status (CHECKED_IN -> CHECKED_OUT)
    UPDATE Reservation SET reservation_status = 'CHECKED_OUT', ...
    WHERE reservation_id = @reservation_id AND reservation_status = 'CHECKED_IN';

    -- STEP 2: Update room occupancy
    UPDATE ReservationRoom SET occupancy_status = 'COMPLETED', ...

    -- STEP 3: Release rooms and mark for cleaning
    UPDATE Room SET room_status = 'AVAILABLE', housekeeping_status = 'DIRTY', ...

    -- STEP 4: Update StayRecord
    UPDATE StayRecord SET actual_checkout_at = GETDATE(), stay_status = 'COMPLETED', ...

    -- STEP 5: Create housekeeping task
    INSERT INTO HousekeepingTask (hotel_id, room_id, task_type, task_status, priority_level)
    SELECT r.hotel_id, rr.room_id, 'CLEANING', 'OPEN', 'HIGH' ...

    -- STEP 6: Auto-cancel REQUESTED service orders
    UPDATE ReservationService SET service_status = 'CANCELLED', ...
    WHERE reservation_id = @reservation_id AND service_status = 'REQUESTED';

    -- STEP 7: Status history
    INSERT INTO ReservationStatusHistory ...
    VALUES (@reservation_id, 'CHECKED_IN', 'CHECKED_OUT', @agent_id, 'Guest checked out');

    COMMIT TRANSACTION;
END
```

**Benefit:** Each procedure encapsulates a complete business transaction (5–7 steps) in a single atomic database operation, eliminating the need for distributed transactions across multiple API calls.

---

## 13. Guest & Hotel Cancellation Stored Procedures

**File:** `database/sql/23_advanced_stored_procedures.sql`

### sp_GuestCancel (Lines 193–278)

Guest-initiated cancellation. Deposit is forfeited (no refund).

```sql
CREATE PROCEDURE dbo.sp_GuestCancel
    @reservation_id  BIGINT,
    @reason          NVARCHAR(255) = 'Guest requested cancellation'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validate: only CONFIRMED can be guest-cancelled
    DECLARE @current_status VARCHAR(20);
    SELECT @current_status = reservation_status
    FROM Reservation WHERE reservation_id = @reservation_id;

    IF @current_status IS NULL
        RAISERROR('Reservation not found.', 16, 1);
    IF @current_status <> 'CONFIRMED'
        RAISERROR('Cannot cancel: reservation status is ...', 16, 1);

    BEGIN TRANSACTION;

    -- STEP 1: Cancel reservation
    UPDATE Reservation SET reservation_status = 'CANCELLED', ...
    WHERE reservation_id = @reservation_id;

    -- STEP 2: Release RoomAvailability back to OPEN
    UPDATE RoomAvailability SET availability_status = 'OPEN', sellable_flag = 1, ...
    WHERE room_id IN (SELECT room_id FROM ReservationRoom WHERE reservation_id = @reservation_id)
      AND stay_date >= (SELECT checkin_date FROM Reservation WHERE reservation_id = @reservation_id)
      AND stay_date <  (SELECT checkout_date FROM Reservation WHERE reservation_id = @reservation_id)
      AND availability_status = 'BOOKED';

    -- STEP 3: Release physical room
    UPDATE Room SET room_status = 'AVAILABLE', ...

    -- STEP 4: Cancel room assignments
    UPDATE ReservationRoom SET occupancy_status = 'CANCELLED', ...

    -- STEP 5: Status history
    INSERT INTO ReservationStatusHistory ...
    VALUES (@reservation_id, 'CONFIRMED', 'CANCELLED', @reason);

    COMMIT TRANSACTION;
END
```

### sp_HotelCancel (Lines 292–399)

Hotel-initiated cancellation. Full refund (hotel's fault).

```sql
CREATE PROCEDURE dbo.sp_HotelCancel
    @reservation_id  BIGINT,
    @agent_id        BIGINT,
    @reason          NVARCHAR(255)
AS
BEGIN
    -- ... validation ...

    -- Calculate refund amount
    DECLARE @refund_amount DECIMAL(18,2);
    SELECT @refund_amount = ISNULL(SUM(amount), 0)
    FROM Payment
    WHERE reservation_id = @reservation_id
      AND payment_status = 'CAPTURED'
      AND payment_type <> 'REFUND';

    BEGIN TRANSACTION;

    -- STEP 1-4: Same as guest cancel ...

    -- STEP 5: Create refund payment record
    IF @refund_amount > 0
    BEGIN
        INSERT INTO Payment (reservation_id, payment_reference, payment_type,
                             payment_method, payment_status, amount, currency_code, paid_at)
        SELECT @reservation_id,
               'REFUND-' + @reservation_code + '-' + FORMAT(GETDATE(), 'yyyyMMddHHmmss'),
               'REFUND', 'SYSTEM_CREDIT', 'CAPTURED', @refund_amount,
               r.currency_code, GETDATE()
        FROM Reservation r WHERE r.reservation_id = @reservation_id;
    END

    -- STEP 6: Status history
    INSERT INTO ReservationStatusHistory ...
    VALUES (@reservation_id, @current_status, 'CANCELLED', @agent_id, 'HOTEL CANCEL: ' + @reason);

    COMMIT TRANSACTION;
END
```

**Benefit:** Two distinct cancellation flows with different business rules (guest = forfeit, hotel = refund) are encapsulated in atomic procedures.

---

## 14. Cursor-based Cleanup Sweep Procedure

**File:** `database/sql/23_advanced_stored_procedures.sql` — Lines 487–534

**Description:** `sp_CleanupAbandonedReservations` uses a **cursor** to iterate over all CONFIRMED reservations older than a configurable window that have no captured payment, cancelling each one.

**SQL Code:**
```sql
CREATE PROCEDURE dbo.sp_CleanupAbandonedReservations
    @window_minutes INT = 30
AS
BEGIN
    SET NOCOUNT ON;

    -- Collect abandoned reservation codes into temp table
    CREATE TABLE #Abandoned (
        reservation_id   BIGINT,
        reservation_code VARCHAR(50)
    );

    INSERT INTO #Abandoned (reservation_id, reservation_code)
    SELECT r.reservation_id, r.reservation_code
    FROM Reservation r
    WHERE r.reservation_status = 'CONFIRMED'
      AND r.created_at < DATEADD(MINUTE, -@window_minutes, GETDATE())
      AND NOT EXISTS (
          SELECT 1 FROM Payment p
          WHERE p.reservation_id = r.reservation_id
            AND p.payment_status = 'CAPTURED'
      );

    -- Cancel each one using cursor
    DECLARE @code VARCHAR(50);
    DECLARE @reason NVARCHAR(255) = N'Cleanup: no payment after '
        + CAST(@window_minutes AS NVARCHAR) + N' min';

    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
        SELECT reservation_code FROM #Abandoned;

    OPEN cur;
    FETCH NEXT FROM cur INTO @code;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC dbo.sp_CancelAbandonedReservation @reservation_code = @code, @reason = @reason;
        FETCH NEXT FROM cur INTO @code;
    END

    CLOSE cur;
    DEALLOCATE cur;

    -- Return cancelled list
    SELECT reservation_id, reservation_code FROM #Abandoned;
    DROP TABLE #Abandoned;
END
```

**Benefit:** Automated cleanup of abandoned reservations (e.g., payment timeout after 30 minutes). Uses a temp table + cursor pattern for safe batch processing.

---

## 15. Auto-Status-History Trigger

**File:** `database/sql/23_advanced_stored_procedures.sql` — Lines 553–592

**Description:** `trg_Reservation_StatusHistory` automatically inserts a record into `ReservationStatusHistory` whenever `reservation_status` changes, with auto-generated reason text.

**SQL Code:**
```sql
CREATE TRIGGER dbo.trg_Reservation_StatusHistory
ON dbo.Reservation
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(reservation_status)
        RETURN;

    BEGIN TRY
        INSERT INTO dbo.ReservationStatusHistory (
            reservation_id, old_status, new_status, change_reason
        )
        SELECT
            i.reservation_id,
            d.reservation_status,
            i.reservation_status,
            CASE i.reservation_status
                WHEN 'CHECKED_IN'  THEN 'Guest checked in (auto-logged by trigger)'
                WHEN 'CHECKED_OUT' THEN 'Guest checked out (auto-logged by trigger)'
                WHEN 'CANCELLED'   THEN 'Reservation cancelled (auto-logged by trigger)'
                WHEN 'NO_SHOW'     THEN 'Guest no-show (auto-logged by trigger)'
                ELSE 'Status changed (auto-logged by trigger)'
            END
        FROM inserted i
        INNER JOIN deleted d ON i.reservation_id = d.reservation_id
        WHERE i.reservation_status <> d.reservation_status;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR('[WARN] trg_Reservation_StatusHistory failed: %s', 10, 1, @ErrMsg) WITH NOWAIT;
    END CATCH
END
```

**Benefit:** Eliminates the need for manual INSERT statements in route handlers. Every status change is automatically logged with a descriptive reason.

---

## 16. Audit Triggers (Payment, Guest, GuestAuth)

**File:** `database/sql/24_audit_triggers.sql` — Lines 20–224

### trg_Payment_AuditLog (Lines 20–89)

Logs payment creation (INSERT) and status changes (UPDATE) to `AuditLog`.

```sql
CREATE TRIGGER dbo.trg_Payment_AuditLog
ON dbo.Payment
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        -- INSERT case: new payment created
        IF NOT EXISTS (SELECT 1 FROM deleted)
        BEGIN
            INSERT INTO dbo.AuditLog (entity_name, entity_pk, action_type,
                old_value_json, new_value_json, changed_by, changed_at, source_module)
            SELECT 'Payment', CAST(i.payment_id AS VARCHAR(100)), 'INSERT',
                NULL,
                N'{"payment_status":"' + i.payment_status
                    + N'","payment_type":"' + ISNULL(i.payment_type, '')
                    + N'","payment_method":"' + ISNULL(i.payment_method, '')
                    + N'","amount":' + CAST(ISNULL(i.amount, 0) AS NVARCHAR)
                    + N',"reservation_id":' + CAST(ISNULL(i.reservation_id, 0) AS NVARCHAR)
                    + N',"payment_reference":"' + ISNULL(i.payment_reference, '')
                    + N'"}',
                NULL, GETDATE(), 'trg_Payment_AuditLog'
            FROM inserted i;
            RETURN;
        END

        -- UPDATE case: payment status changed
        IF UPDATE(payment_status)
        BEGIN
            INSERT INTO dbo.AuditLog (...)
            SELECT 'Payment', CAST(i.payment_id AS VARCHAR(100)), 'STATUS_CHANGE',
                N'{"payment_status":"' + d.payment_status + N'","amount":' + ... + N'}',
                N'{"payment_status":"' + i.payment_status + N'","amount":' + ... + N'}',
                NULL, GETDATE(), 'trg_Payment_AuditLog'
            FROM inserted i INNER JOIN deleted d ON i.payment_id = d.payment_id
            WHERE i.payment_status <> d.payment_status;
        END
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg1 NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrMsg1, 10, 1) WITH LOG;
    END CATCH
END;

### trg_Guest_AuditLog (Lines 103–156)

Logs profile changes (email, name, phone, VIP flag, document) to `AuditLog`.

```sql
CREATE TRIGGER dbo.trg_Guest_AuditLog
ON dbo.Guest
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        IF UPDATE(email) OR UPDATE(first_name) OR UPDATE(last_name)
           OR UPDATE(phone_number) OR UPDATE(vip_flag)
           OR UPDATE(identity_document_no)
        BEGIN
            INSERT INTO dbo.AuditLog (
                entity_name, entity_pk, action_type,
                old_value_json, new_value_json,
                changed_by, changed_at, source_module
            )
            SELECT
                'Guest',
                CAST(i.guest_id AS VARCHAR(100)),
                'PROFILE_UPDATE',
                N'{"email":"' + ISNULL(d.email, '')
                    + N'","first_name":"' + ISNULL(d.first_name, '')
                    + N'","last_name":"' + ISNULL(d.last_name, '')
                    + N'","phone":"' + ISNULL(d.phone_number, '')
                    + N'","vip_flag":' + CAST(ISNULL(d.vip_flag, 0) AS NVARCHAR)
                    + N'}',
                N'{"email":"' + ISNULL(i.email, '')
                    + N'","first_name":"' + ISNULL(i.first_name, '')
                    + N'","last_name":"' + ISNULL(i.last_name, '')
                    + N'","phone":"' + ISNULL(i.phone_number, '')
                    + N'","vip_flag":' + CAST(ISNULL(i.vip_flag, 0) AS NVARCHAR)
                    + N'}',
                NULL, GETDATE(), 'trg_Guest_AuditLog'
            FROM inserted i
            INNER JOIN deleted d ON i.guest_id = d.guest_id
            WHERE ISNULL(i.email, '') <> ISNULL(d.email, '')
               OR ISNULL(i.first_name, '') <> ISNULL(d.first_name, '')
               OR ISNULL(i.last_name, '') <> ISNULL(d.last_name, '')
               OR ISNULL(i.phone_number, '') <> ISNULL(d.phone_number, '')
               OR ISNULL(i.vip_flag, 0) <> ISNULL(d.vip_flag, 0)
               OR ISNULL(i.identity_document_no, '') <> ISNULL(d.identity_document_no, '');
        END
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg2 NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrMsg2, 10, 1) WITH LOG;
    END CATCH
END;
```

### trg_GuestAuth_AuditLog (Lines 170–221)

Logs authentication changes: password reset, email verification, account lock/unlock.

```sql
CREATE TRIGGER dbo.trg_GuestAuth_AuditLog
ON dbo.GuestAuth
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        INSERT INTO dbo.AuditLog (
            entity_name, entity_pk, action_type,
            old_value_json, new_value_json,
            changed_by, changed_at, source_module
        )
        SELECT
            'GuestAuth',
            CAST(i.guest_auth_id AS VARCHAR(100)),
            CASE
                WHEN UPDATE(password_hash) AND d.password_hash <> i.password_hash
                    THEN 'PASSWORD_CHANGE'
                WHEN UPDATE(email_verified_at) AND d.email_verified_at IS NULL AND i.email_verified_at IS NOT NULL
                    THEN 'EMAIL_VERIFIED'
                WHEN UPDATE(account_status) AND d.account_status <> i.account_status
                    THEN 'ACCOUNT_STATUS_CHANGE'
                ELSE 'AUTH_UPDATE'
            END,
            N'{"account_status":"' + ISNULL(d.account_status, '')
                + N'","email_verified":' + CASE WHEN d.email_verified_at IS NOT NULL THEN 'true' ELSE 'false' END
                + N',"login_email":"' + ISNULL(d.login_email, '')
                + N'","guest_id":' + CAST(ISNULL(d.guest_id, 0) AS NVARCHAR)
                + N'}',
            N'{"account_status":"' + ISNULL(i.account_status, '')
                + N'","email_verified":' + CASE WHEN i.email_verified_at IS NOT NULL THEN 'true' ELSE 'false' END
                + N',"login_email":"' + ISNULL(i.login_email, '')
                + N'","guest_id":' + CAST(ISNULL(i.guest_id, 0) AS NVARCHAR)
                + N'}',
            NULL, GETDATE(), 'trg_GuestAuth_AuditLog'
        FROM inserted i
        INNER JOIN deleted d ON i.guest_auth_id = d.guest_auth_id
        WHERE ISNULL(i.account_status, '') <> ISNULL(d.account_status, '')
           OR ISNULL(i.password_hash, '') <> ISNULL(d.password_hash, '')
           OR (d.email_verified_at IS NULL AND i.email_verified_at IS NOT NULL)
           OR ISNULL(i.login_email, '') <> ISNULL(d.login_email, '');
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg3 NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrMsg3, 10, 1) WITH LOG;
    END CATCH
END;
```

**Benefit:** Comprehensive audit trail for all sensitive operations (payments, guest profiles, authentication) with before/after JSON snapshots.

---

## 17. Hybrid SQL + MongoDB Architecture

**Files:** `database/sql/02_create_tables.sql` + `database/mongodb/02_seed_data.js`

**Description:** The project uses a **hybrid architecture** where structured transactional data (reservations, payments, guests) lives in SQL Server, while rich descriptive content (amenity details, room descriptions, hotel images) is stored in MongoDB.

**SQL Side (structured data):**
```sql
-- HotelAmenity stores only the link key + operational fields
CREATE TABLE HotelAmenity (
    hotel_amenity_id    BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id            BIGINT          NOT NULL,
    amenity_code        VARCHAR(50)     NOT NULL, -- Link key -> MongoDB amenity_master
    is_complimentary    BIT             NOT NULL DEFAULT 1,
    is_chargeable       BIT             NOT NULL DEFAULT 0,
    base_fee            DECIMAL(18,2)   NULL,
    availability_status VARCHAR(30)     NULL,
    operating_hours     VARCHAR(100)    NULL,
    notes               NVARCHAR(MAX)   NULL,
    ...
    CONSTRAINT UQ_HotelAmenity_Code UNIQUE (hotel_id, amenity_code)
);
```

**MongoDB Side (rich content):**
```javascript
// MongoDB: amenity_master collection
{
    amenity_code: 'AMN-POOL-PRIV',
    name: 'Private Pool',
    category: 'RECREATION',
    description: 'Temperature-controlled private pool with cabana service',
    icon: 'pool',
    tags: ['luxury', 'rooftop', 'private'],
    images: ['https://cdn.luxereserve.com/amenities/private-pool.jpg']
}
```

**Link Key Pattern:**
| SQL Table | Link Key | MongoDB Collection |
|-----------|----------|-------------------|
| `HotelAmenity.amenity_code` | `amenity_code` | `amenity_master` |
| `RoomType.room_type_code` | `room_type_code` | `room_type_catalog` |
| `Hotel.hotel_code` | `hotel_code` | `Hotel_Catalog` |

**Benefit:** Combines ACID compliance for transactional data with schema flexibility for rich content. MongoDB stores images, tags, descriptions, and floor plans that would be cumbersome in normalized SQL.

---

## 18. MERGE (Upsert) for Idempotent Seeding

**File:** `database/sql/07_auth_extension.sql` — Lines 42–57

**Description:** Uses the T-SQL `MERGE` statement to perform an upsert — insert if not exists, update if exists. This makes seed scripts idempotent (safe to run multiple times).

**SQL Code:**
```sql
MERGE GuestAuth AS target
USING (
    SELECT CAST(1 AS BIGINT) AS guest_id, 'dqc@luxereserve.local' AS login_email,
           '$2b$10$YPOMA6bXP0aBwnuckX1.4OiYRHnG.YuLHC5dzNYN3jDAE4ZKGD5Ai' AS password_hash
) AS source
ON target.guest_id = source.guest_id
WHEN MATCHED THEN
    UPDATE SET
        login_email = source.login_email,
        password_hash = source.password_hash,
        account_status = 'ACTIVE',
        email_verified_at = ISNULL(target.email_verified_at, GETDATE()),
        updated_at = GETDATE()
WHEN NOT MATCHED THEN
    INSERT (guest_id, login_email, password_hash, account_status, email_verified_at)
    VALUES (source.guest_id, source.login_email, source.password_hash, 'ACTIVE', GETDATE());
```

**Benefit:** Idempotent seeding — the script can be run repeatedly without creating duplicate records or causing errors.

---

## 19. Temporal Tables (effective_from / effective_to)

**Files:** `database/sql/02_create_tables.sql` — HotelPolicy (lines 152–153), RatePlan (lines 521–522), Promotion (lines 608–611)

**Description:** Several tables use `effective_from` and `effective_to` columns to implement **temporal validity** — records are active only within a specified date range.

**SQL Code (HotelPolicy):**
```sql
CREATE TABLE HotelPolicy (
    ...
    effective_from              DATETIME        NOT NULL,
    effective_to                DATETIME        NULL,
    status                      VARCHAR(10)     NOT NULL DEFAULT 'ACTIVE',
    ...
    CONSTRAINT CK_HotelPolicy_Status CHECK (status IN ('ACTIVE','INACTIVE','EXPIRED'))
);
```

**SQL Code (RatePlan):**
```sql
CREATE TABLE RatePlan (
    ...
    effective_from          DATETIME        NOT NULL,
    effective_to            DATETIME        NULL,
    status                  VARCHAR(10)     NOT NULL DEFAULT 'ACTIVE',
    ...
);
```

**SQL Code (Promotion):**
```sql
CREATE TABLE Promotion (
    ...
    booking_start_date DATE NOT NULL,
    booking_end_date   DATE NOT NULL,
    stay_start_date    DATE NOT NULL,
    stay_end_date      DATE NOT NULL,
    ...
);
```

**Benefit:** Enables time-based business rules (seasonal pricing, promotional periods, policy changes) without schema changes. Queries filter by `GETDATE() BETWEEN effective_from AND effective_to`.

---

## 20. Composite Indexes for Query Performance

**Files:** Multiple — throughout `02_create_tables.sql`, `03_create_views.sql`, `22_add_hotel_reviews.sql`

**Description:** Strategic composite indexes are created to optimize the most common query patterns.

**SQL Code (key examples):**

```sql
-- RoomAvailability: hotel + date for availability searches
CREATE INDEX IX_RoomAvail_HotelDate ON RoomAvailability(hotel_id, stay_date);

-- RoomAvailability: hotel + status + date for filtering
CREATE INDEX IX_RoomAvail_HotelStatus ON RoomAvailability(hotel_id, availability_status, stay_date);

-- Reservation: hotel + status + checkin for front desk queries
CREATE INDEX IX_Resv_HotelStatus ON Reservation(hotel_id, reservation_status, checkin_date);

-- ReservationRoom: room + date range for availability overlap checks
CREATE INDEX IX_ResvRoom_Room ON ReservationRoom(room_id, stay_start_date, stay_end_date);

-- RoomRate: hotel + date for rate lookups
CREATE INDEX IX_RoomRate_HotelDate ON RoomRate(hotel_id, rate_date);

-- HotelReview: hotel + visibility + moderation + date for public reviews
CREATE INDEX IX_HotelReview_HotelPublished
    ON HotelReview(hotel_id, public_visible_flag, moderation_status, created_at DESC);

-- GuestPreference: guest + type for preference lookups
CREATE INDEX IX_GuestPref_Type ON GuestPreference(guest_id, preference_type);

-- LoyaltyRedemption: guest + status + expiry for active redemptions
CREATE INDEX IX_LoyaltyRedemption_GuestStatus
    ON LoyaltyRedemption(guest_id, status, expires_at);
```

**Benefit:** 20+ carefully designed indexes ensure that all common query patterns (availability searches, reservation lookups, rate queries, review listings) are covered by covering indexes, minimizing table scans.

---

## Summary Table

| # | Technique | SQL File(s) | Key Lines |
|---|-----------|-------------|-----------|
| 1 | Computed Column (PERSISTED) | `02_create_tables.sql` | 318–326 |
| 2 | Self-Referencing FK | `02_create_tables.sql` | 34 |
| 3 | CHECK Constraints | Multiple files | 30+ constraints |
| 4 | Recursive CTE | `03_create_views.sql` | 86–136 |
| 5 | Window Functions | `03_create_views.sql` | 143–187 |
| 6 | Financial Views | `03_create_views.sql` | 9–75 |
| 7 | Price Integrity Trigger | `04_create_triggers.sql` | 9–62 |
| 8 | Cancellation Audit Trigger | `04_create_triggers.sql` | 73–125 |
| 9 | Pessimistic Locking | `05_create_procedures.sql` | 31–34, 161–162 |
| 10 | Savepoint Transactions | `05_create_procedures.sql` | 19–26 |
| 11 | Atomic Room Transfer | `05_create_procedures.sql` | 124–328 |
| 12 | Check-in / Check-out SPs | `23_advanced_stored_procedures.sql` | 20–82, 97–178 |
| 13 | Guest/Hotel Cancel SPs | `23_advanced_stored_procedures.sql` | 193–278, 292–399 |
| 14 | Cursor Cleanup Sweep | `23_advanced_stored_procedures.sql` | 487–534 |
| 15 | Auto-Status-History Trigger | `23_advanced_stored_procedures.sql` | 553–592 |
| 16 | Audit Triggers (3 tables) | `24_audit_triggers.sql` | 20–224 |
| 17 | Hybrid SQL + MongoDB | `02_create_tables.sql` + MongoDB | Link key pattern |
| 18 | MERGE Upsert | `07_auth_extension.sql` | 42–57 |
| 19 | Temporal Validity | `02_create_tables.sql` | HotelPolicy, RatePlan, Promotion |
| 20 | Composite Indexes | Multiple files | 20+ indexes |

---

*Generated from all `database/sql/` scripts (01–24) and `database/mongodb/` scripts.*
