SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID('dbo.EmailVerificationOtp', 'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE name = 'CK_EmailOtp_Purpose'
          AND parent_object_id = OBJECT_ID('dbo.EmailVerificationOtp')
    )
    BEGIN
        ALTER TABLE dbo.EmailVerificationOtp
        DROP CONSTRAINT CK_EmailOtp_Purpose;
    END;

    ALTER TABLE dbo.EmailVerificationOtp
    ADD CONSTRAINT CK_EmailOtp_Purpose
    CHECK (purpose IN ('ACTIVATE', 'BOOKING_ACCESS', 'PASSWORD_RESET'));
END;
GO

PRINT 'Email OTP purpose constraint now supports PASSWORD_RESET.';
GO
