-- ============================================================
-- LuxeReserve — 01: Create Database
-- Engine: SQL Server 2022 Express
-- ============================================================

USE master;
GO

-- Drop if exists for clean re-run
IF EXISTS (SELECT name FROM sys.databases WHERE name = N'LuxeReserve')
BEGIN
    ALTER DATABASE LuxeReserve SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE LuxeReserve;
END
GO

CREATE DATABASE LuxeReserve;
GO

USE LuxeReserve;
GO

PRINT '✅ Database LuxeReserve created successfully.';
GO
