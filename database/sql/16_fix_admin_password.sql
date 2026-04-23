-- ============================================================
-- 16_fix_admin_password.sql
-- Fix admin password hash to match 'admin123'
-- ============================================================
USE LuxeReserve;
GO

UPDATE SystemUser
SET password_hash = '$2b$10$OfDu8TnbUJi5s2XhHiwIVuMxrmsW0H2XhtevGWiuDQI/0CL.lzpP.'
WHERE username = 'admin';

PRINT '✅ Admin password reset to: admin123';
GO
