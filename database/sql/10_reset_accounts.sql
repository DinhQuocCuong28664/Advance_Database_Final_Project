SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT '============================================';
PRINT 'RESET DEMO ACCOUNTS';
PRINT 'Keep only: admin/admin, dqc/dqc, user/user';
PRINT '============================================';
GO

BEGIN TRY
    BEGIN TRANSACTION;

    -- ============================================================
    -- SYSTEM USER ACCOUNTS
    -- ============================================================
    UPDATE SystemUser
    SET hotel_id = 1,
        username = 'admin',
        password_hash = '$2b$10$0C1mLfqGHdtkQHTlpVY88uwkrDxwC45dumzeB3qyNAvqWx7jMPgxq',
        full_name = N'Admin',
        email = 'admin@luxereserve.local',
        department = 'IT',
        account_status = 'ACTIVE',
        updated_at = GETDATE()
    WHERE user_id = 1;

    UPDATE SystemUser
    SET username = CONCAT('archived_', user_id, '_', username),
        password_hash = '$2b$10$0C1mLfqGHdtkQHTlpVY88uwkrDxwC45dumzeB3qyNAvqWx7jMPgxq',
        account_status = 'DISABLED',
        updated_at = GETDATE()
    WHERE user_id <> 1
      AND username NOT LIKE 'archived[_]%';

    DELETE FROM UserRole
    WHERE user_id = 1;

    INSERT INTO UserRole (user_id, role_id, assigned_by)
    VALUES (1, 1, NULL);

    -- ============================================================
    -- GUEST LOGIN ACCOUNTS
    -- Keep exactly two guest login accounts:
    --   dqc/dqc  -> platinum loyal guest
    --   user/user -> newly-registered style guest
    -- ============================================================
    DELETE evo
    FROM EmailVerificationOtp evo
    JOIN GuestAuth ga ON evo.guest_auth_id = ga.guest_auth_id;

    DELETE FROM GuestAuth;

    UPDATE Guest
    SET guest_code = 'G-DQC',
        title = 'Mr.',
        first_name = N'Dinh',
        middle_name = N'Quoc',
        last_name = N'Cuong',
        gender = 'MALE',
        nationality_country_code = 'VN',
        email = 'dqc@luxereserve.local',
        phone_country_code = '+84',
        phone_number = '0900000001',
        vip_flag = 1,
        marketing_opt_in_flag = 1,
        updated_at = GETDATE()
    WHERE guest_id = 1;

    UPDATE Guest
    SET guest_code = 'G-USER',
        title = 'Mr.',
        first_name = N'New',
        middle_name = NULL,
        last_name = N'User',
        gender = 'UNDISCLOSED',
        nationality_country_code = 'VN',
        email = 'user@luxereserve.local',
        phone_country_code = '+84',
        phone_number = '0900000002',
        vip_flag = 0,
        marketing_opt_in_flag = 1,
        updated_at = GETDATE()
    WHERE guest_id = 2;

    INSERT INTO GuestAuth (guest_id, login_email, password_hash, account_status, email_verified_at)
    VALUES
        (1, 'dqc',  '$2b$10$4zuydSn4kEUwRwJCsPQkuesJ/MYAqmz0GGcUSXNf9LdnSmqezzGkG', 'ACTIVE', GETDATE()),
        (2, 'user', '$2b$10$GrFwrsiubaaelyLHFdEqB.s6OFAvZCiGIY0UOui73LJj.kz7TrOlu', 'ACTIVE', GETDATE());

    -- ============================================================
    -- LOYALTY
    -- guest_id = 1 => platinum loyal
    -- guest_id = 2 => no loyalty account yet
    -- ============================================================
    DELETE FROM LoyaltyAccount
    WHERE guest_id = 2;

    IF EXISTS (SELECT 1 FROM LoyaltyAccount WHERE guest_id = 1 AND chain_id = 1)
    BEGIN
        UPDATE LoyaltyAccount
        SET membership_no = 'MAR-PLT-DQC',
            tier_code = 'PLATINUM',
            points_balance = 150000.00,
            lifetime_points = 650000.00,
            enrollment_date = '2020-01-15',
            status = 'ACTIVE',
            updated_at = GETDATE()
        WHERE guest_id = 1
          AND chain_id = 1;
    END
    ELSE
    BEGIN
        INSERT INTO LoyaltyAccount (
            guest_id, chain_id, membership_no, tier_code,
            points_balance, lifetime_points, enrollment_date, status
        )
        VALUES (
            1, 1, 'MAR-PLT-DQC', 'PLATINUM',
            150000.00, 650000.00, '2020-01-15', 'ACTIVE'
        );
    END

    COMMIT TRANSACTION;
    PRINT '✅ Account reset complete.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT '❌ Account reset failed.';
    THROW;
END CATCH;
GO

PRINT 'Current system users';
SELECT user_id, username, full_name, email, account_status
FROM SystemUser
ORDER BY user_id;
GO

PRINT 'Current guest login accounts';
SELECT ga.guest_auth_id, ga.login_email, g.guest_code, g.full_name, g.email, ga.account_status
FROM GuestAuth ga
JOIN Guest g ON ga.guest_id = g.guest_id
ORDER BY ga.guest_auth_id;
GO

PRINT 'Current loyalty snapshot for reset guests';
SELECT g.guest_code, g.full_name, la.membership_no, la.tier_code, la.points_balance, la.status
FROM Guest g
LEFT JOIN LoyaltyAccount la ON g.guest_id = la.guest_id
WHERE g.guest_id IN (1, 2)
ORDER BY g.guest_id;
GO
