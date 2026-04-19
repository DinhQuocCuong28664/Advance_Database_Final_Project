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
  member_only_flag, min_nights, status
)
SELECT *
FROM (VALUES
  (4, NULL, 'RITZ-HAN-LONGWEEKEND', N'Hanoi Long Weekend Escape', 'PERCENT_OFF', 12, 'VND', 'ROOM_ONLY',
   '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 0, 2, 'ACTIVE'),
  (5, NULL, 'IC-DAD-SUNPENINSULA', N'Danang Peninsula Retreat', 'VALUE_CREDIT', 2500000, 'VND', 'ROOM_AND_SERVICE',
   '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 0, 2, 'ACTIVE'),
  (6, NULL, 'IC-PQC-FAMILYESCAPE', N'Phu Quoc Family Escape', 'PERCENT_OFF', 10, 'VND', 'ROOM_ONLY',
   '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 0, 3, 'ACTIVE'),
  (7, NULL, 'W-BALI-TRENDING', N'Bali Trending Stay', 'PERCENT_OFF', 15, 'IDR', 'ROOM_ONLY',
   '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 0, 2, 'ACTIVE'),
  (8, NULL, 'RITZ-TYO-SKYLINE', N'Tokyo Skyline Signature', 'VALUE_CREDIT', 18000, 'JPY', 'SERVICE_ONLY',
   '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 1, 1, 'ACTIVE'),
  (9, NULL, 'IC-SEL-BUSINESSPLUS', N'Seoul Business Plus', 'VALUE_CREDIT', 120000, 'KRW', 'ROOM_AND_SERVICE',
   '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 0, 1, 'ACTIVE')
) AS v(
  hotel_id, brand_id, promotion_code, promotion_name, promotion_type,
  discount_value, currency_code, applies_to,
  booking_start_date, booking_end_date, stay_start_date, stay_end_date,
  member_only_flag, min_nights, status
)
WHERE NOT EXISTS (
  SELECT 1 FROM Promotion p WHERE p.promotion_code = v.promotion_code
);
GO

PRINT '  - Extended room availability through 2026-06-30';
PRINT '  - Added Hanoi, Da Nang, Phu Quoc, Bali, Tokyo, and Seoul';
PRINT '  - Added new room types, rate plans, and destination promotions';
GO
