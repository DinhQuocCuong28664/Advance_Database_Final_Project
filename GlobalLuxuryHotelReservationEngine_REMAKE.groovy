Project GlobalLuxuryHotelReservationEngine {
  database_type: "SQLServer"
  Note: '''
  SQL schema for Global Luxury Hotel Reservation Engine.
  ========================================================
  REMAKE VERSION -- Fixes data redundancy issues
  Author: NoSQL Specialist & Hierarchy Expert
  ========================================================

  Changes from original:
  [FIX-1] Remove currency_code from HotelAmenity, RoomRate, ServiceCatalog (JOIN from Hotel)
  [FIX-2] Remove hotel_id from RateChangeLog, InventoryLockLog (JOIN from Room/RoomRate)
  [FIX-3] Note Reservation financial fields should use computed/view
  [FIX-4] Guest.full_name -> computed column
  [FIX-5] HotelAmenity: remove amenity_name, amenity_category (moved to MongoDB amenity_master)
  [FIX-6] RoomType: remove base_description, boolean features (moved to MongoDB room_type_catalog)
  [FIX-7] Add Location table for hierarchy (Recursive CTE)
  [FIX-8] RoomFeature: add CHECK constraint (at least 1 FK must be NOT NULL)

  Purpose:
  - ACID-safe booking and payment transactions
  - Physical room inventory control
  - Rate change auditing
  - Revenue analytics by hotel / room / quarter
  - Luxury guest preferences and add-on services

  MongoDB collections (hybrid design):
  - Hotel_Catalog      -> rich content, images, embedded amenities & room_types
  - Amenities          -> amenity master data (name, category, description, images, tags)
  - Images             -> hotel/room media gallery
  - guest_profile_projection -> read-optimized guest profile
  - review_summary
  - search_audit_log
  '''
}

// ============================
// ENUMS (unchanged)
// ============================

Enum hotel_status {
  PREOPENING
  ACTIVE
  RENOVATING
  CLOSED
}

Enum hotel_type {
  CITY_HOTEL
  RESORT
  VILLA_RESORT
  AIRPORT_LUXURY
  BUSINESS_LUXURY
}

Enum luxury_segment {
  ULTRA_LUXURY
  LUXURY_RESORT
  LUXURY_BUSINESS
  BOUTIQUE_LUXURY
  PRIVATE_ISLAND
}

Enum brand_status {
  ACTIVE
  INACTIVE
}

Enum room_category {
  DELUXE
  PREMIER
  SUITE
  VILLA
  PRESIDENTIAL_SUITE
}

Enum bed_type {
  KING
  TWIN
  DOUBLE
  SOFA_BED
  MIXED
}

Enum view_type {
  OCEAN
  CITY
  GARDEN
  MOUNTAIN
  POOL
  PARTIAL_OCEAN
  COURTYARD
  LANDMARK
}

Enum room_status {
  AVAILABLE
  OCCUPIED
  OOO
  OOS
  CLEANING
  RESERVED
  BLOCKED
}

Enum housekeeping_status {
  CLEAN
  DIRTY
  INSPECTED
  IN_PROGRESS
}

Enum maintenance_status {
  NORMAL
  UNDER_REPAIR
  BLOCKED
}

Enum availability_status {
  OPEN
  HELD
  BOOKED
  BLOCKED
}

Enum policy_status {
  ACTIVE
  INACTIVE
  EXPIRED
}

Enum amenity_category {
  WELLNESS
  DINING
  BUSINESS
  TRANSPORT
  FAMILY
  EXCLUSIVE
  RECREATION
  ACCESSIBILITY
}

Enum rate_plan_type {
  BAR
  NON_REFUNDABLE
  MEMBER
  PACKAGE
  CORPORATE
  PROMO
}

Enum meal_inclusion {
  ROOM_ONLY
  BREAKFAST
  HALF_BOARD
  FULL_BOARD
  ALL_INCLUSIVE
}

Enum demand_level {
  LOW
  NORMAL
  HIGH
  PEAK
}

Enum price_source {
  MANUAL
  YIELD_ENGINE
  PROMOTION
  SEASONAL_RULE
}

Enum severity_level {
  WARNING
  CRITICAL
}

Enum review_status {
  OPEN
  ACKNOWLEDGED
  CLOSED
}

Enum guest_gender {
  MALE
  FEMALE
  OTHER
  UNDISCLOSED
}

Enum address_type {
  HOME
  WORK
  BILLING
}

Enum preference_type {
  BED
  PILLOW
  FLOOR
  DIET
  VIEW
  TRANSPORT
  NEWSPAPER
  ROOM_SCENT
  HOUSEKEEPING
  ACCESSIBILITY
  OTHER
}

Enum priority_level {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

Enum loyalty_tier_code {
  SILVER
  GOLD
  PLATINUM
  BLACK
}

Enum loyalty_status {
  ACTIVE
  SUSPENDED
  EXPIRED
  CLOSED
}

Enum booking_source {
  DIRECT_WEB
  MOBILE_APP
  OTA
  AGENT
  CALL_CENTER
  WALK_IN
  CORPORATE
}

Enum reservation_status {
  PENDING
  CONFIRMED
  CHECKED_IN
  CHECKED_OUT
  CANCELLED
  NO_SHOW
}

Enum guarantee_type {
  CARD
  DEPOSIT
  COMPANY_GUARANTEE
  NONE
}

Enum purpose_of_stay {
  LEISURE
  BUSINESS
  HONEYMOON
  EVENT
  MEDICAL
  LONG_STAY
  OTHER
}

Enum assignment_status {
  UNASSIGNED
  ASSIGNED
  UPGRADED
  CHANGED
}

Enum occupancy_status {
  RESERVED
  IN_HOUSE
  COMPLETED
  CANCELLED
  NO_SHOW
}

Enum age_category {
  ADULT
  CHILD
  INFANT
}

Enum channel_type {
  DIRECT
  OTA
  GDS
  CORPORATE
  TRAVEL_AGENT
  WHOLESALER
}

Enum payment_type {
  DEPOSIT
  PREPAYMENT
  FULL_PAYMENT
  REFUND
  INCIDENTAL_HOLD
}

Enum payment_method {
  CREDIT_CARD
  BANK_TRANSFER
  WALLET
  CASH
  CORPORATE_BILLING
  POINTS
}

Enum payment_status {
  INITIATED
  AUTHORIZED
  CAPTURED
  FAILED
  REFUNDED
  VOIDED
}

Enum invoice_type {
  PROFORMA
  FINAL
  REFUND
}

Enum invoice_status {
  DRAFT
  ISSUED
  PAID
  CANCELLED
}

Enum pricing_model {
  PER_USE
  PER_HOUR
  PER_PERSON
  PACKAGE
  PER_TRIP
}

Enum service_category {
  SPA
  AIRPORT_TRANSFER
  DINING
  BUTLER
  YACHT
  TOUR
  BABYSITTING
  EVENT
  WELLNESS
  OTHER
}

Enum service_status {
  REQUESTED
  CONFIRMED
  DELIVERED
  CANCELLED
}

Enum stay_status {
  EXPECTED
  IN_HOUSE
  COMPLETED
  NO_SHOW
}

Enum hk_task_type {
  CLEANING
  TURN_DOWN
  INSPECTION
  DEEP_CLEAN
}

Enum hk_task_status {
  OPEN
  ASSIGNED
  IN_PROGRESS
  DONE
  VERIFIED
}

Enum ticket_status {
  OPEN
  ASSIGNED
  IN_PROGRESS
  RESOLVED
  CLOSED
  CANCELLED
}

Enum account_status {
  ACTIVE
  LOCKED
  DISABLED
}

Enum department_code {
  FRONT_OFFICE
  RESERVATIONS
  HOUSEKEEPING
  FINANCE
  SALES
  IT
  ENGINEERING
  MANAGEMENT
}

Enum lock_status {
  SUCCESS
  TIMEOUT
  FAILED
}

Enum audit_action_type {
  INSERT
  UPDATE
  DELETE
  STATUS_CHANGE
}

// [FIX-7] NEW -- Enum for Location hierarchy
Enum location_type {
  REGION
  COUNTRY
  STATE_PROVINCE
  CITY
  DISTRICT
}

// ============================
// TABLES
// ============================

Table HotelChain {
  chain_id bigint [pk, increment]
  chain_code varchar(50) [not null, unique]
  chain_name varchar(150) [not null]
  headquarters_country_code char(2)
  headquarters_city varchar(100)
  official_website varchar(255)
  support_email varchar(150)
  support_phone varchar(30)
  luxury_segment luxury_segment [not null]
  status brand_status [not null, default: 'ACTIVE']
  created_at datetime [not null]
  updated_at datetime [not null]

  Note: 'Top-level hotel chain / group'
}

Table Brand {
  brand_id bigint [pk, increment]
  chain_id bigint [not null]
  brand_code varchar(50) [not null]
  brand_name varchar(150) [not null]
  brand_positioning varchar(150)
  star_standard int
  description text
  status brand_status [not null, default: 'ACTIVE']
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (chain_id, brand_code) [unique]
  }

  Note: 'Sub-brand under a hotel chain'
}

// =============================================================
// [FIX-7] NEW -- Location table: hierarchical structure (adjacency list)
// Supports Recursive CTE to query by region/country/city
// Example: Get all hotels in the "Southeast Asia" region
// =============================================================
Table Location {
  location_id bigint [pk, increment]
  parent_location_id bigint [note: 'Self-referencing FK cho hierarchy. NULL = root node (VD: Region)']
  location_code varchar(50) [not null, unique]
  location_name varchar(150) [not null]
  location_type location_type [not null, note: 'REGION / COUNTRY / STATE_PROVINCE / CITY / DISTRICT']
  level int [not null, note: '0=Region, 1=Country, 2=State, 3=City, 4=District']
  iso_code varchar(10) [note: 'ISO 3166 code if applicable (e.g. VN, US, SG)']
  latitude decimal(10,7)
  longitude decimal(10,7)
  timezone varchar(64)
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (parent_location_id)
    (location_type, location_name)
  }

  Note: '''
  [FIX-7] New table -- Geographic location hierarchy.
  Example hierarchy:
    Southeast Asia (REGION, level=0)
      +-- Vietnam (COUNTRY, level=1)
            +-- Ho Chi Minh (STATE_PROVINCE, level=2)
            |     +-- Ho Chi Minh City (CITY, level=3)
            |           +-- District 1 (DISTRICT, level=4)
            |           +-- District 7 (DISTRICT, level=4)
            +-- Khanh Hoa (STATE_PROVINCE, level=2)
                  +-- Nha Trang (CITY, level=3)

  Recursive CTE example:
  WITH RECURSIVE LocationTree AS (
    SELECT * FROM Location WHERE location_name = N''Southeast Asia''
    UNION ALL
    SELECT L.* FROM Location L
      JOIN LocationTree LT ON L.parent_location_id = LT.location_id
  )
  SELECT H.* FROM Hotel H
    JOIN Location LOC ON H.location_id = LOC.location_id
    WHERE LOC.location_id IN (SELECT location_id FROM LocationTree);
  '''
}

Table Hotel {
  hotel_id bigint [pk, increment]
  brand_id bigint [not null]
  hotel_code varchar(50) [not null, unique]
  hotel_name varchar(200) [not null]
  legal_name varchar(200)
  hotel_type hotel_type [not null]
  star_rating int [not null]
  opening_date date
  status hotel_status [not null, default: 'ACTIVE']
  timezone varchar(64) [not null]
  currency_code char(3) [not null]
  check_in_time time
  check_out_time time
  total_floors int
  total_rooms int
  primary_language_code varchar(10)
  contact_email varchar(150)
  contact_phone varchar(30)
  reservation_email varchar(150)
  reservation_phone varchar(30)
  // [FIX-7] Replace flat address fields with FK to Location hierarchy
  location_id bigint [not null, note: 'FK to Location (level DISTRICT or CITY). Replaces separate country_code, city, district fields']
  address_line_1 varchar(200) [not null]
  address_line_2 varchar(200)
  postal_code varchar(20)
  latitude decimal(10,7)
  longitude decimal(10,7)
  created_at datetime [not null]
  updated_at datetime [not null]

  Note: '''
  Physical hotel property.
  [FIX-7] Added location_id FK replacing flat fields: country_code, state_province, city, district.
  Recursive CTE on Location can now query by region/country/city.
  '''
}

Table HotelPolicy {
  policy_id bigint [pk, increment]
  hotel_id bigint [not null]
  cancellation_policy_text text
  deposit_policy_text text
  child_policy_text text
  pet_policy_text text
  smoking_policy_text text
  extra_bed_policy_text text
  late_checkout_policy_text text
  early_checkin_policy_text text
  identity_document_required boolean [not null, default: false]
  minimum_checkin_age int
  refundable_flag boolean [not null, default: true]
  effective_from datetime [not null]
  effective_to datetime
  status policy_status [not null, default: 'ACTIVE']
  created_at datetime [not null]
  updated_at datetime [not null]
}

// =============================================================
// [FIX-5] HotelAmenity -- Remove amenity_name, amenity_category
// [FIX-1] HotelAmenity -- Remove currency_code
// Master data (name, category, description) -> MongoDB amenity_master
// SQL keeps only operational mapping + fees
// =============================================================
Table HotelAmenity {
  hotel_amenity_id bigint [pk, increment]
  hotel_id bigint [not null]
  amenity_code varchar(50) [not null, note: 'Link key to MongoDB amenity_master collection']
  // [FIX-5] REMOVED: amenity_name varchar(150)         -> fetched from MongoDB amenity_master
  // [FIX-5] REMOVED: amenity_category amenity_category  -> fetched from MongoDB amenity_master
  // [FIX-1] REMOVED: currency_code char(3)              -> JOIN from Hotel.currency_code
  is_complimentary boolean [not null, default: true]
  is_chargeable boolean [not null, default: false]
  base_fee decimal(18,2)
  availability_status varchar(30)
  operating_hours varchar(100)
  notes text
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (hotel_id, amenity_code) [unique]
  }

  Note: '''
  [FIX-1] Remove currency_code -> JOIN Hotel.currency_code
  [FIX-5] Remove amenity_name, amenity_category -> fetched from MongoDB amenity_master by amenity_code
  Hybrid query: SQL operational data + MongoDB rich content
  '''
}

// =============================================================
// [FIX-6] RoomType -- Remove base_description, boolean features
// Rich content moved to MongoDB room_type_catalog
// SQL keeps operational fields for booking logic
// =============================================================
Table RoomType {
  room_type_id bigint [pk, increment]
  hotel_id bigint [not null]
  room_type_code varchar(50) [not null, note: 'Link key to MongoDB room_type_catalog']
  room_type_name varchar(150) [not null]
  category room_category [not null]
  bed_type bed_type [not null]
  max_adults int [not null]
  max_children int [not null, default: 0]
  max_occupancy int [not null]
  room_size_sqm decimal(10,2)
  view_type view_type
  smoking_allowed boolean [not null, default: false]
  // [FIX-6] REMOVED boolean features -> moved to MongoDB room_type_catalog embedded doc:
  // has_balcony, has_private_pool, has_lounge_access, has_butler_service
  // [FIX-6] REMOVED: base_description text -> moved to MongoDB room_type_catalog
  status brand_status [not null, default: 'ACTIVE']
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (hotel_id, room_type_code) [unique]
  }

  Note: '''
  Commercial room type sold to guests.
  [FIX-6] Remove base_description, has_balcony, has_private_pool, has_lounge_access, has_butler_service
  -> Moved to MongoDB room_type_catalog collection (rich content + images + features embedded).
  Linked via room_type_code.
  '''
}

Table Room {
  room_id bigint [pk, increment]
  hotel_id bigint [not null]
  room_type_id bigint [not null]
  room_number varchar(20) [not null]
  floor_number int
  wing_block varchar(50)
  room_status room_status [not null, default: 'AVAILABLE']
  housekeeping_status housekeeping_status [not null, default: 'CLEAN']
  maintenance_status maintenance_status [not null, default: 'NORMAL']
  near_elevator_flag boolean [not null, default: false]
  connecting_room_flag boolean [not null, default: false]
  connected_room_id bigint
  is_accessible boolean [not null, default: false]
  is_vip_preferred boolean [not null, default: false]
  last_renovated_at datetime
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (hotel_id, room_number) [unique]
  }

  Note: 'Physical room inventory unit'
}

// =============================================================
// [FIX-8] RoomFeature -- Add CHECK constraint
// =============================================================
Table RoomFeature {
  room_feature_id bigint [pk, increment]
  room_id bigint
  room_type_id bigint
  feature_code varchar(50) [not null]
  feature_name varchar(150) [not null]
  feature_category varchar(50)
  feature_value varchar(255)
  is_premium boolean [not null, default: false]
  created_at datetime [not null]

  Note: '''
  Feature attached either to a room type or a physical room.
  [FIX-8] CHECK constraint: at least 1 of the 2 FKs must be NOT NULL.
  SQL: ALTER TABLE RoomFeature
       ADD CONSTRAINT CK_RoomFeature_AtLeastOneFK
       CHECK (room_id IS NOT NULL OR room_type_id IS NOT NULL);
  '''
}

Table RoomAvailability {
  availability_id bigint [pk, increment]
  hotel_id bigint [not null, note: 'Kept (denormalized) for performance -- hotel filter query is frequent']
  room_id bigint [not null]
  stay_date date [not null]
  availability_status availability_status [not null, default: 'OPEN']
  sellable_flag boolean [not null, default: true]
  rate_plan_open_flag boolean [not null, default: true]
  min_los int
  max_los int
  cta_flag boolean [not null, default: false]
  ctd_flag boolean [not null, default: false]
  inventory_note varchar(255)
  last_synced_at datetime
  version_no int [not null, default: 1]
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (room_id, stay_date) [unique]
    (hotel_id, stay_date)
    (hotel_id, availability_status, stay_date)
  }

  Note: 'Critical table for inventory checks and pessimistic locking. hotel_id kept denormalized for performance.'
}

Table RatePlan {
  rate_plan_id bigint [pk, increment]
  hotel_id bigint [not null]
  rate_plan_code varchar(50) [not null]
  rate_plan_name varchar(150) [not null]
  rate_plan_type rate_plan_type [not null]
  meal_inclusion meal_inclusion [not null, default: 'ROOM_ONLY']
  cancellation_policy_id bigint
  is_refundable boolean [not null, default: true]
  requires_prepayment boolean [not null, default: false]
  min_advance_booking_days int
  max_advance_booking_days int
  status brand_status [not null, default: 'ACTIVE']
  effective_from datetime [not null]
  effective_to datetime
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (hotel_id, rate_plan_code) [unique]
  }
}

// =============================================================
// [FIX-1] RoomRate -- Remove currency_code
// =============================================================
Table RoomRate {
  room_rate_id bigint [pk, increment]
  hotel_id bigint [not null]
  room_type_id bigint [not null]
  rate_plan_id bigint [not null]
  rate_date date [not null]
  base_rate decimal(18,2) [not null]
  discount_amount decimal(18,2) [not null, default: 0]
  discount_percent decimal(5,2) [not null, default: 0]
  final_rate decimal(18,2) [not null]
  // [FIX-1] REMOVED: currency_code char(3) -> JOIN from Hotel.currency_code via hotel_id
  tax_inclusive_flag boolean [not null, default: false]
  available_inventory_count int
  price_source price_source [not null, default: 'MANUAL']
  demand_level demand_level [not null, default: 'NORMAL']
  created_by bigint
  updated_by bigint
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (room_type_id, rate_plan_id, rate_date) [unique]
    (hotel_id, rate_date)
  }

  Note: '''
  Daily sell rate by room type and rate plan.
  [FIX-1] Remove currency_code -> JOIN Hotel.currency_code via hotel_id
  '''
}

// =============================================================
// [FIX-2] RateChangeLog -- Remove hotel_id (JOIN from RoomRate)
// =============================================================
Table RateChangeLog {
  rate_change_log_id bigint [pk, increment]
  room_rate_id bigint [not null, note: 'FK to RoomRate -- from here JOIN to hotel_id, room_type_id, rate_plan_id']
  // [FIX-2] REMOVED: hotel_id bigint     -> JOIN RoomRate.hotel_id
  // [FIX-2] REMOVED: room_type_id bigint  -> JOIN RoomRate.room_type_id
  // [FIX-2] REMOVED: rate_plan_id bigint  -> JOIN RoomRate.rate_plan_id
  old_rate decimal(18,2) [not null]
  new_rate decimal(18,2) [not null]
  change_amount decimal(18,2) [not null]
  change_percent decimal(9,4) [not null]
  change_reason varchar(255)
  triggered_at datetime [not null]
  triggered_by bigint
  severity_level severity_level [not null, default: 'WARNING']
  review_status review_status [not null, default: 'OPEN']

  indexes {
    (room_rate_id, triggered_at)
  }

  Note: '''
  Populated by trigger when rate change exceeds policy threshold.
  [FIX-2] Remove hotel_id, room_type_id, rate_plan_id -> already available via RoomRate FK.
  Query: JOIN RoomRate ON room_rate_id -> get hotel_id, room_type_id, rate_plan_id.
  '''
}

Table Promotion {
  promotion_id bigint [pk, increment]
  hotel_id bigint
  brand_id bigint
  promotion_code varchar(50) [not null]
  promotion_name varchar(150) [not null]
  promotion_type varchar(50) [not null]
  discount_value decimal(18,2) [not null]
  currency_code char(3) [note: 'Kept -- promotions may be cross-hotel and need their own currency']
  applies_to varchar(30) [not null]
  booking_start_date date [not null]
  booking_end_date date [not null]
  stay_start_date date [not null]
  stay_end_date date [not null]
  member_only_flag boolean [not null, default: false]
  min_nights int
  status brand_status [not null, default: 'ACTIVE']
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (promotion_code) [unique]
  }
}

// =============================================================
// [FIX-4] Guest -- full_name becomes a computed column
// =============================================================
Table Guest {
  guest_id bigint [pk, increment]
  guest_code varchar(50) [not null, unique]
  title varchar(20)
  first_name varchar(100) [not null]
  middle_name varchar(100)
  last_name varchar(100) [not null]
  // [FIX-4] REMOVED: full_name varchar(220)
  // -> Replaced with computed column:
  // ALTER TABLE Guest ADD full_name AS (
  //   CONCAT(COALESCE(first_name,''), ' ', COALESCE(middle_name,''), ' ', COALESCE(last_name,''))
  // ) PERSISTED;
  gender guest_gender
  date_of_birth date
  nationality_country_code char(2)
  email varchar(150)
  phone_country_code varchar(10)
  phone_number varchar(30)
  preferred_language_code varchar(10)
  vip_flag boolean [not null, default: false]
  marketing_opt_in_flag boolean [not null, default: false]
  identity_document_type varchar(30)
  identity_document_no varchar(80)
  document_issue_country char(2)
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (email)
    (phone_country_code, phone_number)
  }

  Note: 
  '''
  [FIX-4] full_name removed from schema -> use computed column:
  ALTER TABLE Guest ADD full_name AS (
    CONCAT(COALESCE(first_name,''), ' ', COALESCE(middle_name,''), ' ', COALESCE(last_name,''))
  ) PERSISTED;
  '''
}

Table GuestAddress {
  guest_address_id bigint [pk, increment]
  guest_id bigint [not null]
  address_type address_type [not null]
  address_line_1 varchar(200) [not null]
  address_line_2 varchar(200)
  city varchar(100)
  state_province varchar(100)
  postal_code varchar(20)
  country_code char(2) [not null]
  is_primary boolean [not null, default: false]
  created_at datetime [not null]
  updated_at datetime [not null]
}

Table GuestPreference {
  preference_id bigint [pk, increment]
  guest_id bigint [not null]
  preference_type preference_type [not null]
  preference_value varchar(255) [not null]
  priority_level priority_level [not null, default: 'MEDIUM']
  effective_from datetime
  effective_to datetime
  note varchar(255)
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (guest_id, preference_type)
  }
}

Table LoyaltyAccount {
  loyalty_account_id bigint [pk, increment]
  guest_id bigint [not null]
  chain_id bigint [not null]
  membership_no varchar(50) [not null, unique]
  tier_code loyalty_tier_code [not null]
  points_balance decimal(18,2) [not null, default: 0]
  lifetime_points decimal(18,2) [not null, default: 0]
  enrollment_date date [not null]
  expiry_date date
  status loyalty_status [not null, default: 'ACTIVE']
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (guest_id, chain_id) [unique]
  }
}

Table BookingChannel {
  booking_channel_id bigint [pk, increment]
  channel_code varchar(50) [not null, unique]
  channel_name varchar(150) [not null]
  channel_type channel_type [not null]
  commission_percent decimal(5,2) [not null, default: 0]
  contact_email varchar(150)
  status brand_status [not null, default: 'ACTIVE']
  created_at datetime [not null]
  updated_at datetime [not null]
}

// =============================================================
// [FIX-3] Reservation -- Note: financial fields should be computed/view
// =============================================================
Table Reservation {
  reservation_id bigint [pk, increment]
  reservation_code varchar(50) [not null, unique]
  hotel_id bigint [not null]
  guest_id bigint [not null]
  booking_channel_id bigint [not null]
  booking_source booking_source [not null]
  reservation_status reservation_status [not null, default: 'PENDING']
  booking_datetime datetime [not null]
  checkin_date date [not null]
  checkout_date date [not null]
  nights int [not null]
  adult_count int [not null]
  child_count int [not null, default: 0]
  room_count int [not null, default: 1]
  currency_code char(3) [not null, note: 'Kept -- snapshot at booking time']
  // [FIX-3] Financial fields SHOULD be computed from ReservationRoom + ReservationService
  // Recommendation: create VIEW vw_ReservationTotal instead of storing directly
  // Or use computed columns. Kept temporarily for backward compatibility.
  subtotal_amount decimal(18,2) [not null, default: 0, note: 'FIX-3: Should be SUM(ReservationRoom.room_subtotal)']
  tax_amount decimal(18,2) [not null, default: 0, note: 'FIX-3: Should be SUM(ReservationRoom.tax_amount)']
  service_charge_amount decimal(18,2) [not null, default: 0]
  discount_amount decimal(18,2) [not null, default: 0, note: 'FIX-3: Should be SUM(ReservationRoom.discount_amount)']
  grand_total_amount decimal(18,2) [not null, default: 0, note: 'FIX-3: Should be subtotal + tax + service_charge - discount']
  deposit_required_flag boolean [not null, default: false]
  deposit_amount decimal(18,2) [not null, default: 0]
  guarantee_type guarantee_type [not null, default: 'NONE']
  special_request_text text
  arrival_time_estimate time
  purpose_of_stay purpose_of_stay [not null, default: 'LEISURE']
  created_by_user_id bigint
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (hotel_id, booking_datetime)
    (guest_id, booking_datetime)
    (hotel_id, reservation_status, checkin_date)
  }

  Note: '''
  Reservation header.
  [FIX-3] Financial fields (subtotal, tax, discount, grand_total) overlap with ReservationRoom.
  Recommendation: create a VIEW:
  CREATE VIEW vw_ReservationTotal AS
  SELECT r.reservation_id,
         SUM(rr.room_subtotal) AS subtotal,
         SUM(rr.tax_amount) AS tax,
         SUM(rr.discount_amount) AS discount,
         SUM(rr.final_amount) AS grand_total
  FROM Reservation r
  JOIN ReservationRoom rr ON r.reservation_id = rr.reservation_id
  GROUP BY r.reservation_id;
  '''
}

Table ReservationRoom {
  reservation_room_id bigint [pk, increment]
  reservation_id bigint [not null]
  room_id bigint
  room_type_id bigint [not null]
  rate_plan_id bigint [not null]
  assigned_room_number_snapshot varchar(20)
  stay_start_date date [not null]
  stay_end_date date [not null]
  adult_count int [not null]
  child_count int [not null, default: 0]
  nightly_rate_snapshot decimal(18,2) [not null]
  room_subtotal decimal(18,2) [not null, default: 0]
  tax_amount decimal(18,2) [not null, default: 0]
  discount_amount decimal(18,2) [not null, default: 0]
  final_amount decimal(18,2) [not null, default: 0]
  assignment_status assignment_status [not null, default: 'UNASSIGNED']
  occupancy_status occupancy_status [not null, default: 'RESERVED']
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (reservation_id)
    (room_id, stay_start_date, stay_end_date)
    (room_type_id, stay_start_date, stay_end_date)
  }

  Note: 'Per-room line item inside a reservation'
}

Table ReservationGuest {
  reservation_guest_id bigint [pk, increment]
  reservation_id bigint [not null]
  guest_id bigint
  full_name varchar(220) [not null, note: 'Kept -- snapshot at booking time; guest may change name later']
  is_primary_guest boolean [not null, default: false]
  age_category age_category [not null]
  nationality_country_code char(2)
  document_type varchar(30)
  document_no varchar(80)
  special_note varchar(255)
  created_at datetime [not null]
}

Table ReservationStatusHistory {
  status_history_id bigint [pk, increment]
  reservation_id bigint [not null]
  old_status reservation_status
  new_status reservation_status [not null]
  changed_by bigint
  change_reason varchar(255)
  changed_at datetime [not null]

  indexes {
    (reservation_id, changed_at)
  }
}

Table Payment {
  payment_id bigint [pk, increment]
  reservation_id bigint [not null]
  payment_reference varchar(80) [not null, unique]
  payment_type payment_type [not null]
  payment_method payment_method [not null]
  payment_status payment_status [not null, default: 'INITIATED']
  gateway_transaction_id varchar(120)
  amount decimal(18,2) [not null]
  currency_code char(3) [not null, note: 'Kept -- transaction snapshot; may differ from hotel currency']
  exchange_rate decimal(18,6)
  paid_at datetime
  failure_reason varchar(255)
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (reservation_id, payment_status)
  }
}

Table PaymentCardToken {
  card_token_id bigint [pk, increment]
  guest_id bigint [not null]
  payment_gateway varchar(50) [not null]
  token_reference varchar(150) [not null, unique]
  card_brand varchar(30)
  last4 varchar(4)
  expiry_month int
  expiry_year int
  billing_name varchar(150)
  billing_address_id bigint
  is_default boolean [not null, default: false]
  created_at datetime [not null]
  updated_at datetime [not null]
}

Table Invoice {
  invoice_id bigint [pk, increment]
  reservation_id bigint [not null]
  invoice_no varchar(50) [not null, unique]
  invoice_type invoice_type [not null]
  issued_at datetime [not null]
  billing_name varchar(150)
  billing_tax_no varchar(50)
  billing_address text
  subtotal_amount decimal(18,2) [not null, default: 0, note: 'Historical snapshot -- keep as-is']
  tax_amount decimal(18,2) [not null, default: 0]
  service_charge_amount decimal(18,2) [not null, default: 0]
  total_amount decimal(18,2) [not null, default: 0]
  currency_code char(3) [not null, note: 'Kept -- invoice snapshot']
  status invoice_status [not null, default: 'DRAFT']
  created_at datetime [not null]
}

// =============================================================
// [FIX-1] ServiceCatalog -- Remove currency_code
// =============================================================
Table ServiceCatalog {
  service_id bigint [pk, increment]
  hotel_id bigint [not null]
  service_code varchar(50) [not null]
  service_name varchar(150) [not null]
  service_category service_category [not null]
  pricing_model pricing_model [not null]
  base_price decimal(18,2) [not null, default: 0]
  // [FIX-1] REMOVED: currency_code char(3) -> JOIN from Hotel.currency_code
  is_active boolean [not null, default: true]
  requires_advance_booking boolean [not null, default: false]
  description_short varchar(255)
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (hotel_id, service_code) [unique]
  }

  Note: '''
  [FIX-1] Remove currency_code -> JOIN Hotel.currency_code via hotel_id.
  Service always belongs to 1 hotel -> share the same currency.
  '''
}

Table ReservationService {
  reservation_service_id bigint [pk, increment]
  reservation_id bigint [not null]
  reservation_room_id bigint
  service_id bigint [not null]
  scheduled_at datetime
  quantity int [not null, default: 1]
  unit_price decimal(18,2) [not null, default: 0]
  discount_amount decimal(18,2) [not null, default: 0]
  final_amount decimal(18,2) [not null, default: 0]
  service_status service_status [not null, default: 'REQUESTED']
  special_instruction varchar(255)
  created_at datetime [not null]
  updated_at datetime [not null]
}

Table StayRecord {
  stay_id bigint [pk, increment]
  reservation_room_id bigint [not null, unique]
  actual_checkin_at datetime
  actual_checkout_at datetime
  frontdesk_agent_id bigint
  stay_status stay_status [not null, default: 'EXPECTED']
  deposit_hold_amount decimal(18,2) [not null, default: 0]
  incident_note varchar(255)
  created_at datetime [not null]
  updated_at datetime [not null]
}

Table HousekeepingTask {
  hk_task_id bigint [pk, increment]
  hotel_id bigint [not null, note: 'Kept (denormalized) for performance -- hotel filter query is frequent']
  room_id bigint [not null]
  task_type hk_task_type [not null]
  task_status hk_task_status [not null, default: 'OPEN']
  priority_level priority_level [not null, default: 'MEDIUM']
  assigned_staff_id bigint
  scheduled_for datetime
  started_at datetime
  completed_at datetime
  note varchar(255)
  created_at datetime [not null]
  updated_at datetime [not null]

  indexes {
    (hotel_id, task_status, scheduled_for)
    (room_id, task_status)
  }
}

Table MaintenanceTicket {
  maintenance_ticket_id bigint [pk, increment]
  hotel_id bigint [not null]
  room_id bigint
  reported_by bigint
  issue_category varchar(50) [not null]
  issue_description text [not null]
  severity_level priority_level [not null, default: 'MEDIUM']
  status ticket_status [not null, default: 'OPEN']
  reported_at datetime [not null]
  assigned_to bigint
  resolved_at datetime
  resolution_note text
  created_at datetime [not null]
  updated_at datetime [not null]
}

Table SystemUser {
  user_id bigint [pk, increment]
  hotel_id bigint
  username varchar(80) [not null, unique]
  password_hash varchar(255) [not null]
  full_name varchar(150) [not null]
  email varchar(150) [not null]
  phone varchar(30)
  job_title varchar(100)
  department department_code
  account_status account_status [not null, default: 'ACTIVE']
  last_login_at datetime
  created_at datetime [not null]
  updated_at datetime [not null]
}

Table Role {
  role_id bigint [pk, increment]
  role_code varchar(50) [not null, unique]
  role_name varchar(100) [not null]
  description varchar(255)
  created_at datetime [not null]
}

Table UserRole {
  user_role_id bigint [pk, increment]
  user_id bigint [not null]
  role_id bigint [not null]
  assigned_at datetime [not null]
  assigned_by bigint

  indexes {
    (user_id, role_id) [unique]
  }
}

// =============================================================
// [FIX-2] InventoryLockLog -- Remove hotel_id
// =============================================================
Table InventoryLockLog {
  lock_log_id bigint [pk, increment]
  reservation_code_attempt varchar(50)
  // [FIX-2] REMOVED: hotel_id bigint -> JOIN Room.hotel_id via room_id
  room_id bigint [not null]
  stay_date date [not null]
  lock_acquired_at datetime
  lock_released_at datetime
  lock_status lock_status [not null]
  session_id varchar(100)
  transaction_id varchar(100)
  note varchar(255)

  indexes {
    (room_id, stay_date)
  }

  Note: '''
  Technical/audit table to support concurrency defense.
  [FIX-2] Remove hotel_id -> JOIN Room.hotel_id if hotel filter is needed.
  Audit table; rarely queried directly by hotel.
  '''
}

Table AuditLog {
  audit_log_id bigint [pk, increment]
  entity_name varchar(100) [not null]
  entity_pk varchar(100) [not null]
  action_type audit_action_type [not null]
  old_value_json text
  new_value_json text
  changed_by bigint
  changed_at datetime [not null]
  source_module varchar(100)
}

/* =========================
   Relationships
   ========================= */

Ref: Brand.chain_id > HotelChain.chain_id
Ref: Hotel.brand_id > Brand.brand_id

// [FIX-7] Location hierarchy
Ref: Location.parent_location_id > Location.location_id
Ref: Hotel.location_id > Location.location_id

Ref: HotelPolicy.hotel_id > Hotel.hotel_id
Ref: HotelAmenity.hotel_id > Hotel.hotel_id

Ref: RoomType.hotel_id > Hotel.hotel_id
Ref: Room.hotel_id > Hotel.hotel_id
Ref: Room.room_type_id > RoomType.room_type_id
Ref: Room.connected_room_id > Room.room_id

Ref: RoomFeature.room_id > Room.room_id
Ref: RoomFeature.room_type_id > RoomType.room_type_id

Ref: RoomAvailability.hotel_id > Hotel.hotel_id
Ref: RoomAvailability.room_id > Room.room_id

Ref: RatePlan.hotel_id > Hotel.hotel_id
Ref: RatePlan.cancellation_policy_id > HotelPolicy.policy_id

Ref: RoomRate.hotel_id > Hotel.hotel_id
Ref: RoomRate.room_type_id > RoomType.room_type_id
Ref: RoomRate.rate_plan_id > RatePlan.rate_plan_id
Ref: RoomRate.created_by > SystemUser.user_id
Ref: RoomRate.updated_by > SystemUser.user_id

// [FIX-2] RateChangeLog -- only keeps FK to RoomRate
Ref: RateChangeLog.room_rate_id > RoomRate.room_rate_id
Ref: RateChangeLog.triggered_by > SystemUser.user_id

Ref: Promotion.hotel_id > Hotel.hotel_id
Ref: Promotion.brand_id > Brand.brand_id

Ref: GuestAddress.guest_id > Guest.guest_id
Ref: GuestPreference.guest_id > Guest.guest_id
Ref: LoyaltyAccount.guest_id > Guest.guest_id
Ref: LoyaltyAccount.chain_id > HotelChain.chain_id

Ref: Reservation.hotel_id > Hotel.hotel_id
Ref: Reservation.guest_id > Guest.guest_id
Ref: Reservation.booking_channel_id > BookingChannel.booking_channel_id
Ref: Reservation.created_by_user_id > SystemUser.user_id

Ref: ReservationRoom.reservation_id > Reservation.reservation_id
Ref: ReservationRoom.room_id > Room.room_id
Ref: ReservationRoom.room_type_id > RoomType.room_type_id
Ref: ReservationRoom.rate_plan_id > RatePlan.rate_plan_id

Ref: ReservationGuest.reservation_id > Reservation.reservation_id
Ref: ReservationGuest.guest_id > Guest.guest_id

Ref: ReservationStatusHistory.reservation_id > Reservation.reservation_id
Ref: ReservationStatusHistory.changed_by > SystemUser.user_id

Ref: Payment.reservation_id > Reservation.reservation_id

Ref: PaymentCardToken.guest_id > Guest.guest_id
Ref: PaymentCardToken.billing_address_id > GuestAddress.guest_address_id

Ref: Invoice.reservation_id > Reservation.reservation_id

Ref: ServiceCatalog.hotel_id > Hotel.hotel_id
Ref: ReservationService.reservation_id > Reservation.reservation_id
Ref: ReservationService.reservation_room_id > ReservationRoom.reservation_room_id
Ref: ReservationService.service_id > ServiceCatalog.service_id

Ref: StayRecord.reservation_room_id > ReservationRoom.reservation_room_id
Ref: StayRecord.frontdesk_agent_id > SystemUser.user_id

Ref: HousekeepingTask.hotel_id > Hotel.hotel_id
Ref: HousekeepingTask.room_id > Room.room_id
Ref: HousekeepingTask.assigned_staff_id > SystemUser.user_id

Ref: MaintenanceTicket.hotel_id > Hotel.hotel_id
Ref: MaintenanceTicket.room_id > Room.room_id
Ref: MaintenanceTicket.reported_by > SystemUser.user_id
Ref: MaintenanceTicket.assigned_to > SystemUser.user_id

Ref: SystemUser.hotel_id > Hotel.hotel_id

Ref: UserRole.user_id > SystemUser.user_id
Ref: UserRole.role_id > Role.role_id
Ref: UserRole.assigned_by > SystemUser.user_id

// [FIX-2] InventoryLockLog -- removed hotel_id ref
Ref: InventoryLockLog.room_id > Room.room_id

Ref: AuditLog.changed_by > SystemUser.user_id
