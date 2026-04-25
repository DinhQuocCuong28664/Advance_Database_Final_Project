# LuxeReserve  Bo Script T2 (SQL Server + MongoDB)

> **Dua tren**: `GlobalLuxuryHotelReservationEngine_REMAKE.groovy`
> **Database Engine**: SQL Server | MongoDB (Hybrid)
> **Muc ich**: Cung cap script hoan chinh cho nhom 3 nguoi thuc hien

---

##  Nguoi 1  SQL Server Database Architect

---

### T2.1  DDL: Guest, RoomFeature, Location (Schema & Computed Columns)

```sql
-- ============================================================
-- T2.1: CREATE TABLE  Guest, RoomFeature, Location
-- Engine: SQL Server (T-SQL)
-- ============================================================

-- -------------------------------------------------------
-- 1. Bang Location  Adjacency List (self-referencing FK)
--    [FIX-7] Hierarchy: Region > Country > State > City > District
-- -------------------------------------------------------
CREATE TABLE Location (
    location_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    parent_location_id  BIGINT NULL,
    location_code       VARCHAR(50)   NOT NULL,
    location_name       NVARCHAR(150) NOT NULL,
    location_type       VARCHAR(20)   NOT NULL,       -- REGION / COUNTRY / STATE_PROVINCE / CITY / DISTRICT
    level               INT           NOT NULL,       -- 0=Region, 1=Country, 2=State, 3=City, 4=District
    iso_code            VARCHAR(10)   NULL,           -- ISO 3166 (VD: VN, US, SG)
    latitude            DECIMAL(10,7) NULL,
    longitude           DECIMAL(10,7) NULL,
    timezone            VARCHAR(64)   NULL,
    created_at          DATETIME      NOT NULL DEFAULT GETDATE(),
    updated_at          DATETIME      NOT NULL DEFAULT GETDATE(),

    -- Constraints
    CONSTRAINT UQ_Location_Code        UNIQUE (location_code),
    CONSTRAINT FK_Location_Parent      FOREIGN KEY (parent_location_id) REFERENCES Location(location_id),
    CONSTRAINT CK_Location_Type        CHECK (location_type IN ('REGION','COUNTRY','STATE_PROVINCE','CITY','DISTRICT')),
    CONSTRAINT CK_Location_Level       CHECK (level BETWEEN 0 AND 4)
);

-- Index ho tro Recursive CTE
CREATE INDEX IX_Location_Parent  ON Location(parent_location_id);
CREATE INDEX IX_Location_TypeName ON Location(location_type, location_name);
GO

-- -------------------------------------------------------
-- 2. Bang Guest
--    [FIX-4] full_name = Computed Column (PERSISTED)
-- -------------------------------------------------------
CREATE TABLE Guest (
    guest_id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
    guest_code                VARCHAR(50)   NOT NULL,
    title                     NVARCHAR(20)  NULL,
    first_name                NVARCHAR(100) NOT NULL,
    middle_name               NVARCHAR(100) NULL,
    last_name                 NVARCHAR(100) NOT NULL,

    -- [FIX-4] Computed Column  PERSISTED e co the anh index
    full_name AS (
        CONCAT(
            COALESCE(first_name, N''),
            N' ',
            COALESCE(middle_name, N''),
            N' ',
            COALESCE(last_name, N'')
        )
    ) PERSISTED,

    gender                    VARCHAR(15)   NULL,       -- MALE / FEMALE / OTHER / UNDISCLOSED
    date_of_birth             DATE          NULL,
    nationality_country_code  CHAR(2)       NULL,
    email                     VARCHAR(150)  NULL,
    phone_country_code        VARCHAR(10)   NULL,
    phone_number              VARCHAR(30)   NULL,
    preferred_language_code   VARCHAR(10)   NULL,
    vip_flag                  BIT           NOT NULL DEFAULT 0,
    marketing_opt_in_flag     BIT           NOT NULL DEFAULT 0,
    identity_document_type    VARCHAR(30)   NULL,
    identity_document_no      VARCHAR(80)   NULL,
    document_issue_country    CHAR(2)       NULL,
    created_at                DATETIME      NOT NULL DEFAULT GETDATE(),
    updated_at                DATETIME      NOT NULL DEFAULT GETDATE(),

    CONSTRAINT UQ_Guest_Code   UNIQUE (guest_code),
    CONSTRAINT CK_Guest_Gender CHECK (gender IN ('MALE','FEMALE','OTHER','UNDISCLOSED'))
);

CREATE INDEX IX_Guest_Email ON Guest(email);
CREATE INDEX IX_Guest_Phone ON Guest(phone_country_code, phone_number);
GO

-- -------------------------------------------------------
-- 3. Bang RoomFeature
--    [FIX-8] CHECK constraint: it nhat 1 FK phai NOT NULL
-- -------------------------------------------------------
CREATE TABLE RoomFeature (
    room_feature_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
    room_id           BIGINT       NULL,
    room_type_id      BIGINT       NULL,
    feature_code      VARCHAR(50)  NOT NULL,
    feature_name      NVARCHAR(150) NOT NULL,
    feature_category  VARCHAR(50)  NULL,
    feature_value     NVARCHAR(255) NULL,
    is_premium        BIT          NOT NULL DEFAULT 0,
    created_at        DATETIME     NOT NULL DEFAULT GETDATE(),

    -- FK toi Room va RoomType (gia su a tao)
    CONSTRAINT FK_RoomFeature_Room     FOREIGN KEY (room_id)      REFERENCES Room(room_id),
    CONSTRAINT FK_RoomFeature_RoomType FOREIGN KEY (room_type_id) REFERENCES RoomType(room_type_id),

    -- [FIX-8] CHECK: it nhat 1 trong 2 FK phai NOT NULL
    CONSTRAINT CK_RoomFeature_AtLeastOneFK
        CHECK (room_id IS NOT NULL OR room_type_id IS NOT NULL)
);
GO
```

> **Giai thich FIX-4**: `PERSISTED` luu gia tri computed vao disk thay vi tinh lai moi lan query  cho phep tao INDEX tren `full_name`, cai thien performance khi tim kiem theo ten.

> **Giai thich FIX-8**: CHECK constraint am bao moi feature phai gan vao it nhat 1 oi tuong (phong vat ly hoac loai phong), tranh du lieu "mo coi".

---

### T2.2  Trigger bao ve gia (Price Integrity Guard)

```sql
-- ============================================================
-- T2.2: AFTER UPDATE Trigger tren RoomRate
-- Muc ich: Tu ong ghi canh bao vao RateChangeLog
--           khi gia thay oi > 50%
-- ============================================================
CREATE OR ALTER TRIGGER trg_RoomRate_PriceIntegrityGuard
ON RoomRate
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Chi xu ly khi cot final_rate bi thay oi
    IF NOT UPDATE(final_rate)
        RETURN;

    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO RateChangeLog (
            room_rate_id,
            old_rate,
            new_rate,
            change_amount,
            change_percent,
            change_reason,
            triggered_at,
            triggered_by,
            severity_level,
            review_status
        )
        SELECT
            i.room_rate_id,
            d.final_rate                           AS old_rate,
            i.final_rate                           AS new_rate,
            i.final_rate - d.final_rate            AS change_amount,
            -- Tinh % thay oi, tranh chia cho 0
            CASE
                WHEN d.final_rate = 0 THEN 100.0000
                ELSE CAST(
                    ABS(i.final_rate - d.final_rate) * 100.0 / d.final_rate
                    AS DECIMAL(9,4)
                )
            END                                    AS change_percent,
            N'[AUTO] Rate changed > 50%  flagged by Price Integrity Guard',
            GETDATE(),
            i.updated_by,
            -- Chia severity: > 50% = CRITICAL
            'CRITICAL',
            'OPEN'
        FROM inserted i
        INNER JOIN deleted d ON i.room_rate_id = d.room_rate_id
        WHERE d.final_rate > 0
          AND ABS(i.final_rate - d.final_rate) * 100.0 / d.final_rate > 50.0;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        -- Ghi loi ra error log (khong block UPDATE goc)
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSev INT = ERROR_SEVERITY();
        RAISERROR(@ErrMsg, @ErrSev, 1);
    END CATCH
END;
GO
```

> **Cach hoat ong**:
> - `inserted` = dong **sau** UPDATE (gia moi)
> - `deleted` = dong **truoc** UPDATE (gia cu)
> - So sanh `ABS(new - old) / old > 50%`  INSERT vao `RateChangeLog` voi `severity = CRITICAL`
> - Boc trong `TRY...CATCH` + `TRANSACTION` e am bao atomicity

---

### T2.3  Stored Procedure: Pessimistic Locking chong Double-Booking

```sql
-- ============================================================
-- T2.3: sp_ReserveRoom  Pessimistic Locking
-- Chong Double-Booking bang UPDLOCK + HOLDLOCK
-- ============================================================
CREATE OR ALTER PROCEDURE sp_ReserveRoom
    @room_id              BIGINT,
    @stay_date            DATE,
    @reservation_code     VARCHAR(50),
    @session_id           VARCHAR(100) = NULL,
    @result_message       NVARCHAR(500) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON; -- Tu ong ROLLBACK khi co loi nghiem trong

    DECLARE @current_status   VARCHAR(20);
    DECLARE @lock_acquired_at DATETIME = GETDATE();
    DECLARE @transaction_id   VARCHAR(100) = CAST(NEWID() AS VARCHAR(100));

    BEGIN TRY
        BEGIN TRANSACTION;

        -- =======================================================
        -- BUOC 1: PESSIMISTIC LOCK  Khoa dong inventory
        -- -------------------------------------------------------
        -- UPDLOCK  = at Update Lock, ngan transaction khac cung
        --            lay lock tren cung dong nay
        -- HOLDLOCK = Giu lock en khi COMMIT/ROLLBACK
        --            (tuong uong SERIALIZABLE tren dong nay)
        -- -------------------------------------------------------
        --  Transaction B en sau se BI BLOCK (cho) tai ay
        --   cho en khi Transaction A COMMIT hoac ROLLBACK
        -- =======================================================
        SELECT @current_status = availability_status
        FROM RoomAvailability WITH (UPDLOCK, HOLDLOCK)
        WHERE room_id   = @room_id
          AND stay_date  = @stay_date;

        -- Kiem tra ton tai
        IF @current_status IS NULL
        BEGIN
            SET @result_message = N'ERROR: Khong tim thay inventory cho room_id='
                + CAST(@room_id AS NVARCHAR) + N', date=' + CAST(@stay_date AS NVARCHAR);

            -- Log lock FAILED
            INSERT INTO InventoryLockLog (
                reservation_code_attempt, room_id, stay_date,
                lock_acquired_at, lock_released_at,
                lock_status, session_id, transaction_id, note
            ) VALUES (
                @reservation_code, @room_id, @stay_date,
                @lock_acquired_at, GETDATE(),
                'FAILED', @session_id, @transaction_id,
                N'Inventory record not found'
            );

            ROLLBACK TRANSACTION;
            RETURN;
        END

        -- =======================================================
        -- BUOC 2: Kiem tra phong con trong
        -- =======================================================
        IF @current_status <> 'OPEN'
        BEGIN
            SET @result_message = N'REJECTED: Phong a uoc at/khoa. Status hien tai: '
                + @current_status;

            INSERT INTO InventoryLockLog (
                reservation_code_attempt, room_id, stay_date,
                lock_acquired_at, lock_released_at,
                lock_status, session_id, transaction_id, note
            ) VALUES (
                @reservation_code, @room_id, @stay_date,
                @lock_acquired_at, GETDATE(),
                'FAILED', @session_id, @transaction_id,
                N'Room not available, status=' + @current_status
            );

            ROLLBACK TRANSACTION;
            RETURN;
        END

        -- =======================================================
        -- BUOC 3: Cap nhat inventory  BOOKED
        -- =======================================================
        UPDATE RoomAvailability
        SET availability_status = 'BOOKED',
            sellable_flag       = 0,
            version_no          = version_no + 1,
            updated_at          = GETDATE()
        WHERE room_id  = @room_id
          AND stay_date = @stay_date;

        -- =======================================================
        -- BUOC 4: Ghi log lock thanh cong
        -- =======================================================
        INSERT INTO InventoryLockLog (
            reservation_code_attempt, room_id, stay_date,
            lock_acquired_at, lock_released_at,
            lock_status, session_id, transaction_id, note
        ) VALUES (
            @reservation_code, @room_id, @stay_date,
            @lock_acquired_at, GETDATE(),
            'SUCCESS', @session_id, @transaction_id,
            N'Room reserved successfully'
        );

        COMMIT TRANSACTION;

        SET @result_message = N'SUCCESS: at phong thanh cong. Room='
            + CAST(@room_id AS NVARCHAR) + N', Date=' + CAST(@stay_date AS NVARCHAR);

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        -- Log lock TIMEOUT/ERROR
        INSERT INTO InventoryLockLog (
            reservation_code_attempt, room_id, stay_date,
            lock_acquired_at, lock_released_at,
            lock_status, session_id, transaction_id, note
        ) VALUES (
            @reservation_code, @room_id, @stay_date,
            @lock_acquired_at, GETDATE(),
            'TIMEOUT', @session_id, @transaction_id,
            ERROR_MESSAGE()
        );

        SET @result_message = N'ERROR: ' + ERROR_MESSAGE();
    END CATCH
END;
GO

-- Cach goi:
DECLARE @msg NVARCHAR(500);
EXEC sp_ReserveRoom
    @room_id          = 101,
    @stay_date        = '2026-04-15',
    @reservation_code = 'RES-20260415-001',
    @session_id       = 'WEB-SESSION-ABC123',
    @result_message   = @msg OUTPUT;
PRINT @msg;
GO
```

> **Giai thich Pessimistic Locking chong Race Condition:**
>
> | Thoi iem | Transaction A | Transaction B |
> |-----------|--------------|--------------|
> | T1 | `SELECT ... WITH (UPDLOCK, HOLDLOCK)`  Lay lock thanh cong, oc status = `OPEN` |  |
> | T2 |  | `SELECT ... WITH (UPDLOCK, HOLDLOCK)`  **BI BLOCK** (cho A giai phong lock) |
> | T3 | `UPDATE ... SET status = 'BOOKED'`  `COMMIT`  Giai phong lock |  |
> | T4 |  | Lock uoc cap  oc status = `BOOKED`  **REJECTED** (phong a uoc at) |
>
> - `UPDLOCK`: Ngan transaction khac lay Update/Exclusive lock tren cung dong
> - `HOLDLOCK`: Giu lock tu luc SELECT en khi COMMIT/ROLLBACK (khong release som)
> - Ket qua: **Chi 1 transaction uoc at phong**, transaction con lai bi tu choi  **Khong bao gio Double-Booking**

---

##  Nguoi 2  NoSQL Specialist (Du lieu lai)

---

### T2.4  MongoDB Document: Hotel_Catalog (Embedded Design)

```json
// ------------------------------------------------------------
// T2.4: Hotel_Catalog  Collection cho MongoDB
// Thiet ke: Embedded (nhung) amenities + room_types
// Muc tieu: Read-heavy, 1 query tra ve toan bo thong tin hotel
// ------------------------------------------------------------
{
  "_id": ObjectId("665a1b2c3d4e5f6a7b8c9d0e"),
  "hotel_id": 1,                              // Map voi SQL Server Hotel.hotel_id
  "hotel_code": "RITZ-HCMC-001",
  "hotel_name": "The Ritz-Carlton, Saigon",
  "brand": "The Ritz-Carlton",
  "chain": "Marriott International",
  "hotel_type": "CITY_HOTEL",
  "star_rating": 5,
  "luxury_segment": "ULTRA_LUXURY",

  // Thong tin mo ta (rich content  khong luu o SQL)
  "description": {
    "short": "Experience unparalleled luxury in the heart of Ho Chi Minh City with breathtaking views of the Saigon River.",
    "long": "Nestled in the vibrant District 1, The Ritz-Carlton Saigon offers 300 elegantly appointed rooms and suites, world-class dining, and an award-winning spa. Every detail is crafted to deliver the legendary Ritz-Carlton service.",
    "highlights": [
      "Rooftop infinity pool with panoramic city views",
      "Michelin-starred restaurant 'The Dining Room'",
      "24-hour butler service for all suites",
      "Private helipad for VIP arrivals"
    ]
  },

  // Gallery media
  "images": [
    {
      "url": "https://cdn.ritzcarlton.com/hcmc/exterior-night.jpg",
      "caption": "Hotel exterior at night",
      "category": "EXTERIOR",
      "is_hero": true,
      "sort_order": 1
    },
    {
      "url": "https://cdn.ritzcarlton.com/hcmc/lobby.jpg",
      "caption": "Grand lobby with crystal chandelier",
      "category": "LOBBY",
      "is_hero": false,
      "sort_order": 2
    },
    {
      "url": "https://cdn.ritzcarlton.com/hcmc/pool.jpg",
      "caption": "Rooftop infinity pool",
      "category": "AMENITY",
      "is_hero": false,
      "sort_order": 3
    }
  ],

// ------------------------------------------------------------
  // EMBEDDED: Amenities (nhung)  link key = amenity_code
  // Operational data (fee, schedule) o SQL HotelAmenity
  // Rich content (name, category, desc) o ay
// ------------------------------------------------------------
  "amenities": [
    {
      "amenity_code": "AMN-POOL-PRIV",
      "name": "Private Pool",
      "category": "RECREATION",
      "description": "Temperature-controlled private pool on the 35th floor with cabana service",
      "icon": "pool",
      "tags": ["luxury", "rooftop", "private"],
      "images": ["https://cdn.ritzcarlton.com/hcmc/private-pool.jpg"]
    },
    {
      "amenity_code": "AMN-SPA-ESPA",
      "name": "ESPA Life Spa",
      "category": "WELLNESS",
      "description": "Award-winning spa featuring signature Vietnamese-inspired treatments",
      "icon": "spa",
      "tags": ["wellness", "signature", "award-winning"],
      "images": ["https://cdn.ritzcarlton.com/hcmc/spa.jpg"]
    },
    {
      "amenity_code": "AMN-BUTLER",
      "name": "Butler Service",
      "category": "EXCLUSIVE",
      "description": "Dedicated 24-hour personal butler for all suite guests",
      "icon": "butler",
      "tags": ["luxury", "24h", "personalized"],
      "images": []
    },
    {
      "amenity_code": "AMN-DINING-MICH",
      "name": "Michelin-Star Dining",
      "category": "DINING",
      "description": "The Dining Room  2 Michelin stars, contemporary French-Vietnamese cuisine",
      "icon": "restaurant",
      "tags": ["michelin", "fine-dining"],
      "images": ["https://cdn.ritzcarlton.com/hcmc/dining-room.jpg"]
    },
    {
      "amenity_code": "AMN-TRANSFER",
      "name": "Airport Luxury Transfer",
      "category": "TRANSPORT",
      "description": "Rolls-Royce Phantom airport transfer with personal greeter",
      "icon": "car",
      "tags": ["transfer", "rolls-royce", "VIP"],
      "images": []
    }
  ],

// ------------------------------------------------------------
  // EMBEDDED: Room Types (nhung)  link key = room_type_code
  // Operational data (max_adults, rate) o SQL RoomType
  // Rich content (description, features, images) o ay
// ------------------------------------------------------------
  "room_types": [
    {
      "room_type_code": "RT-DLX-CITY",
      "name": "Deluxe City View",
      "category": "DELUXE",
      "description": "55 sqm of refined elegance with floor-to-ceiling windows offering stunning city panoramas.",
      "features": {
        "has_balcony": false,
        "has_private_pool": false,
        "has_lounge_access": false,
        "has_butler_service": false
      },
      "images": [
        "https://cdn.ritzcarlton.com/hcmc/deluxe-city.jpg"
      ]
    },
    {
      "room_type_code": "RT-STE-RIVER",
      "name": "Ritz-Carlton Suite  River View",
      "category": "SUITE",
      "description": "120 sqm signature suite with separate living room, panoramic Saigon River views, and exclusive Club Lounge access.",
      "features": {
        "has_balcony": true,
        "has_private_pool": false,
        "has_lounge_access": true,
        "has_butler_service": true
      },
      "images": [
        "https://cdn.ritzcarlton.com/hcmc/suite-river-1.jpg",
        "https://cdn.ritzcarlton.com/hcmc/suite-river-2.jpg"
      ]
    },
    {
      "room_type_code": "RT-PRES-SKY",
      "name": "Presidential Skyline Suite",
      "category": "PRESIDENTIAL_SUITE",
      "description": "300 sqm penthouse-level suite with private terrace, infinity plunge pool, dining for 12, and dedicated butler team.",
      "features": {
        "has_balcony": true,
        "has_private_pool": true,
        "has_lounge_access": true,
        "has_butler_service": true
      },
      "images": [
        "https://cdn.ritzcarlton.com/hcmc/presidential-1.jpg",
        "https://cdn.ritzcarlton.com/hcmc/presidential-2.jpg",
        "https://cdn.ritzcarlton.com/hcmc/presidential-pool.jpg"
      ]
    }
  ],

  // Metadata
  "location": {
    "region": "Southeast Asia",
    "country": "Vietnam",
    "city": "Ho Chi Minh City",
    "district": "District 1",
    "address": "28 Dong Khoi Street",
    "coordinates": { "lat": 10.7769, "lng": 106.7009 }
  },

  "contact": {
    "phone": "+84-28-3823-6688",
    "email": "reservations.saigon@ritzcarlton.com",
    "website": "https://www.ritzcarlton.com/saigon"
  },

  "last_synced_at": ISODate("2026-03-27T14:00:00Z"),
  "created_at": ISODate("2025-01-15T08:00:00Z"),
  "updated_at": ISODate("2026-03-27T14:00:00Z")
}
```

> **Tai sao Embedded (nhung)->**
> - **1 query = toan bo data**: App chi can `findOne({ hotel_id: 1 })`  nhan u amenities, room_types, images
> - **Read-heavy optimization**: Khong can JOIN  latency thap, throughput cao
> - **Atomic update**: Cap nhat 1 amenity trong mang = 1 atomic operation (`$set` voi positional `$`)
> - **Trade-off**: Document size phai < 16MB (BSON limit)  voi hotel data thong thuong hoan toan u

---

### T2.5  MongoDB Query: Tim hotel co Private Pool VA Butler Service

```javascript
// ------------------------------------------------------------
// T2.5: Query tim hotel co ONG THOI Private Pool + Butler Service
// Su dung $all tren truong amenities.name
// ------------------------------------------------------------
// --- Cach 1: Dung $all (khuyen nghi) ---
db.Hotel_Catalog.find({
  "amenities.name": {
    $all: ["Private Pool", "Butler Service"]
  }
}, {
  hotel_name: 1,
  hotel_code: 1,
  star_rating: 1,
  "amenities.name": 1,
  "amenities.category": 1
});

// --- Cach 2: Dung Aggregation Framework (nang cao) ---
db.Hotel_Catalog.aggregate([
  // Stage 1: Loc hotel co CA HAI amenities
  {
    $match: {
      "amenities.name": {
        $all: ["Private Pool", "Butler Service"]
      }
    }
  },
  // Stage 2: Chi giu cac amenities matching
  {
    $project: {
      hotel_name: 1,
      hotel_code: 1,
      star_rating: 1,
      luxury_segment: 1,
      matched_amenities: {
        $filter: {
          input: "$amenities",
          as: "a",
          cond: {
            $in: ["$$a.name", ["Private Pool", "Butler Service"]]
          }
        }
      }
    }
  },
  // Stage 3: Sap xep theo star rating
  { $sort: { star_rating: -1 } }
]);

// --- Index khuyen nghi ---
db.Hotel_Catalog.createIndex({ "amenities.name": 1 });
```

> **Tai sao `$all` toi uu hon query thong thuong->**
>
> | Cach | Query | Van e |
> |------|-------|--------|
> | **Sai** | `{ $and: [{ "amenities.name": "Private Pool" }, { "amenities.name": "Butler Service" }] }` | Hoat ong ung nhung dai dong, kho maintain |
> | **Sai** | 2 lan `find()` roi merge o application | 2 lan roundtrip, ton bandwidth, logic phuc tap |
> | ** ung** | `{ "amenities.name": { $all: [...] } }` | 1 lan query, MongoDB engine toi uu san bang index intersection. Cu phap ngan gon, declarative |
>
> **Khi nao dung `$elemMatch` thay `$all`->**
> - `$all`: Khi chi kiem tra **1 field** trong embedded doc (vd: chi `name`)
> - `$elemMatch`: Khi can kiem tra **nhieu field cung 1 element** (vd: `name = "Pool" AND category = "RECREATION"` tren cung 1 object trong mang)

---

### T2.6  Recursive CTE: Duyet cay phan cap Location

```sql
-- ============================================================
-- T2.6: Recursive CTE  Lay toan bo location con tu goc
-- Input: Ten hoac ID cua Region goc (VD: 'Chau A')
-- Output: Toan bo hierarchy con kem Level
-- ============================================================

-- Buoc 0: Insert du lieu mau
INSERT INTO Location (parent_location_id, location_code, location_name, location_type, level, iso_code) VALUES
(NULL,  'REG-ASIA',       N'Chau A',           'REGION',         0, NULL),
(1,     'CTR-VN',          N'Viet Nam',         'COUNTRY',        1, 'VN'),
(1,     'CTR-TH',          N'Thai Lan',         'COUNTRY',        1, 'TH'),
(1,     'CTR-SG',          N'Singapore',        'COUNTRY',        1, 'SG'),
(2,     'STP-HCM',         N'Ho Chi Minh',     'STATE_PROVINCE', 2, NULL),
(2,     'STP-KH',          N'Khanh Hoa',       'STATE_PROVINCE', 2, NULL),
(5,     'CTY-HCMC',        N'TP. Ho Chi Minh', 'CITY',           3, NULL),
(6,     'CTY-NT',          N'Nha Trang',        'CITY',           3, NULL),
(7,     'DST-Q1',          N'Quan 1',           'DISTRICT',       4, NULL),
(7,     'DST-Q7',          N'Quan 7',           'DISTRICT',       4, NULL),
(3,     'CTY-BKK',         N'Bangkok',          'CITY',           3, NULL),
(4,     'DST-MARINA',      N'Marina Bay',       'DISTRICT',       4, NULL);
GO

-- Buoc 1: Recursive CTE
DECLARE @root_name NVARCHAR(150) = N'Chau A';

WITH LocationTree AS (
    -- ======= Anchor Member: Node goc =======
    SELECT
        location_id,
        parent_location_id,
        location_code,
        location_name,
        location_type,
        level,
        iso_code,
        0 AS depth                           -- Depth tinh tu node goc
    FROM Location
    WHERE location_name = @root_name

    UNION ALL

    -- ======= Recursive Member: Cac node con =======
    SELECT
        child.location_id,
        child.parent_location_id,
        child.location_code,
        child.location_name,
        child.location_type,
        child.level,
        child.iso_code,
        parent.depth + 1 AS depth
    FROM Location child
    INNER JOIN LocationTree parent
        ON child.parent_location_id = parent.location_id
)
SELECT
    location_id,
    parent_location_id,
    location_code,
    location_name,
    location_type,
    level         AS schema_level,  -- Level theo schema (0-4)
    depth         AS tree_depth,    -- Depth tinh tu node query
    REPLICATE('  ', depth) + location_name AS hierarchy_display
FROM LocationTree
ORDER BY level, location_name;
GO
```

**Ket qua mong oi:**

```
schema_level | tree_depth | hierarchy_display
------------------------------------------------------------
0            | 0          | Chau A
1            | 1          |   Singapore
1            | 1          |   Thai Lan
1            | 1          |   Viet Nam
2            | 2          |     Ho Chi Minh
2            | 2          |     Khanh Hoa
3            | 3          |       Bangkok
3            | 3          |       Nha Trang
3            | 3          |       TP. Ho Chi Minh
4            | 4          |         Marina Bay
4            | 4          |         Quan 1
4            | 4          |         Quan 7
```

> **Ung dung thuc te**: Tim tat ca hotel trong "Chau A":
> ```sql
> SELECT H.* FROM Hotel H
> WHERE H.location_id IN (SELECT location_id FROM LocationTree);
> ```

---

##  Nguoi 3  Analytics & Report

---

### T2.7  VIEW tai chinh: vw_ReservationTotal

```sql
-- ============================================================
-- T2.7: VIEW vw_ReservationTotal
-- Source of Truth cho tong tien reservation
-- Thay the financial fields luu cung trong Reservation [FIX-3]
-- ============================================================
CREATE OR ALTER VIEW vw_ReservationTotal
AS
SELECT
    r.reservation_id,
    r.reservation_code,
    r.hotel_id,
    r.guest_id,
    r.reservation_status,
    r.currency_code,
    r.checkin_date,
    r.checkout_date,
    r.nights,

    -- ------- Room Revenue (tu ReservationRoom) -------
    ISNULL(room_totals.room_subtotal, 0)      AS room_subtotal,
    ISNULL(room_totals.room_tax, 0)           AS room_tax,
    ISNULL(room_totals.room_discount, 0)      AS room_discount,
    ISNULL(room_totals.room_final, 0)         AS room_final,
    ISNULL(room_totals.room_count, 0)         AS actual_room_count,

    -- ------- Service Revenue (tu ReservationService) -------
    ISNULL(svc_totals.svc_subtotal, 0)        AS service_subtotal,
    ISNULL(svc_totals.svc_discount, 0)        AS service_discount,
    ISNULL(svc_totals.svc_final, 0)           AS service_final,
    ISNULL(svc_totals.svc_count, 0)           AS service_count,

    -- ------- Grand Total (Room + Service) -------
    ISNULL(room_totals.room_final, 0)
        + ISNULL(svc_totals.svc_final, 0)     AS grand_total,

    -- ------- Payment info -------
    ISNULL(pay_totals.total_paid, 0)          AS total_paid,
    (ISNULL(room_totals.room_final, 0)
        + ISNULL(svc_totals.svc_final, 0))
        - ISNULL(pay_totals.total_paid, 0)    AS balance_due

FROM Reservation r

-- Aggregate room line items
LEFT JOIN (
    SELECT
        reservation_id,
        SUM(room_subtotal)    AS room_subtotal,
        SUM(tax_amount)       AS room_tax,
        SUM(discount_amount)  AS room_discount,
        SUM(final_amount)     AS room_final,
        COUNT(*)              AS room_count
    FROM ReservationRoom
    GROUP BY reservation_id
) room_totals ON r.reservation_id = room_totals.reservation_id

-- Aggregate service line items
LEFT JOIN (
    SELECT
        reservation_id,
        SUM(unit_price * quantity)  AS svc_subtotal,
        SUM(discount_amount)       AS svc_discount,
        SUM(final_amount)          AS svc_final,
        COUNT(*)                   AS svc_count
    FROM ReservationService
    GROUP BY reservation_id
) svc_totals ON r.reservation_id = svc_totals.reservation_id

-- Aggregate payments (chi CAPTURED)
LEFT JOIN (
    SELECT
        reservation_id,
        SUM(amount) AS total_paid
    FROM Payment
    WHERE payment_status = 'CAPTURED'
    GROUP BY reservation_id
) pay_totals ON r.reservation_id = pay_totals.reservation_id;
GO

-- Cach dung:
SELECT * FROM vw_ReservationTotal
WHERE reservation_code = 'RES-20260415-001';

-- Bao cao doanh thu theo hotel:
SELECT hotel_id, COUNT(*) AS bookings, SUM(grand_total) AS revenue
FROM vw_ReservationTotal
WHERE reservation_status IN ('CONFIRMED','CHECKED_IN','CHECKED_OUT')
GROUP BY hotel_id;
GO
```

---

### T2.8  Revenue Intelligence: Top 3 Room Types per Hotel (Window Functions)

```sql
-- ============================================================
-- T2.8: Top 3 loai phong doanh thu cao nhat / Hotel  Q1 2026
-- BAT BUOC: Window Functions (SUM OVER + DENSE_RANK)
-- KHONG dung GROUP BY + TOP on gian
-- ============================================================
WITH RoomRevenue AS (
    -- Buoc 1: Tinh doanh thu theo hotel + room_type, dung SUM() OVER()
    SELECT
        rr.room_type_id,
        rt.room_type_name,
        rt.category          AS room_category,
        res.hotel_id,
        h.hotel_name,
        rr.final_amount,

        -- Window Function: SUM doanh thu theo hotel + room_type
        SUM(rr.final_amount) OVER (
            PARTITION BY res.hotel_id, rr.room_type_id
        ) AS total_revenue_by_room_type,

        -- Window Function: Tong doanh thu hotel (e tinh %)
        SUM(rr.final_amount) OVER (
            PARTITION BY res.hotel_id
        ) AS total_hotel_revenue

    FROM ReservationRoom rr
    INNER JOIN Reservation res  ON rr.reservation_id = res.reservation_id
    INNER JOIN RoomType rt      ON rr.room_type_id   = rt.room_type_id
    INNER JOIN Hotel h          ON res.hotel_id       = h.hotel_id
    WHERE res.reservation_status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      AND res.checkin_date >= '2026-01-01'
      AND res.checkin_date <  '2026-04-01'    -- Q1 2026
),
-- Buoc 2: Deduplicate + Rank
RankedRevenue AS (
    SELECT DISTINCT
        hotel_id,
        hotel_name,
        room_type_id,
        room_type_name,
        room_category,
        total_revenue_by_room_type,
        total_hotel_revenue,

        -- % contribution
        CAST(
            total_revenue_by_room_type * 100.0 / NULLIF(total_hotel_revenue, 0)
            AS DECIMAL(5,2)
        ) AS revenue_share_pct,

        -- Window Function: DENSE_RANK theo hotel
        DENSE_RANK() OVER (
            PARTITION BY hotel_id
            ORDER BY total_revenue_by_room_type DESC
        ) AS revenue_rank

    FROM RoomRevenue
)
-- Buoc 3: Loc Top 3
SELECT
    hotel_id,
    hotel_name,
    revenue_rank,
    room_type_name,
    room_category,
    FORMAT(total_revenue_by_room_type, 'N0') AS revenue,
    CAST(revenue_share_pct AS VARCHAR) + '%' AS share,
    FORMAT(total_hotel_revenue, 'N0')        AS hotel_total
FROM RankedRevenue
WHERE revenue_rank <= 3
ORDER BY hotel_id, revenue_rank;
GO
```

**Ket qua mau:**

```
hotel_id | hotel_name                 | rank | room_type_name           | revenue     | share  | hotel_total
------------------------------------------------------------
1        | The Ritz-Carlton, Saigon   | 1    | Presidential Skyline     | 2,450,000   | 45.2%  | 5,420,000
1        | The Ritz-Carlton, Saigon   | 2    | Ritz-Carlton Suite       | 1,870,000   | 34.5%  | 5,420,000
1        | The Ritz-Carlton, Saigon   | 3    | Deluxe City View         | 830,000     | 15.3%  | 5,420,000
2        | W Hotel Bangkok            | 1    | Extreme WOW Suite        | 3,100,000   | 52.1%  | 5,950,000
...
```

> **Tai sao dung DENSE_RANK thay vi ROW_NUMBER->**
> - `DENSE_RANK`: Neu 2 room types co cung doanh thu  cung rank (1,1,2,3)
> - `ROW_NUMBER`: Luon unique  1 trong 2 bi ay xuong rank thap hon (khong cong bang)

---

### T2.9  AI Audit: Post-mortem Analysis Template

```markdown
## Post-mortem Analysis  AI-Generated Trigger Error

### 1. oan code sai (do AI viet)

> [Dan oan code Trigger bi sai cua AI vao ay]
> Vi du: Trigger khong co TRY...CATCH, thieu ROLLBACK, 
> hoac dung cu phap MySQL (FOR UPDATE) thay vi SQL Server

### 2. Phan tich loi

| # | Loi | Muc nghiem trong | Giai thich |
------------------------------------------------------------
| 1 | **Thieu Deadlock handling** |  CRITICAL | Trigger thuc thi trong context
    cua transaction goc. Neu xay ra Deadlock, SQL Server chon 1 transaction
    lam victim va tu ong ROLLBACK. Trigger khong co `TRY...CATCH`
     error khong uoc xu ly  transaction goc (UPDATE rate) cung bi ROLLBACK
    ma caller khong biet ly do. |
| 2 | **Khong ROLLBACK trong CATCH** |  CRITICAL | Neu INSERT vao
    RateChangeLog gap loi (vd: constraint violation), transaction giu trang
    thai mo (@@TRANCOUNT > 0)  lock khong giai phong  cac session khac
    bi BLOCK vo thoi han  co the gay **su co production**. |
| 3 | **Dung cu phap sai engine** |  WARNING | AI sinh code dung
    `FOR UPDATE` (MySQL/PostgreSQL syntax) thay vi `WITH (UPDLOCK)` 
    (SQL Server). Loi syntax  trigger khong deploy uoc. |

### 3. Nguyen nhan goc (Root Cause)

AI khong uoc cung cap u boi canh kien truc he thong:
- Khong biet target engine la **SQL Server**  sinh code generic/MySQL
- Khong hieu Trigger chay **trong** transaction goc  thieu error handling
- Khong co thong tin ve cau truc `RateChangeLog`  INSERT fields sai

### 4. Prompt a sua (Corrective Prompt)

Nhom a dung prompt sau e ep AI sua lai:

> "oan Trigger sau bi sai nghiem trong: [dan code sai]. 
> Hay sua lai theo cac yeu cau BAT BUOC:
> 1. Engine la SQL Server (T-SQL), KHONG dung MySQL syntax
> 2. Boc logic INSERT vao TRY...CATCH
> 3. Trong CATCH: kiem tra @@TRANCOUNT > 0 thi ROLLBACK
> 4. Xu ly Deadlock: kiem tra ERROR_NUMBER() = 1205
> 5. Su dung bang ao INSERTED va DELETED e so sanh gia cu/moi
> 6. Tham chieu cau truc bang RateChangeLog inh kem: [dan schema]"

### 5. Bai hoc rut ra

1. **Luon set context au tien**: Dan schema/summary vao au prompt
2. **Chi inh engine ro rang**: "SQL Server (T-SQL)" thay vi chi "SQL"
3. **Yeu cau error handling**: Yeu cau TRY...CATCH + Deadlock handling
4. **Review moi output cua AI**: ac biet kiem tra syntax engine va 
   transaction safety truoc khi chay
```

---

##  Checklist van hanh nhom

- [ ] Moi thanh vien bat **New Chat** khi bat au task moi
- [ ] Dan `GlobalLuxuryHotelReservationEngine_REMAKE_Summary.md` vao dong au prompt
- [ ] Luon ghi ro: **"Engine: SQL Server (T-SQL)"** hoac **"Engine: MongoDB"**
- [ ] Neu AI dung `FOR UPDATE` (MySQL)  yeu cau sua sang `WITH (UPDLOCK, HOLDLOCK)`
- [ ] Neu AI dung `LIMIT` (MySQL)  yeu cau sua sang `TOP` (SQL Server)
- [ ] Luu lai moi prompt + response e lam AI Audit (15% iem)
