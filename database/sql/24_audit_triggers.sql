-- ============================================================
-- 24_audit_triggers.sql
-- Rule 14.2.4: Audit triggers for sensitive tables
-- Tables: Payment, Guest, GuestAuth
-- All changes on these tables are logged to AuditLog via trigger
-- ============================================================

USE LuxeReserve;
GO

-- ============================================================
-- trg_Payment_AuditLog
-- AFTER INSERT, UPDATE on Payment
-- Logs payment creation and status changes to AuditLog
-- ============================================================
IF OBJECT_ID('dbo.trg_Payment_AuditLog', 'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_Payment_AuditLog;
GO

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
            INSERT INTO dbo.AuditLog (
                entity_name, entity_pk, action_type,
                old_value_json, new_value_json,
                changed_by, changed_at, source_module
            )
            SELECT
                'Payment',
                CAST(i.payment_id AS VARCHAR(100)),
                'INSERT',
                NULL,
                N'{"payment_status":"' + i.payment_status
                    + N'","payment_type":"' + ISNULL(i.payment_type, '')
                    + N'","payment_method":"' + ISNULL(i.payment_method, '')
                    + N'","amount":' + CAST(ISNULL(i.amount, 0) AS NVARCHAR)
                    + N',"reservation_id":' + CAST(ISNULL(i.reservation_id, 0) AS NVARCHAR)
                    + N',"payment_reference":"' + ISNULL(i.payment_reference, '')
                    + N'"}',
                NULL,
                GETDATE(),
                'trg_Payment_AuditLog'
            FROM inserted i;

            RETURN;
        END

        -- UPDATE case: payment status changed
        IF UPDATE(payment_status)
        BEGIN
            INSERT INTO dbo.AuditLog (
                entity_name, entity_pk, action_type,
                old_value_json, new_value_json,
                changed_by, changed_at, source_module
            )
            SELECT
                'Payment',
                CAST(i.payment_id AS VARCHAR(100)),
                'STATUS_CHANGE',
                N'{"payment_status":"' + d.payment_status
                    + N'","amount":' + CAST(ISNULL(d.amount, 0) AS NVARCHAR)
                    + N'}',
                N'{"payment_status":"' + i.payment_status
                    + N'","amount":' + CAST(ISNULL(i.amount, 0) AS NVARCHAR)
                    + N',"reservation_id":' + CAST(ISNULL(i.reservation_id, 0) AS NVARCHAR)
                    + N'}',
                NULL,
                GETDATE(),
                'trg_Payment_AuditLog'
            FROM inserted i
            INNER JOIN deleted d ON i.payment_id = d.payment_id
            WHERE i.payment_status <> d.payment_status;
        END

    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg1 NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@ErrMsg1, 10, 1) WITH LOG;
    END CATCH
END;
GO

PRINT '[OK] trg_Payment_AuditLog created';
GO

-- ============================================================
-- trg_Guest_AuditLog
-- AFTER UPDATE on Guest
-- Logs profile changes (name, email, phone, VIP, document)
-- ============================================================
IF OBJECT_ID('dbo.trg_Guest_AuditLog', 'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_Guest_AuditLog;
GO

CREATE TRIGGER dbo.trg_Guest_AuditLog
ON dbo.Guest
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        -- Only log when key profile fields change
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
                NULL,
                GETDATE(),
                'trg_Guest_AuditLog'
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
GO

PRINT '[OK] trg_Guest_AuditLog created';
GO

-- ============================================================
-- trg_GuestAuth_AuditLog
-- AFTER UPDATE on GuestAuth
-- Logs auth changes: password reset, email verify, account lock
-- ============================================================
IF OBJECT_ID('dbo.trg_GuestAuth_AuditLog', 'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_GuestAuth_AuditLog;
GO

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
            NULL,
            GETDATE(),
            'trg_GuestAuth_AuditLog'
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
GO

PRINT '[OK] trg_GuestAuth_AuditLog created';
GO
