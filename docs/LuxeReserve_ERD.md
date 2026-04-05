# LuxeReserve — Entity Relationship Diagram (Mermaid)

> **Source**: `GlobalLuxuryHotelReservationEngine_REMAKE.groovy`
> **30 bảng** | **SQL Server + MongoDB Hybrid**

---

## ERD Tổng quan (Full Schema)

> Vì schema có 30 bảng, ERD được chia thành **6 domain diagrams** để dễ đọc, sau đó có 1 diagram tổng hợp ở cuối.

---

### 1. Hotel Management Domain

```mermaid
erDiagram
    HotelChain {
        bigint chain_id PK
        varchar chain_code UK
        varchar chain_name
        char headquarters_country_code
        varchar luxury_segment
        varchar status
    }

    Brand {
        bigint brand_id PK
        bigint chain_id FK
        varchar brand_code
        varchar brand_name
        varchar brand_positioning
        int star_standard
        varchar status
    }

    Location {
        bigint location_id PK
        bigint parent_location_id FK
        varchar location_code UK
        varchar location_name
        varchar location_type
        int level
        varchar iso_code
    }

    Hotel {
        bigint hotel_id PK
        bigint brand_id FK
        bigint location_id FK
        varchar hotel_code UK
        varchar hotel_name
        varchar hotel_type
        int star_rating
        varchar currency_code
        varchar status
    }

    HotelPolicy {
        bigint policy_id PK
        bigint hotel_id FK
        text cancellation_policy_text
        text deposit_policy_text
        varchar status
    }

    HotelAmenity {
        bigint hotel_amenity_id PK
        bigint hotel_id FK
        varchar amenity_code
        bit is_complimentary
        bit is_chargeable
        decimal base_fee
    }

    HotelChain ||--o{ Brand : "has brands"
    Brand ||--o{ Hotel : "operates"
    Location ||--o{ Location : "parent hierarchy"
    Location ||--o{ Hotel : "located at"
    Hotel ||--o{ HotelPolicy : "has policies"
    Hotel ||--o{ HotelAmenity : "has amenities"
```

---

### 2. Room Management Domain

```mermaid
erDiagram
    Hotel {
        bigint hotel_id PK
        varchar hotel_name
    }

    RoomType {
        bigint room_type_id PK
        bigint hotel_id FK
        varchar room_type_code
        varchar room_type_name
        varchar category
        varchar bed_type
        int max_adults
        int max_occupancy
        varchar view_type
    }

    Room {
        bigint room_id PK
        bigint hotel_id FK
        bigint room_type_id FK
        varchar room_number
        int floor_number
        varchar room_status
        varchar housekeeping_status
        varchar maintenance_status
        bigint connected_room_id FK
    }

    RoomFeature {
        bigint room_feature_id PK
        bigint room_id FK
        bigint room_type_id FK
        varchar feature_code
        varchar feature_name
        bit is_premium
    }

    RoomAvailability {
        bigint availability_id PK
        bigint hotel_id FK
        bigint room_id FK
        date stay_date
        varchar availability_status
        bit sellable_flag
        int version_no
    }

    Hotel ||--o{ RoomType : "defines"
    Hotel ||--o{ Room : "contains"
    RoomType ||--o{ Room : "categorizes"
    Room ||--o| Room : "connects to"
    Room ||--o{ RoomFeature : "has features"
    RoomType ||--o{ RoomFeature : "has features"
    Room ||--o{ RoomAvailability : "daily inventory"
    Hotel ||--o{ RoomAvailability : "denormalized"
```

---

### 3. Rate & Pricing Domain

```mermaid
erDiagram
    Hotel {
        bigint hotel_id PK
        varchar currency_code
    }

    RoomType {
        bigint room_type_id PK
    }

    HotelPolicy {
        bigint policy_id PK
    }

    SystemUser {
        bigint user_id PK
    }

    RatePlan {
        bigint rate_plan_id PK
        bigint hotel_id FK
        bigint cancellation_policy_id FK
        varchar rate_plan_code
        varchar rate_plan_name
        varchar rate_plan_type
        varchar meal_inclusion
        bit is_refundable
    }

    RoomRate {
        bigint room_rate_id PK
        bigint hotel_id FK
        bigint room_type_id FK
        bigint rate_plan_id FK
        date rate_date
        decimal base_rate
        decimal final_rate
        varchar price_source
        varchar demand_level
        bigint created_by FK
        bigint updated_by FK
    }

    RateChangeLog {
        bigint rate_change_log_id PK
        bigint room_rate_id FK
        decimal old_rate
        decimal new_rate
        decimal change_percent
        varchar severity_level
        varchar review_status
        bigint triggered_by FK
    }

    Promotion {
        bigint promotion_id PK
        bigint hotel_id FK
        bigint brand_id FK
        varchar promotion_code UK
        varchar promotion_name
        decimal discount_value
        char currency_code
    }

    Hotel ||--o{ RatePlan : "offers"
    HotelPolicy ||--o{ RatePlan : "cancellation policy"
    Hotel ||--o{ RoomRate : "daily rates"
    RoomType ||--o{ RoomRate : "priced for"
    RatePlan ||--o{ RoomRate : "under plan"
    SystemUser ||--o{ RoomRate : "created by"
    SystemUser ||--o{ RoomRate : "updated by"
    RoomRate ||--o{ RateChangeLog : "change audit"
    SystemUser ||--o{ RateChangeLog : "triggered by"
    Hotel ||--o{ Promotion : "runs"
```

---

### 4. Guest Management Domain

```mermaid
erDiagram
    HotelChain {
        bigint chain_id PK
    }

    Guest {
        bigint guest_id PK
        varchar guest_code UK
        varchar first_name
        varchar middle_name
        varchar last_name
        varchar full_name "COMPUTED PERSISTED"
        varchar gender
        date date_of_birth
        varchar email
        bit vip_flag
    }

    GuestAddress {
        bigint guest_address_id PK
        bigint guest_id FK
        varchar address_type
        varchar address_line_1
        varchar city
        char country_code
        bit is_primary
    }

    GuestPreference {
        bigint preference_id PK
        bigint guest_id FK
        varchar preference_type
        varchar preference_value
        varchar priority_level
    }

    LoyaltyAccount {
        bigint loyalty_account_id PK
        bigint guest_id FK
        bigint chain_id FK
        varchar membership_no UK
        varchar tier_code
        decimal points_balance
        varchar status
    }

    PaymentCardToken {
        bigint card_token_id PK
        bigint guest_id FK
        bigint billing_address_id FK
        varchar token_reference UK
        varchar card_brand
        varchar last4
    }

    Guest ||--o{ GuestAddress : "has addresses"
    Guest ||--o{ GuestPreference : "has preferences"
    Guest ||--o{ LoyaltyAccount : "loyalty member"
    HotelChain ||--o{ LoyaltyAccount : "program of"
    Guest ||--o{ PaymentCardToken : "saved cards"
    GuestAddress ||--o{ PaymentCardToken : "billing address"
```

---

### 5. Reservation & Payment Domain

```mermaid
erDiagram
    Hotel {
        bigint hotel_id PK
    }

    Guest {
        bigint guest_id PK
    }

    BookingChannel {
        bigint booking_channel_id PK
        varchar channel_code UK
        varchar channel_name
        varchar channel_type
        decimal commission_percent
    }

    Reservation {
        bigint reservation_id PK
        varchar reservation_code UK
        bigint hotel_id FK
        bigint guest_id FK
        bigint booking_channel_id FK
        varchar booking_source
        varchar reservation_status
        date checkin_date
        date checkout_date
        int nights
        char currency_code
        decimal grand_total_amount
        bigint created_by_user_id FK
    }

    ReservationRoom {
        bigint reservation_room_id PK
        bigint reservation_id FK
        bigint room_id FK
        bigint room_type_id FK
        bigint rate_plan_id FK
        date stay_start_date
        date stay_end_date
        decimal nightly_rate_snapshot
        decimal final_amount
        varchar assignment_status
        varchar occupancy_status
    }

    ReservationGuest {
        bigint reservation_guest_id PK
        bigint reservation_id FK
        bigint guest_id FK
        varchar full_name "snapshot"
        bit is_primary_guest
        varchar age_category
    }

    ReservationStatusHistory {
        bigint status_history_id PK
        bigint reservation_id FK
        varchar old_status
        varchar new_status
        bigint changed_by FK
    }

    Payment {
        bigint payment_id PK
        bigint reservation_id FK
        varchar payment_reference UK
        varchar payment_type
        varchar payment_method
        varchar payment_status
        decimal amount
        char currency_code
    }

    Invoice {
        bigint invoice_id PK
        bigint reservation_id FK
        varchar invoice_no UK
        varchar invoice_type
        decimal total_amount
        char currency_code
        varchar status
    }

    ServiceCatalog {
        bigint service_id PK
        bigint hotel_id FK
        varchar service_code
        varchar service_name
        varchar service_category
        decimal base_price
    }

    ReservationService {
        bigint reservation_service_id PK
        bigint reservation_id FK
        bigint reservation_room_id FK
        bigint service_id FK
        int quantity
        decimal final_amount
        varchar service_status
    }

    StayRecord {
        bigint stay_id PK
        bigint reservation_room_id FK
        datetime actual_checkin_at
        datetime actual_checkout_at
        bigint frontdesk_agent_id FK
        varchar stay_status
    }

    Hotel ||--o{ Reservation : "booked at"
    Guest ||--o{ Reservation : "made by"
    BookingChannel ||--o{ Reservation : "via channel"
    Reservation ||--o{ ReservationRoom : "room lines"
    Reservation ||--o{ ReservationGuest : "guests"
    Reservation ||--o{ ReservationStatusHistory : "status trail"
    Reservation ||--o{ Payment : "payments"
    Reservation ||--o{ Invoice : "invoices"
    Reservation ||--o{ ReservationService : "services"
    ReservationRoom ||--o{ ReservationService : "for room"
    ReservationRoom ||--|| StayRecord : "actual stay"
    Hotel ||--o{ ServiceCatalog : "offers"
    ServiceCatalog ||--o{ ReservationService : "service used"
    Guest ||--o{ ReservationGuest : "guest info"
```

---

### 6. Operations & System Domain

```mermaid
erDiagram
    Hotel {
        bigint hotel_id PK
    }

    Room {
        bigint room_id PK
    }

    SystemUser {
        bigint user_id PK
        bigint hotel_id FK
        varchar username UK
        varchar full_name
        varchar email
        varchar department
        varchar account_status
    }

    Role {
        bigint role_id PK
        varchar role_code UK
        varchar role_name
    }

    UserRole {
        bigint user_role_id PK
        bigint user_id FK
        bigint role_id FK
        bigint assigned_by FK
    }

    HousekeepingTask {
        bigint hk_task_id PK
        bigint hotel_id FK
        bigint room_id FK
        varchar task_type
        varchar task_status
        varchar priority_level
        bigint assigned_staff_id FK
    }

    MaintenanceTicket {
        bigint maintenance_ticket_id PK
        bigint hotel_id FK
        bigint room_id FK
        bigint reported_by FK
        bigint assigned_to FK
        varchar issue_category
        varchar status
    }

    InventoryLockLog {
        bigint lock_log_id PK
        bigint room_id FK
        varchar reservation_code_attempt
        date stay_date
        varchar lock_status
        varchar session_id
    }

    AuditLog {
        bigint audit_log_id PK
        varchar entity_name
        varchar entity_pk
        varchar action_type
        bigint changed_by FK
    }

    Hotel ||--o{ SystemUser : "staff of"
    SystemUser ||--o{ UserRole : "has roles"
    Role ||--o{ UserRole : "assigned to"
    SystemUser ||--o{ UserRole : "assigned by"
    Hotel ||--o{ HousekeepingTask : "tasks"
    Room ||--o{ HousekeepingTask : "for room"
    SystemUser ||--o{ HousekeepingTask : "assigned to"
    Hotel ||--o{ MaintenanceTicket : "tickets"
    Room ||--o{ MaintenanceTicket : "for room"
    SystemUser ||--o{ MaintenanceTicket : "reported by"
    SystemUser ||--o{ MaintenanceTicket : "assigned to"
    Room ||--o{ InventoryLockLog : "lock log"
    SystemUser ||--o{ AuditLog : "changed by"
```

---

## ERD Tổng hợp — Quan hệ giữa các Domain (High-Level)

```mermaid
erDiagram
    HotelChain ||--o{ Brand : "owns"
    Brand ||--o{ Hotel : "operates"
    Location ||--o{ Location : "self-ref hierarchy"
    Location ||--o{ Hotel : "located at"

    Hotel ||--o{ HotelPolicy : "policies"
    Hotel ||--o{ HotelAmenity : "amenities"
    Hotel ||--o{ RoomType : "room types"
    Hotel ||--o{ Room : "rooms"
    Hotel ||--o{ RatePlan : "rate plans"
    Hotel ||--o{ RoomRate : "daily rates"
    Hotel ||--o{ Reservation : "reservations"
    Hotel ||--o{ ServiceCatalog : "services"
    Hotel ||--o{ SystemUser : "staff"
    Hotel ||--o{ HousekeepingTask : "HK tasks"
    Hotel ||--o{ MaintenanceTicket : "maintenance"
    Hotel ||--o{ RoomAvailability : "inventory"
    Hotel ||--o{ Promotion : "promotions"

    RoomType ||--o{ Room : "classifies"
    Room ||--o| Room : "connects"
    Room ||--o{ RoomFeature : "features"
    RoomType ||--o{ RoomFeature : "features"
    Room ||--o{ RoomAvailability : "availability"
    Room ||--o{ InventoryLockLog : "lock log"
    Room ||--o{ HousekeepingTask : "tasks"
    Room ||--o{ MaintenanceTicket : "tickets"

    RatePlan ||--o{ RoomRate : "rates"
    RoomType ||--o{ RoomRate : "rates"
    RoomRate ||--o{ RateChangeLog : "change log"

    Guest ||--o{ GuestAddress : "addresses"
    Guest ||--o{ GuestPreference : "preferences"
    Guest ||--o{ LoyaltyAccount : "loyalty"
    Guest ||--o{ PaymentCardToken : "cards"
    Guest ||--o{ Reservation : "bookings"
    Guest ||--o{ ReservationGuest : "guest info"

    HotelChain ||--o{ LoyaltyAccount : "loyalty program"

    BookingChannel ||--o{ Reservation : "channel"
    Reservation ||--o{ ReservationRoom : "room lines"
    Reservation ||--o{ ReservationGuest : "guests"
    Reservation ||--o{ ReservationStatusHistory : "history"
    Reservation ||--o{ Payment : "payments"
    Reservation ||--o{ Invoice : "invoices"
    Reservation ||--o{ ReservationService : "add-on services"

    ReservationRoom ||--|| StayRecord : "actual stay"
    ReservationRoom ||--o{ ReservationService : "service for room"

    ServiceCatalog ||--o{ ReservationService : "catalog item"

    SystemUser ||--o{ UserRole : "roles"
    Role ||--o{ UserRole : "users"
    SystemUser ||--o{ AuditLog : "audit trail"
    SystemUser ||--o{ RateChangeLog : "triggered by"
    SystemUser ||--o{ RoomRate : "created-updated by"
    SystemUser ||--o{ ReservationStatusHistory : "changed by"
    SystemUser ||--o{ StayRecord : "frontdesk agent"
    SystemUser ||--o{ HousekeepingTask : "assigned staff"
    SystemUser ||--o{ MaintenanceTicket : "reported-assigned"

    HotelPolicy ||--o{ RatePlan : "cancellation policy"
    GuestAddress ||--o{ PaymentCardToken : "billing addr"
    Brand ||--o{ Promotion : "brand promo"
```

---

## Chú thích ký hiệu Mermaid

| Ký hiệu | Ý nghĩa |
|----------|---------|
| `\|\|--o{` | One-to-Many (1:N) |
| `\|\|--\|\|` | One-to-One (1:1) |
| `o{--o{` | Many-to-Many (bảng trung gian) |
| `PK` | Primary Key |
| `FK` | Foreign Key |
| `UK` | Unique Key |

---

## Ghi chú Hybrid SQL ↔ MongoDB

Các bảng SQL sau có **link key** sang MongoDB collections:

| SQL Table | Link Key | MongoDB Collection | Dữ liệu MongoDB |
|-----------|----------|-------------------|-----------------|
| `HotelAmenity` | `amenity_code` | `amenity_master` | name, category, description, images, tags |
| `RoomType` | `room_type_code` | `room_type_catalog` | description, features, images |
| `Hotel` | `hotel_id` | `Hotel_Catalog` | rich content, embedded amenities & room_types |
| `Guest` | `guest_id` | `guest_profile_projection` | read-optimized guest profile |
