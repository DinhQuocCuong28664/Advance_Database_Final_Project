# LuxeReserve — Entity Relationship Diagram (ERD)

> **Engine:** SQL Server 2022 Express (T-SQL) + MongoDB (Hybrid)
> **Total Tables:** 30+ SQL tables + 3 MongoDB collections

---

## 1. Location Hierarchy

```mermaid
erDiagram
    Location ||--o{ Location : "self-referencing (parent)"
    Location ||--o{ Hotel : "has"

    Location {
        BIGINT location_id PK
        BIGINT parent_location_id FK "self-ref"
        VARCHAR location_code UK
        NVARCHAR location_name
        VARCHAR location_type "REGION|COUNTRY|STATE_PROVINCE|CITY|DISTRICT"
        INT level "0-4"
        VARCHAR iso_code
        DECIMAL latitude
        DECIMAL longitude
        VARCHAR timezone
    }
```

---

## 2. Hotel Chain → Brand → Hotel

```mermaid
erDiagram
    HotelChain ||--o{ Brand : "owns"
    Brand ||--o{ Hotel : "has"
    Hotel ||--o{ HotelPolicy : "has"
    Hotel ||--o{ HotelAmenity : "has"
    Hotel ||--o{ RoomType : "has"
    Hotel ||--o{ Room : "has"
    Hotel ||--o{ RoomAvailability : "has"
    Hotel ||--o{ RatePlan : "has"
    Hotel ||--o{ RoomRate : "has"
    Hotel ||--o{ Promotion : "has"
    Hotel ||--o{ ServiceCatalog : "has"
    Hotel ||--o{ Reservation : "receives"
    Hotel ||--o{ HotelReview : "has"
    Hotel ||--o{ SystemUser : "employs"

    HotelChain {
        BIGINT chain_id PK
        VARCHAR chain_code UK
        NVARCHAR chain_name
        CHAR headquarters_country_code
        VARCHAR luxury_segment "ULTRA_LUXURY|LUXURY_RESORT|..."
        VARCHAR status "ACTIVE|INACTIVE"
    }

    Brand {
        BIGINT brand_id PK
        BIGINT chain_id FK
        VARCHAR brand_code UK "(chain_id, brand_code)"
        NVARCHAR brand_name
        INT star_standard
        VARCHAR status
    }

    Hotel {
        BIGINT hotel_id PK
        BIGINT brand_id FK
        VARCHAR hotel_code UK
        NVARCHAR hotel_name
        VARCHAR hotel_type "CITY_HOTEL|RESORT|VILLA_RESORT|..."
        INT star_rating
        VARCHAR status "PREOPENING|ACTIVE|RENOVATING|CLOSED"
        VARCHAR timezone
        CHAR currency_code
        BIGINT location_id FK
        NVARCHAR address_line_1
        DECIMAL latitude
        DECIMAL longitude
    }
```

---

## 3. Hotel Policies & Amenities

```mermaid
erDiagram
    HotelPolicy {
        BIGINT policy_id PK
        BIGINT hotel_id FK
        NVARCHAR cancellation_policy_text
        NVARCHAR deposit_policy_text
        BIT refundable_flag
        DATETIME effective_from
        DATETIME effective_to
        VARCHAR status "ACTIVE|INACTIVE|EXPIRED"
    }

    HotelAmenity {
        BIGINT hotel_amenity_id PK
        BIGINT hotel_id FK
        VARCHAR amenity_code UK "(hotel_id, amenity_code) -> MongoDB"
        BIT is_complimentary
        BIT is_chargeable
        DECIMAL base_fee
        VARCHAR availability_status
    }
```

> **Note:** `amenity_master` (name, description, images, tags) is stored in **MongoDB**.
> `HotelAmenity.amenity_code` is the link key.

---

## 4. Room Management

```mermaid
erDiagram
    RoomType ||--o{ Room : "categorizes"
    RoomType ||--o{ RoomFeature : "has"
    Room ||--o{ RoomFeature : "has"
    Room ||--o{ RoomAvailability : "has"
    Room ||--o{ ReservationRoom : "assigned"
    Room ||--o{ Room : "connected (self-ref)"

    RoomType {
        BIGINT room_type_id PK
        BIGINT hotel_id FK
        VARCHAR room_type_code UK "(hotel_id, room_type_code) -> MongoDB"
        NVARCHAR room_type_name
        VARCHAR category "DELUXE|PREMIER|SUITE|VILLA|PRESIDENTIAL_SUITE"
        VARCHAR bed_type "KING|TWIN|DOUBLE|SOFA_BED|MIXED"
        INT max_adults
        INT max_children
        INT max_occupancy
        DECIMAL room_size_sqm
        VARCHAR view_type
        BIT smoking_allowed
        VARCHAR status
    }

    Room {
        BIGINT room_id PK
        BIGINT hotel_id FK
        BIGINT room_type_id FK
        VARCHAR room_number UK "(hotel_id, room_number)"
        INT floor_number
        VARCHAR room_status "AVAILABLE|OCCUPIED|OOO|OOS|..."
        VARCHAR housekeeping_status "CLEAN|DIRTY|INSPECTED|IN_PROGRESS"
        VARCHAR maintenance_status "NORMAL|UNDER_REPAIR|BLOCKED"
        BIT near_elevator_flag
        BIT connecting_room_flag
        BIGINT connected_room_id FK "self-ref"
        BIT is_accessible
        BIT is_vip_preferred
    }

    RoomFeature {
        BIGINT room_feature_id PK
        BIGINT room_id FK "nullable"
        BIGINT room_type_id FK "nullable"
        VARCHAR feature_code
        NVARCHAR feature_name
        VARCHAR feature_category
        NVARCHAR feature_value
        BIT is_premium
        "CHECK: room_id IS NOT NULL OR room_type_id IS NOT NULL"
    }

    RoomAvailability {
        BIGINT availability_id PK
        BIGINT hotel_id FK "denormalized"
        BIGINT room_id FK
        DATE stay_date UK "(room_id, stay_date)"
        VARCHAR availability_status "OPEN|HELD|BOOKED|BLOCKED"
        BIT sellable_flag
        BIT rate_plan_open_flag
        INT min_los
        INT max_los
        INT version_no "optimistic locking"
    }
```

---

## 5. Guest Management

```mermaid
erDiagram
    Guest ||--o{ GuestAddress : "has"
    Guest ||--o{ GuestPreference : "has"
    Guest ||--o{ LoyaltyAccount : "has"
    Guest ||--o{ GuestAuth : "has"
    Guest ||--o{ Reservation : "makes"
    Guest ||--o{ PaymentCardToken : "has"
    Guest ||--o{ LoyaltyRedemption : "redeems"
    Guest ||--o{ HotelReview : "writes"

    Guest {
        BIGINT guest_id PK
        VARCHAR guest_code UK
        NVARCHAR title
        NVARCHAR first_name
        NVARCHAR middle_name
        NVARCHAR last_name
        NVARCHAR full_name "COMPUTED PERSISTED: CONCAT(first_name, middle_name, last_name)"
        VARCHAR gender "MALE|FEMALE|OTHER|UNDISCLOSED"
        DATE date_of_birth
        CHAR nationality_country_code
        VARCHAR email
        VARCHAR phone_number
        BIT vip_flag
        BIT marketing_opt_in_flag
        VARCHAR identity_document_type
        VARCHAR identity_document_no
    }

    GuestAddress {
        BIGINT guest_address_id PK
        BIGINT guest_id FK
        VARCHAR address_type "HOME|WORK|BILLING"
        NVARCHAR address_line_1
        NVARCHAR city
        CHAR country_code
        BIT is_primary
    }

    GuestPreference {
        BIGINT preference_id PK
        BIGINT guest_id FK
        VARCHAR preference_type "BED|PILLOW|DIET|VIEW|..."
        NVARCHAR preference_value
        VARCHAR priority_level "LOW|MEDIUM|HIGH|CRITICAL"
    }

    LoyaltyAccount {
        BIGINT loyalty_account_id PK
        BIGINT guest_id FK
        BIGINT chain_id FK
        VARCHAR membership_no UK
        VARCHAR tier_code "SILVER|GOLD|PLATINUM|BLACK"
        DECIMAL points_balance
        DECIMAL lifetime_points
        DATE enrollment_date
        DATE expiry_date
        VARCHAR status "ACTIVE|SUSPENDED|EXPIRED|CLOSED"
    }

    GuestAuth {
        BIGINT guest_auth_id PK
        BIGINT guest_id FK UK
        VARCHAR login_email UK
        VARCHAR password_hash
        VARCHAR account_status "ACTIVE|LOCKED|DISABLED"
        DATETIME email_verified_at
        DATETIME last_login_at
    }
```

---

## 6. System Users & Roles

```mermaid
erDiagram
    SystemUser ||--o{ UserRole : "has"
    Role ||--o{ UserRole : "assigned"
    SystemUser ||--o{ UserRole : "assigned_by"

    SystemUser {
        BIGINT user_id PK
        BIGINT hotel_id FK "nullable"
        VARCHAR username UK
        VARCHAR password_hash
        NVARCHAR full_name
        VARCHAR email
        VARCHAR department "FRONT_OFFICE|RESERVATIONS|HOUSEKEEPING|..."
        VARCHAR account_status "ACTIVE|LOCKED|DISABLED"
    }

    Role {
        BIGINT role_id PK
        VARCHAR role_code UK
        NVARCHAR role_name
    }

    UserRole {
        BIGINT user_role_id PK
        BIGINT user_id FK
        BIGINT role_id FK
        DATETIME assigned_at
        BIGINT assigned_by FK "nullable"
        "UK: (user_id, role_id)"
    }
```

---

## 7. Rate & Pricing

```mermaid
erDiagram
    RatePlan ||--o{ RoomRate : "defines"
    RoomRate ||--o{ RateChangeLog : "audits"
    HotelPolicy ||--o{ RatePlan : "references"

    RatePlan {
        BIGINT rate_plan_id PK
        BIGINT hotel_id FK
        VARCHAR rate_plan_code UK "(hotel_id, rate_plan_code)"
        NVARCHAR rate_plan_name
        VARCHAR rate_plan_type "BAR|NON_REFUNDABLE|MEMBER|PACKAGE|CORPORATE|PROMO"
        VARCHAR meal_inclusion "ROOM_ONLY|BREAKFAST|HALF_BOARD|FULL_BOARD|ALL_INCLUSIVE"
        BIGINT cancellation_policy_id FK
        BIT is_refundable
        BIT requires_prepayment
        DATETIME effective_from
        DATETIME effective_to
        VARCHAR status
    }

    RoomRate {
        BIGINT room_rate_id PK
        BIGINT hotel_id FK
        BIGINT room_type_id FK
        BIGINT rate_plan_id FK
        DATE rate_date UK "(room_type_id, rate_plan_id, rate_date)"
        DECIMAL base_rate
        DECIMAL discount_amount
        DECIMAL discount_percent
        DECIMAL final_rate
        BIT tax_inclusive_flag
        INT available_inventory_count
        VARCHAR price_source "MANUAL|YIELD_ENGINE|PROMOTION|SEASONAL_RULE"
        VARCHAR demand_level "LOW|NORMAL|HIGH|PEAK"
    }

    RateChangeLog {
        BIGINT rate_change_log_id PK
        BIGINT room_rate_id FK
        DECIMAL old_rate
        DECIMAL new_rate
        DECIMAL change_amount
        DECIMAL change_percent
        NVARCHAR change_reason
        VARCHAR severity_level "WARNING|CRITICAL"
        VARCHAR review_status "OPEN|ACKNOWLEDGED|CLOSED"
    }

    Promotion {
        BIGINT promotion_id PK
        BIGINT hotel_id FK "nullable"
        BIGINT brand_id FK "nullable"
        VARCHAR promotion_code UK
        NVARCHAR promotion_name
        VARCHAR promotion_type
        DECIMAL discount_value
        DATE booking_start_date
        DATE booking_end_date
        DATE stay_start_date
        DATE stay_end_date
        BIT member_only_flag
        DECIMAL redeemable_points_cost
        INT voucher_valid_days
        VARCHAR status
    }
```

---

## 8. Booking & Reservation

```mermaid
erDiagram
    BookingChannel ||--o{ Reservation : "sourced"
    Reservation ||--o{ ReservationRoom : "contains"
    Reservation ||--o{ ReservationGuest : "includes"
    Reservation ||--o{ ReservationStatusHistory : "tracks"
    Reservation ||--o{ Payment : "has"
    Reservation ||--o{ Invoice : "bills"
    Reservation ||--o{ ReservationService : "orders"
    Reservation ||--o{ LoyaltyRedemption : "uses"
    Reservation ||--o{ HotelReview : "reviewed"

    BookingChannel {
        BIGINT booking_channel_id PK
        VARCHAR channel_code UK
        NVARCHAR channel_name
        VARCHAR channel_type "DIRECT|OTA|GDS|CORPORATE|TRAVEL_AGENT|WHOLESALER"
        DECIMAL commission_percent
        VARCHAR status
    }

    Reservation {
        BIGINT reservation_id PK
        VARCHAR reservation_code UK
        BIGINT hotel_id FK
        BIGINT guest_id FK
        BIGINT booking_channel_id FK
        VARCHAR booking_source "DIRECT_WEB|MOBILE_APP|OTA|AGENT|..."
        VARCHAR reservation_status "PENDING|CONFIRMED|CHECKED_IN|CHECKED_OUT|CANCELLED|NO_SHOW"
        DATETIME booking_datetime
        DATE checkin_date
        DATE checkout_date
        INT nights
        INT adult_count
        INT child_count
        INT room_count
        CHAR currency_code
        DECIMAL subtotal_amount
        DECIMAL tax_amount
        DECIMAL grand_total_amount
        BIT deposit_required_flag
        DECIMAL deposit_amount
        VARCHAR guarantee_type "CARD|DEPOSIT|COMPANY_GUARANTEE|NONE"
        VARCHAR purpose_of_stay "LEISURE|BUSINESS|HONEYMOON|EVENT|..."
    }

    ReservationRoom {
        BIGINT reservation_room_id PK
        BIGINT reservation_id FK
        BIGINT room_id FK "nullable"
        BIGINT room_type_id FK
        BIGINT rate_plan_id FK
        DATE stay_start_date
        DATE stay_end_date
        DECIMAL nightly_rate_snapshot
        DECIMAL final_amount
        VARCHAR assignment_status "UNASSIGNED|ASSIGNED|UPGRADED|CHANGED"
        VARCHAR occupancy_status "RESERVED|IN_HOUSE|COMPLETED|CANCELLED|NO_SHOW"
    }

    ReservationGuest {
        BIGINT reservation_guest_id PK
        BIGINT reservation_id FK
        BIGINT guest_id FK "nullable"
        NVARCHAR full_name "snapshot"
        BIT is_primary_guest
        VARCHAR age_category "ADULT|CHILD|INFANT"
        VARCHAR document_type
        VARCHAR document_no
    }

    ReservationStatusHistory {
        BIGINT status_history_id PK
        BIGINT reservation_id FK
        VARCHAR old_status
        VARCHAR new_status
        BIGINT changed_by FK
        NVARCHAR change_reason
        DATETIME changed_at
    }

    LoyaltyRedemption {
        BIGINT loyalty_redemption_id PK
        BIGINT guest_id FK
        BIGINT loyalty_account_id FK
        BIGINT promotion_id FK
        BIGINT reservation_id FK "nullable"
        VARCHAR issued_promo_code UK
        DECIMAL points_spent
        VARCHAR status "ISSUED|REDEEMED|EXPIRED|CANCELLED"
        DATETIME expires_at
    }
```

---

## 9. Payment & Invoice

```mermaid
erDiagram
    Payment {
        BIGINT payment_id PK
        BIGINT reservation_id FK
        VARCHAR payment_reference UK
        VARCHAR payment_type "DEPOSIT|PREPAYMENT|FULL_PAYMENT|REFUND|INCIDENTAL_HOLD"
        VARCHAR payment_method "CREDIT_CARD|BANK_TRANSFER|WALLET|CASH|..."
        VARCHAR payment_status "INITIATED|AUTHORIZED|CAPTURED|FAILED|REFUNDED|VOIDED"
        VARCHAR gateway_transaction_id
        DECIMAL amount
        CHAR currency_code
        DECIMAL exchange_rate
        DATETIME paid_at
    }

    PaymentCardToken {
        BIGINT card_token_id PK
        BIGINT guest_id FK
        VARCHAR payment_gateway
        VARCHAR token_reference UK
        VARCHAR card_brand
        VARCHAR last4
        INT expiry_month
        INT expiry_year
        BIT is_default
    }

    Invoice {
        BIGINT invoice_id PK
        BIGINT reservation_id FK
        VARCHAR invoice_no UK
        VARCHAR invoice_type "PROFORMA|FINAL|REFUND"
        DECIMAL total_amount
        CHAR currency_code
        VARCHAR status "DRAFT|ISSUED|PAID|CANCELLED"
    }
```

---

## 10. Services & Stay

```mermaid
erDiagram
    ServiceCatalog ||--o{ ReservationService : "ordered"
    ReservationRoom ||--o{ ReservationService : "references"
    ReservationRoom ||--o{ StayRecord : "records"

    ServiceCatalog {
        BIGINT service_id PK
        BIGINT hotel_id FK
        VARCHAR service_code UK "(hotel_id, service_code)"
        NVARCHAR service_name
        VARCHAR service_category "SPA|AIRPORT_TRANSFER|DINING|BUTLER|..."
        VARCHAR pricing_model "PER_USE|PER_HOUR|PER_PERSON|PACKAGE|PER_TRIP"
        DECIMAL base_price
        BIT is_active
        BIT requires_advance_booking
    }

    ReservationService {
        BIGINT reservation_service_id PK
        BIGINT reservation_id FK
        BIGINT reservation_room_id FK "nullable"
        BIGINT service_id FK
        DATETIME scheduled_at
        INT quantity
        DECIMAL unit_price
        DECIMAL final_amount
        VARCHAR service_status "REQUESTED|CONFIRMED|DELIVERED|CANCELLED"
    }

    StayRecord {
        BIGINT stay_id PK
        BIGINT reservation_room_id FK UK
        DATETIME actual_checkin_at
        DATETIME actual_checkout_at
        BIGINT frontdesk_agent_id FK
        VARCHAR stay_status "EXPECTED|IN_HOUSE|COMPLETED|NO_SHOW"
        DECIMAL deposit_hold_amount
    }

    HotelReview {
        BIGINT hotel_review_id PK
        BIGINT hotel_id FK
        BIGINT guest_id FK
        BIGINT reservation_id FK UK
        INT rating_score "1-5"
        NVARCHAR review_title
        NVARCHAR review_text
        BIT public_visible_flag
        VARCHAR moderation_status "PUBLISHED|HIDDEN"
    }
```

---

## 11. Audit & Logging

```mermaid
erDiagram
    AuditLog {
        BIGINT audit_log_id PK
        VARCHAR entity_name
        VARCHAR entity_pk
        VARCHAR action_type "INSERT|UPDATE|STATUS_CHANGE|PROFILE_UPDATE|..."
        NVARCHAR old_value_json
        NVARCHAR new_value_json
        BIGINT changed_by
        DATETIME changed_at
        VARCHAR source_module
    }

    InventoryLockLog {
        BIGINT lock_log_id PK
        VARCHAR reservation_code_attempt
        BIGINT room_id
        DATE stay_date
        DATETIME lock_acquired_at
        DATETIME lock_released_at
        VARCHAR lock_status "SUCCESS|FAILED|RELEASED|TIMEOUT"
        VARCHAR session_id
        VARCHAR transaction_id
        NVARCHAR note
    }

    EmailVerificationOtp {
        BIGINT email_otp_id PK
        BIGINT guest_auth_id FK
        VARCHAR otp_code
        VARCHAR purpose "ACTIVATE|BOOKING_ACCESS|PASSWORD_RESET"
        DATETIME expires_at
        DATETIME consumed_at
    }
```

---

## 12. MongoDB Collections (Hybrid Schema)

```mermaid
erDiagram
    amenity_master {
        ObjectId _id
        string amenity_code "link key"
        string name
        string category
        string description
        string icon
        string[] tags
        string[] images
    }

    room_type_catalog {
        ObjectId _id
        string room_type_code "link key"
        string description
        string[] features
        string[] images
        object[] floor_plans
    }

    Hotel_Catalog {
        ObjectId _id
        string hotel_code "link key"
        string description
        string[] gallery_images
        object[] nearby_attractions
    }
```

---

## Legend

| Symbol | Meaning |
|--------|---------|
| `PK` | Primary Key |
| `FK` | Foreign Key |
| `UK` | Unique Key |
| `||--o{` | One-to-Many relationship |
| `||--||` | One-to-One relationship |
| `"..."` | CHECK constraint values |
| `-> MongoDB` | Cross-reference to MongoDB collection |

---

*Generated from `database/sql/` scripts (01–24) and `database/mongodb/` scripts.*
