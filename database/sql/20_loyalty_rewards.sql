USE LuxeReserve;
GO

IF COL_LENGTH('dbo.Promotion', 'redeemable_points_cost') IS NULL
BEGIN
    ALTER TABLE dbo.Promotion
    ADD redeemable_points_cost DECIMAL(18,2) NULL;
END
GO

IF COL_LENGTH('dbo.Promotion', 'voucher_valid_days') IS NULL
BEGIN
    ALTER TABLE dbo.Promotion
    ADD voucher_valid_days INT NULL;
END
GO

IF OBJECT_ID('dbo.CK_Promo_PointsCost', 'C') IS NULL
BEGIN
    ALTER TABLE dbo.Promotion
    ADD CONSTRAINT CK_Promo_PointsCost
    CHECK (redeemable_points_cost IS NULL OR redeemable_points_cost >= 0);
END
GO

IF OBJECT_ID('dbo.CK_Promo_VoucherDays', 'C') IS NULL
BEGIN
    ALTER TABLE dbo.Promotion
    ADD CONSTRAINT CK_Promo_VoucherDays
    CHECK (voucher_valid_days IS NULL OR voucher_valid_days >= 1);
END
GO

IF OBJECT_ID('dbo.LoyaltyRedemption', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.LoyaltyRedemption (
        loyalty_redemption_id BIGINT IDENTITY(1,1) PRIMARY KEY,
        guest_id             BIGINT          NOT NULL,
        loyalty_account_id   BIGINT          NOT NULL,
        promotion_id         BIGINT          NOT NULL,
        reservation_id       BIGINT          NULL,
        issued_promo_code    VARCHAR(50)     NOT NULL,
        points_spent         DECIMAL(18,2)   NOT NULL,
        status               VARCHAR(15)     NOT NULL DEFAULT 'ISSUED',
        issued_at            DATETIME        NOT NULL DEFAULT GETDATE(),
        expires_at           DATETIME        NOT NULL,
        redeemed_at          DATETIME        NULL,
        cancelled_at         DATETIME        NULL,
        note                 NVARCHAR(255)   NULL,
        created_at           DATETIME        NOT NULL DEFAULT GETDATE(),
        updated_at           DATETIME        NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_LoyaltyRedemption_Guest FOREIGN KEY (guest_id) REFERENCES dbo.Guest(guest_id),
        CONSTRAINT FK_LoyaltyRedemption_Account FOREIGN KEY (loyalty_account_id) REFERENCES dbo.LoyaltyAccount(loyalty_account_id),
        CONSTRAINT FK_LoyaltyRedemption_Promo FOREIGN KEY (promotion_id) REFERENCES dbo.Promotion(promotion_id),
        CONSTRAINT FK_LoyaltyRedemption_Reservation FOREIGN KEY (reservation_id) REFERENCES dbo.Reservation(reservation_id),
        CONSTRAINT UQ_LoyaltyRedemption_Code UNIQUE (issued_promo_code),
        CONSTRAINT CK_LoyaltyRedemption_Status CHECK (status IN ('ISSUED','REDEEMED','EXPIRED','CANCELLED')),
        CONSTRAINT CK_LoyaltyRedemption_Points CHECK (points_spent >= 0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LoyaltyRedemption_GuestStatus' AND object_id = OBJECT_ID('dbo.LoyaltyRedemption'))
BEGIN
    CREATE INDEX IX_LoyaltyRedemption_GuestStatus
    ON dbo.LoyaltyRedemption(guest_id, status, expires_at);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LoyaltyRedemption_PromoStatus' AND object_id = OBJECT_ID('dbo.LoyaltyRedemption'))
BEGIN
    CREATE INDEX IX_LoyaltyRedemption_PromoStatus
    ON dbo.LoyaltyRedemption(promotion_id, status);
END
GO

UPDATE dbo.Promotion
SET redeemable_points_cost = CASE promotion_code
        WHEN 'MARRIOTT-ELITE-APR' THEN 1200
        WHEN 'IC-SG-CLUB-MEMBER' THEN 900
        ELSE redeemable_points_cost
    END,
    voucher_valid_days = CASE promotion_code
        WHEN 'MARRIOTT-ELITE-APR' THEN 45
        WHEN 'IC-SG-CLUB-MEMBER' THEN 30
        ELSE voucher_valid_days
    END,
    updated_at = GETDATE()
WHERE promotion_code IN ('MARRIOTT-ELITE-APR', 'IC-SG-CLUB-MEMBER');
GO

PRINT 'Loyalty reward promotions and redemption table are ready.';
GO
