-- ============================================================
-- LuxeReserve - 04: Triggers
-- Price Integrity Guard - AFTER UPDATE on RoomRate
-- ============================================================

USE LuxeReserve;
GO

CREATE OR ALTER TRIGGER dbo.trg_RoomRate_PriceIntegrityGuard
ON dbo.RoomRate
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Only fire when final_rate column is modified
    IF NOT UPDATE(final_rate)
        RETURN;

    BEGIN TRY
        INSERT INTO dbo.RateChangeLog (
            room_rate_id,
            old_rate,
            new_rate,
            change_amount,
            change_percent,
            change_reason,
            triggered_at,
            triggered_by,
            severity_level,
            review_status
        )
        SELECT
            i.room_rate_id,
            d.final_rate,
            i.final_rate,
            i.final_rate - d.final_rate,
            CASE
                WHEN d.final_rate = 0 THEN 100.0000
                ELSE CAST(
                    ABS(i.final_rate - d.final_rate) * 100.0 / d.final_rate
                    AS DECIMAL(9,4)
                )
            END,
            N'[AUTO] Rate change > 50% - flagged by Price Integrity Guard',
            GETDATE(),
            i.updated_by,
            'CRITICAL',
            'OPEN'
        FROM inserted i
        INNER JOIN deleted d ON i.room_rate_id = d.room_rate_id
        WHERE d.final_rate > 0
          AND ABS(i.final_rate - d.final_rate) * 100.0 / d.final_rate > 50.0;

    END TRY
    BEGIN CATCH
        -- Log but don't block the original UPDATE
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrMsg, 10, 1) WITH LOG; -- severity 10 = informational
    END CATCH
END;
GO

PRINT 'OK TRIGGER trg_RoomRate_PriceIntegrityGuard created.';
GO

-- ============================================================
-- trg_Reservation_CancellationAudit
-- AFTER UPDATE on Reservation
-- Auto-log to AuditLog when status -> CANCELLED
-- ============================================================

CREATE OR ALTER TRIGGER dbo.trg_Reservation_CancellationAudit
ON dbo.Reservation
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Only fire when reservation_status column is modified
    IF NOT UPDATE(reservation_status)
        RETURN;

    BEGIN TRY
        INSERT INTO dbo.AuditLog (
            entity_name,
            entity_pk,
            action_type,
            old_value_json,
            new_value_json,
            changed_by,
            changed_at,
            source_module
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
            i.created_by_user_id,
            GETDATE(),
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
GO

PRINT 'OK TRIGGER trg_Reservation_CancellationAudit created.';
GO
