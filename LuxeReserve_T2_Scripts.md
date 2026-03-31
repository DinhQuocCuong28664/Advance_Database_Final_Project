# LuxeReserve — Bộ Script T2 (SQL Server + MongoDB)

> **Dựa trên**: `GlobalLuxuryHotelReservationEngine_REMAKE.groovy`
> **Database Engine**: SQL Server | MongoDB (Hybrid)
> **Mục đích**: Cung cấp script hoàn chỉnh cho nhóm 3 người thực hiện

---

## 🧑‍💻 Người 1 — SQL Server Database Architect

---

### T2.1 — DDL: Guest, RoomFeature, Location (Schema & Computed Columns)

```sql
-- ============================================================
-- T2.1: CREATE TABLE — Guest, RoomFeature, Location
-- Engine: SQL Server (T-SQL)
-- ============================================================

-- -------------------------------------------------------
-- 1. Bảng Location — Adjacency List (self-referencing FK)
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

-- Index hỗ trợ Recursive CTE
CREATE INDEX IX_Location_Parent  ON Location(parent_location_id);
CREATE INDEX IX_Location_TypeName ON Location(location_type, location_name);
GO

-- -------------------------------------------------------
-- 2. Bảng Guest
--    [FIX-4] full_name = Computed Column (PERSISTED)
-- -------------------------------------------------------
CREATE TABLE Guest (
    guest_id                  BIGINT IDENTITY(1,1) PRIMARY KEY,
    guest_code                VARCHAR(50)   NOT NULL,
    title                     NVARCHAR(20)  NULL,
    first_name                NVARCHAR(100) NOT NULL,
    middle_name               NVARCHAR(100) NULL,
    last_name                 NVARCHAR(100) NOT NULL,

    -- [FIX-4] Computed Column — PERSISTED để có thể đánh index
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
-- 3. Bảng RoomFeature
--    [FIX-8] CHECK constraint: ít nhất 1 FK phải NOT NULL
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

    -- FK tới Room và RoomType (giả sử đã tạo)
    CONSTRAINT FK_RoomFeature_Room     FOREIGN KEY (room_id)      REFERENCES Room(room_id),
    CONSTRAINT FK_RoomFeature_RoomType FOREIGN KEY (room_type_id) REFERENCES RoomType(room_type_id),

    -- [FIX-8] CHECK: ít nhất 1 trong 2 FK phải NOT NULL
    CONSTRAINT CK_RoomFeature_AtLeastOneFK
        CHECK (room_id IS NOT NULL OR room_type_id IS NOT NULL)
);
GO
```

> **Giải thích FIX-4**: `PERSISTED` lưu giá trị computed vào disk thay vì tính lại mỗi lần query → cho phép tạo INDEX trên `full_name`, cải thiện performance khi tìm kiếm theo tên.

> **Giải thích FIX-8**: CHECK constraint đảm bảo mỗi feature phải gắn vào ít nhất 1 đối tượng (phòng vật lý hoặc loại phòng), tránh dữ liệu "mồ côi".

---

### T2.2 — Trigger bảo vệ giá (Price Integrity Guard)

```sql
-- ============================================================
-- T2.2: AFTER UPDATE Trigger trên RoomRate
-- Mục đích: Tự động ghi cảnh báo vào RateChangeLog
--           khi giá thay đổi > 50%
-- ============================================================
CREATE OR ALTER TRIGGER trg_RoomRate_PriceIntegrityGuard
ON RoomRate
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Chỉ xử lý khi cột final_rate bị thay đổi
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
            -- Tính % thay đổi, tránh chia cho 0
            CASE
                WHEN d.final_rate = 0 THEN 100.0000
                ELSE CAST(
                    ABS(i.final_rate - d.final_rate) * 100.0 / d.final_rate
                    AS DECIMAL(9,4)
                )
            END                                    AS change_percent,
            N'[AUTO] Rate changed > 50% — flagged by Price Integrity Guard',
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

        -- Ghi lỗi ra error log (không block UPDATE gốc)
        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSev INT = ERROR_SEVERITY();
        RAISERROR(@ErrMsg, @ErrSev, 1);
    END CATCH
END;
GO
```

> **Cách hoạt động**:
> - `inserted` = dòng **sau** UPDATE (giá mới)
> - `deleted` = dòng **trước** UPDATE (giá cũ)
> - So sánh `ABS(new - old) / old > 50%` → INSERT vào `RateChangeLog` với `severity = CRITICAL`
> - Bọc trong `TRY...CATCH` + `TRANSACTION` để đảm bảo atomicity

---

### T2.3 — Stored Procedure: Pessimistic Locking chống Double-Booking

```sql
-- ============================================================
-- T2.3: sp_ReserveRoom — Pessimistic Locking
-- Chống Double-Booking bằng UPDLOCK + HOLDLOCK
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
    SET XACT_ABORT ON; -- Tự động ROLLBACK khi có lỗi nghiêm trọng

    DECLARE @current_status   VARCHAR(20);
    DECLARE @lock_acquired_at DATETIME = GETDATE();
    DECLARE @transaction_id   VARCHAR(100) = CAST(NEWID() AS VARCHAR(100));

    BEGIN TRY
        BEGIN TRANSACTION;

        -- =======================================================
        -- BƯỚC 1: PESSIMISTIC LOCK — Khóa dòng inventory
        -- -------------------------------------------------------
        -- UPDLOCK  = Đặt Update Lock, ngăn transaction khác cũng
        --            lấy lock trên cùng dòng này
        -- HOLDLOCK = Giữ lock đến khi COMMIT/ROLLBACK
        --            (tương đương SERIALIZABLE trên dòng này)
        -- -------------------------------------------------------
        -- → Transaction B đến sau sẽ BỊ BLOCK (chờ) tại đây
        --   cho đến khi Transaction A COMMIT hoặc ROLLBACK
        -- =======================================================
        SELECT @current_status = availability_status
        FROM RoomAvailability WITH (UPDLOCK, HOLDLOCK)
        WHERE room_id   = @room_id
          AND stay_date  = @stay_date;

        -- Kiểm tra tồn tại
        IF @current_status IS NULL
        BEGIN
            SET @result_message = N'ERROR: Không tìm thấy inventory cho room_id='
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
        -- BƯỚC 2: Kiểm tra phòng còn trống
        -- =======================================================
        IF @current_status <> 'OPEN'
        BEGIN
            SET @result_message = N'REJECTED: Phòng đã được đặt/khóa. Status hiện tại: '
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
        -- BƯỚC 3: Cập nhật inventory → BOOKED
        -- =======================================================
        UPDATE RoomAvailability
        SET availability_status = 'BOOKED',
            sellable_flag       = 0,
            version_no          = version_no + 1,
            updated_at          = GETDATE()
        WHERE room_id  = @room_id
          AND stay_date = @stay_date;

        -- =======================================================
        -- BƯỚC 4: Ghi log lock thành công
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

        SET @result_message = N'SUCCESS: Đặt phòng thành công. Room='
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

-- Cách gọi:
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

> **Giải thích Pessimistic Locking chống Race Condition:**
>
> | Thời điểm | Transaction A | Transaction B |
> |-----------|--------------|--------------|
> | T1 | `SELECT ... WITH (UPDLOCK, HOLDLOCK)` → Lấy lock thành công, đọc status = `OPEN` | — |
> | T2 | — | `SELECT ... WITH (UPDLOCK, HOLDLOCK)` → **BỊ BLOCK** (chờ A giải phóng lock) |
> | T3 | `UPDATE ... SET status = 'BOOKED'` → `COMMIT` → Giải phóng lock | — |
> | T4 | — | Lock được cấp → Đọc status = `BOOKED` → **REJECTED** (phòng đã được đặt) |
>
> - `UPDLOCK`: Ngăn transaction khác lấy Update/Exclusive lock trên cùng dòng
> - `HOLDLOCK`: Giữ lock từ lúc SELECT đến khi COMMIT/ROLLBACK (không release sớm)
> - Kết quả: **Chỉ 1 transaction được đặt phòng**, transaction còn lại bị từ chối → **Không bao giờ Double-Booking**

---

## 🗄️ Người 2 — NoSQL Specialist (Dữ liệu lai)

---

### T2.4 — MongoDB Document: Hotel_Catalog (Embedded Design)

```json
// ============================================================
// T2.4: Hotel_Catalog — Collection cho MongoDB
// Thiết kế: Embedded (nhúng) amenities + room_types
// Mục tiêu: Read-heavy, 1 query trả về toàn bộ thông tin hotel
// ============================================================

{
  "_id": ObjectId("665a1b2c3d4e5f6a7b8c9d0e"),
  "hotel_id": 1,                              // Map với SQL Server Hotel.hotel_id
  "hotel_code": "RITZ-HCMC-001",
  "hotel_name": "The Ritz-Carlton, Saigon",
  "brand": "The Ritz-Carlton",
  "chain": "Marriott International",
  "hotel_type": "CITY_HOTEL",
  "star_rating": 5,
  "luxury_segment": "ULTRA_LUXURY",

  // Thông tin mô tả (rich content — không lưu ở SQL)
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

  // -------------------------------------------------------
  // EMBEDDED: Amenities (nhúng) — link key = amenity_code
  // Operational data (fee, schedule) ở SQL HotelAmenity
  // Rich content (name, category, desc) ở đây
  // -------------------------------------------------------
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
      "description": "The Dining Room — 2 Michelin stars, contemporary French-Vietnamese cuisine",
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

  // -------------------------------------------------------
  // EMBEDDED: Room Types (nhúng) — link key = room_type_code
  // Operational data (max_adults, rate) ở SQL RoomType
  // Rich content (description, features, images) ở đây
  // -------------------------------------------------------
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
      "name": "Ritz-Carlton Suite — River View",
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

> **Tại sao Embedded (nhúng)?**
> - **1 query = toàn bộ data**: App chỉ cần `findOne({ hotel_id: 1 })` → nhận đủ amenities, room_types, images
> - **Read-heavy optimization**: Không cần JOIN → latency thấp, throughput cao
> - **Atomic update**: Cập nhật 1 amenity trong mảng = 1 atomic operation (`$set` với positional `$`)
> - **Trade-off**: Document size phải < 16MB (BSON limit) — với hotel data thông thường hoàn toàn đủ

---

### T2.5 — MongoDB Query: Tìm hotel có Private Pool VÀ Butler Service

```javascript
// ============================================================
// T2.5: Query tìm hotel có ĐỒNG THỜI Private Pool + Butler Service
// Sử dụng $all trên trường amenities.name
// ============================================================

// --- Cách 1: Dùng $all (khuyến nghị) ---
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

// --- Cách 2: Dùng Aggregation Framework (nâng cao) ---
db.Hotel_Catalog.aggregate([
  // Stage 1: Lọc hotel có CẢ HAI amenities
  {
    $match: {
      "amenities.name": {
        $all: ["Private Pool", "Butler Service"]
      }
    }
  },
  // Stage 2: Chỉ giữ các amenities matching
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
  // Stage 3: Sắp xếp theo star rating
  { $sort: { star_rating: -1 } }
]);

// --- Index khuyến nghị ---
db.Hotel_Catalog.createIndex({ "amenities.name": 1 });
```

> **Tại sao `$all` tối ưu hơn query thông thường?**
>
> | Cách | Query | Vấn đề |
> |------|-------|--------|
> | **Sai** | `{ $and: [{ "amenities.name": "Private Pool" }, { "amenities.name": "Butler Service" }] }` | Hoạt động đúng nhưng dài dòng, khó maintain |
> | **Sai** | 2 lần `find()` rồi merge ở application | 2 lần roundtrip, tốn bandwidth, logic phức tạp |
> | **✅ Đúng** | `{ "amenities.name": { $all: [...] } }` | 1 lần query, MongoDB engine tối ưu sẵn bằng index intersection. Cú pháp ngắn gọn, declarative |
>
> **Khi nào dùng `$elemMatch` thay `$all`?**
> - `$all`: Khi chỉ kiểm tra **1 field** trong embedded doc (vd: chỉ `name`)
> - `$elemMatch`: Khi cần kiểm tra **nhiều field cùng 1 element** (vd: `name = "Pool" AND category = "RECREATION"` trên cùng 1 object trong mảng)

---

### T2.6 — Recursive CTE: Duyệt cây phân cấp Location

```sql
-- ============================================================
-- T2.6: Recursive CTE — Lấy toàn bộ location con từ gốc
-- Input: Tên hoặc ID của Region gốc (VD: 'Châu Á')
-- Output: Toàn bộ hierarchy con kèm Level
-- ============================================================

-- Bước 0: Insert dữ liệu mẫu
INSERT INTO Location (parent_location_id, location_code, location_name, location_type, level, iso_code) VALUES
(NULL,  'REG-ASIA',       N'Châu Á',           'REGION',         0, NULL),
(1,     'CTR-VN',          N'Việt Nam',         'COUNTRY',        1, 'VN'),
(1,     'CTR-TH',          N'Thái Lan',         'COUNTRY',        1, 'TH'),
(1,     'CTR-SG',          N'Singapore',        'COUNTRY',        1, 'SG'),
(2,     'STP-HCM',         N'Hồ Chí Minh',     'STATE_PROVINCE', 2, NULL),
(2,     'STP-KH',          N'Khánh Hòa',       'STATE_PROVINCE', 2, NULL),
(5,     'CTY-HCMC',        N'TP. Hồ Chí Minh', 'CITY',           3, NULL),
(6,     'CTY-NT',          N'Nha Trang',        'CITY',           3, NULL),
(7,     'DST-Q1',          N'Quận 1',           'DISTRICT',       4, NULL),
(7,     'DST-Q7',          N'Quận 7',           'DISTRICT',       4, NULL),
(3,     'CTY-BKK',         N'Bangkok',          'CITY',           3, NULL),
(4,     'DST-MARINA',      N'Marina Bay',       'DISTRICT',       4, NULL);
GO

-- Bước 1: Recursive CTE
DECLARE @root_name NVARCHAR(150) = N'Châu Á';

WITH LocationTree AS (
    -- ======= Anchor Member: Node gốc =======
    SELECT
        location_id,
        parent_location_id,
        location_code,
        location_name,
        location_type,
        level,
        iso_code,
        0 AS depth                           -- Depth tính từ node gốc
    FROM Location
    WHERE location_name = @root_name

    UNION ALL

    -- ======= Recursive Member: Các node con =======
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
    depth         AS tree_depth,    -- Depth tính từ node query
    REPLICATE('  ', depth) + location_name AS hierarchy_display
FROM LocationTree
ORDER BY level, location_name;
GO
```

**Kết quả mong đợi:**

```
schema_level | tree_depth | hierarchy_display
-------------|------------|----------------------------------
0            | 0          | Châu Á
1            | 1          |   Singapore
1            | 1          |   Thái Lan
1            | 1          |   Việt Nam
2            | 2          |     Hồ Chí Minh
2            | 2          |     Khánh Hòa
3            | 3          |       Bangkok
3            | 3          |       Nha Trang
3            | 3          |       TP. Hồ Chí Minh
4            | 4          |         Marina Bay
4            | 4          |         Quận 1
4            | 4          |         Quận 7
```

> **Ứng dụng thực tế**: Tìm tất cả hotel trong "Châu Á":
> ```sql
> SELECT H.* FROM Hotel H
> WHERE H.location_id IN (SELECT location_id FROM LocationTree);
> ```

---

## 📊 Người 3 — Analytics & Report

---

### T2.7 — VIEW tài chính: vw_ReservationTotal

```sql
-- ============================================================
-- T2.7: VIEW vw_ReservationTotal
-- Source of Truth cho tổng tiền reservation
-- Thay thế financial fields lưu cứng trong Reservation [FIX-3]
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

    -- ------- Room Revenue (từ ReservationRoom) -------
    ISNULL(room_totals.room_subtotal, 0)      AS room_subtotal,
    ISNULL(room_totals.room_tax, 0)           AS room_tax,
    ISNULL(room_totals.room_discount, 0)      AS room_discount,
    ISNULL(room_totals.room_final, 0)         AS room_final,
    ISNULL(room_totals.room_count, 0)         AS actual_room_count,

    -- ------- Service Revenue (từ ReservationService) -------
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

-- Aggregate payments (chỉ CAPTURED)
LEFT JOIN (
    SELECT
        reservation_id,
        SUM(amount) AS total_paid
    FROM Payment
    WHERE payment_status = 'CAPTURED'
    GROUP BY reservation_id
) pay_totals ON r.reservation_id = pay_totals.reservation_id;
GO

-- Cách dùng:
SELECT * FROM vw_ReservationTotal
WHERE reservation_code = 'RES-20260415-001';

-- Báo cáo doanh thu theo hotel:
SELECT hotel_id, COUNT(*) AS bookings, SUM(grand_total) AS revenue
FROM vw_ReservationTotal
WHERE reservation_status IN ('CONFIRMED','CHECKED_IN','CHECKED_OUT')
GROUP BY hotel_id;
GO
```

---

### T2.8 — Revenue Intelligence: Top 3 Room Types per Hotel (Window Functions)

```sql
-- ============================================================
-- T2.8: Top 3 loại phòng doanh thu cao nhất / Hotel — Q1 2026
-- BẮT BUỘC: Window Functions (SUM OVER + DENSE_RANK)
-- KHÔNG dùng GROUP BY + TOP đơn giản
-- ============================================================
WITH RoomRevenue AS (
    -- Bước 1: Tính doanh thu theo hotel + room_type, dùng SUM() OVER()
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

        -- Window Function: Tổng doanh thu hotel (để tính %)
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
-- Bước 2: Deduplicate + Rank
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
-- Bước 3: Lọc Top 3
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

**Kết quả mẫu:**

```
hotel_id | hotel_name                 | rank | room_type_name           | revenue     | share  | hotel_total
---------|----------------------------|------|--------------------------|-------------|--------|------------
1        | The Ritz-Carlton, Saigon   | 1    | Presidential Skyline     | 2,450,000   | 45.2%  | 5,420,000
1        | The Ritz-Carlton, Saigon   | 2    | Ritz-Carlton Suite       | 1,870,000   | 34.5%  | 5,420,000
1        | The Ritz-Carlton, Saigon   | 3    | Deluxe City View         | 830,000     | 15.3%  | 5,420,000
2        | W Hotel Bangkok            | 1    | Extreme WOW Suite        | 3,100,000   | 52.1%  | 5,950,000
...
```

> **Tại sao dùng DENSE_RANK thay vì ROW_NUMBER?**
> - `DENSE_RANK`: Nếu 2 room types có cùng doanh thu → cùng rank (1,1,2,3)
> - `ROW_NUMBER`: Luôn unique → 1 trong 2 bị đẩy xuống rank thấp hơn (không công bằng)

---

### T2.9 — AI Audit: Post-mortem Analysis Template

```markdown
## Post-mortem Analysis — AI-Generated Trigger Error

### 1. Đoạn code sai (do AI viết)

> [Dán đoạn code Trigger bị sai của AI vào đây]
> Ví dụ: Trigger không có TRY...CATCH, thiếu ROLLBACK, 
> hoặc dùng cú pháp MySQL (FOR UPDATE) thay vì SQL Server

### 2. Phân tích lỗi

| # | Lỗi | Mức nghiêm trọng | Giải thích |
|---|------|-------------------|------------|
| 1 | **Thiếu Deadlock handling** | 🔴 CRITICAL | Trigger thực thi trong context
    của transaction gốc. Nếu xảy ra Deadlock, SQL Server chọn 1 transaction
    làm victim và tự động ROLLBACK. Trigger không có `TRY...CATCH`
    → error không được xử lý → transaction gốc (UPDATE rate) cũng bị ROLLBACK
    mà caller không biết lý do. |
| 2 | **Không ROLLBACK trong CATCH** | 🔴 CRITICAL | Nếu INSERT vào
    RateChangeLog gặp lỗi (vd: constraint violation), transaction giữ trạng
    thái mở (@@TRANCOUNT > 0) → lock không giải phóng → các session khác
    bị BLOCK vô thời hạn → có thể gây **sự cố production**. |
| 3 | **Dùng cú pháp sai engine** | 🟡 WARNING | AI sinh code dùng
    `FOR UPDATE` (MySQL/PostgreSQL syntax) thay vì `WITH (UPDLOCK)` 
    (SQL Server). Lỗi syntax → trigger không deploy được. |

### 3. Nguyên nhân gốc (Root Cause)

AI không được cung cấp đủ bối cảnh kiến trúc hệ thống:
- Không biết target engine là **SQL Server** → sinh code generic/MySQL
- Không hiểu Trigger chạy **trong** transaction gốc → thiếu error handling
- Không có thông tin về cấu trúc `RateChangeLog` → INSERT fields sai

### 4. Prompt đã sửa (Corrective Prompt)

Nhóm đã dùng prompt sau để ép AI sửa lại:

> "Đoạn Trigger sau bị sai nghiêm trọng: [dán code sai]. 
> Hãy sửa lại theo các yêu cầu BẮT BUỘC:
> 1. Engine là SQL Server (T-SQL), KHÔNG dùng MySQL syntax
> 2. Bọc logic INSERT vào TRY...CATCH
> 3. Trong CATCH: kiểm tra @@TRANCOUNT > 0 thì ROLLBACK
> 4. Xử lý Deadlock: kiểm tra ERROR_NUMBER() = 1205
> 5. Sử dụng bảng ảo INSERTED và DELETED để so sánh giá cũ/mới
> 6. Tham chiếu cấu trúc bảng RateChangeLog đính kèm: [dán schema]"

### 5. Bài học rút ra

1. **Luôn set context đầu tiên**: Dán schema/summary vào đầu prompt
2. **Chỉ định engine rõ ràng**: "SQL Server (T-SQL)" thay vì chỉ "SQL"
3. **Yêu cầu error handling**: Yêu cầu TRY...CATCH + Deadlock handling
4. **Review mọi output của AI**: Đặc biệt kiểm tra syntax engine và 
   transaction safety trước khi chạy
```

---

## 💡 Checklist vận hành nhóm

- [ ] Mỗi thành viên bật **New Chat** khi bắt đầu task mới
- [ ] Dán `GlobalLuxuryHotelReservationEngine_REMAKE_Summary.md` vào dòng đầu prompt
- [ ] Luôn ghi rõ: **"Engine: SQL Server (T-SQL)"** hoặc **"Engine: MongoDB"**
- [ ] Nếu AI dùng `FOR UPDATE` (MySQL) → yêu cầu sửa sang `WITH (UPDLOCK, HOLDLOCK)`
- [ ] Nếu AI dùng `LIMIT` (MySQL) → yêu cầu sửa sang `TOP` (SQL Server)
- [ ] Lưu lại mọi prompt + response để làm AI Audit (15% điểm)
