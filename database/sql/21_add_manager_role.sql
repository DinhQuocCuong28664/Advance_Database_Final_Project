USE LuxeReserve;
GO

SET NOCOUNT ON;
GO

IF EXISTS (SELECT 1 FROM Role WHERE role_id = 3)
BEGIN
    UPDATE Role
    SET role_code = 'MANAGER',
        role_name = N'Revenue Manager'
    WHERE role_id = 3;
END
ELSE IF NOT EXISTS (SELECT 1 FROM Role WHERE role_code = 'MANAGER')
BEGIN
    INSERT INTO Role (role_id, role_code, role_name)
    VALUES (3, 'MANAGER', N'Revenue Manager');
END;
GO

IF EXISTS (SELECT 1 FROM SystemUser WHERE user_id = 3)
BEGIN
    UPDATE SystemUser
    SET hotel_id = 1,
        username = 'manager',
        password_hash = '$2b$10$wUlcEcOW/ZdUavpz3S9s0uuANC7rHtquuGbdAMIQK22iAw2lYRgfe',
        full_name = N'Manager',
        email = 'manager@luxereserve.local',
        department = 'MANAGEMENT',
        account_status = 'ACTIVE'
    WHERE user_id = 3;
END
ELSE IF NOT EXISTS (SELECT 1 FROM SystemUser WHERE username = 'manager')
BEGIN
    SET IDENTITY_INSERT SystemUser ON;
    INSERT INTO SystemUser (user_id, hotel_id, username, password_hash, full_name, email, department, account_status)
    VALUES (3, 1, 'manager', '$2b$10$wUlcEcOW/ZdUavpz3S9s0uuANC7rHtquuGbdAMIQK22iAw2lYRgfe', N'Manager', 'manager@luxereserve.local', 'MANAGEMENT', 'ACTIVE');
    SET IDENTITY_INSERT SystemUser OFF;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM UserRole ur
    JOIN Role r ON ur.role_id = r.role_id
    WHERE ur.user_id = 3 AND r.role_code = 'MANAGER'
)
BEGIN
    INSERT INTO UserRole (user_id, role_id, assigned_by)
    SELECT 3, role_id, 1
    FROM Role
    WHERE role_code = 'MANAGER';
END;
GO

PRINT '[OK] Manager role and account ensured.';
PRINT '[OK] Login: manager (see .agent/ACCOUNT.md)';
GO
