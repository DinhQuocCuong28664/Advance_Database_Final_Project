-- ============================================================
-- 23_advanced_stored_procedures.sql
-- Advanced DB: Move multi-step business logic into Stored Procedures
-- and auto-logging into Triggers.
--
-- Rule 14: Logic that CAN be handled at DB MUST be at DB.
-- ============================================================

USE LuxeReserve;
GO

-- ============================================================
-- 1. sp_CheckIn
--    Atomically: update reservation -> update room assignment
--    -> update physical room -> create stay record -> log history
-- ============================================================
IF OBJECT_ID('dbo.sp_CheckIn', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_CheckIn;
GO

CREATE PROCEDURE dbo.sp_CheckIn
    @reservation_id  BIGINT,
    @agent_id        BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    -- STEP 1: Update reservation status (only CONFIRMED -> CHECKED_IN)
    UPDATE Reservation
    SET reservation_status = 'CHECKED_IN', updated_at = GETDATE()
    WHERE reservation_id = @reservation_id
      AND reservation_status = 'CONFIRMED';

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR('Check-in failed: reservation not found or not CONFIRMED.', 16, 1);
        RETURN;
    END

    -- STEP 2: Update room occupancy
    UPDATE ReservationRoom
    SET occupancy_status = 'IN_HOUSE', updated_at = GETDATE()
    WHERE reservation_id = @reservation_id;

    -- STEP 3: Update physical room status
    UPDATE Room
    SET room_status = 'OCCUPIED', updated_at = GETDATE()
    WHERE room_id IN (
        SELECT room_id FROM ReservationRoom
        WHERE reservation_id = @reservation_id AND room_id IS NOT NULL
    );

    -- STEP 4: Create StayRecord for each room
    INSERT INTO StayRecord (reservation_room_id, actual_checkin_at, frontdesk_agent_id, stay_status)
    SELECT reservation_room_id, GETDATE(), @agent_id, 'IN_HOUSE'
    FROM ReservationRoom
    WHERE reservation_id = @reservation_id;

    -- STEP 5: Status history (trigger will also fire for AuditLog)
    INSERT INTO ReservationStatusHistory
        (reservation_id, old_status, new_status, changed_by, change_reason)
    VALUES
        (@reservation_id, 'CONFIRMED', 'CHECKED_IN', @agent_id, 'Guest checked in');

    COMMIT TRANSACTION;

    -- Return success info
    SELECT
        r.reservation_id,
        r.reservation_code,
        r.reservation_status,
        rr.room_id,
        rm.room_number
    FROM Reservation r
    LEFT JOIN ReservationRoom rr ON rr.reservation_id = r.reservation_id
    LEFT JOIN Room rm ON rr.room_id = rm.room_id
    WHERE r.reservation_id = @reservation_id;
END
GO

PRINT '[OK] sp_CheckIn created';
GO


-- ============================================================
-- 2. sp_CheckOut
--    Atomically: update reservation -> update room assignment
--    -> release room -> update stay record -> create housekeeping
--    -> cancel pending services -> log history
-- ============================================================
IF OBJECT_ID('dbo.sp_CheckOut', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_CheckOut;
GO

CREATE PROCEDURE dbo.sp_CheckOut
    @reservation_id  BIGINT,
    @agent_id        BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    -- STEP 1: Update reservation status (only CHECKED_IN -> CHECKED_OUT)
    UPDATE Reservation
    SET reservation_status = 'CHECKED_OUT', updated_at = GETDATE()
    WHERE reservation_id = @reservation_id
      AND reservation_status = 'CHECKED_IN';

    IF @@ROWCOUNT = 0
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR('Check-out failed: reservation not found or not CHECKED_IN.', 16, 1);
        RETURN;
    END

    -- STEP 2: Update room occupancy
    UPDATE ReservationRoom
    SET occupancy_status = 'COMPLETED', updated_at = GETDATE()
    WHERE reservation_id = @reservation_id;

    -- STEP 3: Release rooms and mark for cleaning
    UPDATE Room
    SET room_status = 'AVAILABLE',
        housekeeping_status = 'DIRTY',
        updated_at = GETDATE()
    WHERE room_id IN (
        SELECT room_id FROM ReservationRoom
        WHERE reservation_id = @reservation_id AND room_id IS NOT NULL
    );

    -- STEP 4: Update StayRecord
    UPDATE StayRecord
    SET actual_checkout_at = GETDATE(),
        stay_status = 'COMPLETED',
        updated_at = GETDATE()
    WHERE reservation_room_id IN (
        SELECT reservation_room_id FROM ReservationRoom
        WHERE reservation_id = @reservation_id
    );

    -- STEP 5: Create housekeeping task for each room
    INSERT INTO HousekeepingTask (hotel_id, room_id, task_type, task_status, priority_level)
    SELECT r.hotel_id, rr.room_id, 'CLEANING', 'OPEN', 'HIGH'
    FROM ReservationRoom rr
    JOIN Room r ON rr.room_id = r.room_id
    WHERE rr.reservation_id = @reservation_id AND rr.room_id IS NOT NULL;

    -- STEP 6: Auto-cancel REQUESTED service orders
    UPDATE ReservationService
    SET service_status = 'CANCELLED', updated_at = GETDATE()
    WHERE reservation_id = @reservation_id
      AND service_status = 'REQUESTED';

    -- STEP 7: Status history
    INSERT INTO ReservationStatusHistory
        (reservation_id, old_status, new_status, changed_by, change_reason)
    VALUES
        (@reservation_id, 'CHECKED_IN', 'CHECKED_OUT', @agent_id, 'Guest checked out');

    COMMIT TRANSACTION;

    -- Return financial summary
    SELECT
        r.reservation_id,
        r.reservation_code,
        r.reservation_status,
        vrt.grand_total,
        vrt.total_paid,
        vrt.balance_due
    FROM Reservation r
    LEFT JOIN vw_ReservationTotal vrt ON vrt.reservation_id = r.reservation_id
    WHERE r.reservation_id = @reservation_id;
END
GO

PRINT '[OK] sp_CheckOut created';
GO


-- ============================================================
-- 3. sp_GuestCancel
--    Guest-initiated cancellation. Deposit is forfeited (no refund).
--    Atomically: validate -> cancel reservation -> release rooms
--    -> update room status -> cancel assignments -> log history
-- ============================================================
IF OBJECT_ID('dbo.sp_GuestCancel', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_GuestCancel;
GO

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
    FROM Reservation
    WHERE reservation_id = @reservation_id;

    IF @current_status IS NULL
    BEGIN
        RAISERROR('Reservation not found.', 16, 1);
        RETURN;
    END

    IF @current_status <> 'CONFIRMED'
    BEGIN
        DECLARE @err_msg NVARCHAR(200) = 'Cannot cancel: reservation status is ' + @current_status + '. Only CONFIRMED can be guest-cancelled.';
        RAISERROR(@err_msg, 16, 1);
        RETURN;
    END

    BEGIN TRANSACTION;

    -- STEP 1: Cancel reservation
    UPDATE Reservation
    SET reservation_status = 'CANCELLED', updated_at = GETDATE()
    WHERE reservation_id = @reservation_id;

    -- STEP 2: Release RoomAvailability back to OPEN
    UPDATE RoomAvailability
    SET availability_status = 'OPEN',
        sellable_flag = 1,
        version_no = version_no + 1,
        inventory_note = N'Released by guest cancellation',
        updated_at = GETDATE()
    WHERE room_id IN (SELECT room_id FROM ReservationRoom WHERE reservation_id = @reservation_id)
      AND stay_date >= (SELECT checkin_date FROM Reservation WHERE reservation_id = @reservation_id)
      AND stay_date <  (SELECT checkout_date FROM Reservation WHERE reservation_id = @reservation_id)
      AND availability_status = 'BOOKED';

    -- STEP 3: Release physical room
    UPDATE Room
    SET room_status = 'AVAILABLE', updated_at = GETDATE()
    WHERE room_id IN (
        SELECT room_id FROM ReservationRoom
        WHERE reservation_id = @reservation_id AND room_id IS NOT NULL
    );

    -- STEP 4: Cancel room assignments
    UPDATE ReservationRoom
    SET occupancy_status = 'CANCELLED', updated_at = GETDATE()
    WHERE reservation_id = @reservation_id;

    -- STEP 5: Status history
    INSERT INTO ReservationStatusHistory
        (reservation_id, old_status, new_status, change_reason)
    VALUES
        (@reservation_id, 'CONFIRMED', 'CANCELLED', @reason);

    COMMIT TRANSACTION;

    -- Return result with forfeited deposit amount
    SELECT
        r.reservation_id,
        r.reservation_code,
        'CANCELLED' AS new_status,
        ISNULL(dep.deposit_forfeited, 0) AS deposit_forfeited,
        0 AS refund_amount,
        @reason AS cancel_reason
    FROM Reservation r
    OUTER APPLY (
        SELECT SUM(amount) AS deposit_forfeited
        FROM Payment
        WHERE reservation_id = @reservation_id
          AND payment_type = 'DEPOSIT'
          AND payment_status = 'CAPTURED'
    ) dep
    WHERE r.reservation_id = @reservation_id;
END
GO

PRINT '[OK] sp_GuestCancel created';
GO


-- ============================================================
-- 4. sp_HotelCancel
--    Hotel-initiated cancellation. Full refund (hotel's fault).
--    Similar to guest-cancel but with refund record + agent tracking.
-- ============================================================
IF OBJECT_ID('dbo.sp_HotelCancel', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_HotelCancel;
GO

CREATE PROCEDURE dbo.sp_HotelCancel
    @reservation_id  BIGINT,
    @agent_id        BIGINT,
    @reason          NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Validate: cannot cancel already cancelled/checked-out/no-show
    DECLARE @current_status VARCHAR(20);
    DECLARE @reservation_code VARCHAR(50);
    SELECT @current_status = reservation_status,
           @reservation_code = reservation_code
    FROM Reservation
    WHERE reservation_id = @reservation_id;

    IF @current_status IS NULL
    BEGIN
        RAISERROR('Reservation not found.', 16, 1);
        RETURN;
    END

    IF @current_status IN ('CANCELLED', 'CHECKED_OUT', 'NO_SHOW')
    BEGIN
        DECLARE @err_msg NVARCHAR(200) = 'Cannot cancel: reservation status is ' + @current_status;
        RAISERROR(@err_msg, 16, 1);
        RETURN;
    END

    BEGIN TRANSACTION;

    -- Calculate refund amount (sum of all captured non-refund payments)
    DECLARE @refund_amount DECIMAL(18,2);
    SELECT @refund_amount = ISNULL(SUM(amount), 0)
    FROM Payment
    WHERE reservation_id = @reservation_id
      AND payment_status = 'CAPTURED'
      AND payment_type <> 'REFUND';

    -- STEP 1: Cancel reservation
    UPDATE Reservation
    SET reservation_status = 'CANCELLED', updated_at = GETDATE()
    WHERE reservation_id = @reservation_id;

    -- STEP 2: Release RoomAvailability
    UPDATE RoomAvailability
    SET availability_status = 'OPEN',
        sellable_flag = 1,
        version_no = version_no + 1,
        inventory_note = N'Released by hotel cancellation: ' + CAST(@reservation_id AS NVARCHAR),
        updated_at = GETDATE()
    WHERE room_id IN (SELECT room_id FROM ReservationRoom WHERE reservation_id = @reservation_id)
      AND stay_date >= (SELECT checkin_date FROM Reservation WHERE reservation_id = @reservation_id)
      AND stay_date <  (SELECT checkout_date FROM Reservation WHERE reservation_id = @reservation_id)
      AND availability_status = 'BOOKED';

    -- STEP 3: Release physical room
    UPDATE Room
    SET room_status = 'AVAILABLE', updated_at = GETDATE()
    WHERE room_id IN (
        SELECT room_id FROM ReservationRoom
        WHERE reservation_id = @reservation_id AND room_id IS NOT NULL
    );

    -- STEP 4: Cancel room assignments
    UPDATE ReservationRoom
    SET occupancy_status = 'CANCELLED', updated_at = GETDATE()
    WHERE reservation_id = @reservation_id;

    -- STEP 5: Create refund payment record (if there was payment)
    IF @refund_amount > 0
    BEGIN
        INSERT INTO Payment
            (reservation_id, payment_reference, payment_type, payment_method,
             payment_status, amount, currency_code, paid_at)
        SELECT
            @reservation_id,
            'REFUND-' + @reservation_code + '-' + FORMAT(GETDATE(), 'yyyyMMddHHmmss'),
            'REFUND',
            'SYSTEM_CREDIT',
            'CAPTURED',
            @refund_amount,
            r.currency_code,
            GETDATE()
        FROM Reservation r
        WHERE r.reservation_id = @reservation_id;
    END

    -- STEP 6: Status history
    INSERT INTO ReservationStatusHistory
        (reservation_id, old_status, new_status, changed_by, change_reason)
    VALUES
        (@reservation_id, @current_status, 'CANCELLED', @agent_id, 'HOTEL CANCEL: ' + @reason);

    COMMIT TRANSACTION;

    -- Return result
    SELECT
        @reservation_id AS reservation_id,
        @reservation_code AS reservation_code,
        'CANCELLED' AS new_status,
        @current_status AS old_status,
        @refund_amount AS refund_amount,
        @reason AS cancel_reason,
        @agent_id AS cancelled_by_agent;
END
GO

PRINT '[OK] sp_HotelCancel created';
GO


-- ============================================================
-- 5. sp_CancelAbandonedReservation
--    Cancel a single reservation that has no captured payment.
--    Called by cleanup sweep or VNPay return handler.
-- ============================================================
IF OBJECT_ID('dbo.sp_CancelAbandonedReservation', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_CancelAbandonedReservation;
GO

CREATE PROCEDURE dbo.sp_CancelAbandonedReservation
    @reservation_code  VARCHAR(50),
    @reason            NVARCHAR(255) = 'Payment abandoned'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @reservation_id BIGINT;

    -- Only cancel if CONFIRMED and has no captured payment
    SELECT @reservation_id = r.reservation_id
    FROM Reservation r
    WHERE r.reservation_code = @reservation_code
      AND r.reservation_status = 'CONFIRMED'
      AND NOT EXISTS (
          SELECT 1 FROM Payment p
          WHERE p.reservation_id = r.reservation_id
            AND p.payment_status = 'CAPTURED'
      );

    IF @reservation_id IS NULL
        RETURN; -- Already cancelled or already paid; idempotent

    BEGIN TRANSACTION;

    -- Cancel reservation
    UPDATE Reservation
    SET reservation_status = 'CANCELLED', updated_at = GETDATE()
    WHERE reservation_id = @reservation_id;

    -- Release room availability
    UPDATE ra
    SET ra.availability_status = 'OPEN',
        ra.sellable_flag       = 1,
        ra.inventory_note      = N'Released: ' + @reason,
        ra.updated_at          = GETDATE()
    FROM RoomAvailability ra
    JOIN ReservationRoom rr ON ra.room_id = rr.room_id
      AND ra.hotel_id = (SELECT hotel_id FROM Reservation WHERE reservation_id = @reservation_id)
      AND ra.stay_date >= (SELECT checkin_date  FROM Reservation WHERE reservation_id = @reservation_id)
      AND ra.stay_date <  (SELECT checkout_date FROM Reservation WHERE reservation_id = @reservation_id)
    WHERE rr.reservation_id = @reservation_id
      AND ra.availability_status = 'BOOKED';

    -- Cancel room assignment
    UPDATE ReservationRoom
    SET occupancy_status = 'CANCELLED', updated_at = GETDATE()
    WHERE reservation_id = @reservation_id;

    -- Status history
    INSERT INTO ReservationStatusHistory
        (reservation_id, old_status, new_status, change_reason)
    VALUES
        (@reservation_id, 'CONFIRMED', 'CANCELLED', @reason);

    COMMIT TRANSACTION;

    PRINT '[OK] Cancelled abandoned reservation: ' + @reservation_code;
END
GO

PRINT '[OK] sp_CancelAbandonedReservation created';
GO


-- ============================================================
-- 6. sp_CleanupAbandonedReservations
--    Sweep: cancel ALL CONFIRMED reservations with no payment
--    older than @window_minutes. Returns cancelled codes.
-- ============================================================
IF OBJECT_ID('dbo.sp_CleanupAbandonedReservations', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_CleanupAbandonedReservations;
GO

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

    -- Cancel each one using the single-reservation SP
    DECLARE @code VARCHAR(50);
    DECLARE @reason NVARCHAR(255) = N'Cleanup: no payment after ' + CAST(@window_minutes AS NVARCHAR) + N' min';

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
GO

PRINT '[OK] sp_CleanupAbandonedReservations created';
GO


-- ============================================================
-- 7. trg_Reservation_StatusHistory
--    AFTER UPDATE trigger: auto-insert into ReservationStatusHistory
--    whenever reservation_status changes.
--    This replaces manual INSERT statements in route handlers.
--
--    NOTE: Route handlers should STOP inserting into
--    ReservationStatusHistory manually after this trigger is active.
--    The trigger handles all status transitions automatically.
-- ============================================================
IF OBJECT_ID('dbo.trg_Reservation_StatusHistory', 'TR') IS NOT NULL DROP TRIGGER dbo.trg_Reservation_StatusHistory;
GO

CREATE TRIGGER dbo.trg_Reservation_StatusHistory
ON dbo.Reservation
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Only fire when reservation_status actually changed
    IF NOT UPDATE(reservation_status)
        RETURN;

    BEGIN TRY
        INSERT INTO dbo.ReservationStatusHistory (
            reservation_id,
            old_status,
            new_status,
            change_reason
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
        -- Swallow trigger errors to avoid blocking the main operation
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR('[WARN] trg_Reservation_StatusHistory failed: %s', 10, 1, @ErrMsg) WITH NOWAIT;
    END CATCH
END
GO

PRINT '[OK] trg_Reservation_StatusHistory created';
GO


-- ============================================================
-- Summary
-- ============================================================
PRINT '';
PRINT '=== Advanced Stored Procedures Summary ===';
PRINT 'sp_CheckIn                        - 5-step check-in flow';
PRINT 'sp_CheckOut                       - 7-step check-out flow';
PRINT 'sp_GuestCancel                    - 6-step guest cancellation';
PRINT 'sp_HotelCancel                    - 6-step hotel cancellation + refund';
PRINT 'sp_CancelAbandonedReservation     - 4-step abandon cancel (single)';
PRINT 'sp_CleanupAbandonedReservations   - Sweep: cancel all expired unpaid';
PRINT 'trg_Reservation_StatusHistory     - Auto-log status changes';
PRINT '';
PRINT '[OK] All stored procedures and triggers created successfully.';
GO
