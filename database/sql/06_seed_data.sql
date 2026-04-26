-- ============================================================
-- LuxeReserve - 06: Consolidated Seed Data
-- Includes base network, expanded network, service catalog,
-- room features, promotions, and normalized demo access.
-- Supersedes legacy split scripts:
--   08_demo_promotions.sql
--   09_expand_network_seed.sql
--   10_reset_accounts.sql
--   13_add_cashier_account.sql
--   14_seed_service_catalog.sql
--   15_seed_room_features.sql
--   16_fix_admin_password.sql
-- ============================================================

-- ============================================================
-- LuxeReserve - 06: Seed Data
-- Sample data for demo & testing
-- ============================================================

USE LuxeReserve;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ============================================================
-- LOCATIONS (Hierarchy)
-- ============================================================
SET IDENTITY_INSERT Location ON;
INSERT INTO Location (location_id, parent_location_id, location_code, location_name, location_type, level, iso_code, timezone) VALUES
(1,    NULL, 'REG-SEA',    N'Southeast Asia',       'REGION',         0, NULL, NULL),
(2,    NULL, 'REG-EA',     N'East Asia',            'REGION',         0, NULL, NULL),
(3,    1,    'CTR-VN',     N'Vietnam',              'COUNTRY',        1, 'VN', 'Asia/Ho_Chi_Minh'),
(4,    1,    'CTR-TH',     N'Thailand',             'COUNTRY',        1, 'TH', 'Asia/Bangkok'),
(5,    1,    'CTR-SG',     N'Singapore',            'COUNTRY',        1, 'SG', 'Asia/Singapore'),
(6,    2,    'CTR-JP',     N'Japan',                'COUNTRY',        1, 'JP', 'Asia/Tokyo'),
(7,    3,    'STP-HCM',    N'Ho Chi Minh',          'STATE_PROVINCE', 2, NULL, 'Asia/Ho_Chi_Minh'),
(8,    3,    'STP-KH',     N'Khanh Hoa',            'STATE_PROVINCE', 2, NULL, 'Asia/Ho_Chi_Minh'),
(9,    4,    'STP-BKK',    N'Bangkok Metropolitan', 'STATE_PROVINCE', 2, NULL, 'Asia/Bangkok'),
(10,   7,    'CTY-HCMC',   N'Ho Chi Minh City',     'CITY',           3, NULL, 'Asia/Ho_Chi_Minh'),
(11,   8,    'CTY-NT',     N'Nha Trang',            'CITY',           3, NULL, 'Asia/Ho_Chi_Minh'),
(12,   9,    'CTY-BKK',    N'Bangkok',              'CITY',           3, NULL, 'Asia/Bangkok'),
(13,   5,    'CTY-SG',     N'Singapore City',       'CITY',           3, NULL, 'Asia/Singapore'),
(14,   10,   'DST-Q1',     N'District 1',           'DISTRICT',       4, NULL, 'Asia/Ho_Chi_Minh'),
(15,   10,   'DST-Q7',     N'District 7',           'DISTRICT',       4, NULL, 'Asia/Ho_Chi_Minh'),
(16,   12,   'DST-SILOM',  N'Silom',                'DISTRICT',       4, NULL, 'Asia/Bangkok'),
(17,   13,   'DST-MARINA', N'Marina Bay',           'DISTRICT',       4, NULL, 'Asia/Singapore');
SET IDENTITY_INSERT Location OFF;
GO

-- ============================================================
-- HOTEL CHAINS
-- ============================================================
SET IDENTITY_INSERT HotelChain ON;
INSERT INTO HotelChain (chain_id, chain_code, chain_name, headquarters_country_code, headquarters_city, luxury_segment, status) VALUES
(1, 'MARRIOTT',   N'Marriott International',  'US', N'Bethesda',   'ULTRA_LUXURY',     'ACTIVE'),
(2, 'IHG',        N'IHG Hotels & Resorts',    'GB', N'Denham',     'LUXURY_BUSINESS',  'ACTIVE');
SET IDENTITY_INSERT HotelChain OFF;
GO

-- ============================================================
-- BRANDS
-- ============================================================
SET IDENTITY_INSERT Brand ON;
INSERT INTO Brand (brand_id, chain_id, brand_code, brand_name, brand_positioning, star_standard, status) VALUES
(1, 1, 'RITZ',     N'The Ritz-Carlton',    N'Ultra-luxury full-service',   5, 'ACTIVE'),
(2, 1, 'W-HOTELS', N'W Hotels',            N'Luxury lifestyle',            5, 'ACTIVE'),
(3, 2, 'IC',       N'InterContinental',    N'Premium luxury business',     5, 'ACTIVE');
SET IDENTITY_INSERT Brand OFF;
GO

-- ============================================================
-- HOTELS (Full data - no nulls)
-- ============================================================
SET IDENTITY_INSERT Hotel ON;

INSERT INTO Hotel (
  hotel_id, brand_id, hotel_code, hotel_name, legal_name, hotel_type,
  star_rating, opening_date, status, timezone, currency_code,
  check_in_time, check_out_time, total_floors, total_rooms,
  primary_language_code, contact_email, contact_phone,
  reservation_email, reservation_phone,
  location_id, address_line_1, address_line_2, postal_code,
  latitude, longitude
) VALUES
(1, 1, 'RITZ-HCMC-001', N'The Ritz-Carlton, Saigon',
  N'Ritz-Carlton Saigon Hotel Co., Ltd.', 'CITY_HOTEL',
  5, '2015-06-15', 'ACTIVE', 'Asia/Ho_Chi_Minh', 'VND',
  '15:00', '12:00', 35, 300,
  'vi', 'info@ritzcarlton-saigon.com', '+84-28-3823-6688',
  'reservations.saigon@ritzcarlton.com', '+84-28-3823-6600',
  14, N'28 Dong Khoi Street', N'Ben Nghe Ward', '700000',
  10.7769, 106.7009),

(2, 2, 'W-BKK-001', N'W Bangkok',
  N'W Bangkok Hotel Co., Ltd.', 'CITY_HOTEL',
  5, '2012-10-01', 'ACTIVE', 'Asia/Bangkok', 'THB',
  '15:00', '11:00', 30, 403,
  'th', 'info@wbangkok.com', '+66-2-344-4000',
  'reservations@wbangkok.com', '+66-2-344-4111',
  16, N'106 North Sathorn Road', N'Silom, Bang Rak', '10500',
  13.7227, 100.5289),

(3, 3, 'IC-SG-001', N'InterContinental Singapore',
  N'InterContinental Hotels Singapore Pte. Ltd.', 'BUSINESS_LUXURY',
  5, '1995-09-01', 'ACTIVE', 'Asia/Singapore', 'SGD',
  '15:00', '12:00', 25, 406,
  'en', 'singapore@ihg.com', '+65-6338-7600',
  'reservations.singapore@ihg.com', '+65-6338-7611',
  17, N'80 Middle Road', N'Bugis, Downtown Core', '188966',
  1.2995, 103.8553);

SET IDENTITY_INSERT Hotel OFF;
GO

-- ============================================================
-- HOTEL POLICIES
-- ============================================================
SET IDENTITY_INSERT HotelPolicy ON;
INSERT INTO HotelPolicy (policy_id, hotel_id, cancellation_policy_text, deposit_policy_text, minimum_checkin_age, effective_from, status) VALUES
(1, 1, N'Free cancellation up to 48 hours before check-in. No-show: 1 night charge.', N'Credit card guarantee required.', 18, '2025-01-01', 'ACTIVE'),
(2, 2, N'Free cancellation up to 24 hours before check-in.', N'First night deposit for peak season.', 18, '2025-01-01', 'ACTIVE'),
(3, 3, N'Free cancellation up to 72 hours before check-in for corporate rates.', N'Prepayment required for non-refundable rates.', 21, '2025-01-01', 'ACTIVE');
SET IDENTITY_INSERT HotelPolicy OFF;
GO

-- ============================================================
-- HOTEL AMENITIES (link to MongoDB via amenity_code)
-- ============================================================
INSERT INTO HotelAmenity (hotel_id, amenity_code, is_complimentary, is_chargeable, base_fee, operating_hours) VALUES
(1, 'AMN-POOL-PRIV',    1, 0, NULL,      '06:00-22:00'),
(1, 'AMN-SPA-ESPA',     0, 1, 2500000,   '09:00-21:00'),
(1, 'AMN-BUTLER',       1, 0, NULL,       '24/7'),
(1, 'AMN-DINING-MICH',  0, 1, NULL,       '18:00-23:00'),
(1, 'AMN-TRANSFER',     0, 1, 3000000,   'On request'),
(2, 'AMN-POOL-PRIV',    1, 0, NULL,       '07:00-22:00'),
(2, 'AMN-SPA-AWAY',     0, 1, 3500,      '10:00-20:00'),
(2, 'AMN-CLUB-WOW',     0, 1, 5000,      '18:00-02:00'),
(3, 'AMN-POOL-PRIV',    1, 0, NULL,       '06:30-21:00'),
(3, 'AMN-SPA-CLUB',     0, 1, 250,       '09:00-21:00'),
(3, 'AMN-BUTLER',       1, 0, NULL,       '24/7');
GO

-- ============================================================
-- ROOM TYPES (link to MongoDB via room_type_code)
-- ============================================================
SET IDENTITY_INSERT RoomType ON;
INSERT INTO RoomType (room_type_id, hotel_id, room_type_code, room_type_name, category, bed_type, max_adults, max_children, max_occupancy, room_size_sqm, view_type, status) VALUES
-- Ritz-Carlton Saigon
(1, 1, 'RT-DLX-CITY',   N'Deluxe City View',            'DELUXE',             'KING', 2, 1, 3, 55,  'CITY',  'ACTIVE'),
(2, 1, 'RT-STE-RIVER',  N'Ritz-Carlton Suite River',     'SUITE',              'KING', 2, 2, 4, 120, 'OCEAN', 'ACTIVE'),
(3, 1, 'RT-PRES-SKY',   N'Presidential Skyline Suite',   'PRESIDENTIAL_SUITE', 'KING', 4, 2, 6, 300, 'CITY',  'ACTIVE'),
-- W Bangkok
(4, 2, 'RT-WONDERFUL',  N'Wonderful Room',               'DELUXE',             'KING', 2, 1, 3, 44,  'CITY',  'ACTIVE'),
(5, 2, 'RT-EWOW-STE',   N'Extreme WOW Suite',           'SUITE',              'KING', 2, 2, 4, 175, 'CITY',  'ACTIVE'),
-- InterContinental Singapore
(6, 3, 'RT-CLUB-DLX',   N'Club InterContinental Deluxe', 'DELUXE',            'TWIN', 2, 1, 3, 38,  'CITY',  'ACTIVE'),
(7, 3, 'RT-PRES-SG',    N'Presidential Suite',           'PRESIDENTIAL_SUITE', 'KING', 4, 2, 6, 220, 'CITY',  'ACTIVE');
SET IDENTITY_INSERT RoomType OFF;
GO

-- ============================================================
-- ROOMS (Physical inventory)
-- ============================================================
SET IDENTITY_INSERT Room ON;
INSERT INTO Room (room_id, hotel_id, room_type_id, room_number, floor_number, room_status, housekeeping_status) VALUES
-- Ritz-Carlton: 6 sample rooms
(1,  1, 1, '1501', 15, 'AVAILABLE', 'CLEAN'),
(2,  1, 1, '1502', 15, 'AVAILABLE', 'CLEAN'),
(3,  1, 1, '1601', 16, 'AVAILABLE', 'CLEAN'),
(4,  1, 2, '2001', 20, 'AVAILABLE', 'CLEAN'),
(5,  1, 2, '2002', 20, 'AVAILABLE', 'CLEAN'),
(6,  1, 3, '3501', 35, 'AVAILABLE', 'INSPECTED'),
-- W Bangkok: 4 sample rooms
(7,  2, 4, '801',  8,  'AVAILABLE', 'CLEAN'),
(8,  2, 4, '802',  8,  'AVAILABLE', 'CLEAN'),
(9,  2, 5, '2501', 25, 'AVAILABLE', 'CLEAN'),
-- IC Singapore: 3 sample rooms
(10, 3, 6, '1201', 12, 'AVAILABLE', 'CLEAN'),
(11, 3, 6, '1202', 12, 'AVAILABLE', 'CLEAN'),
(12, 3, 7, '2501', 25, 'AVAILABLE', 'INSPECTED');
SET IDENTITY_INSERT Room OFF;
GO

-- ============================================================
-- ROOM AVAILABILITY (April 2026)
-- ============================================================
-- Generate 14 days of availability for all rooms
DECLARE @start DATE = '2026-04-01';
DECLARE @end   DATE = '2026-04-14';
DECLARE @d     DATE = @start;

WHILE @d <= @end
BEGIN
    INSERT INTO RoomAvailability (hotel_id, room_id, stay_date, availability_status, sellable_flag)
    SELECT hotel_id, room_id, @d, 'OPEN', 1
    FROM Room;

    SET @d = DATEADD(DAY, 1, @d);
END
GO

-- ============================================================
-- GUESTS
-- ============================================================
SET IDENTITY_INSERT Guest ON;
INSERT INTO Guest (guest_id, guest_code, title, first_name, middle_name, last_name, gender, date_of_birth, nationality_country_code, email, phone_country_code, phone_number, vip_flag) VALUES
(1, 'dqc', 'Mr.', N'Dinh', N'Quoc', N'Cuong', 'MALE', '1998-01-01', 'VN', 'dqc@luxereserve.local', '+84', '0900000001', 1);
SET IDENTITY_INSERT Guest OFF;
GO

-- ============================================================
-- GUEST PREFERENCES
-- ============================================================
INSERT INTO GuestPreference (guest_id, preference_type, preference_value, priority_level) VALUES
(1, 'BED',   N'King size, extra firm mattress',        'HIGH'),
(1, 'FLOOR', N'High floor (15+)',                      'HIGH'),
(1, 'VIEW',  N'City view preferred',                   'MEDIUM');
GO

-- ============================================================
-- LOYALTY ACCOUNTS
-- ============================================================
INSERT INTO LoyaltyAccount (guest_id, chain_id, membership_no, tier_code, points_balance, lifetime_points, enrollment_date, status) VALUES
(1, 1, 'MAR-PLT-DQC', 'PLATINUM', 150000.00, 650000.00, '2020-01-15', 'ACTIVE');
GO

-- ============================================================
-- GUEST AUTH
-- Demo login:
--   dqc / dqc
-- ============================================================
INSERT INTO GuestAuth (guest_id, login_email, password_hash, account_status, email_verified_at) VALUES
(1, 'dqc@luxereserve.local', '$2b$10$YPOMA6bXP0aBwnuckX1.4OiYRHnG.YuLHC5dzNYN3jDAE4ZKGD5Ai', 'ACTIVE', GETDATE());
GO

-- ============================================================
-- SYSTEM USERS
-- ============================================================
SET IDENTITY_INSERT SystemUser ON;
INSERT INTO SystemUser (user_id, hotel_id, username, password_hash, full_name, email, department, account_status) VALUES
(1, 1, 'admin',   '$2b$10$LRArHF87Ay2k8uPTI0scPenxOBIehsGYeKOQnFgWUC/nRmr7RoK3K', N'Admin',   'admin@luxereserve.local',   'IT',           'ACTIVE'),
(2, 1, 'cashier', '$2b$10$Sml4F/p99J/tvZbRXS.CJuxBAul4U/vnkN.QMSs0YwnHiARYBlnuW', N'Cashier', 'cashier@luxereserve.local', 'FRONT_OFFICE', 'ACTIVE');
SET IDENTITY_INSERT SystemUser OFF;
GO

-- ============================================================
-- ROLES & USER ROLES
-- ============================================================
SET IDENTITY_INSERT Role ON;
INSERT INTO Role (role_id, role_code, role_name) VALUES
(1, 'ADMIN',        N'System Administrator'),
(2, 'FRONT_DESK',   N'Front Desk Agent'),
(3, 'REV_MANAGER',  N'Revenue Manager'),
(4, 'HK_MANAGER',   N'Housekeeping Manager'),
(5, 'CASHIER',      N'Cashier');
SET IDENTITY_INSERT Role OFF;

INSERT INTO UserRole (user_id, role_id, assigned_by) VALUES
(1, 1, NULL),
(2, 2, 1),
(2, 5, 1);
GO

-- ============================================================
-- BOOKING CHANNELS
-- ============================================================
SET IDENTITY_INSERT BookingChannel ON;
INSERT INTO BookingChannel (booking_channel_id, channel_code, channel_name, channel_type, commission_percent) VALUES
(1, 'DIRECT-WEB',   N'Official Website',     'DIRECT',       0),
(2, 'DIRECT-APP',   N'Mobile App',           'DIRECT',       0),
(3, 'BOOKING-COM',  N'Booking.com',          'OTA',          15),
(4, 'EXPEDIA',      N'Expedia Group',        'OTA',          18),
(5, 'AMEX-GBT',     N'Amex GBT Corporate',  'CORPORATE',    8);
SET IDENTITY_INSERT BookingChannel OFF;
GO

-- ============================================================
-- RATE PLANS
-- ============================================================
SET IDENTITY_INSERT RatePlan ON;
INSERT INTO RatePlan (rate_plan_id, hotel_id, rate_plan_code, rate_plan_name, rate_plan_type, meal_inclusion, cancellation_policy_id, is_refundable, effective_from, status) VALUES
(1, 1, 'BAR-STD',     N'Best Available Rate',     'BAR',            'BREAKFAST', 1, 1, '2025-01-01', 'ACTIVE'),
(2, 1, 'NR-ADVANCE',  N'Non-Refundable Advance',  'NON_REFUNDABLE', 'BREAKFAST', 1, 0, '2025-01-01', 'ACTIVE'),
(3, 1, 'MEMBER-PLT',  N'Platinum Member Rate',     'MEMBER',        'BREAKFAST', 1, 1, '2025-01-01', 'ACTIVE'),
(4, 2, 'BAR-STD',     N'Best Available Rate',      'BAR',           'ROOM_ONLY', 2, 1, '2025-01-01', 'ACTIVE'),
(5, 3, 'BAR-STD',     N'Best Available Rate',      'BAR',           'BREAKFAST', 3, 1, '2025-01-01', 'ACTIVE'),
(6, 3, 'CORP-STD',    N'Corporate Standard Rate',  'CORPORATE',     'BREAKFAST', 3, 1, '2025-01-01', 'ACTIVE');
SET IDENTITY_INSERT RatePlan OFF;
GO

-- ============================================================
-- ROOM RATES (April 2026 - 14 days)
-- ============================================================
DECLARE @rd DATE = '2026-04-01';
WHILE @rd <= '2026-04-14'
BEGIN
    INSERT INTO RoomRate (hotel_id, room_type_id, rate_plan_id, rate_date, base_rate, final_rate, price_source, demand_level, created_by) VALUES
    -- Ritz-Carlton
    (1, 1, 1, @rd, 4500000,  4500000,  'MANUAL', 'NORMAL', 1),
    (1, 1, 2, @rd, 4500000,  3600000,  'MANUAL', 'NORMAL', 1),  -- NR: -20%
    (1, 2, 1, @rd, 12000000, 12000000, 'MANUAL', 'NORMAL', 1),
    (1, 3, 1, @rd, 45000000, 45000000, 'MANUAL', 'HIGH',   1),
    -- W Bangkok
    (2, 4, 4, @rd, 8500,     8500,     'MANUAL', 'NORMAL', NULL),
    (2, 5, 4, @rd, 35000,    35000,    'MANUAL', 'NORMAL', NULL),
    -- IC Singapore
    (3, 6, 5, @rd, 480,      480,      'MANUAL', 'NORMAL', NULL),
    (3, 7, 5, @rd, 2800,     2800,     'MANUAL', 'HIGH',   NULL);

    SET @rd = DATEADD(DAY, 1, @rd);
END
GO

-- ============================================================
-- SERVICE CATALOG
-- ============================================================
INSERT INTO ServiceCatalog (hotel_id, service_code, service_name, service_category, pricing_model, base_price, description_short) VALUES
(1, 'SVC-SPA-VIP',    N'VIP Signature Spa Treatment',    'SPA',              'PER_PERSON', 3500000, N'90-minute luxury spa with Vietnamese herbs'),
(1, 'SVC-TRANSFER',   N'Airport Rolls-Royce Transfer',   'AIRPORT_TRANSFER', 'PER_TRIP',   5000000, N'Rolls-Royce Phantom with personal greeter'),
(1, 'SVC-BUTLER-24',  N'24h Personal Butler',            'BUTLER',           'PER_USE',    0,       N'Complimentary for suite guests'),
(1, 'SVC-DINING-PRV', N'Private Dining Experience',      'DINING',           'PER_PERSON', 8000000, N'Chef''s table with wine pairing'),
(2, 'SVC-SPA-AWAY',   N'AWAY Spa Retreat',               'SPA',              'PER_PERSON', 4500,    N'Signature Thai-inspired treatment'),
(3, 'SVC-CLUB-ACC',   N'Club Lounge Access',             'DINING',           'PER_USE',    180,     N'All-day refreshments and cocktails');
GO

-- ============================================================
-- PROMOTIONS
-- ============================================================
INSERT INTO Promotion (
  hotel_id, brand_id, promotion_code, promotion_name, promotion_type,
  discount_value, currency_code, applies_to,
  booking_start_date, booking_end_date, stay_start_date, stay_end_date,
  member_only_flag, min_nights, redeemable_points_cost, voucher_valid_days, status
) VALUES
(1, NULL, 'RC-SGN-SUITE-2026', N'Ritz-Carlton Suite Escape', 'PERCENT_OFF', 15, 'VND', 'ROOM_ONLY',
 '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 0, 2, NULL, NULL, 'ACTIVE'),
(NULL, 1, 'MARRIOTT-ELITE-APR', N'Marriott Elite Member Privilege', 'PERCENT_OFF', 18, NULL, 'ROOM_ONLY',
 '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 1, 2, 1200, 45, 'ACTIVE'),
(2, NULL, 'W-BKK-SPA-CREDIT', N'W Bangkok Spa Credit', 'VALUE_CREDIT', 3500, 'THB', 'SERVICE_ONLY',
 '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 0, 1, NULL, NULL, 'ACTIVE'),
(NULL, 3, 'IC-SG-CLUB-MEMBER', N'Club InterContinental Member Privilege', 'VALUE_CREDIT', 120, 'SGD', 'ROOM_AND_SERVICE',
 '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 1, 1, 900, 30, 'ACTIVE');
GO

-- ============================================================


-- ============================================================
-- MERGED: expand network seed
-- ============================================================

USE LuxeReserve;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

PRINT '';
PRINT '========================================';
PRINT '  Expanding LuxeReserve Hotel Network';
PRINT '========================================';
GO

SET IDENTITY_INSERT Location ON;
INSERT INTO Location (location_id, parent_location_id, location_code, location_name, location_type, level, iso_code, timezone)
SELECT v.location_id, v.parent_location_id, v.location_code, v.location_name, v.location_type, v.level, v.iso_code, v.timezone
FROM (VALUES
  (18, 3,  'STP-HN',       N'Hanoi',              'STATE_PROVINCE', 2, NULL, 'Asia/Ho_Chi_Minh'),
  (19, 3,  'STP-DN',       N'Da Nang',            'STATE_PROVINCE', 2, NULL, 'Asia/Ho_Chi_Minh'),
  (20, 3,  'STP-KG',       N'Kien Giang',         'STATE_PROVINCE', 2, NULL, 'Asia/Ho_Chi_Minh'),
  (21, 1,  'CTR-ID',       N'Indonesia',          'COUNTRY',        1, 'ID', 'Asia/Jakarta'),
  (22, 2,  'CTR-KR',       N'South Korea',        'COUNTRY',        1, 'KR', 'Asia/Seoul'),
  (23, 21, 'STP-BALI',     N'Bali',               'STATE_PROVINCE', 2, NULL, 'Asia/Makassar'),
  (24, 6,  'STP-TYO',      N'Tokyo Prefecture',   'STATE_PROVINCE', 2, NULL, 'Asia/Tokyo'),
  (25, 22, 'STP-SEOUL',    N'Seoul Capital Area', 'STATE_PROVINCE', 2, NULL, 'Asia/Seoul'),
  (26, 18, 'CTY-HAN',      N'Hanoi',              'CITY',           3, NULL, 'Asia/Ho_Chi_Minh'),
  (27, 19, 'CTY-DAD',      N'Da Nang',            'CITY',           3, NULL, 'Asia/Ho_Chi_Minh'),
  (28, 20, 'CTY-PQC',      N'Phu Quoc',           'CITY',           3, NULL, 'Asia/Ho_Chi_Minh'),
  (29, 23, 'CTY-SEMINYAK', N'Seminyak',           'CITY',           3, NULL, 'Asia/Makassar'),
  (30, 24, 'CTY-TYO',      N'Tokyo',              'CITY',           3, NULL, 'Asia/Tokyo'),
  (31, 25, 'CTY-SEOUL',    N'Seoul',              'CITY',           3, NULL, 'Asia/Seoul'),
  (32, 26, 'DST-HOANKIEM', N'Hoan Kiem',          'DISTRICT',       4, NULL, 'Asia/Ho_Chi_Minh'),
  (33, 27, 'DST-SONTRA',   N'Son Tra',            'DISTRICT',       4, NULL, 'Asia/Ho_Chi_Minh'),
  (34, 28, 'DST-DUONGTO',  N'Duong To',           'DISTRICT',       4, NULL, 'Asia/Ho_Chi_Minh'),
  (35, 29, 'DST-SEMINYAK', N'Seminyak Beach',     'DISTRICT',       4, NULL, 'Asia/Makassar'),
  (36, 30, 'DST-ROPPONGI', N'Roppongi',           'DISTRICT',       4, NULL, 'Asia/Tokyo'),
  (37, 31, 'DST-GANGNAM',  N'Gangnam',            'DISTRICT',       4, NULL, 'Asia/Seoul')
) AS v(location_id, parent_location_id, location_code, location_name, location_type, level, iso_code, timezone)
WHERE NOT EXISTS (
  SELECT 1 FROM Location l WHERE l.location_id = v.location_id
);
SET IDENTITY_INSERT Location OFF;
GO

SET IDENTITY_INSERT Hotel ON;
INSERT INTO Hotel (
  hotel_id, brand_id, hotel_code, hotel_name, legal_name, hotel_type,
  star_rating, opening_date, status, timezone, currency_code,
  check_in_time, check_out_time, total_floors, total_rooms,
  primary_language_code, contact_email, contact_phone,
  reservation_email, reservation_phone,
  location_id, address_line_1, address_line_2, postal_code,
  latitude, longitude
)
SELECT *
FROM (VALUES
  (4, 1, 'RITZ-HAN-001', N'The Ritz-Carlton, Hanoi', N'Ritz-Carlton Hanoi Hotel Co., Ltd.', 'CITY_HOTEL',
   5, '2018-09-01', 'ACTIVE', 'Asia/Ho_Chi_Minh', 'VND',
   '15:00', '12:00', 32, 280,
   'vi', 'info@ritzcarlton-hanoi.com', '+84-24-3926-8888',
   'reservations.hanoi@ritzcarlton.com', '+84-24-3926-8800',
   32, N'12 Trang Tien Street', N'French Quarter', '100000',
   CAST(21.0254 AS DECIMAL(10,7)), CAST(105.8558 AS DECIMAL(10,7))),

  (5, 3, 'IC-DAD-001', N'InterContinental Danang Sun Peninsula Resort', N'InterContinental Danang Resort Co., Ltd.', 'RESORT',
   5, '2016-05-20', 'ACTIVE', 'Asia/Ho_Chi_Minh', 'VND',
   '15:00', '12:00', 8, 180,
   'vi', 'info@icdanang.com', '+84-236-393-8888',
   'reservations.danang@ihg.com', '+84-236-393-8899',
   33, N'Bai Bac, Son Tra Peninsula', N'Tho Quang Ward', '550000',
   CAST(16.1362 AS DECIMAL(10,7)), CAST(108.2467 AS DECIMAL(10,7))),

  (6, 3, 'IC-PQC-001', N'InterContinental Phu Quoc Long Beach Resort', N'InterContinental Phu Quoc Resort Co., Ltd.', 'RESORT',
   5, '2019-06-28', 'ACTIVE', 'Asia/Ho_Chi_Minh', 'VND',
   '15:00', '12:00', 10, 260,
   'vi', 'info@icphuquoc.com', '+84-297-397-8888',
   'reservations.phuquoc@ihg.com', '+84-297-397-8899',
   34, N'Bai Truong, Long Beach', N'Duong To Commune', '920000',
   CAST(10.1406 AS DECIMAL(10,7)), CAST(103.9862 AS DECIMAL(10,7))),

  (7, 2, 'W-BALI-001', N'W Bali - Seminyak', N'W Bali Hotel Indonesia', 'RESORT',
   5, '2014-03-01', 'ACTIVE', 'Asia/Makassar', 'IDR',
   '15:00', '12:00', 7, 233,
   'id', 'info@wbali.com', '+62-361-300-0106',
   'reservations@wbali.com', '+62-361-300-0100',
   35, N'Jl. Petitenget', N'Seminyak', '80361',
   CAST(-8.6799 AS DECIMAL(10,7)), CAST(115.1512 AS DECIMAL(10,7))),

  (8, 1, 'RITZ-TYO-001', N'The Ritz-Carlton, Tokyo', N'Ritz-Carlton Tokyo K.K.', 'CITY_HOTEL',
   5, '2007-03-30', 'ACTIVE', 'Asia/Tokyo', 'JPY',
   '15:00', '12:00', 53, 245,
   'ja', 'info@ritzcarlton-tokyo.com', '+81-3-3423-8000',
   'reservations.tokyo@ritzcarlton.com', '+81-3-3423-8100',
   36, N'Tokyo Midtown 9-7-1 Akasaka', N'Minato-ku', '107-6245',
   CAST(35.6655 AS DECIMAL(10,7)), CAST(139.7310 AS DECIMAL(10,7))),

  (9, 3, 'IC-SEL-001', N'InterContinental Seoul COEX', N'InterContinental Seoul Co., Ltd.', 'BUSINESS_LUXURY',
   5, '1999-12-01', 'ACTIVE', 'Asia/Seoul', 'KRW',
   '15:00', '11:00', 30, 302,
   'ko', 'info@icseoul.com', '+82-2-3452-2500',
   'reservations.seoul@ihg.com', '+82-2-3452-2600',
   37, N'524 Bongeunsa-ro', N'Gangnam-gu', '06164',
   CAST(37.5126 AS DECIMAL(10,7)), CAST(127.0590 AS DECIMAL(10,7)))
) AS v(
  hotel_id, brand_id, hotel_code, hotel_name, legal_name, hotel_type,
  star_rating, opening_date, status, timezone, currency_code,
  check_in_time, check_out_time, total_floors, total_rooms,
  primary_language_code, contact_email, contact_phone,
  reservation_email, reservation_phone,
  location_id, address_line_1, address_line_2, postal_code,
  latitude, longitude
)
WHERE NOT EXISTS (
  SELECT 1 FROM Hotel h WHERE h.hotel_id = v.hotel_id
);
SET IDENTITY_INSERT Hotel OFF;
GO

SET IDENTITY_INSERT HotelPolicy ON;
INSERT INTO HotelPolicy (policy_id, hotel_id, cancellation_policy_text, deposit_policy_text, minimum_checkin_age, effective_from, status)
SELECT *
FROM (VALUES
  (4, 4, N'Free cancellation up to 48 hours before arrival.', N'Credit card guarantee required for all stays.', 18, '2025-01-01', 'ACTIVE'),
  (5, 5, N'Free cancellation up to 7 days before arrival during resort season.', N'One-night deposit required for premium suites.', 18, '2025-01-01', 'ACTIVE'),
  (6, 6, N'Free cancellation up to 72 hours before check-in.', N'Deposit required for suite and peak season bookings.', 18, '2025-01-01', 'ACTIVE'),
  (7, 7, N'Free cancellation up to 72 hours before arrival.', N'Credit card guarantee or deposit required for villas.', 18, '2025-01-01', 'ACTIVE'),
  (8, 8, N'Free cancellation up to 48 hours before arrival.', N'Credit card guarantee required for all bookings.', 20, '2025-01-01', 'ACTIVE'),
  (9, 9, N'Free cancellation up to 24 hours before arrival for BAR.', N'Corporate stays may require company guarantee.', 19, '2025-01-01', 'ACTIVE')
) AS v(policy_id, hotel_id, cancellation_policy_text, deposit_policy_text, minimum_checkin_age, effective_from, status)
WHERE NOT EXISTS (
  SELECT 1 FROM HotelPolicy hp WHERE hp.policy_id = v.policy_id
);
SET IDENTITY_INSERT HotelPolicy OFF;
GO

INSERT INTO HotelAmenity (hotel_id, amenity_code, is_complimentary, is_chargeable, base_fee, operating_hours)
SELECT v.hotel_id, v.amenity_code, v.is_complimentary, v.is_chargeable, v.base_fee, v.operating_hours
FROM (VALUES
  (4, 'AMN-POOL-PRIV',   1, 0, NULL,    '06:00-22:00'),
  (4, 'AMN-SPA-ESPA',    0, 1, 2800000, '09:00-21:00'),
  (4, 'AMN-BUTLER',      1, 0, NULL,    '24/7'),
  (5, 'AMN-POOL-PRIV',   1, 0, NULL,    '06:00-21:00'),
  (5, 'AMN-SPA-CLUB',    0, 1, 2200000, '09:00-21:00'),
  (5, 'AMN-TRANSFER',    0, 1, 1800000, 'On request'),
  (6, 'AMN-POOL-PRIV',   1, 0, NULL,    '06:00-22:00'),
  (6, 'AMN-SPA-CLUB',    0, 1, 1800000, '09:00-21:00'),
  (6, 'AMN-BUTLER',      1, 0, NULL,    '24/7'),
  (7, 'AMN-POOL-PRIV',   1, 0, NULL,    '07:00-22:00'),
  (7, 'AMN-SPA-AWAY',    0, 1, 2200000, '10:00-22:00'),
  (7, 'AMN-CLUB-WOW',    0, 1, 850000,  '17:00-01:00'),
  (8, 'AMN-POOL-PRIV',   1, 0, NULL,    '06:00-22:00'),
  (8, 'AMN-SPA-ESPA',    0, 1, 38000,   '09:00-21:00'),
  (8, 'AMN-BUTLER',      1, 0, NULL,    '24/7'),
  (9, 'AMN-POOL-PRIV',   1, 0, NULL,    '06:00-22:00'),
  (9, 'AMN-SPA-CLUB',    0, 1, 320000,  '09:00-21:00'),
  (9, 'AMN-BUTLER',      1, 0, NULL,    '24/7')
) AS v(hotel_id, amenity_code, is_complimentary, is_chargeable, base_fee, operating_hours)
WHERE NOT EXISTS (
  SELECT 1
  FROM HotelAmenity ha
  WHERE ha.hotel_id = v.hotel_id AND ha.amenity_code = v.amenity_code
);
GO

SET IDENTITY_INSERT RoomType ON;
INSERT INTO RoomType (
  room_type_id, hotel_id, room_type_code, room_type_name, category, bed_type,
  max_adults, max_children, max_occupancy, room_size_sqm, view_type, status
)
SELECT *
FROM (VALUES
  (8, 4, 'RT-HN-DELUXE',      N'Hanoi Heritage Deluxe',        'DELUXE', 'KING', 2, 1, 3, 48,  'CITY',          'ACTIVE'),
  (9, 4, 'RT-HN-CARLTON',     N'Carlton Capital Suite',        'SUITE',  'KING', 2, 2, 4, 102, 'LANDMARK',      'ACTIVE'),
  (10, 5, 'RT-DN-CLASSIC',    N'Classic Peninsula Room',       'PREMIER','KING', 2, 1, 3, 70,  'OCEAN',         'ACTIVE'),
  (11, 5, 'RT-DN-PENINSULA',  N'Peninsula Suite',              'SUITE',  'KING', 2, 2, 4, 135, 'OCEAN',         'ACTIVE'),
  (12, 6, 'RT-PQ-CLASSIC',    N'Classic Long Beach Room',      'DELUXE', 'KING', 2, 1, 3, 49,  'GARDEN',        'ACTIVE'),
  (13, 6, 'RT-PQ-OCEANSTE',   N'Ocean View Suite',             'SUITE',  'KING', 2, 2, 4, 96,  'OCEAN',         'ACTIVE'),
  (14, 7, 'RT-BALI-WONDER',   N'Wonderful Garden Escape',      'DELUXE', 'KING', 2, 1, 3, 52,  'GARDEN',        'ACTIVE'),
  (15, 7, 'RT-BALI-VILLA',    N'Pool Villa Retreat',           'VILLA',  'KING', 2, 2, 4, 145, 'POOL',          'ACTIVE'),
  (16, 8, 'RT-TYO-SKYLINE',   N'Tokyo Skyline Premier',        'PREMIER','KING', 2, 1, 3, 54,  'LANDMARK',      'ACTIVE'),
  (17, 8, 'RT-TYO-CLUBSTE',   N'Club Roppongi Suite',          'SUITE',  'KING', 2, 2, 4, 110, 'LANDMARK',      'ACTIVE'),
  (18, 9, 'RT-SEL-CLUBDLX',   N'Club Deluxe Room',             'DELUXE', 'KING', 2, 1, 3, 45,  'CITY',          'ACTIVE'),
  (19, 9, 'RT-SEL-SUITE',     N'Gangnam Executive Suite',      'SUITE',  'KING', 2, 2, 4, 98,  'CITY',          'ACTIVE')
) AS v(
  room_type_id, hotel_id, room_type_code, room_type_name, category, bed_type,
  max_adults, max_children, max_occupancy, room_size_sqm, view_type, status
)
WHERE NOT EXISTS (
  SELECT 1 FROM RoomType rt WHERE rt.room_type_id = v.room_type_id
);
SET IDENTITY_INSERT RoomType OFF;
GO

SET IDENTITY_INSERT Room ON;
INSERT INTO Room (room_id, hotel_id, room_type_id, room_number, floor_number, room_status, housekeeping_status)
SELECT *
FROM (VALUES
  (13, 4, 8,  '1801', 18, 'AVAILABLE', 'CLEAN'),
  (14, 4, 8,  '1802', 18, 'AVAILABLE', 'CLEAN'),
  (15, 4, 9,  '2601', 26, 'AVAILABLE', 'INSPECTED'),
  (16, 5, 10, '301',   3, 'AVAILABLE', 'CLEAN'),
  (17, 5, 10, '302',   3, 'AVAILABLE', 'CLEAN'),
  (18, 5, 11, '701',   7, 'AVAILABLE', 'INSPECTED'),
  (19, 6, 12, '401',   4, 'AVAILABLE', 'CLEAN'),
  (20, 6, 12, '402',   4, 'AVAILABLE', 'CLEAN'),
  (21, 6, 13, '1101', 11, 'AVAILABLE', 'INSPECTED'),
  (22, 7, 14, '210',   2, 'AVAILABLE', 'CLEAN'),
  (23, 7, 14, '211',   2, 'AVAILABLE', 'CLEAN'),
  (24, 7, 15, 'V01',   1, 'AVAILABLE', 'INSPECTED'),
  (25, 8, 16, '4501', 45, 'AVAILABLE', 'CLEAN'),
  (26, 8, 16, '4502', 45, 'AVAILABLE', 'CLEAN'),
  (27, 8, 17, '5201', 52, 'AVAILABLE', 'INSPECTED'),
  (28, 9, 18, '1701', 17, 'AVAILABLE', 'CLEAN'),
  (29, 9, 18, '1702', 17, 'AVAILABLE', 'CLEAN'),
  (30, 9, 19, '2501', 25, 'AVAILABLE', 'INSPECTED')
) AS v(room_id, hotel_id, room_type_id, room_number, floor_number, room_status, housekeeping_status)
WHERE NOT EXISTS (
  SELECT 1 FROM Room r WHERE r.room_id = v.room_id
);
SET IDENTITY_INSERT Room OFF;
GO

SET IDENTITY_INSERT RatePlan ON;
INSERT INTO RatePlan (
  rate_plan_id, hotel_id, rate_plan_code, rate_plan_name, rate_plan_type,
  meal_inclusion, cancellation_policy_id, is_refundable, effective_from, status
)
SELECT *
FROM (VALUES
  (7,  4, 'BAR-STD', N'Best Available Rate', 'BAR', 'BREAKFAST', 4, 1, '2025-01-01', 'ACTIVE'),
  (8,  5, 'BAR-STD', N'Best Available Rate', 'BAR', 'BREAKFAST', 5, 1, '2025-01-01', 'ACTIVE'),
  (9,  6, 'BAR-STD', N'Best Available Rate', 'BAR', 'BREAKFAST', 6, 1, '2025-01-01', 'ACTIVE'),
  (10, 7, 'BAR-STD', N'Best Available Rate', 'BAR', 'BREAKFAST', 7, 1, '2025-01-01', 'ACTIVE'),
  (11, 8, 'BAR-STD', N'Best Available Rate', 'BAR', 'BREAKFAST', 8, 1, '2025-01-01', 'ACTIVE'),
  (12, 9, 'BAR-STD', N'Best Available Rate', 'BAR', 'BREAKFAST', 9, 1, '2025-01-01', 'ACTIVE')
) AS v(
  rate_plan_id, hotel_id, rate_plan_code, rate_plan_name, rate_plan_type,
  meal_inclusion, cancellation_policy_id, is_refundable, effective_from, status
)
WHERE NOT EXISTS (
  SELECT 1 FROM RatePlan rp WHERE rp.rate_plan_id = v.rate_plan_id
);
SET IDENTITY_INSERT RatePlan OFF;
GO

DECLARE @availDate DATE = '2026-04-01';
WHILE @availDate <= '2026-06-30'
BEGIN
  INSERT INTO RoomAvailability (hotel_id, room_id, stay_date, availability_status, sellable_flag)
  SELECT r.hotel_id, r.room_id, @availDate, 'OPEN', 1
  FROM Room r
  WHERE NOT EXISTS (
    SELECT 1
    FROM RoomAvailability ra
    WHERE ra.room_id = r.room_id
      AND ra.stay_date = @availDate
  );

  SET @availDate = DATEADD(DAY, 1, @availDate);
END;
GO

DECLARE @rateDate DATE = '2026-04-01';
WHILE @rateDate <= '2026-06-30'
BEGIN
  INSERT INTO RoomRate (
    hotel_id, room_type_id, rate_plan_id, rate_date,
    base_rate, final_rate, price_source, demand_level, created_by
  )
  SELECT m.hotel_id, m.room_type_id, m.rate_plan_id, @rateDate,
         m.base_rate, m.final_rate, 'MANUAL', m.demand_level, NULL
  FROM (VALUES
    (1, 1, 1, 4500000, 4500000, 'NORMAL'),
    (1, 1, 2, 4500000, 3600000, 'NORMAL'),
    (1, 2, 1, 12000000, 12000000, 'NORMAL'),
    (1, 3, 1, 45000000, 45000000, 'HIGH'),
    (2, 4, 4, 8500, 8500, 'NORMAL'),
    (2, 5, 4, 35000, 35000, 'HIGH'),
    (3, 6, 5, 480, 480, 'NORMAL'),
    (3, 7, 5, 2800, 2800, 'HIGH'),
    (4, 8, 7, 5200000, 5200000, 'NORMAL'),
    (4, 9, 7, 14500000, 14500000, 'HIGH'),
    (5, 10, 8, 7800000, 7800000, 'NORMAL'),
    (5, 11, 8, 18500000, 18500000, 'HIGH'),
    (6, 12, 9, 6200000, 6200000, 'NORMAL'),
    (6, 13, 9, 16800000, 16800000, 'HIGH'),
    (7, 14, 10, 4200000, 4200000, 'NORMAL'),
    (7, 15, 10, 14500000, 14500000, 'HIGH'),
    (8, 16, 11, 95000, 95000, 'NORMAL'),
    (8, 17, 11, 240000, 240000, 'HIGH'),
    (9, 18, 12, 420000, 420000, 'NORMAL'),
    (9, 19, 12, 1600000, 1600000, 'HIGH')
  ) AS m(hotel_id, room_type_id, rate_plan_id, base_rate, final_rate, demand_level)
  WHERE NOT EXISTS (
    SELECT 1
    FROM RoomRate rr
    WHERE rr.room_type_id = m.room_type_id
      AND rr.rate_plan_id = m.rate_plan_id
      AND rr.rate_date = @rateDate
  );

  SET @rateDate = DATEADD(DAY, 1, @rateDate);
END;
GO

INSERT INTO Promotion (
  hotel_id, brand_id, promotion_code, promotion_name, promotion_type,
  discount_value, currency_code, applies_to,
  booking_start_date, booking_end_date, stay_start_date, stay_end_date,
  member_only_flag, min_nights, redeemable_points_cost, voucher_valid_days, status
)
SELECT *
FROM (VALUES
  (4, NULL, 'RITZ-HAN-LONGWEEKEND', N'Hanoi Long Weekend Escape', 'PERCENT_OFF', 12, 'VND', 'ROOM_ONLY',
   '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 0, 2, NULL, NULL, 'ACTIVE'),
  (5, NULL, 'IC-DAD-SUNPENINSULA', N'Danang Peninsula Retreat', 'VALUE_CREDIT', 2500000, 'VND', 'ROOM_AND_SERVICE',
   '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 0, 2, NULL, NULL, 'ACTIVE'),
  (6, NULL, 'IC-PQC-FAMILYESCAPE', N'Phu Quoc Family Escape', 'PERCENT_OFF', 10, 'VND', 'ROOM_ONLY',
   '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 0, 3, NULL, NULL, 'ACTIVE'),
  (7, NULL, 'W-BALI-TRENDING', N'Bali Trending Stay', 'PERCENT_OFF', 15, 'IDR', 'ROOM_ONLY',
   '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 0, 2, NULL, NULL, 'ACTIVE'),
  (8, NULL, 'RITZ-TYO-SKYLINE', N'Tokyo Skyline Signature', 'VALUE_CREDIT', 18000, 'JPY', 'SERVICE_ONLY',
   '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 1, 1, NULL, NULL, 'ACTIVE'),
  (9, NULL, 'IC-SEL-BUSINESSPLUS', N'Seoul Business Plus', 'VALUE_CREDIT', 120000, 'KRW', 'ROOM_AND_SERVICE',
   '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 0, 1, NULL, NULL, 'ACTIVE')
) AS v(
  hotel_id, brand_id, promotion_code, promotion_name, promotion_type,
  discount_value, currency_code, applies_to,
  booking_start_date, booking_end_date, stay_start_date, stay_end_date,
  member_only_flag, min_nights, redeemable_points_cost, voucher_valid_days, status
)
WHERE NOT EXISTS (
  SELECT 1 FROM Promotion p WHERE p.promotion_code = v.promotion_code
);
GO

PRINT '  - Extended room availability through 2026-06-30';
PRINT '  - Added Hanoi, Da Nang, Phu Quoc, Bali, Tokyo, and Seoul';
PRINT '  - Added new room types, rate plans, and destination promotions';
GO


-- ============================================================
-- MERGED: full service catalog
-- ============================================================

-- 14_seed_service_catalog.sql (v2 - English descriptions)
USE LuxeReserve;
GO

DELETE FROM ReservationService;
DELETE FROM ServiceCatalog;
GO

-- HOTEL 1 - The Ritz-Carlton, Saigon (VND)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(1,'SPA001','VIP Signature Spa Treatment','SPA','PER_USE',3500000,'Indulgent 90-minute spa ritual with premium imported oils'),
(1,'SPA002','Deep Tissue Massage','SPA','PER_HOUR',1200000,'Therapeutic deep-pressure massage to release tension'),
(1,'SPA003','Facial & Skin Renewal','SPA','PER_USE',2200000,'Professional restorative facial and skin treatment'),
(1,'TRN001','Airport Rolls-Royce Transfer','AIRPORT_TRANSFER','PER_TRIP',5000000,'Rolls-Royce Ghost airport pickup and drop-off service'),
(1,'TRN002','City Limousine Tour','AIRPORT_TRANSFER','PER_TRIP',2800000,'Explore Ho Chi Minh City in a luxury limousine'),
(1,'BUT001','24h Personal Butler','BUTLER','PER_USE',0,'Dedicated personal butler available 24/7 throughout your stay'),
(1,'DIN001','Private Dining Experience','DINING','PER_PERSON',8000000,'7-course private dinner on the rooftop with Saigon views'),
(1,'DIN002','In-Room Breakfast Deluxe','DINING','PER_PERSON',650000,'Premium breakfast delivered to your room at 7 AM'),
(1,'DIN003','Wine & Cheese Pairing','DINING','PER_PERSON',1500000,'Curated selection of imported wines and artisan cheeses'),
(1,'WEL001','Yoga & Meditation Session','WELLNESS','PER_USE',800000,'Private yoga and meditation with a certified instructor'),
(1,'WEL002','Personal Training','WELLNESS','PER_HOUR',1000000,'One-on-one PT session in the hotel''s private gym'),
(1,'TOT001','Cu Chi Tunnels Private Tour','TOUR','PER_PERSON',2500000,'Exclusive guided tour of the historic Cu Chi Tunnels'),
(1,'TOT002','Mekong Delta Boat Trip','TOUR','PER_PERSON',3200000,'Discover the Mekong Delta by traditional wooden boat'),
(1,'EVT001','Meeting Room - Half Day','EVENT','PER_USE',4500000,'Standard meeting room for 4 hours, seats up to 10'),
(1,'OTH001','Laundry Express','OTHER','PER_USE',300000,'Express laundry and pressing service, ready in 3 hours');
GO

-- HOTEL 2 - W Bangkok (THB)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(2,'SPA001','AWAY Spa Retreat','SPA','PER_USE',4500,'Signature treatment blending Thai healing techniques'),
(2,'SPA002','Thai Herbal Compress','SPA','PER_HOUR',2200,'Traditional Thai herbal compress massage'),
(2,'TRN001','BTS Siam Station Transfer','AIRPORT_TRANSFER','PER_TRIP',800,'Hotel electric vehicle shuttle to and from BTS Siam'),
(2,'TRN002','Suvarnabhumi Airport VIP Transfer','AIRPORT_TRANSFER','PER_TRIP',3800,'Luxury sedan pickup at Suvarnabhumi International Airport'),
(2,'DIN001','Chef Table at W Kitchen','DINING','PER_PERSON',6500,'9-course Asian fusion tasting menu at the chef''s table'),
(2,'DIN002','Pool Bar Cabana Package','DINING','PER_USE',3200,'Drinks and light bites package at a poolside cabana'),
(2,'WEL001','FIT Gym Personal Training','WELLNESS','PER_HOUR',1500,'Personal training session in the state-of-the-art FIT gym'),
(2,'TOT001','Floating Market Day Trip','TOUR','PER_PERSON',2800,'Guided day trip to the iconic Damnoen Saduak floating market'),
(2,'TOT002','Grand Palace & Wat Pho Tour','TOUR','PER_PERSON',2200,'Private tour of the Royal Palace and Reclining Buddha temple'),
(2,'OTH001','Tuk-Tuk City Night Ride','OTHER','PER_USE',1200,'Guided Bangkok night tour by traditional tuk-tuk');
GO

-- HOTEL 3 - InterContinental Singapore (SGD)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(3,'DIN001','Club Lounge Access','DINING','PER_USE',180,'All-day Club Lounge access with food and beverages included'),
(3,'DIN002','Afternoon High Tea','DINING','PER_PERSON',98,'Traditional Singapore-style afternoon high tea in the lobby'),
(3,'SPA001','Remede Spa Signature','SPA','PER_USE',380,'Premium 90-minute Remede-brand signature spa treatment'),
(3,'TRN001','Changi Airport VIP Transfer','AIRPORT_TRANSFER','PER_TRIP',120,'Mercedes S-Class pickup at Changi International Airport'),
(3,'TOT001','Gardens by the Bay Night Tour','TOUR','PER_PERSON',85,'Light garden tour at Marina Bay after dark'),
(3,'TOT002','Sentosa & USS Day Trip','TOUR','PER_PERSON',200,'Day trip to Sentosa Island and Universal Studios Singapore'),
(3,'WEL001','Yoga on the Rooftop','WELLNESS','PER_USE',60,'Rooftop yoga session with panoramic Marina Bay views'),
(3,'OTH001','Concierge Restaurant Booking','OTHER','PER_USE',0,'Concierge-assisted reservation at Singapore''s top restaurants'),
(3,'OTH002','Laundry Valet Service','OTHER','PER_USE',28,'Full laundry and pressing service, returned within 4 hours');
GO

-- HOTEL 4 - The Ritz-Carlton, Hanoi (VND)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(4,'SPA001','Imperial Spa Experience','SPA','PER_USE',4200000,'Spa journey inspired by the royal heritage of Hanoi'),
(4,'SPA002','Hot Stone Therapy','SPA','PER_HOUR',1800000,'Deep-muscle relaxation using heated basalt stones'),
(4,'TRN001','Noi Bai Airport Luxury Transfer','AIRPORT_TRANSFER','PER_TRIP',4800000,'Limousine pickup and drop-off at Noi Bai International Airport'),
(4,'DIN001','Hanoi Street Food Night Tour','DINING','PER_PERSON',1200000,'Evening Hanoi street food tour led by our executive chef'),
(4,'DIN002','Rooftop Pho Experience','DINING','PER_PERSON',450000,'Authentic Hanoi pho served on the hotel rooftop'),
(4,'TOT001','Hoan Kiem Cultural Walk','TOUR','PER_PERSON',900000,'Cultural walking tour around Hoan Kiem Lake and the Old Quarter'),
(4,'TOT002','Halong Bay Day Cruise','TOUR','PER_PERSON',5500000,'Luxury day cruise through the UNESCO-listed Halong Bay'),
(4,'WEL001','Tai Chi at Hoan Kiem','WELLNESS','PER_USE',400000,'Sunrise Tai Chi class at Hoan Kiem Lake with a local master'),
(4,'BUT001','Personal Concierge Butler','BUTLER','PER_USE',0,'Dedicated concierge butler available 24/7 for all requests'),
(4,'OTH001','Traditional Ao Dai Rental','OTHER','PER_USE',600000,'Traditional Vietnamese Ao Dai rental for cultural photography');
GO

-- HOTEL 5 - InterContinental Danang (VND)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(5,'SPA001','Harnn Heritage Spa Journey','SPA','PER_USE',3800000,'Harnn-brand spa experience surrounded by natural landscape'),
(5,'SPA002','Couple Ocean View Massage','SPA','PER_USE',2600000,'Couples massage with a stunning view of Da Nang Bay'),
(5,'TRN001','Da Nang Airport Transfer','AIRPORT_TRANSFER','PER_TRIP',800000,'Luxury SUV pickup and drop-off at Da Nang Airport'),
(5,'DIN001','CITRON Restaurant Fine Dining','DINING','PER_PERSON',2200000,'French-Vietnamese fusion dining experience at CITRON'),
(5,'DIN002','Sunset Cocktail on the Cliff','DINING','PER_PERSON',800000,'Cocktails at sunset on the clifftop terrace of Sun Peninsula'),
(5,'TOT001','Ancient Hoi An Town Tour','TOUR','PER_PERSON',950000,'Private guided tour of the UNESCO Hoi An Ancient Town'),
(5,'TOT002','My Son Sanctuary Sunrise Tour','TOUR','PER_PERSON',1500000,'Sunrise tour of the UNESCO My Son Cham Sanctuary'),
(5,'WEL001','Beach Yoga at Sunrise','WELLNESS','PER_USE',500000,'Instructor-led sunrise yoga session on the beach'),
(5,'YAC001','Sunset Catamaran Cruise','YACHT','PER_PERSON',2800000,'Catamaran sunset cruise on the East Sea'),
(5,'OTH001','Water Sports Package','OTHER','PER_USE',1200000,'Water sports bundle: surfing, kayaking, and snorkeling');
GO

-- HOTEL 6 - InterContinental Phu Quoc (VND)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(6,'SPA001','Phu Quoc Coconut Spa Ritual','SPA','PER_USE',2800000,'Island-inspired coconut spa ritual unique to Phu Quoc'),
(6,'YAC001','Sunset Yacht Charter','YACHT','PER_TRIP',18000000,'Private 2-hour sunset yacht charter around the island'),
(6,'YAC002','Snorkeling Day Cruise','YACHT','PER_PERSON',2200000,'Day cruise with coral reef snorkeling around the island'),
(6,'TRN001','Phu Quoc Airport Transfer','AIRPORT_TRANSFER','PER_TRIP',600000,'Electric vehicle pickup at Phu Quoc International Airport'),
(6,'DIN001','Beach BBQ Dinner','DINING','PER_PERSON',1800000,'Fresh seafood BBQ dinner on a private beach'),
(6,'TOT001','Phu Quoc Pepper Farm Tour','TOUR','PER_PERSON',800000,'Guided tour of Phu Quoc''s famous pepper plantations'),
(6,'TOT002','North Island Explorer','TOUR','PER_PERSON',1500000,'Explore the northern island: rock streams and national park'),
(6,'WEL001','Stand-Up Paddleboard','WELLNESS','PER_HOUR',400000,'Stand-up paddleboarding along the scenic Bai Dai Beach'),
(6,'OTH001','Night Market Tuk-Tuk','OTHER','PER_USE',350000,'Guided tuk-tuk ride through Phu Quoc Night Market');
GO

-- HOTEL 7 - W Bali - Seminyak (IDR)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(7,'SPA001','AWAY Spa Balinese Journey','SPA','PER_USE',1400000,'Traditional Balinese healing ritual with frangipani oil'),
(7,'SPA002','Volcano Mud Body Wrap','SPA','PER_USE',900000,'Purifying Balinese volcanic mud body wrap treatment'),
(7,'YAC001','Sunset Boat to Tanah Lot','YACHT','PER_PERSON',750000,'Private boat transfer to watch sunset at Tanah Lot temple'),
(7,'TRN001','Ngurah Rai Airport VIP Transfer','AIRPORT_TRANSFER','PER_TRIP',600000,'Premium vehicle pickup at Bali Ngurah Rai International Airport'),
(7,'DIN001','Rooftop Dinner at WooBar','DINING','PER_PERSON',2200000,'Rooftop dinner experience at the iconic WooBar in Seminyak'),
(7,'TOT001','Ubud Rice Terrace Full Day','TOUR','PER_PERSON',1200000,'Full-day tour: Tegalalang rice terraces and craft villages'),
(7,'TOT002','Mount Batur Sunrise Trek','TOUR','PER_PERSON',1500000,'Trek the active Batur volcano to watch the sunrise at 1717m'),
(7,'WEL001','Temple Meditation Ceremony','WELLNESS','PER_USE',450000,'Guided meditation ceremony at a local Balinese temple'),
(7,'OTH001','Kecak Fire Dance Tickets','OTHER','PER_USE',350000,'Tickets to the Kecak fire dance performance at Uluwatu Temple');
GO

-- HOTEL 8 - The Ritz-Carlton, Tokyo (JPY)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(8,'SPA001','The Spa Signature Treatment','SPA','PER_USE',55000,'90-minute treatment blending Japanese and European techniques'),
(8,'DIN001','Hinokizaka Kaiseki Dinner','DINING','PER_PERSON',45000,'8-course kaiseki dinner at Hinokizaka on the 45th floor'),
(8,'DIN002','Sushi Masterclass','DINING','PER_PERSON',38000,'Hands-on sushi-making class with a Michelin-starred chef'),
(8,'TRN001','Narita Airport Limousine','AIRPORT_TRANSFER','PER_TRIP',35000,'Luxury limousine transfer from Narita International Airport'),
(8,'TRN002','Haneda Airport Limousine','AIRPORT_TRANSFER','PER_TRIP',25000,'Luxury limousine transfer from Haneda Airport'),
(8,'TOT001','Shinjuku & Shibuya Private Tour','TOUR','PER_PERSON',30000,'Private guided tour of Shinjuku and Shibuya districts'),
(8,'TOT002','Mt. Fuji & Hakone Day Trip','TOUR','PER_PERSON',65000,'Day trip to Mount Fuji, Lake Kawaguchi, and Hakone'),
(8,'WEL001','Onsen & Tea Ceremony','WELLNESS','PER_USE',18000,'Traditional onsen bathing followed by a Japanese tea ceremony'),
(8,'BUT001','Wardrobe Butler Service','BUTLER','PER_USE',0,'Professional wardrobe arrangement by a Ritz-Carlton butler'),
(8,'OTH001','Kimono Fitting & Photoshoot','OTHER','PER_USE',22000,'Kimono dressing and photoshoot in the historic Yanaka district');
GO

-- HOTEL 9 - InterContinental Seoul COEX (KRW)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(9,'SPA001','Korean Jjimjilbang Spa','SPA','PER_USE',150000,'Authentic Korean bathhouse experience with salt sauna rooms'),
(9,'SPA002','Ginseng Revitalizing Treatment','SPA','PER_HOUR',220000,'Korean ginseng-infused energy-restoring spa treatment'),
(9,'DIN001','Club InterContinental Lounge','DINING','PER_USE',120000,'All-day Club Lounge access with panoramic Seoul views'),
(9,'DIN002','Korean BBQ at Ninth Gate','DINING','PER_PERSON',180000,'Premium Korean BBQ dining experience at Ninth Gate'),
(9,'TRN001','Incheon Airport Limousine','AIRPORT_TRANSFER','PER_TRIP',250000,'Limousine transfer to and from Incheon International Airport'),
(9,'TOT001','Gyeongbokgung Palace Tour','TOUR','PER_PERSON',95000,'Guided tour of Gyeongbokgung Palace and the National Museum'),
(9,'TOT002','K-Pop & Myeongdong Night Tour','TOUR','PER_PERSON',130000,'K-pop culture experience and Myeongdong shopping district tour'),
(9,'TOT003','DMZ & JSA Border Tour','TOUR','PER_PERSON',280000,'Guided tour of the Demilitarized Zone and Joint Security Area'),
(9,'WEL001','Taekwondo Experience Class','WELLNESS','PER_USE',80000,'Taekwondo beginner class with a professional Korean master'),
(9,'OTH001','Hanbok Photoshoot','OTHER','PER_USE',75000,'Korean Hanbok fitting and photoshoot at Bukchon Hanok Village');
GO

SELECT COUNT(*) AS total_services, COUNT(DISTINCT hotel_id) AS hotels_covered FROM ServiceCatalog;
GO


-- ============================================================
-- MERGED: room features
-- ============================================================

-- ============================================================
-- 15_seed_room_features.sql
-- Seed RoomFeature data for all room types
-- Covers: VIEW, BED, BATH, TECH, AMENITY, SPACE categories
-- ============================================================
USE LuxeReserve;
GO

DELETE FROM RoomFeature;
GO

-- Helper: insert features per room_type_id
-- W Bali (hotel 1) - Seminyak Villa rooms
INSERT INTO RoomFeature (room_type_id, feature_code, feature_name, feature_category, feature_value, is_premium)
SELECT rt.room_type_id, f.feature_code, f.feature_name, f.feature_category, f.feature_value, f.is_premium
FROM RoomType rt
CROSS APPLY (VALUES
    ('OCEAN_VIEW',    'Ocean View',           'VIEW',    'Direct oceanfront',      1),
    ('KING_BED',      'King Size Bed',        'BED',     '200x200cm',              0),
    ('RAIN_SHOWER',   'Rain Shower',          'BATH',    'Overhead rainfall',      0),
    ('PRIVATE_POOL',  'Private Pool',         'AMENITY', '4x8m infinity pool',     1),
    ('SMART_TV',      'Smart TV',             'TECH',    '55" OLED',               0),
    ('WIFI_6',        'High-Speed WiFi',      'TECH',    'WiFi 6 / 500 Mbps',     0),
    ('MINIBAR',       'Minibar',              'AMENITY', 'Complimentary selection', 0),
    ('BALCONY',       'Private Balcony',      'SPACE',   'Furnished terrace',      1),
    ('SAFE_BOX',      'In-Room Safe',         'AMENITY', 'Digital keypad',         0),
    ('ESPRESSO',      'Espresso Machine',     'AMENITY', 'Nespresso Vertuo',       1)
) AS f(feature_code, feature_name, feature_category, feature_value, is_premium)
WHERE rt.hotel_id = 1;
GO

-- Ritz-Carlton Tokyo (hotel 2)
INSERT INTO RoomFeature (room_type_id, feature_code, feature_name, feature_category, feature_value, is_premium)
SELECT rt.room_type_id, f.feature_code, f.feature_name, f.feature_category, f.feature_value, f.is_premium
FROM RoomType rt
CROSS APPLY (VALUES
    ('CITY_VIEW',     'City Skyline View',    'VIEW',    'Floor-to-ceiling windows', 1),
    ('KING_BED',      'King Size Bed',        'BED',     'Premium 210x200cm',       0),
    ('SOAKING_TUB',   'Japanese Soaking Tub', 'BATH',    'Deep hinoki-style',       1),
    ('SMART_TV',      'Smart TV',             'TECH',    '65" QLED',                0),
    ('WIFI_6',        'High-Speed WiFi',      'TECH',    'WiFi 6E / 1 Gbps',       0),
    ('NESPRESSO',     'Nespresso Machine',    'AMENITY', 'Nespresso Creatista',     1),
    ('MINIBAR',       'Curated Minibar',      'AMENITY', 'Japanese whisky selection', 1),
    ('BOSE_SPEAKER',  'Bose Speaker',         'TECH',    'Bose SoundLink Flex',     0),
    ('YUKATA',        'Yukata Robe',          'AMENITY', 'Traditional cotton',      0),
    ('TURNDOWN',      'Turndown Service',     'AMENITY', 'Evening chocolate',       0)
) AS f(feature_code, feature_name, feature_category, feature_value, is_premium)
WHERE rt.hotel_id = 2;
GO

-- Marina Bay Sands SG (hotel 3)
INSERT INTO RoomFeature (room_type_id, feature_code, feature_name, feature_category, feature_value, is_premium)
SELECT rt.room_type_id, f.feature_code, f.feature_name, f.feature_category, f.feature_value, f.is_premium
FROM RoomType rt
CROSS APPLY (VALUES
    ('BAY_VIEW',      'Marina Bay View',      'VIEW',    'Iconic skyline panorama', 1),
    ('TWIN_KING',     'Twin or King Bed',     'BED',     'Pillow-top mattress',    0),
    ('MARBLE_BATH',   'Marble Bathroom',      'BATH',    'Italian marble finish',  1),
    ('SMART_TV',      'Smart TV',             'TECH',    '55" Samsung Frame',      0),
    ('WIFI_6',        'High-Speed WiFi',      'TECH',    'WiFi 6 / 800 Mbps',     0),
    ('INFINITY_POOL', 'Infinity Pool Access', 'AMENITY', 'Rooftop SkyPark',        1),
    ('DYSON',         'Dyson Hairdryer',      'AMENITY', 'Supersonic HD15',        0),
    ('WORKSPACE',     'Executive Desk',       'SPACE',   'Ergonomic workspace',    0),
    ('SAFE_BOX',      'In-Room Safe',         'AMENITY', 'Laptop-size',            0),
    ('BATHROBE',      'Plush Bathrobe',       'AMENITY', 'Egyptian cotton',        0)
) AS f(feature_code, feature_name, feature_category, feature_value, is_premium)
WHERE rt.hotel_id = 3;
GO

-- Generic features for remaining hotels (4-9)
INSERT INTO RoomFeature (room_type_id, feature_code, feature_name, feature_category, feature_value, is_premium)
SELECT rt.room_type_id, f.feature_code, f.feature_name, f.feature_category, f.feature_value, f.is_premium
FROM RoomType rt
CROSS APPLY (VALUES
    ('KING_BED',    'King Size Bed',     'BED',     'Premium mattress',     0),
    ('SMART_TV',    'Smart TV',          'TECH',    '50" LED Smart TV',     0),
    ('WIFI_6',      'High-Speed WiFi',   'TECH',    'WiFi 6 / 300 Mbps',   0),
    ('MINIBAR',     'Minibar',           'AMENITY', 'Daily restocked',      0),
    ('SAFE_BOX',    'In-Room Safe',      'AMENITY', 'Electronic keypad',    0),
    ('BATHROBE',    'Bathrobe & Slippers','AMENITY','Premium cotton',       0),
    ('RAIN_SHOWER', 'Rain Shower',       'BATH',    'Overhead rainfall',    0),
    ('WORKSPACE',   'Work Desk',         'SPACE',   'Desk with USB ports',  0)
) AS f(feature_code, feature_name, feature_category, feature_value, is_premium)
WHERE rt.hotel_id IN (4,5,6,7,8,9);
GO

PRINT 'RoomFeature seed complete';
GO

PRINT '';
PRINT '========================================';
PRINT '  CONSOLIDATED SEED COMPLETE';
PRINT '  - 9 hotels, rates, availability, promotions';
PRINT '  - full service catalog + room features';
PRINT '  - 3 login accounts: admin, cashier, dqc';
PRINT '========================================';
GO

