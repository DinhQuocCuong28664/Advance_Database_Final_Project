-- ============================================================
-- LuxeReserve - 02: Create All Tables (30 tables)
-- Engine: SQL Server 2022 (T-SQL)
-- Order: Dependency-safe (parents before children)
-- ============================================================

USE LuxeReserve;
GO

-- Required for computed columns with PERSISTED + indexes
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- ============================================================
-- DOMAIN 1: LOCATION HIERARCHY [FIX-7]
-- ============================================================

CREATE TABLE Location (
    location_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    parent_location_id  BIGINT          NULL,
    location_code       VARCHAR(50)     NOT NULL,
    location_name       NVARCHAR(150)   NOT NULL,
    location_type       VARCHAR(20)     NOT NULL,
    level               INT             NOT NULL,
    iso_code            VARCHAR(10)     NULL,
    latitude            DECIMAL(10,7)   NULL,
    longitude           DECIMAL(10,7)   NULL,
    timezone            VARCHAR(64)     NULL,
    created_at          DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at          DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT UQ_Location_Code   UNIQUE (location_code),
    CONSTRAINT FK_Location_Parent FOREIGN KEY (parent_location_id) REFERENCES Location(location_id),
    CONSTRAINT CK_Location_Type   CHECK (location_type IN ('REGION','COUNTRY','STATE_PROVINCE','CITY','DISTRICT')),
    CONSTRAINT CK_Location_Level  CHECK (level BETWEEN 0 AND 4)
);
CREATE INDEX IX_Location_Parent   ON Location(parent_location_id);
CREATE INDEX IX_Location_TypeName ON Location(location_type, location_name);
GO

PRINT '[OK] Location';
GO

-- ============================================================
-- DOMAIN 2: HOTEL CHAIN -> BRAND -> HOTEL
-- ============================================================

CREATE TABLE HotelChain (
    chain_id                    BIGINT IDENTITY(1,1) PRIMARY KEY,
    chain_code                  VARCHAR(50)     NOT NULL,
    chain_name                  NVARCHAR(150)   NOT NULL,
    headquarters_country_code   CHAR(2)         NULL,
    headquarters_city           NVARCHAR(100)   NULL,
    official_website            VARCHAR(255)    NULL,
    support_email               VARCHAR(150)    NULL,
    support_phone               VARCHAR(30)     NULL,
    luxury_segment              VARCHAR(20)     NOT NULL,
    status                      VARCHAR(10)     NOT NULL DEFAULT 'ACTIVE',
    created_at                  DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at                  DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT UQ_HotelChain_Code     UNIQUE (chain_code),
    CONSTRAINT CK_HotelChain_Segment  CHECK (luxury_segment IN ('ULTRA_LUXURY','LUXURY_RESORT','LUXURY_BUSINESS','BOUTIQUE_LUXURY','PRIVATE_ISLAND')),
    CONSTRAINT CK_HotelChain_Status   CHECK (status IN ('ACTIVE','INACTIVE'))
);
GO

PRINT '[OK] HotelChain';
GO

CREATE TABLE Brand (
    brand_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    chain_id            BIGINT          NOT NULL,
    brand_code          VARCHAR(50)     NOT NULL,
    brand_name          NVARCHAR(150)   NOT NULL,
    brand_positioning   NVARCHAR(150)   NULL,
    star_standard       INT             NULL,
    description         NVARCHAR(MAX)   NULL,
    status              VARCHAR(10)     NOT NULL DEFAULT 'ACTIVE',
    created_at          DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at          DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_Brand_Chain       FOREIGN KEY (chain_id) REFERENCES HotelChain(chain_id),
    CONSTRAINT UQ_Brand_ChainCode   UNIQUE (chain_id, brand_code),
    CONSTRAINT CK_Brand_Status      CHECK (status IN ('ACTIVE','INACTIVE'))
);
GO

PRINT '[OK] Brand';
GO

CREATE TABLE Hotel (
    hotel_id                BIGINT IDENTITY(1,1) PRIMARY KEY,
    brand_id                BIGINT          NOT NULL,
    hotel_code              VARCHAR(50)     NOT NULL,
    hotel_name              NVARCHAR(200)   NOT NULL,
    legal_name              NVARCHAR(200)   NULL,
    hotel_type              VARCHAR(20)     NOT NULL,
    star_rating             INT             NOT NULL,
    opening_date            DATE            NULL,
    status                  VARCHAR(15)     NOT NULL DEFAULT 'ACTIVE',
    timezone                VARCHAR(64)     NOT NULL,
    currency_code           CHAR(3)         NOT NULL,
    check_in_time           TIME            NULL,
    check_out_time          TIME            NULL,
    total_floors            INT             NULL,
    total_rooms             INT             NULL,
    primary_language_code   VARCHAR(10)     NULL,
    contact_email           VARCHAR(150)    NULL,
    contact_phone           VARCHAR(30)     NULL,
    reservation_email       VARCHAR(150)    NULL,
    reservation_phone       VARCHAR(30)     NULL,
    location_id             BIGINT          NOT NULL,
    address_line_1          NVARCHAR(200)   NOT NULL,
    address_line_2          NVARCHAR(200)   NULL,
    postal_code             VARCHAR(20)     NULL,
    latitude                DECIMAL(10,7)   NULL,
    longitude               DECIMAL(10,7)   NULL,
    created_at              DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at              DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT UQ_Hotel_Code    UNIQUE (hotel_code),
    CONSTRAINT FK_Hotel_Brand   FOREIGN KEY (brand_id)    REFERENCES Brand(brand_id),
    CONSTRAINT FK_Hotel_Location FOREIGN KEY (location_id) REFERENCES Location(location_id),
    CONSTRAINT CK_Hotel_Type    CHECK (hotel_type IN ('CITY_HOTEL','RESORT','VILLA_RESORT','AIRPORT_LUXURY','BUSINESS_LUXURY')),
    CONSTRAINT CK_Hotel_Status  CHECK (status IN ('PREOPENING','ACTIVE','RENOVATING','CLOSED'))
);
GO

PRINT '[OK] Hotel';
GO

-- ============================================================
-- DOMAIN 3: HOTEL POLICIES & AMENITIES
-- ============================================================

CREATE TABLE HotelPolicy (
    policy_id                   BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id                    BIGINT          NOT NULL,
    cancellation_policy_text    NVARCHAR(MAX)   NULL,
    deposit_policy_text         NVARCHAR(MAX)   NULL,
    child_policy_text           NVARCHAR(MAX)   NULL,
    pet_policy_text             NVARCHAR(MAX)   NULL,
    smoking_policy_text         NVARCHAR(MAX)   NULL,
    extra_bed_policy_text       NVARCHAR(MAX)   NULL,
    late_checkout_policy_text   NVARCHAR(MAX)   NULL,
    early_checkin_policy_text   NVARCHAR(MAX)   NULL,
    identity_document_required  BIT             NOT NULL DEFAULT 0,
    minimum_checkin_age         INT             NULL,
    refundable_flag             BIT             NOT NULL DEFAULT 1,
    effective_from              DATETIME        NOT NULL,
    effective_to                DATETIME        NULL,
    status                      VARCHAR(10)     NOT NULL DEFAULT 'ACTIVE',
    created_at                  DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at                  DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_HotelPolicy_Hotel FOREIGN KEY (hotel_id) REFERENCES Hotel(hotel_id),
    CONSTRAINT CK_HotelPolicy_Status CHECK (status IN ('ACTIVE','INACTIVE','EXPIRED'))
);
GO

PRINT '[OK] HotelPolicy';
GO

-- [FIX-1] Removed currency_code, [FIX-5] moved amenity_name/category to MongoDB
CREATE TABLE HotelAmenity (
    hotel_amenity_id    BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id            BIGINT          NOT NULL,
    amenity_code        VARCHAR(50)     NOT NULL, -- Link key -> MongoDB amenity_master
    is_complimentary    BIT             NOT NULL DEFAULT 1,
    is_chargeable       BIT             NOT NULL DEFAULT 0,
    base_fee            DECIMAL(18,2)   NULL,
    availability_status VARCHAR(30)     NULL,
    operating_hours     VARCHAR(100)    NULL,
    notes               NVARCHAR(MAX)   NULL,
    created_at          DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at          DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_HotelAmenity_Hotel    FOREIGN KEY (hotel_id) REFERENCES Hotel(hotel_id),
    CONSTRAINT UQ_HotelAmenity_Code     UNIQUE (hotel_id, amenity_code)
);
GO

PRINT '[OK] HotelAmenity';
GO

-- ============================================================
-- DOMAIN 4: ROOM MANAGEMENT
-- ============================================================

-- [FIX-6] Removed base_description and boolean features -> MongoDB room_type_catalog
CREATE TABLE RoomType (
    room_type_id    BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id        BIGINT          NOT NULL,
    room_type_code  VARCHAR(50)     NOT NULL, -- Link key -> MongoDB room_type_catalog
    room_type_name  NVARCHAR(150)   NOT NULL,
    category        VARCHAR(25)     NOT NULL,
    bed_type        VARCHAR(15)     NOT NULL,
    max_adults      INT             NOT NULL,
    max_children    INT             NOT NULL DEFAULT 0,
    max_occupancy   INT             NOT NULL,
    room_size_sqm   DECIMAL(10,2)   NULL,
    view_type       VARCHAR(20)     NULL,
    smoking_allowed BIT             NOT NULL DEFAULT 0,
    status          VARCHAR(10)     NOT NULL DEFAULT 'ACTIVE',
    created_at      DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at      DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_RoomType_Hotel    FOREIGN KEY (hotel_id) REFERENCES Hotel(hotel_id),
    CONSTRAINT UQ_RoomType_Code     UNIQUE (hotel_id, room_type_code),
    CONSTRAINT CK_RoomType_Cat      CHECK (category IN ('DELUXE','PREMIER','SUITE','VILLA','PRESIDENTIAL_SUITE')),
    CONSTRAINT CK_RoomType_Bed      CHECK (bed_type IN ('KING','TWIN','DOUBLE','SOFA_BED','MIXED')),
    CONSTRAINT CK_RoomType_View     CHECK (view_type IS NULL OR view_type IN ('OCEAN','CITY','GARDEN','MOUNTAIN','POOL','PARTIAL_OCEAN','COURTYARD','LANDMARK')),
    CONSTRAINT CK_RoomType_Status   CHECK (status IN ('ACTIVE','INACTIVE'))
);
GO

PRINT '[OK] RoomType';
GO

CREATE TABLE Room (
    room_id             BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id            BIGINT          NOT NULL,
    room_type_id        BIGINT          NOT NULL,
    room_number         VARCHAR(20)     NOT NULL,
    floor_number        INT             NULL,
    wing_block          VARCHAR(50)     NULL,
    room_status         VARCHAR(15)     NOT NULL DEFAULT 'AVAILABLE',
    housekeeping_status VARCHAR(15)     NOT NULL DEFAULT 'CLEAN',
    maintenance_status  VARCHAR(15)     NOT NULL DEFAULT 'NORMAL',
    near_elevator_flag  BIT             NOT NULL DEFAULT 0,
    connecting_room_flag BIT            NOT NULL DEFAULT 0,
    connected_room_id   BIGINT          NULL,
    is_accessible       BIT             NOT NULL DEFAULT 0,
    is_vip_preferred    BIT             NOT NULL DEFAULT 0,
    last_renovated_at   DATETIME        NULL,
    created_at          DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at          DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_Room_Hotel        FOREIGN KEY (hotel_id)    REFERENCES Hotel(hotel_id),
    CONSTRAINT FK_Room_RoomType     FOREIGN KEY (room_type_id) REFERENCES RoomType(room_type_id),
    CONSTRAINT FK_Room_Connected    FOREIGN KEY (connected_room_id) REFERENCES Room(room_id),
    CONSTRAINT UQ_Room_Number       UNIQUE (hotel_id, room_number),
    CONSTRAINT CK_Room_Status       CHECK (room_status IN ('AVAILABLE','OCCUPIED','OOO','OOS','CLEANING','RESERVED','BLOCKED')),
    CONSTRAINT CK_Room_HK          CHECK (housekeeping_status IN ('CLEAN','DIRTY','INSPECTED','IN_PROGRESS')),
    CONSTRAINT CK_Room_Maint       CHECK (maintenance_status IN ('NORMAL','UNDER_REPAIR','BLOCKED'))
);
GO

PRINT '[OK] Room';
GO

-- [FIX-8] CHECK constraint: at least 1 FK must be NOT NULL
CREATE TABLE RoomFeature (
    room_feature_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
    room_id             BIGINT          NULL,
    room_type_id        BIGINT          NULL,
    feature_code        VARCHAR(50)     NOT NULL,
    feature_name        NVARCHAR(150)   NOT NULL,
    feature_category    VARCHAR(50)     NULL,
    feature_value       NVARCHAR(255)   NULL,
    is_premium          BIT             NOT NULL DEFAULT 0,
    created_at          DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_RoomFeature_Room      FOREIGN KEY (room_id)      REFERENCES Room(room_id),
    CONSTRAINT FK_RoomFeature_RoomType  FOREIGN KEY (room_type_id) REFERENCES RoomType(room_type_id),
    CONSTRAINT CK_RoomFeature_AtLeastOneFK CHECK (room_id IS NOT NULL OR room_type_id IS NOT NULL)
);
GO

PRINT '[OK] RoomFeature';
GO

-- Critical inventory table - supports pessimistic locking
CREATE TABLE RoomAvailability (
    availability_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id            BIGINT          NOT NULL, -- Denormalized for performance
    room_id             BIGINT          NOT NULL,
    stay_date           DATE            NOT NULL,
    availability_status VARCHAR(10)     NOT NULL DEFAULT 'OPEN',
    sellable_flag       BIT             NOT NULL DEFAULT 1,
    rate_plan_open_flag BIT             NOT NULL DEFAULT 1,
    min_los             INT             NULL,
    max_los             INT             NULL,
    cta_flag            BIT             NOT NULL DEFAULT 0,
    ctd_flag            BIT             NOT NULL DEFAULT 0,
    inventory_note      NVARCHAR(255)   NULL,
    last_synced_at      DATETIME        NULL,
    version_no          INT             NOT NULL DEFAULT 1,
    created_at          DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at          DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_RoomAvail_Hotel   FOREIGN KEY (hotel_id) REFERENCES Hotel(hotel_id),
    CONSTRAINT FK_RoomAvail_Room    FOREIGN KEY (room_id)  REFERENCES Room(room_id),
    CONSTRAINT UQ_RoomAvail_Date    UNIQUE (room_id, stay_date),
    CONSTRAINT CK_RoomAvail_Status  CHECK (availability_status IN ('OPEN','HELD','BOOKED','BLOCKED'))
);
CREATE INDEX IX_RoomAvail_HotelDate   ON RoomAvailability(hotel_id, stay_date);
CREATE INDEX IX_RoomAvail_HotelStatus ON RoomAvailability(hotel_id, availability_status, stay_date);
GO

PRINT '[OK] RoomAvailability';
GO

-- ============================================================
-- DOMAIN 5: GUEST MANAGEMENT
-- ============================================================

-- [FIX-4] full_name = Computed Column (PERSISTED)
CREATE TABLE Guest (
    guest_id                    BIGINT IDENTITY(1,1) PRIMARY KEY,
    guest_code                  VARCHAR(50)     NOT NULL,
    title                       NVARCHAR(20)    NULL,
    first_name                  NVARCHAR(100)   NOT NULL,
    middle_name                 NVARCHAR(100)   NULL,
    last_name                   NVARCHAR(100)   NOT NULL,
    full_name AS (
        RTRIM(
            CONCAT(
                COALESCE(first_name, N''), N' ',
                COALESCE(middle_name, N''), N' ',
                COALESCE(last_name, N'')
            )
        )
    ) PERSISTED,
    gender                      VARCHAR(15)     NULL,
    date_of_birth               DATE            NULL,
    nationality_country_code    CHAR(2)         NULL,
    email                       VARCHAR(150)    NULL,
    phone_country_code          VARCHAR(10)     NULL,
    phone_number                VARCHAR(30)     NULL,
    preferred_language_code     VARCHAR(10)     NULL,
    vip_flag                    BIT             NOT NULL DEFAULT 0,
    marketing_opt_in_flag       BIT             NOT NULL DEFAULT 0,
    identity_document_type      VARCHAR(30)     NULL,
    identity_document_no        VARCHAR(80)     NULL,
    document_issue_country      CHAR(2)         NULL,
    created_at                  DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at                  DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT UQ_Guest_Code    UNIQUE (guest_code),
    CONSTRAINT CK_Guest_Gender  CHECK (gender IS NULL OR gender IN ('MALE','FEMALE','OTHER','UNDISCLOSED'))
);
CREATE INDEX IX_Guest_Email ON Guest(email);
CREATE INDEX IX_Guest_Phone ON Guest(phone_country_code, phone_number);
GO

PRINT '[OK] Guest';
GO

CREATE TABLE GuestAddress (
    guest_address_id    BIGINT IDENTITY(1,1) PRIMARY KEY,
    guest_id            BIGINT          NOT NULL,
    address_type        VARCHAR(10)     NOT NULL,
    address_line_1      NVARCHAR(200)   NOT NULL,
    address_line_2      NVARCHAR(200)   NULL,
    city                NVARCHAR(100)   NULL,
    state_province      NVARCHAR(100)   NULL,
    postal_code         VARCHAR(20)     NULL,
    country_code        CHAR(2)         NOT NULL,
    is_primary          BIT             NOT NULL DEFAULT 0,
    created_at          DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at          DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_GuestAddr_Guest   FOREIGN KEY (guest_id) REFERENCES Guest(guest_id),
    CONSTRAINT CK_GuestAddr_Type    CHECK (address_type IN ('HOME','WORK','BILLING'))
);
GO

PRINT '[OK] GuestAddress';
GO

CREATE TABLE GuestPreference (
    preference_id       BIGINT IDENTITY(1,1) PRIMARY KEY,
    guest_id            BIGINT          NOT NULL,
    preference_type     VARCHAR(20)     NOT NULL,
    preference_value    NVARCHAR(255)   NOT NULL,
    priority_level      VARCHAR(10)     NOT NULL DEFAULT 'MEDIUM',
    effective_from      DATETIME        NULL,
    effective_to        DATETIME        NULL,
    note                NVARCHAR(255)   NULL,
    created_at          DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at          DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_GuestPref_Guest   FOREIGN KEY (guest_id) REFERENCES Guest(guest_id),
    CONSTRAINT CK_GuestPref_Type    CHECK (preference_type IN ('BED','PILLOW','FLOOR','DIET','VIEW','TRANSPORT','NEWSPAPER','ROOM_SCENT','HOUSEKEEPING','ACCESSIBILITY','OTHER')),
    CONSTRAINT CK_GuestPref_Priority CHECK (priority_level IN ('LOW','MEDIUM','HIGH','CRITICAL'))
);
CREATE INDEX IX_GuestPref_Type ON GuestPreference(guest_id, preference_type);
GO

PRINT '[OK] GuestPreference';
GO

CREATE TABLE LoyaltyAccount (
    loyalty_account_id  BIGINT IDENTITY(1,1) PRIMARY KEY,
    guest_id            BIGINT          NOT NULL,
    chain_id            BIGINT          NOT NULL,
    membership_no       VARCHAR(50)     NOT NULL,
    tier_code           VARCHAR(10)     NOT NULL,
    points_balance      DECIMAL(18,2)   NOT NULL DEFAULT 0,
    lifetime_points     DECIMAL(18,2)   NOT NULL DEFAULT 0,
    enrollment_date     DATE            NOT NULL,
    expiry_date         DATE            NULL,
    status              VARCHAR(10)     NOT NULL DEFAULT 'ACTIVE',
    created_at          DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at          DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_Loyalty_Guest     FOREIGN KEY (guest_id) REFERENCES Guest(guest_id),
    CONSTRAINT FK_Loyalty_Chain     FOREIGN KEY (chain_id) REFERENCES HotelChain(chain_id),
    CONSTRAINT UQ_Loyalty_Member    UNIQUE (membership_no),
    CONSTRAINT UQ_Loyalty_GuestChain UNIQUE (guest_id, chain_id),
    CONSTRAINT CK_Loyalty_Tier      CHECK (tier_code IN ('SILVER','GOLD','PLATINUM','BLACK')),
    CONSTRAINT CK_Loyalty_Status    CHECK (status IN ('ACTIVE','SUSPENDED','EXPIRED','CLOSED'))
);
GO

PRINT '[OK] LoyaltyAccount';
GO

CREATE TABLE GuestAuth (
    guest_auth_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    guest_id              BIGINT          NOT NULL,
    login_email           VARCHAR(150)    NOT NULL,
    password_hash         VARCHAR(255)    NOT NULL,
    account_status        VARCHAR(10)     NOT NULL DEFAULT 'ACTIVE',
    email_verified_at     DATETIME        NULL,
    last_login_at         DATETIME        NULL,
    created_at            DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at            DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_GuestAuth_Guest   FOREIGN KEY (guest_id) REFERENCES Guest(guest_id),
    CONSTRAINT UQ_GuestAuth_Guest   UNIQUE (guest_id),
    CONSTRAINT UQ_GuestAuth_Email   UNIQUE (login_email),
    CONSTRAINT CK_GuestAuth_Status  CHECK (account_status IN ('ACTIVE','LOCKED','DISABLED'))
);
CREATE INDEX IX_GuestAuth_LoginEmail ON GuestAuth(login_email);
GO

PRINT '[OK] GuestAuth';
GO

-- ============================================================
-- DOMAIN 6: SYSTEM USERS & ROLES
-- ============================================================

CREATE TABLE SystemUser (
    user_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id        BIGINT          NULL,
    username        VARCHAR(80)     NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    full_name       NVARCHAR(150)   NOT NULL,
    email           VARCHAR(150)    NOT NULL,
    phone           VARCHAR(30)     NULL,
    job_title       NVARCHAR(100)   NULL,
    department      VARCHAR(20)     NULL,
    account_status  VARCHAR(10)     NOT NULL DEFAULT 'ACTIVE',
    last_login_at   DATETIME        NULL,
    created_at      DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at      DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_SystemUser_Hotel  FOREIGN KEY (hotel_id) REFERENCES Hotel(hotel_id),
    CONSTRAINT UQ_SystemUser_Name   UNIQUE (username),
    CONSTRAINT CK_SysUser_Dept      CHECK (department IS NULL OR department IN ('FRONT_OFFICE','RESERVATIONS','HOUSEKEEPING','FINANCE','SALES','IT','ENGINEERING','MANAGEMENT')),
    CONSTRAINT CK_SysUser_Status    CHECK (account_status IN ('ACTIVE','LOCKED','DISABLED'))
);
GO

PRINT '[OK] SystemUser';
GO

CREATE TABLE Role (
    role_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
    role_code   VARCHAR(50)     NOT NULL,
    role_name   NVARCHAR(100)   NOT NULL,
    description NVARCHAR(255)   NULL,
    created_at  DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT UQ_Role_Code UNIQUE (role_code)
);
GO

PRINT '[OK] Role';
GO

CREATE TABLE UserRole (
    user_role_id    BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id         BIGINT      NOT NULL,
    role_id         BIGINT      NOT NULL,
    assigned_at     DATETIME    NOT NULL DEFAULT GETDATE(),
    assigned_by     BIGINT      NULL,

    CONSTRAINT FK_UserRole_User     FOREIGN KEY (user_id)     REFERENCES SystemUser(user_id),
    CONSTRAINT FK_UserRole_Role     FOREIGN KEY (role_id)     REFERENCES Role(role_id),
    CONSTRAINT FK_UserRole_Assigner FOREIGN KEY (assigned_by) REFERENCES SystemUser(user_id),
    CONSTRAINT UQ_UserRole          UNIQUE (user_id, role_id)
);
GO

PRINT '[OK] UserRole';
GO

-- ============================================================
-- DOMAIN 7: RATE & PRICING
-- ============================================================

CREATE TABLE RatePlan (
    rate_plan_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id                BIGINT          NOT NULL,
    rate_plan_code          VARCHAR(50)     NOT NULL,
    rate_plan_name          NVARCHAR(150)   NOT NULL,
    rate_plan_type          VARCHAR(20)     NOT NULL,
    meal_inclusion          VARCHAR(20)     NOT NULL DEFAULT 'ROOM_ONLY',
    cancellation_policy_id  BIGINT          NULL,
    is_refundable           BIT             NOT NULL DEFAULT 1,
    requires_prepayment     BIT             NOT NULL DEFAULT 0,
    min_advance_booking_days INT            NULL,
    max_advance_booking_days INT            NULL,
    status                  VARCHAR(10)     NOT NULL DEFAULT 'ACTIVE',
    effective_from          DATETIME        NOT NULL,
    effective_to            DATETIME        NULL,
    created_at              DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at              DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_RatePlan_Hotel    FOREIGN KEY (hotel_id)                REFERENCES Hotel(hotel_id),
    CONSTRAINT FK_RatePlan_Policy   FOREIGN KEY (cancellation_policy_id)  REFERENCES HotelPolicy(policy_id),
    CONSTRAINT UQ_RatePlan_Code     UNIQUE (hotel_id, rate_plan_code),
    CONSTRAINT CK_RatePlan_Type     CHECK (rate_plan_type IN ('BAR','NON_REFUNDABLE','MEMBER','PACKAGE','CORPORATE','PROMO')),
    CONSTRAINT CK_RatePlan_Meal     CHECK (meal_inclusion IN ('ROOM_ONLY','BREAKFAST','HALF_BOARD','FULL_BOARD','ALL_INCLUSIVE')),
    CONSTRAINT CK_RatePlan_Status   CHECK (status IN ('ACTIVE','INACTIVE'))
);
GO

PRINT '[OK] RatePlan';
GO

-- [FIX-1] Removed currency_code -> JOIN Hotel.currency_code
CREATE TABLE RoomRate (
    room_rate_id            BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id                BIGINT          NOT NULL,
    room_type_id            BIGINT          NOT NULL,
    rate_plan_id            BIGINT          NOT NULL,
    rate_date               DATE            NOT NULL,
    base_rate               DECIMAL(18,2)   NOT NULL,
    discount_amount         DECIMAL(18,2)   NOT NULL DEFAULT 0,
    discount_percent        DECIMAL(5,2)    NOT NULL DEFAULT 0,
    final_rate              DECIMAL(18,2)   NOT NULL,
    tax_inclusive_flag       BIT             NOT NULL DEFAULT 0,
    available_inventory_count INT           NULL,
    price_source            VARCHAR(20)     NOT NULL DEFAULT 'MANUAL',
    demand_level            VARCHAR(10)     NOT NULL DEFAULT 'NORMAL',
    created_by              BIGINT          NULL,
    updated_by              BIGINT          NULL,
    created_at              DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at              DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_RoomRate_Hotel    FOREIGN KEY (hotel_id)     REFERENCES Hotel(hotel_id),
    CONSTRAINT FK_RoomRate_RoomType FOREIGN KEY (room_type_id) REFERENCES RoomType(room_type_id),
    CONSTRAINT FK_RoomRate_RatePlan FOREIGN KEY (rate_plan_id) REFERENCES RatePlan(rate_plan_id),
    CONSTRAINT FK_RoomRate_Creator  FOREIGN KEY (created_by)   REFERENCES SystemUser(user_id),
    CONSTRAINT FK_RoomRate_Updater  FOREIGN KEY (updated_by)   REFERENCES SystemUser(user_id),
    CONSTRAINT UQ_RoomRate_Combo    UNIQUE (room_type_id, rate_plan_id, rate_date),
    CONSTRAINT CK_RoomRate_Source   CHECK (price_source IN ('MANUAL','YIELD_ENGINE','PROMOTION','SEASONAL_RULE')),
    CONSTRAINT CK_RoomRate_Demand   CHECK (demand_level IN ('LOW','NORMAL','HIGH','PEAK'))
);
CREATE INDEX IX_RoomRate_HotelDate ON RoomRate(hotel_id, rate_date);
GO

PRINT '[OK] RoomRate';
GO

-- [FIX-2] Removed hotel_id, room_type_id, rate_plan_id -> JOIN from RoomRate
CREATE TABLE RateChangeLog (
    rate_change_log_id  BIGINT IDENTITY(1,1) PRIMARY KEY,
    room_rate_id        BIGINT          NOT NULL,
    old_rate            DECIMAL(18,2)   NOT NULL,
    new_rate            DECIMAL(18,2)   NOT NULL,
    change_amount       DECIMAL(18,2)   NOT NULL,
    change_percent      DECIMAL(9,4)    NOT NULL,
    change_reason       NVARCHAR(255)   NULL,
    triggered_at        DATETIME        NOT NULL DEFAULT GETDATE(),
    triggered_by        BIGINT          NULL,
    severity_level      VARCHAR(10)     NOT NULL DEFAULT 'WARNING',
    review_status       VARCHAR(15)     NOT NULL DEFAULT 'OPEN',

    CONSTRAINT FK_RateChangeLog_Rate    FOREIGN KEY (room_rate_id) REFERENCES RoomRate(room_rate_id),
    CONSTRAINT FK_RateChangeLog_User    FOREIGN KEY (triggered_by) REFERENCES SystemUser(user_id),
    CONSTRAINT CK_RCL_Severity          CHECK (severity_level IN ('WARNING','CRITICAL')),
    CONSTRAINT CK_RCL_ReviewStatus      CHECK (review_status IN ('OPEN','ACKNOWLEDGED','CLOSED'))
);
CREATE INDEX IX_RCL_RateTime ON RateChangeLog(room_rate_id, triggered_at);
GO

PRINT '[OK] RateChangeLog';
GO

CREATE TABLE Promotion (
    promotion_id    BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id        BIGINT          NULL,
    brand_id        BIGINT          NULL,
    promotion_code  VARCHAR(50)     NOT NULL,
    promotion_name  NVARCHAR(150)   NOT NULL,
    promotion_type  VARCHAR(50)     NOT NULL,
    discount_value  DECIMAL(18,2)   NOT NULL,
    currency_code   CHAR(3)         NULL, -- Cross-hotel -> keep own currency
    applies_to      VARCHAR(30)     NOT NULL,
    booking_start_date DATE         NOT NULL,
    booking_end_date   DATE         NOT NULL,
    stay_start_date    DATE         NOT NULL,
    stay_end_date      DATE         NOT NULL,
    member_only_flag   BIT          NOT NULL DEFAULT 0,
    min_nights         INT          NULL,
    redeemable_points_cost DECIMAL(18,2) NULL,
    voucher_valid_days INT          NULL,
    status          VARCHAR(10)     NOT NULL DEFAULT 'ACTIVE',
    created_at      DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at      DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_Promo_Hotel   FOREIGN KEY (hotel_id) REFERENCES Hotel(hotel_id),
    CONSTRAINT FK_Promo_Brand   FOREIGN KEY (brand_id) REFERENCES Brand(brand_id),
    CONSTRAINT UQ_Promo_Code    UNIQUE (promotion_code),
    CONSTRAINT CK_Promo_Status  CHECK (status IN ('ACTIVE','INACTIVE')),
    CONSTRAINT CK_Promo_PointsCost CHECK (redeemable_points_cost IS NULL OR redeemable_points_cost >= 0),
    CONSTRAINT CK_Promo_VoucherDays CHECK (voucher_valid_days IS NULL OR voucher_valid_days >= 1)
);
GO

PRINT '[OK] Promotion';
GO

-- ============================================================
-- DOMAIN 8: BOOKING & RESERVATION
-- ============================================================

CREATE TABLE BookingChannel (
    booking_channel_id  BIGINT IDENTITY(1,1) PRIMARY KEY,
    channel_code        VARCHAR(50)     NOT NULL,
    channel_name        NVARCHAR(150)   NOT NULL,
    channel_type        VARCHAR(20)     NOT NULL,
    commission_percent  DECIMAL(5,2)    NOT NULL DEFAULT 0,
    contact_email       VARCHAR(150)    NULL,
    status              VARCHAR(10)     NOT NULL DEFAULT 'ACTIVE',
    created_at          DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at          DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT UQ_BookChan_Code     UNIQUE (channel_code),
    CONSTRAINT CK_BookChan_Type     CHECK (channel_type IN ('DIRECT','OTA','GDS','CORPORATE','TRAVEL_AGENT','WHOLESALER')),
    CONSTRAINT CK_BookChan_Status   CHECK (status IN ('ACTIVE','INACTIVE'))
);
GO

PRINT '[OK] BookingChannel';
GO

-- [FIX-3] Financial fields kept for backward compat - use vw_ReservationTotal instead
CREATE TABLE Reservation (
    reservation_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    reservation_code        VARCHAR(50)     NOT NULL,
    hotel_id                BIGINT          NOT NULL,
    guest_id                BIGINT          NOT NULL,
    booking_channel_id      BIGINT          NOT NULL,
    booking_source          VARCHAR(20)     NOT NULL,
    reservation_status      VARCHAR(15)     NOT NULL DEFAULT 'PENDING',
    booking_datetime        DATETIME        NOT NULL DEFAULT GETDATE(),
    checkin_date            DATE            NOT NULL,
    checkout_date           DATE            NOT NULL,
    nights                  INT             NOT NULL,
    adult_count             INT             NOT NULL,
    child_count             INT             NOT NULL DEFAULT 0,
    room_count              INT             NOT NULL DEFAULT 1,
    currency_code           CHAR(3)         NOT NULL, -- Snapshot at booking time
    subtotal_amount         DECIMAL(18,2)   NOT NULL DEFAULT 0,
    tax_amount              DECIMAL(18,2)   NOT NULL DEFAULT 0,
    service_charge_amount   DECIMAL(18,2)   NOT NULL DEFAULT 0,
    discount_amount         DECIMAL(18,2)   NOT NULL DEFAULT 0,
    grand_total_amount      DECIMAL(18,2)   NOT NULL DEFAULT 0,
    deposit_required_flag   BIT             NOT NULL DEFAULT 0,
    deposit_amount          DECIMAL(18,2)   NOT NULL DEFAULT 0,
    guarantee_type          VARCHAR(20)     NOT NULL DEFAULT 'NONE',
    special_request_text    NVARCHAR(MAX)   NULL,
    arrival_time_estimate   TIME            NULL,
    purpose_of_stay         VARCHAR(15)     NOT NULL DEFAULT 'LEISURE',
    created_by_user_id      BIGINT          NULL,
    created_at              DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at              DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT UQ_Reservation_Code      UNIQUE (reservation_code),
    CONSTRAINT FK_Reservation_Hotel     FOREIGN KEY (hotel_id)             REFERENCES Hotel(hotel_id),
    CONSTRAINT FK_Reservation_Guest     FOREIGN KEY (guest_id)             REFERENCES Guest(guest_id),
    CONSTRAINT FK_Reservation_Channel   FOREIGN KEY (booking_channel_id)   REFERENCES BookingChannel(booking_channel_id),
    CONSTRAINT FK_Reservation_Creator   FOREIGN KEY (created_by_user_id)   REFERENCES SystemUser(user_id),
    CONSTRAINT CK_Resv_Source   CHECK (booking_source IN ('DIRECT_WEB','MOBILE_APP','OTA','AGENT','CALL_CENTER','WALK_IN','CORPORATE')),
    CONSTRAINT CK_Resv_Status   CHECK (reservation_status IN ('PENDING','CONFIRMED','CHECKED_IN','CHECKED_OUT','CANCELLED','NO_SHOW')),
    CONSTRAINT CK_Resv_Guarantee CHECK (guarantee_type IN ('CARD','DEPOSIT','COMPANY_GUARANTEE','NONE')),
    CONSTRAINT CK_Resv_Purpose  CHECK (purpose_of_stay IN ('LEISURE','BUSINESS','HONEYMOON','EVENT','MEDICAL','LONG_STAY','OTHER'))
);
CREATE INDEX IX_Resv_HotelDate      ON Reservation(hotel_id, booking_datetime);
CREATE INDEX IX_Resv_GuestDate      ON Reservation(guest_id, booking_datetime);
CREATE INDEX IX_Resv_HotelStatus    ON Reservation(hotel_id, reservation_status, checkin_date);
GO

PRINT '[OK] Reservation';
GO

CREATE TABLE ReservationRoom (
    reservation_room_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    reservation_id              BIGINT          NOT NULL,
    room_id                     BIGINT          NULL,
    room_type_id                BIGINT          NOT NULL,
    rate_plan_id                BIGINT          NOT NULL,
    assigned_room_number_snapshot VARCHAR(20)   NULL,
    stay_start_date             DATE            NOT NULL,
    stay_end_date               DATE            NOT NULL,
    adult_count                 INT             NOT NULL,
    child_count                 INT             NOT NULL DEFAULT 0,
    nightly_rate_snapshot       DECIMAL(18,2)   NOT NULL,
    room_subtotal               DECIMAL(18,2)   NOT NULL DEFAULT 0,
    tax_amount                  DECIMAL(18,2)   NOT NULL DEFAULT 0,
    discount_amount             DECIMAL(18,2)   NOT NULL DEFAULT 0,
    final_amount                DECIMAL(18,2)   NOT NULL DEFAULT 0,
    assignment_status           VARCHAR(15)     NOT NULL DEFAULT 'UNASSIGNED',
    occupancy_status            VARCHAR(15)     NOT NULL DEFAULT 'RESERVED',
    created_at                  DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at                  DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_ResvRoom_Resv     FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id),
    CONSTRAINT FK_ResvRoom_Room     FOREIGN KEY (room_id)        REFERENCES Room(room_id),
    CONSTRAINT FK_ResvRoom_RoomType FOREIGN KEY (room_type_id)   REFERENCES RoomType(room_type_id),
    CONSTRAINT FK_ResvRoom_RatePlan FOREIGN KEY (rate_plan_id)   REFERENCES RatePlan(rate_plan_id),
    CONSTRAINT CK_ResvRoom_Assign   CHECK (assignment_status IN ('UNASSIGNED','ASSIGNED','UPGRADED','CHANGED')),
    CONSTRAINT CK_ResvRoom_Occ      CHECK (occupancy_status IN ('RESERVED','IN_HOUSE','COMPLETED','CANCELLED','NO_SHOW'))
);
CREATE INDEX IX_ResvRoom_Resv       ON ReservationRoom(reservation_id);
CREATE INDEX IX_ResvRoom_Room       ON ReservationRoom(room_id, stay_start_date, stay_end_date);
CREATE INDEX IX_ResvRoom_RoomType   ON ReservationRoom(room_type_id, stay_start_date, stay_end_date);
GO

PRINT '[OK] ReservationRoom';
GO

CREATE TABLE ReservationGuest (
    reservation_guest_id        BIGINT IDENTITY(1,1) PRIMARY KEY,
    reservation_id              BIGINT          NOT NULL,
    guest_id                    BIGINT          NULL,
    full_name                   NVARCHAR(220)   NOT NULL, -- Snapshot
    is_primary_guest            BIT             NOT NULL DEFAULT 0,
    age_category                VARCHAR(10)     NOT NULL,
    nationality_country_code    CHAR(2)         NULL,
    document_type               VARCHAR(30)     NULL,
    document_no                 VARCHAR(80)     NULL,
    special_note                NVARCHAR(255)   NULL,
    created_at                  DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_ResvGuest_Resv    FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id),
    CONSTRAINT FK_ResvGuest_Guest   FOREIGN KEY (guest_id)       REFERENCES Guest(guest_id),
    CONSTRAINT CK_ResvGuest_Age     CHECK (age_category IN ('ADULT','CHILD','INFANT'))
);
GO

PRINT '[OK] ReservationGuest';
GO

CREATE TABLE ReservationStatusHistory (
    status_history_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
    reservation_id      BIGINT          NOT NULL,
    old_status          VARCHAR(15)     NULL,
    new_status          VARCHAR(15)     NOT NULL,
    changed_by          BIGINT          NULL,
    change_reason       NVARCHAR(255)   NULL,
    changed_at          DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_ResvHist_Resv FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id),
    CONSTRAINT FK_ResvHist_User FOREIGN KEY (changed_by)     REFERENCES SystemUser(user_id)
);
CREATE INDEX IX_ResvHist_ResvTime ON ReservationStatusHistory(reservation_id, changed_at);
GO

PRINT '[OK] ReservationStatusHistory';
GO

CREATE TABLE LoyaltyRedemption (
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

    CONSTRAINT FK_LoyaltyRedemption_Guest FOREIGN KEY (guest_id) REFERENCES Guest(guest_id),
    CONSTRAINT FK_LoyaltyRedemption_Account FOREIGN KEY (loyalty_account_id) REFERENCES LoyaltyAccount(loyalty_account_id),
    CONSTRAINT FK_LoyaltyRedemption_Promo FOREIGN KEY (promotion_id) REFERENCES Promotion(promotion_id),
    CONSTRAINT FK_LoyaltyRedemption_Reservation FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id),
    CONSTRAINT UQ_LoyaltyRedemption_Code UNIQUE (issued_promo_code),
    CONSTRAINT CK_LoyaltyRedemption_Status CHECK (status IN ('ISSUED','REDEEMED','EXPIRED','CANCELLED')),
    CONSTRAINT CK_LoyaltyRedemption_Points CHECK (points_spent >= 0)
);
CREATE INDEX IX_LoyaltyRedemption_GuestStatus ON LoyaltyRedemption(guest_id, status, expires_at);
CREATE INDEX IX_LoyaltyRedemption_PromoStatus ON LoyaltyRedemption(promotion_id, status);
GO

PRINT '[OK] LoyaltyRedemption';
GO

-- ============================================================
-- DOMAIN 9: PAYMENT & INVOICE
-- ============================================================

CREATE TABLE Payment (
    payment_id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    reservation_id          BIGINT          NOT NULL,
    payment_reference       VARCHAR(80)     NOT NULL,
    payment_type            VARCHAR(20)     NOT NULL,
    payment_method          VARCHAR(20)     NOT NULL,
    payment_status          VARCHAR(15)     NOT NULL DEFAULT 'INITIATED',
    gateway_transaction_id  VARCHAR(120)    NULL,
    amount                  DECIMAL(18,2)   NOT NULL,
    currency_code           CHAR(3)         NOT NULL, -- Snapshot
    exchange_rate           DECIMAL(18,6)   NULL,
    paid_at                 DATETIME        NULL,
    failure_reason          NVARCHAR(255)   NULL,
    created_at              DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at              DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_Payment_Resv      FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id),
    CONSTRAINT UQ_Payment_Ref       UNIQUE (payment_reference),
    CONSTRAINT CK_Payment_Type      CHECK (payment_type IN ('DEPOSIT','PREPAYMENT','FULL_PAYMENT','REFUND','INCIDENTAL_HOLD')),
    CONSTRAINT CK_Payment_Method    CHECK (payment_method IN ('CREDIT_CARD','BANK_TRANSFER','WALLET','CASH','CORPORATE_BILLING','POINTS')),
    CONSTRAINT CK_Payment_Status    CHECK (payment_status IN ('INITIATED','AUTHORIZED','CAPTURED','FAILED','REFUNDED','VOIDED'))
);
CREATE INDEX IX_Payment_ResvStatus ON Payment(reservation_id, payment_status);
GO

PRINT '[OK] Payment';
GO

CREATE TABLE PaymentCardToken (
    card_token_id       BIGINT IDENTITY(1,1) PRIMARY KEY,
    guest_id            BIGINT          NOT NULL,
    payment_gateway     VARCHAR(50)     NOT NULL,
    token_reference     VARCHAR(150)    NOT NULL,
    card_brand          VARCHAR(30)     NULL,
    last4               VARCHAR(4)      NULL,
    expiry_month        INT             NULL,
    expiry_year         INT             NULL,
    billing_name        NVARCHAR(150)   NULL,
    billing_address_id  BIGINT          NULL,
    is_default          BIT             NOT NULL DEFAULT 0,
    created_at          DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at          DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_CardToken_Guest   FOREIGN KEY (guest_id)           REFERENCES Guest(guest_id),
    CONSTRAINT FK_CardToken_Addr    FOREIGN KEY (billing_address_id) REFERENCES GuestAddress(guest_address_id),
    CONSTRAINT UQ_CardToken_Ref     UNIQUE (token_reference)
);
GO

PRINT '[OK] PaymentCardToken';
GO

CREATE TABLE Invoice (
    invoice_id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    reservation_id          BIGINT          NOT NULL,
    invoice_no              VARCHAR(50)     NOT NULL,
    invoice_type            VARCHAR(10)     NOT NULL,
    issued_at               DATETIME        NOT NULL DEFAULT GETDATE(),
    billing_name            NVARCHAR(150)   NULL,
    billing_tax_no          VARCHAR(50)     NULL,
    billing_address         NVARCHAR(MAX)   NULL,
    subtotal_amount         DECIMAL(18,2)   NOT NULL DEFAULT 0,
    tax_amount              DECIMAL(18,2)   NOT NULL DEFAULT 0,
    service_charge_amount   DECIMAL(18,2)   NOT NULL DEFAULT 0,
    total_amount            DECIMAL(18,2)   NOT NULL DEFAULT 0,
    currency_code           CHAR(3)         NOT NULL, -- Snapshot
    status                  VARCHAR(10)     NOT NULL DEFAULT 'DRAFT',
    created_at              DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_Invoice_Resv  FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id),
    CONSTRAINT UQ_Invoice_No    UNIQUE (invoice_no),
    CONSTRAINT CK_Invoice_Type  CHECK (invoice_type IN ('PROFORMA','FINAL','REFUND')),
    CONSTRAINT CK_Invoice_Status CHECK (status IN ('DRAFT','ISSUED','PAID','CANCELLED'))
);
GO

PRINT '[OK] Invoice';
GO

-- ============================================================
-- DOMAIN 10: SERVICES & STAY
-- ============================================================

-- [FIX-1] Removed currency_code -> JOIN Hotel.currency_code
CREATE TABLE ServiceCatalog (
    service_id              BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id                BIGINT          NOT NULL,
    service_code            VARCHAR(50)     NOT NULL,
    service_name            NVARCHAR(150)   NOT NULL,
    service_category        VARCHAR(20)     NOT NULL,
    pricing_model           VARCHAR(15)     NOT NULL,
    base_price              DECIMAL(18,2)   NOT NULL DEFAULT 0,
    is_active               BIT             NOT NULL DEFAULT 1,
    requires_advance_booking BIT            NOT NULL DEFAULT 0,
    description_short       NVARCHAR(255)   NULL,
    created_at              DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at              DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_SvcCatalog_Hotel  FOREIGN KEY (hotel_id) REFERENCES Hotel(hotel_id),
    CONSTRAINT UQ_SvcCatalog_Code   UNIQUE (hotel_id, service_code),
    CONSTRAINT CK_SvcCat_Category   CHECK (service_category IN ('SPA','AIRPORT_TRANSFER','DINING','BUTLER','YACHT','TOUR','BABYSITTING','EVENT','WELLNESS','OTHER')),
    CONSTRAINT CK_SvcCat_Pricing    CHECK (pricing_model IN ('PER_USE','PER_HOUR','PER_PERSON','PACKAGE','PER_TRIP'))
);
GO

PRINT '[OK] ServiceCatalog';
GO

CREATE TABLE ReservationService (
    reservation_service_id  BIGINT IDENTITY(1,1) PRIMARY KEY,
    reservation_id          BIGINT          NOT NULL,
    reservation_room_id     BIGINT          NULL,
    service_id              BIGINT          NOT NULL,
    scheduled_at            DATETIME        NULL,
    quantity                INT             NOT NULL DEFAULT 1,
    unit_price              DECIMAL(18,2)   NOT NULL DEFAULT 0,
    discount_amount         DECIMAL(18,2)   NOT NULL DEFAULT 0,
    final_amount            DECIMAL(18,2)   NOT NULL DEFAULT 0,
    service_status          VARCHAR(15)     NOT NULL DEFAULT 'REQUESTED',
    special_instruction     NVARCHAR(255)   NULL,
    created_at              DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at              DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_ResvSvc_Resv      FOREIGN KEY (reservation_id)     REFERENCES Reservation(reservation_id),
    CONSTRAINT FK_ResvSvc_ResvRoom  FOREIGN KEY (reservation_room_id) REFERENCES ReservationRoom(reservation_room_id),
    CONSTRAINT FK_ResvSvc_Service   FOREIGN KEY (service_id)         REFERENCES ServiceCatalog(service_id),
    CONSTRAINT CK_ResvSvc_Status    CHECK (service_status IN ('REQUESTED','CONFIRMED','DELIVERED','CANCELLED'))
);
GO

PRINT '[OK] ReservationService';
GO

CREATE TABLE StayRecord (
    stay_id                 BIGINT IDENTITY(1,1) PRIMARY KEY,
    reservation_room_id     BIGINT          NOT NULL,
    actual_checkin_at       DATETIME        NULL,
    actual_checkout_at      DATETIME        NULL,
    frontdesk_agent_id      BIGINT          NULL,
    stay_status             VARCHAR(15)     NOT NULL DEFAULT 'EXPECTED',
    deposit_hold_amount     DECIMAL(18,2)   NOT NULL DEFAULT 0,
    incident_note           NVARCHAR(255)   NULL,
    created_at              DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at              DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_Stay_ResvRoom FOREIGN KEY (reservation_room_id) REFERENCES ReservationRoom(reservation_room_id),
    CONSTRAINT FK_Stay_Agent    FOREIGN KEY (frontdesk_agent_id)  REFERENCES SystemUser(user_id),
    CONSTRAINT UQ_Stay_ResvRoom UNIQUE (reservation_room_id),
    CONSTRAINT CK_Stay_Status   CHECK (stay_status IN ('EXPECTED','IN_HOUSE','COMPLETED','NO_SHOW'))
);
GO

PRINT '[OK] StayRecord';
GO

CREATE TABLE HotelReview (
    hotel_review_id         BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id                BIGINT          NOT NULL,
    guest_id                BIGINT          NOT NULL,
    reservation_id          BIGINT          NOT NULL,
    rating_score            INT             NOT NULL,
    review_title            NVARCHAR(150)   NULL,
    review_text             NVARCHAR(1500)  NOT NULL,
    public_visible_flag     BIT             NOT NULL DEFAULT 1,
    moderation_status       VARCHAR(15)     NOT NULL DEFAULT 'PUBLISHED',
    created_at              DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at              DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_HotelReview_Hotel FOREIGN KEY (hotel_id) REFERENCES Hotel(hotel_id),
    CONSTRAINT FK_HotelReview_Guest FOREIGN KEY (guest_id) REFERENCES Guest(guest_id),
    CONSTRAINT FK_HotelReview_Reservation FOREIGN KEY (reservation_id) REFERENCES Reservation(reservation_id),
    CONSTRAINT UQ_HotelReview_Reservation UNIQUE (reservation_id),
    CONSTRAINT CK_HotelReview_Rating CHECK (rating_score BETWEEN 1 AND 5),
    CONSTRAINT CK_HotelReview_Moderation CHECK (moderation_status IN ('PUBLISHED','HIDDEN'))
);
CREATE INDEX IX_HotelReview_HotelPublished ON HotelReview(hotel_id, public_visible_flag, moderation_status, created_at DESC);
CREATE INDEX IX_HotelReview_GuestCreated ON HotelReview(guest_id, created_at DESC);
GO

PRINT '[OK] HotelReview';
GO

-- ============================================================
-- DOMAIN 11: OPERATIONS
-- ============================================================

CREATE TABLE HousekeepingTask (
    hk_task_id          BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id            BIGINT          NOT NULL, -- Denormalized for performance
    room_id             BIGINT          NOT NULL,
    task_type           VARCHAR(15)     NOT NULL,
    task_status         VARCHAR(15)     NOT NULL DEFAULT 'OPEN',
    priority_level      VARCHAR(10)     NOT NULL DEFAULT 'MEDIUM',
    assigned_staff_id   BIGINT          NULL,
    scheduled_for       DATETIME        NULL,
    started_at          DATETIME        NULL,
    completed_at        DATETIME        NULL,
    note                NVARCHAR(255)   NULL,
    created_at          DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at          DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_HK_Hotel  FOREIGN KEY (hotel_id)          REFERENCES Hotel(hotel_id),
    CONSTRAINT FK_HK_Room   FOREIGN KEY (room_id)           REFERENCES Room(room_id),
    CONSTRAINT FK_HK_Staff  FOREIGN KEY (assigned_staff_id) REFERENCES SystemUser(user_id),
    CONSTRAINT CK_HK_Type   CHECK (task_type IN ('CLEANING','TURN_DOWN','INSPECTION','DEEP_CLEAN')),
    CONSTRAINT CK_HK_Status CHECK (task_status IN ('OPEN','ASSIGNED','IN_PROGRESS','DONE','VERIFIED')),
    CONSTRAINT CK_HK_Priority CHECK (priority_level IN ('LOW','MEDIUM','HIGH','CRITICAL'))
);
CREATE INDEX IX_HK_HotelStatus ON HousekeepingTask(hotel_id, task_status, scheduled_for);
CREATE INDEX IX_HK_RoomStatus  ON HousekeepingTask(room_id, task_status);
GO

PRINT '[OK] HousekeepingTask';
GO

CREATE TABLE MaintenanceTicket (
    maintenance_ticket_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
    hotel_id                BIGINT          NOT NULL,
    room_id                 BIGINT          NULL,
    reported_by             BIGINT          NULL,
    issue_category          VARCHAR(50)     NOT NULL,
    issue_description       NVARCHAR(MAX)   NOT NULL,
    severity_level          VARCHAR(10)     NOT NULL DEFAULT 'MEDIUM',
    status                  VARCHAR(15)     NOT NULL DEFAULT 'OPEN',
    reported_at             DATETIME        NOT NULL DEFAULT GETDATE(),
    assigned_to             BIGINT          NULL,
    resolved_at             DATETIME        NULL,
    resolution_note         NVARCHAR(MAX)   NULL,
    created_at              DATETIME        NOT NULL DEFAULT GETDATE(),
    updated_at              DATETIME        NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_Maint_Hotel       FOREIGN KEY (hotel_id)    REFERENCES Hotel(hotel_id),
    CONSTRAINT FK_Maint_Room        FOREIGN KEY (room_id)     REFERENCES Room(room_id),
    CONSTRAINT FK_Maint_Reporter    FOREIGN KEY (reported_by) REFERENCES SystemUser(user_id),
    CONSTRAINT FK_Maint_Assignee    FOREIGN KEY (assigned_to) REFERENCES SystemUser(user_id),
    CONSTRAINT CK_Maint_Severity    CHECK (severity_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    CONSTRAINT CK_Maint_Status      CHECK (status IN ('OPEN','ASSIGNED','IN_PROGRESS','RESOLVED','CLOSED','CANCELLED'))
);
GO

PRINT '[OK] MaintenanceTicket';
GO

-- ============================================================
-- DOMAIN 12: AUDIT & LOCK LOGGING
-- ============================================================

-- [FIX-2] Removed hotel_id -> JOIN Room.hotel_id
CREATE TABLE InventoryLockLog (
    lock_log_id                 BIGINT IDENTITY(1,1) PRIMARY KEY,
    reservation_code_attempt    VARCHAR(50)     NULL,
    room_id                     BIGINT          NOT NULL,
    stay_date                   DATE            NOT NULL,
    lock_acquired_at            DATETIME        NULL,
    lock_released_at            DATETIME        NULL,
    lock_status                 VARCHAR(10)     NOT NULL,
    session_id                  VARCHAR(100)    NULL,
    transaction_id              VARCHAR(100)    NULL,
    note                        NVARCHAR(255)   NULL,

    CONSTRAINT FK_LockLog_Room  FOREIGN KEY (room_id) REFERENCES Room(room_id),
    CONSTRAINT CK_LockLog_Status CHECK (lock_status IN ('SUCCESS','TIMEOUT','FAILED','RELEASED'))
);
CREATE INDEX IX_LockLog_RoomDate ON InventoryLockLog(room_id, stay_date);
GO

PRINT '[OK] InventoryLockLog';
GO

CREATE TABLE AuditLog (
    audit_log_id    BIGINT IDENTITY(1,1) PRIMARY KEY,
    entity_name     VARCHAR(100)    NOT NULL,
    entity_pk       VARCHAR(100)    NOT NULL,
    action_type     VARCHAR(15)     NOT NULL,
    old_value_json  NVARCHAR(MAX)   NULL,
    new_value_json  NVARCHAR(MAX)   NULL,
    changed_by      BIGINT          NULL,
    changed_at      DATETIME        NOT NULL DEFAULT GETDATE(),
    source_module   VARCHAR(100)    NULL,

    CONSTRAINT FK_Audit_User    FOREIGN KEY (changed_by) REFERENCES SystemUser(user_id),
    CONSTRAINT CK_Audit_Action  CHECK (action_type IN ('INSERT','UPDATE','DELETE','STATUS_CHANGE'))
);
GO

PRINT '[OK] AuditLog';
GO

-- ============================================================
-- SUMMARY
-- ============================================================

PRINT '';
PRINT '==========================================';
PRINT '[OK] ALL 30 TABLES CREATED SUCCESSFULLY';
PRINT '==========================================';
GO
