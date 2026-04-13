USE LuxeReserve;
GO

MERGE Promotion AS target
USING (
    SELECT
      CAST(1 AS BIGINT) AS hotel_id,
      CAST(NULL AS BIGINT) AS brand_id,
      'RC-SGN-SUITE-2026' AS promotion_code,
      N'Ritz-Carlton Suite Escape' AS promotion_name,
      'PERCENT_OFF' AS promotion_type,
      CAST(15 AS DECIMAL(18,2)) AS discount_value,
      CAST('VND' AS CHAR(3)) AS currency_code,
      'ROOM_ONLY' AS applies_to,
      CAST('2026-04-01' AS DATE) AS booking_start_date,
      CAST('2026-12-31' AS DATE) AS booking_end_date,
      CAST('2026-04-01' AS DATE) AS stay_start_date,
      CAST('2026-12-31' AS DATE) AS stay_end_date,
      CAST(0 AS BIT) AS member_only_flag,
      CAST(2 AS INT) AS min_nights,
      'ACTIVE' AS status
    UNION ALL
    SELECT NULL, 1, 'MARRIOTT-ELITE-APR', N'Marriott Elite Member Privilege', 'PERCENT_OFF',
           CAST(18 AS DECIMAL(18,2)), NULL, 'ROOM_ONLY',
           '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 1, 2, 'ACTIVE'
    UNION ALL
    SELECT 2, NULL, 'W-BKK-SPA-CREDIT', N'W Bangkok Spa Credit', 'VALUE_CREDIT',
           CAST(3500 AS DECIMAL(18,2)), 'THB', 'SERVICE_ONLY',
           '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 0, 1, 'ACTIVE'
    UNION ALL
    SELECT NULL, 3, 'IC-SG-CLUB-MEMBER', N'Club InterContinental Member Privilege', 'VALUE_CREDIT',
           CAST(120 AS DECIMAL(18,2)), 'SGD', 'ROOM_AND_SERVICE',
           '2026-04-01', '2026-12-31', '2026-04-01', '2026-12-31', 1, 1, 'ACTIVE'
) AS source
ON target.promotion_code = source.promotion_code
WHEN MATCHED THEN
  UPDATE SET
    hotel_id = source.hotel_id,
    brand_id = source.brand_id,
    promotion_name = source.promotion_name,
    promotion_type = source.promotion_type,
    discount_value = source.discount_value,
    currency_code = source.currency_code,
    applies_to = source.applies_to,
    booking_start_date = source.booking_start_date,
    booking_end_date = source.booking_end_date,
    stay_start_date = source.stay_start_date,
    stay_end_date = source.stay_end_date,
    member_only_flag = source.member_only_flag,
    min_nights = source.min_nights,
    status = source.status,
    updated_at = GETDATE()
WHEN NOT MATCHED THEN
  INSERT (
    hotel_id, brand_id, promotion_code, promotion_name, promotion_type,
    discount_value, currency_code, applies_to,
    booking_start_date, booking_end_date, stay_start_date, stay_end_date,
    member_only_flag, min_nights, status
  )
  VALUES (
    source.hotel_id, source.brand_id, source.promotion_code, source.promotion_name, source.promotion_type,
    source.discount_value, source.currency_code, source.applies_to,
    source.booking_start_date, source.booking_end_date, source.stay_start_date, source.stay_end_date,
    source.member_only_flag, source.min_nights, source.status
  );
GO

PRINT 'Demo promotions applied.';
GO
