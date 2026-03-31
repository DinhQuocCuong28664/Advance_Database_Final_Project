-- ============================================================
-- LuxeReserve — 04: Triggers
-- Price Integrity Guard — AFTER UPDATE on RoomRate
-- ============================================================

USE LuxeReserve;
GO

CREATE OR ALTER TRIGGER trg_RoomRate_PriceIntegrityGuard
ON RoomRate
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Only fire when final_rate column is modified
    IF NOT UPDATE(final_rate)
        RETURN;

    BEGIN TRY
        INSERT INTO RateChangeLog (
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
            N'[AUTO] Rate change > 50% — flagged by Price Integrity Guard',
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

PRINT '✅ TRIGGER trg_RoomRate_PriceIntegrityGuard created.';
GO
