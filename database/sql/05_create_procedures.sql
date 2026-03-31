-- ============================================================
-- LuxeReserve — 05: Stored Procedures
-- sp_ReserveRoom — Pessimistic Locking (UPDLOCK + HOLDLOCK)
-- ============================================================

USE LuxeReserve;
GO

CREATE OR ALTER PROCEDURE sp_ReserveRoom
    @room_id              BIGINT,
    @stay_date            DATE,
    @reservation_code     VARCHAR(50),
    @session_id           VARCHAR(100) = NULL,
    @result_status        INT           OUTPUT,  -- 0=SUCCESS, 1=NOT_FOUND, 2=REJECTED, 9=ERROR
    @result_message       NVARCHAR(500) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @current_status     VARCHAR(20);
    DECLARE @lock_acquired_at   DATETIME = GETDATE();
    DECLARE @transaction_id     VARCHAR(100) = CAST(NEWID() AS VARCHAR(100));

    BEGIN TRY
        BEGIN TRANSACTION;

        -- ═══════════════════════════════════════════════
        -- STEP 1: PESSIMISTIC LOCK on inventory row
        -- UPDLOCK  = Prevent other transactions from
        --            acquiring update/exclusive locks
        -- HOLDLOCK = Hold lock until COMMIT/ROLLBACK
        --            (equivalent to SERIALIZABLE on row)
        -- ═══════════════════════════════════════════════
        SELECT @current_status = availability_status
        FROM RoomAvailability WITH (UPDLOCK, HOLDLOCK)
        WHERE room_id  = @room_id
          AND stay_date = @stay_date;

        -- Check existence
        IF @current_status IS NULL
        BEGIN
            SET @result_status  = 1;
            SET @result_message = N'NOT_FOUND: No inventory record for room_id='
                + CAST(@room_id AS NVARCHAR) + N', date=' + CONVERT(NVARCHAR, @stay_date, 23);

            INSERT INTO InventoryLockLog
                (reservation_code_attempt, room_id, stay_date,
                 lock_acquired_at, lock_released_at, lock_status,
                 session_id, transaction_id, note)
            VALUES
                (@reservation_code, @room_id, @stay_date,
                 @lock_acquired_at, GETDATE(), 'FAILED',
                 @session_id, @transaction_id, N'Inventory record not found');

            ROLLBACK TRANSACTION;
            RETURN;
        END

        -- ═══════════════════════════════════════════════
        -- STEP 2: Check availability
        -- ═══════════════════════════════════════════════
        IF @current_status <> 'OPEN'
        BEGIN
            SET @result_status  = 2;
            SET @result_message = N'REJECTED: Room not available. Current status: '
                + @current_status;

            INSERT INTO InventoryLockLog
                (reservation_code_attempt, room_id, stay_date,
                 lock_acquired_at, lock_released_at, lock_status,
                 session_id, transaction_id, note)
            VALUES
                (@reservation_code, @room_id, @stay_date,
                 @lock_acquired_at, GETDATE(), 'FAILED',
                 @session_id, @transaction_id,
                 N'Room not available, status=' + @current_status);

            ROLLBACK TRANSACTION;
            RETURN;
        END

        -- ═══════════════════════════════════════════════
        -- STEP 3: Reserve the room (update inventory)
        -- ═══════════════════════════════════════════════
        UPDATE RoomAvailability
        SET availability_status = 'BOOKED',
            sellable_flag       = 0,
            version_no          = version_no + 1,
            updated_at          = GETDATE()
        WHERE room_id  = @room_id
          AND stay_date = @stay_date;

        -- ═══════════════════════════════════════════════
        -- STEP 4: Log successful lock
        -- ═══════════════════════════════════════════════
        INSERT INTO InventoryLockLog
            (reservation_code_attempt, room_id, stay_date,
             lock_acquired_at, lock_released_at, lock_status,
             session_id, transaction_id, note)
        VALUES
            (@reservation_code, @room_id, @stay_date,
             @lock_acquired_at, GETDATE(), 'SUCCESS',
             @session_id, @transaction_id,
             N'Room reserved successfully');

        COMMIT TRANSACTION;

        SET @result_status  = 0;
        SET @result_message = N'SUCCESS: Room reserved. room_id='
            + CAST(@room_id AS NVARCHAR) + N', date=' + CONVERT(NVARCHAR, @stay_date, 23);

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        -- Log error/timeout
        BEGIN TRY
            INSERT INTO InventoryLockLog
                (reservation_code_attempt, room_id, stay_date,
                 lock_acquired_at, lock_released_at, lock_status,
                 session_id, transaction_id, note)
            VALUES
                (@reservation_code, @room_id, @stay_date,
                 @lock_acquired_at, GETDATE(), 'TIMEOUT',
                 @session_id, @transaction_id, ERROR_MESSAGE());
        END TRY
        BEGIN CATCH
            -- Ignore logging errors
        END CATCH

        SET @result_status  = 9;
        SET @result_message = N'ERROR: ' + ERROR_MESSAGE();
    END CATCH
END;
GO

PRINT '✅ PROCEDURE sp_ReserveRoom created.';
GO
