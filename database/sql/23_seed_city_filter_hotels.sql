-- ============================================================
-- LuxeReserve - 23: City Filter Demo Hotels
-- Purpose: add second hotels in existing cities so Search filters
-- can demonstrate city, brand, star, and price differences.
-- Safe to run multiple times.
-- ============================================================

USE LuxeReserve;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

-- ------------------------------------------------------------
-- Hotels
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM Hotel WHERE hotel_code = 'RITZ-BKK-002')
BEGIN
  INSERT INTO Hotel (
    brand_id, hotel_code, hotel_name, legal_name, hotel_type,
    star_rating, opening_date, status, timezone, currency_code,
    check_in_time, check_out_time, total_floors, total_rooms,
    primary_language_code, contact_email, contact_phone,
    reservation_email, reservation_phone,
    location_id, address_line_1, address_line_2, postal_code,
    latitude, longitude
  )
  VALUES (
    1, 'RITZ-BKK-002', N'The Ritz-Carlton, Bangkok Riverside',
    N'Ritz-Carlton Bangkok Riverside Hotel Co., Ltd.', 'CITY_HOTEL',
    5, '2020-11-01', 'ACTIVE', 'Asia/Bangkok', 'THB',
    '15:00', '12:00', 38, 260,
    'th', 'info@ritzcarlton-bangkok.com', '+66-2-888-1000',
    'reservations.bangkok@ritzcarlton.com', '+66-2-888-1111',
    16, N'88 Charoen Krung Road', N'Silom, Bang Rak', '10500',
    13.7244, 100.5142
  );
END;

IF NOT EXISTS (SELECT 1 FROM Hotel WHERE hotel_code = 'W-SG-002')
BEGIN
  INSERT INTO Hotel (
    brand_id, hotel_code, hotel_name, legal_name, hotel_type,
    star_rating, opening_date, status, timezone, currency_code,
    check_in_time, check_out_time, total_floors, total_rooms,
    primary_language_code, contact_email, contact_phone,
    reservation_email, reservation_phone,
    location_id, address_line_1, address_line_2, postal_code,
    latitude, longitude
  )
  VALUES (
    2, 'W-SG-002', N'W Singapore Marina Bay',
    N'W Singapore Marina Bay Pte. Ltd.', 'BUSINESS_LUXURY',
    5, '2019-04-18', 'ACTIVE', 'Asia/Singapore', 'SGD',
    '15:00', '12:00', 29, 310,
    'en', 'hello@wsingapore-marina.com', '+65-6800-2288',
    'reservations@wsingapore-marina.com', '+65-6800-2299',
    17, N'9 Raffles Boulevard', N'Marina Bay', '039596',
    1.2917, 103.8592
  );
END;

IF NOT EXISTS (SELECT 1 FROM Hotel WHERE hotel_code = 'W-SGN-002')
BEGIN
  INSERT INTO Hotel (
    brand_id, hotel_code, hotel_name, legal_name, hotel_type,
    star_rating, opening_date, status, timezone, currency_code,
    check_in_time, check_out_time, total_floors, total_rooms,
    primary_language_code, contact_email, contact_phone,
    reservation_email, reservation_phone,
    location_id, address_line_1, address_line_2, postal_code,
    latitude, longitude
  )
  VALUES (
    2, 'W-SGN-002', N'W Saigon Riverside',
    N'W Saigon Riverside Hotel Co., Ltd.', 'CITY_HOTEL',
    4, '2021-08-20', 'ACTIVE', 'Asia/Ho_Chi_Minh', 'VND',
    '14:00', '12:00', 24, 220,
    'vi', 'hello@wsaigon-riverside.com', '+84-28-7777-2000',
    'reservations@wsaigon-riverside.com', '+84-28-7777-2111',
    15, N'2 Nguyen Van Linh Boulevard', N'District 7', '700000',
    10.7297, 106.7217
  );
END;

DECLARE @ritzBkk BIGINT = (SELECT hotel_id FROM Hotel WHERE hotel_code = 'RITZ-BKK-002');
DECLARE @wSg BIGINT = (SELECT hotel_id FROM Hotel WHERE hotel_code = 'W-SG-002');
DECLARE @wSgn BIGINT = (SELECT hotel_id FROM Hotel WHERE hotel_code = 'W-SGN-002');

-- ------------------------------------------------------------
-- Policies
-- ------------------------------------------------------------
INSERT INTO HotelPolicy (hotel_id, cancellation_policy_text, deposit_policy_text, minimum_checkin_age, refundable_flag, effective_from, status)
SELECT v.hotel_id, v.cancellation_policy_text, v.deposit_policy_text, v.minimum_checkin_age, 1, '2025-01-01', 'ACTIVE'
FROM (VALUES
  (@ritzBkk, N'Free cancellation up to 48 hours before check-in.', N'Credit card guarantee required.', 18),
  (@wSg,     N'Free cancellation up to 72 hours before check-in.', N'One-night deposit required for peak dates.', 21),
  (@wSgn,    N'Free cancellation up to 24 hours before check-in.', N'30 percent deposit required at booking.', 18)
) AS v(hotel_id, cancellation_policy_text, deposit_policy_text, minimum_checkin_age)
WHERE NOT EXISTS (
  SELECT 1 FROM HotelPolicy hp WHERE hp.hotel_id = v.hotel_id AND hp.status = 'ACTIVE'
);

-- ------------------------------------------------------------
-- Amenities
-- ------------------------------------------------------------
INSERT INTO HotelAmenity (hotel_id, amenity_code, is_complimentary, is_chargeable, base_fee, operating_hours)
SELECT v.hotel_id, v.amenity_code, v.is_complimentary, v.is_chargeable, v.base_fee, v.operating_hours
FROM (VALUES
  (@ritzBkk, 'AMN-POOL-PRIV', 1, 0, NULL, '06:00-22:00'),
  (@ritzBkk, 'AMN-SPA-ESPA', 0, 1, 4200, '09:00-21:00'),
  (@wSg,     'AMN-POOL-PRIV', 1, 0, NULL, '06:30-22:00'),
  (@wSg,     'AMN-CLUB-WOW', 0, 1, 320, '17:00-23:00'),
  (@wSgn,    'AMN-POOL-PRIV', 1, 0, NULL, '06:00-22:00'),
  (@wSgn,    'AMN-SPA-AWAY', 0, 1, 1800000, '10:00-20:00')
) AS v(hotel_id, amenity_code, is_complimentary, is_chargeable, base_fee, operating_hours)
WHERE NOT EXISTS (
  SELECT 1 FROM HotelAmenity ha WHERE ha.hotel_id = v.hotel_id AND ha.amenity_code = v.amenity_code
);

-- ------------------------------------------------------------
-- Room types
-- ------------------------------------------------------------
INSERT INTO RoomType (hotel_id, room_type_code, room_type_name, category, bed_type, max_adults, max_children, max_occupancy, room_size_sqm, view_type, status)
SELECT v.hotel_id, v.room_type_code, v.room_type_name, v.category, v.bed_type, v.max_adults, v.max_children, v.max_occupancy, v.room_size_sqm, v.view_type, 'ACTIVE'
FROM (VALUES
  (@ritzBkk, 'RT-BKK-DLX-RIVER', N'Deluxe River View',      'DELUXE', 'KING', 2, 1, 3, 52,  'CITY'),
  (@ritzBkk, 'RT-BKK-STE-ROYAL', N'Royal Riverside Suite',  'SUITE',  'KING', 2, 2, 4, 118, 'LANDMARK'),
  (@wSg,     'RT-SG-FABULOUS',   N'Fabulous Marina Room',   'PREMIER','KING', 2, 1, 3, 45,  'CITY'),
  (@wSg,     'RT-SG-WOW',        N'WOW Marina Suite',       'SUITE',  'KING', 2, 2, 4, 105, 'OCEAN'),
  (@wSgn,    'RT-SGN-COZY',      N'Cozy City Room',         'DELUXE', 'KING', 2, 1, 3, 38,  'CITY'),
  (@wSgn,    'RT-SGN-STUDIO',    N'Riverside Studio Suite', 'SUITE',  'KING', 2, 1, 3, 70,  'CITY')
) AS v(hotel_id, room_type_code, room_type_name, category, bed_type, max_adults, max_children, max_occupancy, room_size_sqm, view_type)
WHERE NOT EXISTS (
  SELECT 1 FROM RoomType rt WHERE rt.hotel_id = v.hotel_id AND rt.room_type_code = v.room_type_code
);

-- ------------------------------------------------------------
-- Rooms
-- ------------------------------------------------------------
INSERT INTO Room (hotel_id, room_type_id, room_number, floor_number, room_status, housekeeping_status)
SELECT v.hotel_id, rt.room_type_id, v.room_number, v.floor_number, 'AVAILABLE', v.housekeeping_status
FROM (VALUES
  (@ritzBkk, 'RT-BKK-DLX-RIVER', '1201', 12, 'CLEAN'),
  (@ritzBkk, 'RT-BKK-DLX-RIVER', '1202', 12, 'CLEAN'),
  (@ritzBkk, 'RT-BKK-STE-ROYAL', '2801', 28, 'INSPECTED'),
  (@wSg,     'RT-SG-FABULOUS',   '1501', 15, 'CLEAN'),
  (@wSg,     'RT-SG-FABULOUS',   '1502', 15, 'CLEAN'),
  (@wSg,     'RT-SG-WOW',        '2901', 29, 'INSPECTED'),
  (@wSgn,    'RT-SGN-COZY',      '0901', 9,  'CLEAN'),
  (@wSgn,    'RT-SGN-COZY',      '0902', 9,  'CLEAN'),
  (@wSgn,    'RT-SGN-STUDIO',    '2101', 21, 'INSPECTED')
) AS v(hotel_id, room_type_code, room_number, floor_number, housekeeping_status)
JOIN RoomType rt ON rt.hotel_id = v.hotel_id AND rt.room_type_code = v.room_type_code
WHERE NOT EXISTS (
  SELECT 1 FROM Room r WHERE r.hotel_id = v.hotel_id AND r.room_number = v.room_number
);

-- ------------------------------------------------------------
-- Rate plans
-- ------------------------------------------------------------
INSERT INTO RatePlan (hotel_id, rate_plan_code, rate_plan_name, rate_plan_type, meal_inclusion, cancellation_policy_id, is_refundable, effective_from, status)
SELECT v.hotel_id, 'BAR-STD', N'Best Available Rate', 'BAR', v.meal_inclusion, hp.policy_id, 1, '2025-01-01', 'ACTIVE'
FROM (VALUES
  (@ritzBkk, 'BREAKFAST'),
  (@wSg,     'ROOM_ONLY'),
  (@wSgn,    'BREAKFAST')
) AS v(hotel_id, meal_inclusion)
JOIN HotelPolicy hp ON hp.hotel_id = v.hotel_id AND hp.status = 'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1 FROM RatePlan rp WHERE rp.hotel_id = v.hotel_id AND rp.rate_plan_code = 'BAR-STD'
);

-- ------------------------------------------------------------
-- Availability and rates
-- ------------------------------------------------------------
DECLARE @startDate DATE = '2026-04-01';
DECLARE @endDate DATE = '2026-06-30';
DECLARE @d DATE = @startDate;

WHILE @d <= @endDate
BEGIN
  INSERT INTO RoomAvailability (hotel_id, room_id, stay_date, availability_status, sellable_flag)
  SELECT r.hotel_id, r.room_id, @d, 'OPEN', 1
  FROM Room r
  WHERE r.hotel_id IN (@ritzBkk, @wSg, @wSgn)
    AND NOT EXISTS (
      SELECT 1 FROM RoomAvailability ra
      WHERE ra.room_id = r.room_id AND ra.stay_date = @d
    );

  INSERT INTO RoomRate (hotel_id, room_type_id, rate_plan_id, rate_date, base_rate, final_rate, price_source, demand_level, created_by)
  SELECT m.hotel_id, rt.room_type_id, rp.rate_plan_id, @d, m.base_rate, m.final_rate, 'MANUAL', m.demand_level, NULL
  FROM (VALUES
    (@ritzBkk, 'RT-BKK-DLX-RIVER', 9800,     9800,     'NORMAL'),
    (@ritzBkk, 'RT-BKK-STE-ROYAL', 42000,    42000,    'HIGH'),
    (@wSg,     'RT-SG-FABULOUS',   620,      620,      'NORMAL'),
    (@wSg,     'RT-SG-WOW',        3100,     3100,     'HIGH'),
    (@wSgn,    'RT-SGN-COZY',      3200000,  3200000,  'NORMAL'),
    (@wSgn,    'RT-SGN-STUDIO',    7800000,  7800000,  'NORMAL')
  ) AS m(hotel_id, room_type_code, base_rate, final_rate, demand_level)
  JOIN RoomType rt ON rt.hotel_id = m.hotel_id AND rt.room_type_code = m.room_type_code
  JOIN RatePlan rp ON rp.hotel_id = m.hotel_id AND rp.rate_plan_code = 'BAR-STD'
  WHERE NOT EXISTS (
    SELECT 1 FROM RoomRate rr
    WHERE rr.room_type_id = rt.room_type_id
      AND rr.rate_plan_id = rp.rate_plan_id
      AND rr.rate_date = @d
  );

  SET @d = DATEADD(DAY, 1, @d);
END;

COMMIT TRANSACTION;

PRINT 'OK: city filter demo hotels seeded.';
GO
