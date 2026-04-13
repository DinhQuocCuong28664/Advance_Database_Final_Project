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
    WHEN 'admin' THEN '$2b$10$JcsOWTu5PIkaKfo5mJOX2uTjhRd2LNeBUmTfoK9xuFIYZWBqaFeZq'
    WHEN 'fd.nguyen' THEN '$2b$10$Y2II8hvj4oUwso5gaKHBVe0qK9ad.M04TCofqPCxIlaD0iIlvaOCq'
    WHEN 'rev.tran' THEN '$2b$10$9DPo8uBPW3gVNHGD8Ce3MeHSHghUGyFuLXXqHypnhRXeXVnp/P.7a'
    WHEN 'fd.somchai' THEN '$2b$10$Y2II8hvj4oUwso5gaKHBVe0qK9ad.M04TCofqPCxIlaD0iIlvaOCq'
    WHEN 'fd.lim' THEN '$2b$10$Y2II8hvj4oUwso5gaKHBVe0qK9ad.M04TCofqPCxIlaD0iIlvaOCq'
    ELSE password_hash
END,
updated_at = GETDATE()
WHERE username IN ('admin', 'fd.nguyen', 'rev.tran', 'fd.somchai', 'fd.lim');
GO

MERGE GuestAuth AS target
USING (
    SELECT CAST(1 AS BIGINT) AS guest_id, 'quoc.nguyen@gmail.com' AS login_email,
           '$2b$10$K3Kp5MKFb48b8phwwwhokuKHshaw7hBmeW75CSXbqYiicUeMPAle2' AS password_hash
    UNION ALL
    SELECT CAST(2 AS BIGINT), 'sakura.t@yahoo.co.jp',
           '$2b$10$0tAP4OlXtTYWX4ze4PF8ReQ1S48G4vNIXcaobGU./dhsPPHA7JO6y'
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

PRINT 'Auth extension applied.';
PRINT 'Admin test credentials: admin / admin123';
PRINT 'Guest test credentials: quoc.nguyen@gmail.com / guest12345';
PRINT 'Guest test credentials: sakura.t@yahoo.co.jp / member12345';
GO
