SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.EmailVerificationOtp', 'U') IS NULL
BEGIN
    CREATE TABLE EmailVerificationOtp (
        email_otp_id      BIGINT IDENTITY(1,1) PRIMARY KEY,
        guest_auth_id     BIGINT        NOT NULL,
        otp_code          VARCHAR(10)   NOT NULL,
        purpose           VARCHAR(20)   NOT NULL DEFAULT 'ACTIVATE',
        expires_at        DATETIME      NOT NULL,
        consumed_at       DATETIME      NULL,
        created_at        DATETIME      NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_EmailOtp_GuestAuth FOREIGN KEY (guest_auth_id) REFERENCES GuestAuth(guest_auth_id),
        CONSTRAINT CK_EmailOtp_Purpose CHECK (purpose IN ('ACTIVATE'))
    );

    CREATE INDEX IX_EmailOtp_GuestAuth ON EmailVerificationOtp(guest_auth_id, created_at DESC);
END;
GO

PRINT 'Email verification table ready.';
GO
