/**
 * LuxeReserve — Full Database Reset + Account Setup
 * =====================================================
 * Chạy script này trên máy mới để đồng bộ tài khoản demo
 * 
 * Cách dùng (từ thư mục gốc project):
 *   cd src
 *   node ..\database\reset_and_setup.js
 */

const bcrypt   = require('bcryptjs');
const fs       = require('fs');
const path     = require('path');
const { execSync } = require('child_process');

const SQLCMD = `sqlcmd -S "localhost\\SQLEXPRESS" -d LuxeReserve -E`;

// ── Helper ───────────────────────────────────────────────────
function runSql(label, sqlContent) {
  const tmp = path.join(__dirname, '_tmp_reset.sql');
  fs.writeFileSync(tmp, sqlContent, 'utf8');
  console.log(`⏳ ${label}...`);
  try {
    execSync(`${SQLCMD} -i "${tmp}"`, { stdio: 'inherit' });
    console.log(`✅ ${label} done\n`);
  } finally {
    fs.unlinkSync(tmp);
  }
}

async function main() {
  console.log('\n==============================================');
  console.log(' LuxeReserve — Reset & Setup Demo Accounts');
  console.log('==============================================\n');

  // ── Step 1: Run 10_reset_accounts.sql ───────────────────────
  const resetScript = path.join(__dirname, 'sql', '10_reset_accounts.sql');
  console.log('⏳ Step 1: Resetting all accounts...');
  execSync(`${SQLCMD} -i "${resetScript}"`, { stdio: 'inherit' });
  console.log('✅ Step 1 done\n');

  // ── Step 2: Hash passwords ───────────────────────────────────
  console.log('⏳ Step 2: Generating bcrypt hashes...');
  const [adminHash, cashierHash] = await Promise.all([
    bcrypt.hash('admin',   10),
    bcrypt.hash('cashier', 10),
  ]);
  console.log('   admin   hash length:', adminHash.length);
  console.log('   cashier hash length:', cashierHash.length);
  console.log('✅ Step 2 done\n');

  // ── Step 3: Confirm admin hash ───────────────────────────────
  runSql('Step 3: Confirm admin/admin password', `
USE LuxeReserve;
UPDATE SystemUser
SET password_hash = '${adminHash}',
    username      = 'admin',
    full_name     = N'Admin',
    email         = 'admin@luxereserve.local',
    department    = 'IT',
    account_status = 'ACTIVE',
    updated_at    = GETDATE()
WHERE user_id = 1;

-- Ensure admin has ADMIN role only
DELETE FROM UserRole WHERE user_id = 1;
INSERT INTO UserRole (user_id, role_id, assigned_by)
VALUES (1, (SELECT role_id FROM Role WHERE role_code = 'ADMIN'), NULL);

SELECT username, LEFT(password_hash, 7) AS hash_prefix,
       LEN(password_hash) AS hash_len FROM SystemUser WHERE user_id = 1;
`);

  // ── Step 4: Create/reset cashier account ────────────────────
  runSql('Step 4: Create cashier/cashier (CASHIER + FRONT_DESK)', `
USE LuxeReserve;

-- Ensure roles exist
IF NOT EXISTS (SELECT 1 FROM Role WHERE role_code = 'CASHIER')
  INSERT INTO Role (role_code, role_name, description)
  VALUES ('CASHIER', 'Cashier', 'Handles payment collection and settlement');

IF NOT EXISTS (SELECT 1 FROM Role WHERE role_code = 'FRONT_DESK')
  INSERT INTO Role (role_code, role_name, description)
  VALUES ('FRONT_DESK', 'Front Desk', 'Check-in, check-out, and reservation management');

-- Remove old cashier if exists
IF EXISTS (SELECT 1 FROM SystemUser WHERE username = 'cashier')
BEGIN
  DECLARE @old BIGINT = (SELECT user_id FROM SystemUser WHERE username = 'cashier');
  DELETE FROM UserRole  WHERE user_id = @old;
  DELETE FROM SystemUser WHERE user_id = @old;
END

-- Insert new cashier
INSERT INTO SystemUser (hotel_id, username, password_hash, full_name, email, department, account_status)
VALUES (1, 'cashier', '${cashierHash}', N'Front Desk Cashier', 'cashier@luxereserve.local', 'FRONT_OFFICE', 'ACTIVE');

-- Assign roles
DECLARE @uid  BIGINT = (SELECT user_id FROM SystemUser WHERE username = 'cashier');
INSERT INTO UserRole (user_id, role_id)
  SELECT @uid, role_id FROM Role WHERE role_code IN ('CASHIER', 'FRONT_DESK');

-- Verify
SELECT u.username, u.full_name, u.account_status,
       STRING_AGG(r.role_code, ', ') AS roles
FROM SystemUser u
JOIN UserRole ur ON u.user_id = ur.user_id
JOIN Role r ON ur.role_id = r.role_id
WHERE u.username IN ('admin', 'cashier')
GROUP BY u.username, u.full_name, u.account_status
ORDER BY u.username;
`);

  // ── Done ─────────────────────────────────────────────────────
  console.log('==============================================');
  console.log(' ✅  All accounts ready!');
  console.log('----------------------------------------------');
  console.log('  admin   / admin   → /admin   (ADMIN)');
  console.log('  cashier / cashier → /cashier (CASHIER+FRONT_DESK)');
  console.log('  dqc     / dqc     → /        (Guest PLATINUM)');
  console.log('  user    / user    → /        (Guest NEW)');
  console.log('==============================================\n');
}

main().catch(e => { console.error('\n❌', e.message); process.exit(1); });
