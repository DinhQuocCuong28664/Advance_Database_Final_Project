-- ============================================================
-- 15_seed_room_features.sql
-- Seed RoomFeature data for all room types
-- Covers: VIEW, BED, BATH, TECH, AMENITY, SPACE categories
-- ============================================================
USE LuxeReserve;
GO

DELETE FROM RoomFeature;
GO

-- ── Helper: insert features per room_type_id ──
-- W Bali (hotel 1) — Seminyak Villa rooms
INSERT INTO RoomFeature (room_type_id, feature_code, feature_name, feature_category, feature_value, is_premium)
SELECT rt.room_type_id, f.feature_code, f.feature_name, f.feature_category, f.feature_value, f.is_premium
FROM RoomType rt
CROSS APPLY (VALUES
    ('OCEAN_VIEW',    'Ocean View',           'VIEW',    'Direct oceanfront',      1),
    ('KING_BED',      'King Size Bed',        'BED',     '200×200cm',              0),
    ('RAIN_SHOWER',   'Rain Shower',          'BATH',    'Overhead rainfall',      0),
    ('PRIVATE_POOL',  'Private Pool',         'AMENITY', '4×8m infinity pool',     1),
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
    ('KING_BED',      'King Size Bed',        'BED',     'Premium 210×200cm',       0),
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

PRINT '✅ RoomFeature seed complete';
GO
