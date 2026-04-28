USE LuxeReserve;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.GuestAuth', 'U') IS NULL
BEGIN
    CREATE TABLE GuestAuth (
        guest_auth_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
        guest_id              BIGINT          NOT NULL,
        login_email           VARCHAR(150)    NOT NULL,
        password_hash         VARCHAR(255)    NOT NULL,
        account_status        VARCHAR(10)     NOT NULL DEFAULT 'ACTIVE',
        email_verified_at     DATETIME        NULL,
        last_login_at         DATETIME        NULL,
        created_at            DATETIME        NOT NULL DEFAULT GETDATE(),
        updated_at            DATETIME        NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_GuestAuth_Guest   FOREIGN KEY (guest_id) REFERENCES Guest(guest_id),
        CONSTRAINT UQ_GuestAuth_Guest   UNIQUE (guest_id),
        CONSTRAINT UQ_GuestAuth_Email   UNIQUE (login_email),
        CONSTRAINT CK_GuestAuth_Status  CHECK (account_status IN ('ACTIVE','LOCKED','DISABLED'))
    );

    CREATE INDEX IX_GuestAuth_LoginEmail ON GuestAuth(login_email);
END;
GO

UPDATE SystemUser
SET password_hash = CASE username
    WHEN 'admin' THEN '$2b$10$LRArHF87Ay2k8uPTI0scPenxOBIehsGYeKOQnFgWUC/nRmr7RoK3K'
    WHEN 'cashier' THEN '$2b$10$Sml4F/p99J/tvZbRXS.CJuxBAul4U/vnkN.QMSs0YwnHiARYBlnuW'
    WHEN 'manager' THEN '$2b$10$wUlcEcOW/ZdUavpz3S9s0uuANC7rHtquuGbdAMIQK22iAw2lYRgfe'
    ELSE password_hash
END,
updated_at = GETDATE()
WHERE username IN ('admin', 'cashier', 'manager');
GO

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
GO

PRINT '[OK] Auth extension applied.';
PRINT '[OK] Test accounts: admin, cashier, manager, dqc (see .agent/ACCOUNT.md)';
GO
