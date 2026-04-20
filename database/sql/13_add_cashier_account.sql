-- ============================================================
-- LuxeReserve — 13: Add Cashier Account
-- Role: CASHIER + FRONT_DESK (Front Desk portal only)
-- Run: sqlcmd -S localhost\SQLEXPRESS -d LuxeReserve -E -i 13_add_cashier_account.sql
-- ============================================================
USE LuxeReserve;
GO

-- ── Ensure roles exist ───────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM Role WHERE role_code = 'CASHIER')
  INSERT INTO Role (role_code, role_name, description)
  VALUES ('CASHIER', 'Cashier', 'Handles payment collection and settlement');

IF NOT EXISTS (SELECT 1 FROM Role WHERE role_code = 'FRONT_DESK')
  INSERT INTO Role (role_code, role_name, description)
  VALUES ('FRONT_DESK', 'Front Desk', 'Check-in, check-out, and reservation management');
GO

-- ── Remove cashier if already exists (idempotent) ────────────
IF EXISTS (SELECT 1 FROM SystemUser WHERE username = 'cashier')
BEGIN
  DECLARE @uid BIGINT = (SELECT user_id FROM SystemUser WHERE username = 'cashier');
  DELETE FROM UserRole WHERE user_id = @uid;
  DELETE FROM SystemUser WHERE user_id = @uid;
  PRINT '  ♻  Old cashier account removed';
END
GO

-- ── Insert cashier system user ───────────────────────────────
-- Password hash generated via Node.js bcryptjs (cost=10) for "cashier"
DECLARE @cashierHash NVARCHAR(MAX);
-- Re-generate hash at runtime to avoid PowerShell $ escaping issues
-- Run the helper: node -e "require('bcryptjs').hash('cashier',10).then(h=>console.log(h))"
-- Then replace the value below, OR use the Node.js fix script instead.
-- For now we insert a placeholder and then update via Node helper.
SET @cashierHash = '$PLACEHOLDER$';

INSERT INTO SystemUser (
  hotel_id, username, password_hash, full_name, email,
  department, account_status
)
VALUES (
  1,
  'cashier',
  @cashierHash,
  'Front Desk Cashier',
  'cashier@luxereserve.local',
  'FRONT_OFFICE',
  'ACTIVE'
);
GO

-- ── Assign roles ─────────────────────────────────────────────
DECLARE @uid BIGINT = (SELECT user_id FROM SystemUser WHERE username = 'cashier');
DECLARE @cashierRoleId BIGINT = (SELECT role_id FROM Role WHERE role_code = 'CASHIER');
DECLARE @fdRoleId      BIGINT = (SELECT role_id FROM Role WHERE role_code = 'FRONT_DESK');

INSERT INTO UserRole (user_id, role_id) VALUES (@uid, @cashierRoleId);
INSERT INTO UserRole (user_id, role_id) VALUES (@uid, @fdRoleId);

PRINT '  ✅ cashier account created with CASHIER + FRONT_DESK roles';
GO
