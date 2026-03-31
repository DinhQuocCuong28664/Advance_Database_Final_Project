-- ============================================================
-- LuxeReserve — 06: Seed Data
-- Sample data for demo & testing
-- ============================================================

USE LuxeReserve;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ═══════════════════════════════════
-- LOCATIONS (Hierarchy)
-- ═══════════════════════════════════
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

-- ═══════════════════════════════════
-- HOTEL CHAINS
-- ═══════════════════════════════════
SET IDENTITY_INSERT HotelChain ON;
INSERT INTO HotelChain (chain_id, chain_code, chain_name, headquarters_country_code, headquarters_city, luxury_segment, status) VALUES
(1, 'MARRIOTT',   N'Marriott International',  'US', N'Bethesda',   'ULTRA_LUXURY',     'ACTIVE'),
(2, 'IHG',        N'IHG Hotels & Resorts',    'GB', N'Denham',     'LUXURY_BUSINESS',  'ACTIVE');
SET IDENTITY_INSERT HotelChain OFF;
GO

-- ═══════════════════════════════════
-- BRANDS
-- ═══════════════════════════════════
SET IDENTITY_INSERT Brand ON;
INSERT INTO Brand (brand_id, chain_id, brand_code, brand_name, brand_positioning, star_standard, status) VALUES
(1, 1, 'RITZ',     N'The Ritz-Carlton',    N'Ultra-luxury full-service',   5, 'ACTIVE'),
(2, 1, 'W-HOTELS', N'W Hotels',            N'Luxury lifestyle',            5, 'ACTIVE'),
(3, 2, 'IC',       N'InterContinental',    N'Premium luxury business',     5, 'ACTIVE');
SET IDENTITY_INSERT Brand OFF;
GO

-- ═══════════════════════════════════
-- HOTELS
-- ═══════════════════════════════════
SET IDENTITY_INSERT Hotel ON;
INSERT INTO Hotel (hotel_id, brand_id, hotel_code, hotel_name, hotel_type, star_rating, status, timezone, currency_code, check_in_time, check_out_time, total_floors, total_rooms, location_id, address_line_1) VALUES
(1, 1, 'RITZ-HCMC-001', N'The Ritz-Carlton, Saigon',        'CITY_HOTEL',     5, 'ACTIVE', 'Asia/Ho_Chi_Minh', 'VND', '15:00', '12:00', 35, 300, 14, N'28 Dong Khoi Street'),
(2, 2, 'W-BKK-001',     N'W Bangkok',                       'CITY_HOTEL',     5, 'ACTIVE', 'Asia/Bangkok',     'THB', '15:00', '11:00', 30, 403, 16, N'106 North Sathorn Road'),
(3, 3, 'IC-SG-001',     N'InterContinental Singapore',      'BUSINESS_LUXURY',5, 'ACTIVE', 'Asia/Singapore',   'SGD', '15:00', '12:00', 25, 406, 17, N'80 Middle Road');
SET IDENTITY_INSERT Hotel OFF;
GO

-- ═══════════════════════════════════
-- HOTEL POLICIES
-- ═══════════════════════════════════
SET IDENTITY_INSERT HotelPolicy ON;
INSERT INTO HotelPolicy (policy_id, hotel_id, cancellation_policy_text, deposit_policy_text, minimum_checkin_age, effective_from, status) VALUES
(1, 1, N'Free cancellation up to 48 hours before check-in. No-show: 1 night charge.', N'Credit card guarantee required.', 18, '2025-01-01', 'ACTIVE'),
(2, 2, N'Free cancellation up to 24 hours before check-in.', N'First night deposit for peak season.', 18, '2025-01-01', 'ACTIVE'),
(3, 3, N'Free cancellation up to 72 hours before check-in for corporate rates.', N'Prepayment required for non-refundable rates.', 21, '2025-01-01', 'ACTIVE');
SET IDENTITY_INSERT HotelPolicy OFF;
GO

-- ═══════════════════════════════════
-- HOTEL AMENITIES (link to MongoDB via amenity_code)
-- ═══════════════════════════════════
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

-- ═══════════════════════════════════
-- ROOM TYPES (link to MongoDB via room_type_code)
-- ═══════════════════════════════════
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

-- ═══════════════════════════════════
-- ROOMS (Physical inventory)
-- ═══════════════════════════════════
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

-- ═══════════════════════════════════
-- ROOM AVAILABILITY (April 2026)
-- ═══════════════════════════════════
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

-- ═══════════════════════════════════
-- GUESTS
-- ═══════════════════════════════════
SET IDENTITY_INSERT Guest ON;
INSERT INTO Guest (guest_id, guest_code, title, first_name, middle_name, last_name, gender, date_of_birth, nationality_country_code, email, phone_country_code, phone_number, vip_flag) VALUES
(1, 'G-001', 'Mr.',  N'Quoc',   N'Anh',  N'Nguyen',  'MALE',   '1990-05-15', 'VN', 'quoc.nguyen@gmail.com',  '+84', '0901234567', 1),
(2, 'G-002', 'Ms.',  N'Sakura', NULL,     N'Tanaka',  'FEMALE', '1988-11-02', 'JP', 'sakura.t@yahoo.co.jp',   '+81', '09012345678',0),
(3, 'G-003', 'Mr.',  N'James',  N'R.',    N'Thompson','MALE',   '1975-03-22', 'US', 'jthompson@outlook.com',  '+1',  '2125551234', 1),
(4, 'G-004', 'Mrs.', N'Min',    NULL,     N'Park',    'FEMALE', '1992-07-10', 'KR', 'minpark@naver.com',      '+82', '01012345678',0);
SET IDENTITY_INSERT Guest OFF;
GO

-- ═══════════════════════════════════
-- GUEST PREFERENCES
-- ═══════════════════════════════════
INSERT INTO GuestPreference (guest_id, preference_type, preference_value, priority_level) VALUES
(1, 'BED',   N'King size, extra firm mattress',        'HIGH'),
(1, 'FLOOR', N'High floor (15+)',                      'HIGH'),
(1, 'VIEW',  N'City view preferred',                   'MEDIUM'),
(1, 'DIET',  N'No shellfish, Vietnamese cuisine',      'CRITICAL'),
(3, 'BED',   N'King size',                             'HIGH'),
(3, 'PILLOW',N'Hypoallergenic pillow',                 'MEDIUM'),
(3, 'VIEW',  N'Ocean/river view',                      'HIGH');
GO

-- ═══════════════════════════════════
-- LOYALTY ACCOUNTS
-- ═══════════════════════════════════
INSERT INTO LoyaltyAccount (guest_id, chain_id, membership_no, tier_code, points_balance, lifetime_points, enrollment_date, status) VALUES
(1, 1, 'MAR-PLT-001', 'PLATINUM', 125000.00, 580000.00, '2020-01-15', 'ACTIVE'),
(3, 1, 'MAR-BLK-002', 'BLACK',    450000.00, 2100000.00,'2015-06-01', 'ACTIVE'),
(2, 2, 'IHG-GLD-001', 'GOLD',     35000.00,  120000.00, '2022-03-10', 'ACTIVE');
GO

-- ═══════════════════════════════════
-- SYSTEM USERS
-- ═══════════════════════════════════
SET IDENTITY_INSERT SystemUser ON;
INSERT INTO SystemUser (user_id, hotel_id, username, password_hash, full_name, email, department, account_status) VALUES
(1, 1, 'admin',          'hashed_pw_admin',  N'System Admin',         'admin@luxereserve.com',           'IT',           'ACTIVE'),
(2, 1, 'fd.nguyen',      'hashed_pw_fd01',   N'Nguyen Thi Mai',      'mai.nguyen@ritzcarlton-sgn.com',  'FRONT_OFFICE', 'ACTIVE'),
(3, 1, 'rev.tran',       'hashed_pw_rev01',  N'Tran Van Duc',        'duc.tran@ritzcarlton-sgn.com',    'FINANCE',      'ACTIVE'),
(4, 2, 'fd.somchai',     'hashed_pw_fd02',   N'Somchai Paticharoen', 'somchai@wbangkok.com',            'FRONT_OFFICE', 'ACTIVE'),
(5, 3, 'fd.lim',         'hashed_pw_fd03',   N'Lim Wei Ming',       'weiming@ic-singapore.com',        'FRONT_OFFICE', 'ACTIVE');
SET IDENTITY_INSERT SystemUser OFF;
GO

-- ═══════════════════════════════════
-- ROLES & USER ROLES
-- ═══════════════════════════════════
SET IDENTITY_INSERT Role ON;
INSERT INTO Role (role_id, role_code, role_name) VALUES
(1, 'ADMIN',        N'System Administrator'),
(2, 'FRONT_DESK',   N'Front Desk Agent'),
(3, 'REV_MANAGER',  N'Revenue Manager'),
(4, 'HK_MANAGER',   N'Housekeeping Manager');
SET IDENTITY_INSERT Role OFF;

INSERT INTO UserRole (user_id, role_id, assigned_by) VALUES
(1, 1, NULL),
(2, 2, 1),
(3, 3, 1),
(4, 2, 1),
(5, 2, 1);
GO

-- ═══════════════════════════════════
-- BOOKING CHANNELS
-- ═══════════════════════════════════
SET IDENTITY_INSERT BookingChannel ON;
INSERT INTO BookingChannel (booking_channel_id, channel_code, channel_name, channel_type, commission_percent) VALUES
(1, 'DIRECT-WEB',   N'Official Website',     'DIRECT',       0),
(2, 'DIRECT-APP',   N'Mobile App',           'DIRECT',       0),
(3, 'BOOKING-COM',  N'Booking.com',          'OTA',          15),
(4, 'EXPEDIA',      N'Expedia Group',        'OTA',          18),
(5, 'AMEX-GBT',     N'Amex GBT Corporate',  'CORPORATE',    8);
SET IDENTITY_INSERT BookingChannel OFF;
GO

-- ═══════════════════════════════════
-- RATE PLANS
-- ═══════════════════════════════════
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

-- ═══════════════════════════════════
-- ROOM RATES (April 2026 — 14 days)
-- ═══════════════════════════════════
DECLARE @rd DATE = '2026-04-01';
WHILE @rd <= '2026-04-14'
BEGIN
    INSERT INTO RoomRate (hotel_id, room_type_id, rate_plan_id, rate_date, base_rate, final_rate, price_source, demand_level, created_by) VALUES
    -- Ritz-Carlton
    (1, 1, 1, @rd, 4500000,  4500000,  'MANUAL', 'NORMAL', 3),
    (1, 1, 2, @rd, 4500000,  3600000,  'MANUAL', 'NORMAL', 3),  -- NR: -20%
    (1, 2, 1, @rd, 12000000, 12000000, 'MANUAL', 'NORMAL', 3),
    (1, 3, 1, @rd, 45000000, 45000000, 'MANUAL', 'HIGH',   3),
    -- W Bangkok
    (2, 4, 4, @rd, 8500,     8500,     'MANUAL', 'NORMAL', NULL),
    (2, 5, 4, @rd, 35000,    35000,    'MANUAL', 'NORMAL', NULL),
    -- IC Singapore
    (3, 6, 5, @rd, 480,      480,      'MANUAL', 'NORMAL', NULL),
    (3, 7, 5, @rd, 2800,     2800,     'MANUAL', 'HIGH',   NULL);

    SET @rd = DATEADD(DAY, 1, @rd);
END
GO

-- ═══════════════════════════════════
-- SERVICE CATALOG
-- ═══════════════════════════════════
INSERT INTO ServiceCatalog (hotel_id, service_code, service_name, service_category, pricing_model, base_price, description_short) VALUES
(1, 'SVC-SPA-VIP',    N'VIP Signature Spa Treatment',    'SPA',              'PER_PERSON', 3500000, N'90-minute luxury spa with Vietnamese herbs'),
(1, 'SVC-TRANSFER',   N'Airport Rolls-Royce Transfer',   'AIRPORT_TRANSFER', 'PER_TRIP',   5000000, N'Rolls-Royce Phantom with personal greeter'),
(1, 'SVC-BUTLER-24',  N'24h Personal Butler',            'BUTLER',           'PER_USE',    0,       N'Complimentary for suite guests'),
(1, 'SVC-DINING-PRV', N'Private Dining Experience',      'DINING',           'PER_PERSON', 8000000, N'Chef''s table with wine pairing'),
(2, 'SVC-SPA-AWAY',   N'AWAY Spa Retreat',               'SPA',              'PER_PERSON', 4500,    N'Signature Thai-inspired treatment'),
(3, 'SVC-CLUB-ACC',   N'Club Lounge Access',             'DINING',           'PER_USE',    180,     N'All-day refreshments and cocktails');
GO

-- ═══════════════════════════════════
-- SAMPLE RESERVATION (Guest 1 at Ritz-Carlton)
-- ═══════════════════════════════════
SET IDENTITY_INSERT Reservation ON;
INSERT INTO Reservation (
    reservation_id, reservation_code, hotel_id, guest_id, booking_channel_id,
    booking_source, reservation_status, checkin_date, checkout_date, nights,
    adult_count, room_count, currency_code, subtotal_amount, grand_total_amount,
    guarantee_type, purpose_of_stay, created_by_user_id
) VALUES (
    1, 'RES-20260401-001', 1, 1, 1,
    'DIRECT_WEB', 'CONFIRMED', '2026-04-05', '2026-04-08', 3,
    2, 1, 'VND', 13500000, 14850000,
    'CARD', 'LEISURE', 2
);
SET IDENTITY_INSERT Reservation OFF;

INSERT INTO ReservationRoom (
    reservation_id, room_id, room_type_id, rate_plan_id,
    stay_start_date, stay_end_date, adult_count,
    nightly_rate_snapshot, room_subtotal, tax_amount, final_amount,
    assignment_status, occupancy_status
) VALUES (
    1, 1, 1, 1,
    '2026-04-05', '2026-04-08', 2,
    4500000, 13500000, 1350000, 14850000,
    'ASSIGNED', 'RESERVED'
);

INSERT INTO ReservationGuest (reservation_id, guest_id, full_name, is_primary_guest, age_category) VALUES
(1, 1, N'Quoc Anh Nguyen', 1, 'ADULT');

INSERT INTO ReservationStatusHistory (reservation_id, old_status, new_status, changed_by, change_reason) VALUES
(1, NULL,      'PENDING',   2, N'Reservation created via website'),
(1, 'PENDING', 'CONFIRMED', 2, N'Payment authorized');

-- Mark availability as BOOKED for these dates
UPDATE RoomAvailability
SET availability_status = 'BOOKED', sellable_flag = 0, version_no = 2
WHERE room_id = 1 AND stay_date BETWEEN '2026-04-05' AND '2026-04-07';
GO

-- ═══════════════════════════════════
-- SAMPLE PAYMENT
-- ═══════════════════════════════════
INSERT INTO Payment (
    reservation_id, payment_reference, payment_type, payment_method,
    payment_status, amount, currency_code, paid_at
) VALUES (
    1, 'PAY-RITZ-20260401-001', 'DEPOSIT', 'CREDIT_CARD',
    'CAPTURED', 4500000, 'VND', '2026-04-01 10:30:00'
);
GO

PRINT '';
PRINT '══════════════════════════════════════════';
PRINT '  ✅ SEED DATA LOADED SUCCESSFULLY';
PRINT '  - 17 Locations (hierarchy)';
PRINT '  - 2 Chains, 3 Brands, 3 Hotels';
PRINT '  - 7 Room Types, 12 Rooms';
PRINT '  - 14 days availability (168 records)';
PRINT '  - 4 Guests, 3 Loyalty Accounts';
PRINT '  - 6 Rate Plans, 112 Room Rates';
PRINT '  - 6 Services, 5 System Users';
PRINT '  - 1 Sample Reservation with Payment';
PRINT '══════════════════════════════════════════';
GO
