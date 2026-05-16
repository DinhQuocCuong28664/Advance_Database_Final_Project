-- =========================================================================
-- Fix AuditLog Check Constraint and Column Size
-- 
-- The trg_GuestAuth_AuditLog trigger inserts strings like 
-- 'ACCOUNT_STATUS_CHANGE' (21 chars) and 'EMAIL_VERIFIED' (14 chars).
-- 
-- 1. The action_type column was restricted to VARCHAR(15), causing truncation.
-- 2. The CK_Audit_Action constraint restricted values to ('INSERT', 'UPDATE', 
--    'DELETE', 'STATUS_CHANGE'), causing trigger failure.
-- =========================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Drop the restrictive check constraint
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Audit_Action')
BEGIN
    ALTER TABLE dbo.AuditLog DROP CONSTRAINT CK_Audit_Action;
    PRINT '[OK] Dropped constraint CK_Audit_Action from AuditLog';
END
GO

-- 2. Expand the column size to accommodate longer action types
ALTER TABLE dbo.AuditLog ALTER COLUMN action_type VARCHAR(50) NOT NULL;
PRINT '[OK] Altered column action_type to VARCHAR(50)';
GO
