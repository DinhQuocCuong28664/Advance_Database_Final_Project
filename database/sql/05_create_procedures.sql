-- ============================================================
-- LuxeReserve - 05: Stored Procedures
-- sp_ReserveRoom - Pessimistic Locking (UPDLOCK + HOLDLOCK)
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

        -- ============================================================
        -- STEP 1: PESSIMISTIC LOCK on inventory row
        -- UPDLOCK  = Prevent other transactions from
        --            acquiring update/exclusive locks
        -- HOLDLOCK = Hold lock until COMMIT/ROLLBACK
        --            (equivalent to SERIALIZABLE on row)
        -- ============================================================
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

        -- ============================================================
        -- STEP 2: Check availability
        -- ============================================================
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

        -- ============================================================
        -- STEP 3: Reserve the room (update inventory)
        -- ============================================================
        UPDATE RoomAvailability
        SET availability_status = 'BOOKED',
            sellable_flag       = 0,
            version_no          = version_no + 1,
            updated_at          = GETDATE()
        WHERE room_id  = @room_id
          AND stay_date = @stay_date;

        -- ============================================================
        -- STEP 4: Log successful lock
        -- ============================================================
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

PRINT 'OK PROCEDURE sp_ReserveRoom created.';
GO

-- ============================================================
-- sp_TransferRoom - Atomic Room Transfer with Pessimistic Locking
-- Release old room -> Lock new room (all dates in range)
-- Uses UPDLOCK + HOLDLOCK for concurrency safety
-- Returns: 0=SUCCESS, 1=OLD_NOT_FOUND, 2=NEW_NOT_AVAILABLE, 9=ERROR
-- ============================================================

CREATE OR ALTER PROCEDURE sp_TransferRoom
    @reservation_id       BIGINT,
    @old_room_id          BIGINT,
    @new_room_id          BIGINT,
    @checkin_date         DATE,
    @checkout_date        DATE,
    @reason               NVARCHAR(255),
    @agent_id             BIGINT = NULL,
    @result_status        INT           OUTPUT,
    @result_message       NVARCHAR(500) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @night_count      INT;
    DECLARE @i                INT = 0;
    DECLARE @stay_date        DATE;
    DECLARE @old_status       VARCHAR(10);
    DECLARE @new_status       VARCHAR(10);
    DECLARE @session_id       VARCHAR(100) = 'TRANSFER-' + CAST(@reservation_id AS VARCHAR);
    DECLARE @transaction_id   VARCHAR(100) = CAST(NEWID() AS VARCHAR(100));

    SET @night_count = DATEDIFF(DAY, @checkin_date, @checkout_date);

    BEGIN TRY
        BEGIN TRANSACTION;

        -- ============================================================
        -- PHASE 1: Validate & release OLD room
        -- ============================================================
        WHILE @i < @night_count
        BEGIN
            SET @stay_date = DATEADD(DAY, @i, @checkin_date);

            -- Lock old room row
            SELECT @old_status = availability_status
            FROM RoomAvailability WITH (UPDLOCK, HOLDLOCK)
            WHERE room_id = @old_room_id AND stay_date = @stay_date;

            IF @old_status IS NULL
            BEGIN
                SET @result_status = 1;
                SET @result_message = N'OLD_NOT_FOUND: No inventory for old room_id='
                    + CAST(@old_room_id AS NVARCHAR) + N', date=' + CONVERT(NVARCHAR, @stay_date, 23);

                INSERT INTO InventoryLockLog
                    (reservation_code_attempt, room_id, stay_date,
                     lock_acquired_at, lock_released_at, lock_status,
                     session_id, transaction_id, note)
                VALUES
                    (N'TRANSFER-RES-' + CAST(@reservation_id AS NVARCHAR), @old_room_id, @stay_date,
                     GETDATE(), GETDATE(), 'FAILED',
                     @session_id, @transaction_id, @result_message);

                ROLLBACK TRANSACTION;
                RETURN;
            END

            -- Release old room -> OPEN
            UPDATE RoomAvailability
            SET availability_status = 'OPEN',
                sellable_flag = 1,
                version_no = version_no + 1,
                inventory_note = N'Released by room transfer (reservation_id=' + CAST(@reservation_id AS NVARCHAR) + N')',
                updated_at = GETDATE()
            WHERE room_id = @old_room_id AND stay_date = @stay_date;

            -- Log release
            INSERT INTO InventoryLockLog
                (reservation_code_attempt, room_id, stay_date,
                 lock_acquired_at, lock_released_at, lock_status,
                 session_id, transaction_id, note)
            VALUES
                (N'TRANSFER-RES-' + CAST(@reservation_id AS NVARCHAR), @old_room_id, @stay_date,
                 GETDATE(), GETDATE(), 'RELEASED',
                 @session_id, @transaction_id,
                 N'Old room released for transfer');

            SET @i = @i + 1;
        END

        -- ============================================================
        -- PHASE 2: Lock & book NEW room
        -- ============================================================
        SET @i = 0;
        WHILE @i < @night_count
        BEGIN
            SET @stay_date = DATEADD(DAY, @i, @checkin_date);

            -- Pessimistic lock on new room
            SELECT @new_status = availability_status
            FROM RoomAvailability WITH (UPDLOCK, HOLDLOCK)
            WHERE room_id = @new_room_id AND stay_date = @stay_date;

            IF @new_status IS NULL OR @new_status <> 'OPEN'
            BEGIN
                SET @result_status = 2;
                SET @result_message = N'NEW_NOT_AVAILABLE: New room_id='
                    + CAST(@new_room_id AS NVARCHAR) + N' not available on '
                    + CONVERT(NVARCHAR, @stay_date, 23)
                    + N'. Status=' + ISNULL(@new_status, 'NULL');

                INSERT INTO InventoryLockLog
                    (reservation_code_attempt, room_id, stay_date,
                     lock_acquired_at, lock_released_at, lock_status,
                     session_id, transaction_id, note)
                VALUES
                    (N'TRANSFER-RES-' + CAST(@reservation_id AS NVARCHAR), @new_room_id, @stay_date,
                     GETDATE(), GETDATE(), 'FAILED',
                     @session_id, @transaction_id, @result_message);

                -- ROLLBACK releases the old room changes too -> atomic
                ROLLBACK TRANSACTION;
                RETURN;
            END

            -- Book new room
            UPDATE RoomAvailability
            SET availability_status = 'BOOKED',
                sellable_flag = 0,
                version_no = version_no + 1,
                inventory_note = N'Transferred from room_id=' + CAST(@old_room_id AS NVARCHAR),
                updated_at = GETDATE()
            WHERE room_id = @new_room_id AND stay_date = @stay_date;

            -- Log success
            INSERT INTO InventoryLockLog
                (reservation_code_attempt, room_id, stay_date,
                 lock_acquired_at, lock_released_at, lock_status,
                 session_id, transaction_id, note)
            VALUES
                (N'TRANSFER-RES-' + CAST(@reservation_id AS NVARCHAR), @new_room_id, @stay_date,
                 GETDATE(), GETDATE(), 'SUCCESS',
                 @session_id, @transaction_id,
                 N'New room booked via transfer');

            SET @i = @i + 1;
        END

        -- ============================================================
        -- PHASE 3: Update ReservationRoom
        -- ============================================================
        UPDATE ReservationRoom
        SET room_id = @new_room_id,
            updated_at = GETDATE()
        WHERE reservation_id = @reservation_id
          AND room_id = @old_room_id;

        -- ============================================================
        -- PHASE 4: Update physical Room status
        -- ============================================================
        UPDATE Room
        SET room_status = 'AVAILABLE',
            maintenance_status = CASE
                WHEN @reason LIKE '%issue%' OR @reason LIKE '%maintenance%' OR @reason LIKE '%repair%'
                THEN 'UNDER_REPAIR' ELSE maintenance_status END,
            updated_at = GETDATE()
        WHERE room_id = @old_room_id;

        UPDATE Room
        SET room_status = CASE
                WHEN EXISTS (SELECT 1 FROM Reservation WHERE reservation_id = @reservation_id AND reservation_status = 'CHECKED_IN')
                THEN 'OCCUPIED' ELSE 'RESERVED' END,
            updated_at = GETDATE()
        WHERE room_id = @new_room_id;

        -- ============================================================
        -- PHASE 5: Status history log
        -- ============================================================
        INSERT INTO ReservationStatusHistory
            (reservation_id, old_status, new_status, changed_by, change_reason)
        SELECT reservation_status, reservation_status, reservation_status, @agent_id,
               N'Room transferred: ' + CAST(@old_room_id AS NVARCHAR) + N' -> ' + CAST(@new_room_id AS NVARCHAR)
               + N'. Reason: ' + ISNULL(@reason, N'N/A')
        FROM Reservation WHERE reservation_id = @reservation_id;

        COMMIT TRANSACTION;

        SET @result_status = 0;
        SET @result_message = N'SUCCESS: Room transferred from room_id='
            + CAST(@old_room_id AS NVARCHAR) + N' to room_id=' + CAST(@new_room_id AS NVARCHAR);

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        BEGIN TRY
            INSERT INTO InventoryLockLog
                (reservation_code_attempt, room_id, stay_date,
                 lock_acquired_at, lock_released_at, lock_status,
                 session_id, transaction_id, note)
            VALUES
                (N'TRANSFER-RES-' + CAST(@reservation_id AS NVARCHAR), @new_room_id, @stay_date,
                 GETDATE(), GETDATE(), 'TIMEOUT',
                 @session_id, @transaction_id, ERROR_MESSAGE());
        END TRY
        BEGIN CATCH END CATCH

        SET @result_status = 9;
        SET @result_message = N'ERROR: ' + ERROR_MESSAGE();
    END CATCH
END;
GO

PRINT 'OK PROCEDURE sp_TransferRoom created.';
GO


