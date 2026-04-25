# UI Rebuild Plan Based on Booking.com Structure

## 1. UI Reset Rationale

The current frontend should not be treated as a foundation for future work.

Reasons:

- It was started too early, before the core public booking journey was stabilized.
- Several screens were built as working tools instead of product-grade customer journeys.
- Guest flow, loyalty flow, reservation self-service, and admin operations were mixed too soon.
- Layout and navigation decisions were made before the correct page architecture was locked.
- The next frontend pass should start from business flow first, not from the current component tree.

This document is the new source of truth for rebuilding the frontend from zero.

The old frontend is not a baseline.

## 2. Product Scope For This Hotel-Only Platform

The rebuilt product is a hotel-chain booking website, not a travel super-app.

In scope:

- search destinations where the chain has hotels
- compare hotels inside the chain only
- open a hotel detail page before booking
- complete booking as anonymous or logged-in loyalty guest
- guest reservation lookup and self-service
- guest account basics
- separate admin portal for operations

Out of scope:

- flights
- flight + hotel
- car rental
- attractions
- airport taxi
- marketplace-scale review ecosystem
- large-scale third-party property listings
- deep smart filters not supported by backend truth
- wallet, reward redemption, or voucher marketplace in v1

## 3. Reference Patterns Taken From Booking.com

The Booking.com screenshots in the [`hotel`](C:\Users\cbzer\Downloads\HCSDLNC\hotel) folder should be used as structural references only.

Adopt:

- homepage with a dominant search bar above the fold
- destination-first search entry
- separate search results page
- left sidebar filters on search results
- top sort row above hotel cards
- list/grid results concept
- hotel detail page before booking
- checkout-style booking page with a right or left summary sidebar
- account area separated from public browsing

Do not adopt:

- Booking.com branding, color system, or full visual clone
- tabs for flights, taxis, attractions, or rental cars
- large review-led marketplace complexity
- filters that require data the backend does not expose

Visual direction:

- use Booking.com for information hierarchy and page order
- keep LuxeReserve as the product identity
- visual polish is secondary to workflow correctness in the rebuild

## 4. Page Architecture

The rebuild should use this route map:

- `/`
  - public homepage
- `/search`
  - destination search results
- `/hotel/:id`
  - hotel detail page
- `/booking/:hotelId`
  - booking flow entry for a selected hotel
- `/booking/:hotelId/:roomId`
  - booking flow for a selected room option
- `/reservation`
  - guest reservation lookup and self-service
- `/login`
  - guest login
- `/register`
  - guest registration
- `/account`
  - guest account overview
- `/admin/login`
  - admin login
- `/admin/*`
  - admin operational portal

These routes should replace the earlier mixed-page model.

## 5. Core User Journeys

### 5.1 Anonymous Guest Journey

Flow:

1. Open homepage
2. Enter destination, dates, and guest count in the hero search bar
3. Move to `/search`
4. Compare chain hotels in the destination
5. Open `/hotel/:id`
6. Review hotel content, amenities, room options, and promotions
7. Select a room and move to booking
8. Enter guest details manually
9. Confirm booking and payment details
10. Land on reservation confirmation and later use `/reservation` for lookup

Rules:

- anonymous users must be able to book without creating an account
- anonymous users must never see account-only assumptions in the booking form
- hotel comparison comes before room selection

### 5.2 Loyalty Guest Journey

Flow:

1. Guest signs in through `/login`
2. Search and browse exactly like anonymous flow
3. Booking form is prefilled using guest profile
4. Member context is visible during booking
5. Applicable member-only promotions can be shown
6. Reservation is visible later in `/account` and `/reservation`

Rules:

- loyalty is an enhancement to booking, not a separate booking model
- v1 loyalty scope is profile + status + offers only
- no points redemption or wallet behavior in v1

### 5.3 Guest Reservation Self-Service

`/reservation` should remain guest-facing only.

Allowed:

- lookup by reservation code
- reservation summary
- payment summary
- guest-facing payment actions if enabled
- guest cancellation if backend rules allow it
- read-only lifecycle/status timeline

Not allowed:

- check-in
- check-out
- invoice issue
- service operations
- housekeeping or maintenance actions
- hotel-side operational workflows

### 5.4 Admin Journey

Admin should be a separate product area.

Flow:

1. Login via `/admin/login`
2. Enter admin portal
3. Access front desk, inventory, and operational tools
4. Manage reservation lifecycle and hotel-side operations

Admin owns:

- reservation operations
- check-in
- check-out
- hotel cancellation
- inventory management
- invoice issue
- housekeeping and maintenance views
- operational feeds and reporting

Public guest pages must never expose admin actions.

## 6. Page-Level Behavior

### 6.1 Homepage `/`

Homepage sections:

- header with brand and auth entry points
- hero banner with main search bar
- curated hot destinations
- featured hotels or promotions
- trust/value section
- footer

Hero search bar fields:

- destination
- check-in / check-out
- guests
- search button

Homepage must not contain:

- booking steps
- room cards
- admin workflow shortcuts
- large operational widgets

### 6.2 Search Results `/search`

Purpose:

- compare hotels in the selected destination before entering a hotel detail page

Layout:

- top persistent search row
- top sort row
- optional map placeholder area
- left filter sidebar
- right result list or grid

Result cards should show:

- hotel name
- location summary
- star rating
- brand
- chain
- a starting price if available
- a few highlights or amenity cues
- CTA to open hotel detail

Search results should compare hotels first, not individual room variants.

Allowed filters in v1:

- budget per night
- district / area
- brand
- hotel type
- star rating

Deferred filters:

- smart filters based on natural language
- review-score filters unless backed by real data
- landmark distance filters
- accessibility filters
- pet-friendly filters
- breakfast-specific filters unless backend truth exists
- marketplace-scale checkbox walls like Booking.com

### 6.3 Hotel Detail `/hotel/:id`

This page must always exist before booking.

Sections:

- image gallery
- hotel title and location summary
- address and map summary
- overview / description
- amenities
- room options
- active promotions
- primary reserve CTA

Room options should be the bridge from hotel browsing to booking.

Reserve CTA behavior:

- selecting a room opens `/booking/:hotelId/:roomId`
- if a room is not yet selected, the hotel page should encourage choosing a room first

### 6.4 Booking `/booking/:hotelId` or `/booking/:hotelId/:roomId`

This page should behave like a checkout flow, not like search.

Booking steps:

1. selected hotel and room summary
2. guest details
3. payment / confirmation

Layout:

- main form area
- summary sidebar

Summary sidebar should include:

- hotel
- stay dates
- guest count
- selected room
- pricing summary
- guarantee/payment summary

Rules:

- anonymous guests enter details manually
- logged-in guests get autofill and loyalty context
- booking page must not include admin or service operations
- hotel comparison and room discovery should already be done before this page

### 6.5 Account `/account`

This is the basic guest account area.

Sections:

- profile basics
- account identity
- upcoming stays
- reservation history
- loyalty summary if applicable

Do not build in v1:

- wallet
- reward redemption
- voucher center
- complex preference center

### 6.6 Admin `/admin/*`

Admin remains fully separate from the guest/public journey.

Admin page groups:

- front desk
- inventory
- operations
- reports

This area should not share workflow assumptions with public pages.

## 7. Rebuild Phases

The rebuild must happen in this order:

### Phase 1: Architecture And Routing  DONE

- finalize page map
- create global shell
- separate public routes, account routes, and admin routes
- define auth entry points

### Phase 2: Homepage  DONE

- build header and footer
- build hero banner and destination search
- build hot destination cards
- build featured properties/promotions section
- build trust/value section

### Phase 3: Search Results  DONE

- build `/search`
- implement destination-driven hotel comparison
- implement allowed filters only
- add sort row
- add result list/grid mode if needed
- add optional map placeholder block

### Phase 4: Hotel Detail  DONE

- build `/hotel/:id`
- add gallery, overview, amenities, room options, and promotions
- connect reserve CTA to booking flow

### Phase 5: Booking Flow  DONE

- build checkout-style booking page
- support anonymous booking
- support logged-in loyalty autofill
- build summary sidebar
- finalize confirmation state
- deposit system (30% bat buoc)
- VNPay integration (code ready, commented out)

### Phase 6: Reservation Self-Service  DONE

- build guest lookup page
- add summary, timeline, payment summary, and guest actions
- keep admin actions out

### Phase 7: Account  DONE

- build guest account shell
- add profile summary, upcoming stays, history, and loyalty snapshot

### Phase 8: Admin Portal  PARTIAL

-  build admin login (unified with guest login)
-  inventory management with optimistic locking
-  account management (system users + guests)
-  reports & analytics with KPIs + Excel/PDF export
-  front desk (check-in / check-out / room transfer)
-  guest services (order, deliver, pay incidentals)
-  housekeeping task management
-  maintenance ticket management
-  invoice generation and issuance

### Phase 9: Polish  PARTIAL

-  responsive behavior (all breakpoints)
-  CSS refactored to per-page stylesheets
-  improve consistency and accessibility
-  further visual refinements

---

## 8. Backend vs Frontend Gap Analysis

> **Updated: 2026-04-20**

### 8.1 Database Schema  30 Tables in 12 Domains

| Domain | Tables | Frontend Coverage |
|---|---|---|
| 1. Location Hierarchy | Location |  Used in search + homepage |
| 2. Hotel Chain  Brand  Hotel | HotelChain, Brand, Hotel |  Used in hotel list/detail |
| 3. Hotel Policies & Amenities | HotelPolicy, HotelAmenity |  Amenities shown, policies not displayed |
| 4. Room Management | RoomType, Room, RoomFeature, RoomAvailability |  Used in booking + admin inventory |
| 5. Guest Management | Guest, GuestAddress, GuestPreference, LoyaltyAccount, GuestAuth |  Auth + basic profile used, preferences/addresses not exposed |
| 6. System Users & Roles | SystemUser, Role, UserRole |  Used in admin auth + account management |
| 7. Rate & Pricing | RatePlan, RoomRate, RateChangeLog, Promotion |  Rates in booking, promos in hotel/home, rate alerts in admin |
| 8. Booking & Reservation | BookingChannel, Reservation, ReservationRoom, ReservationGuest, ReservationStatusHistory |  Full booking flow + guest self-service |
| 9. Payment & Invoice | Payment, PaymentCardToken, Invoice |  Payment done, **Invoice has NO frontend** |
| 10. Services & Stay | ServiceCatalog, ReservationService, StayRecord |  **No frontend at all** |
| 11. Operations | HousekeepingTask, MaintenanceTicket |  **No frontend at all** |
| 12. Audit & Lock | InventoryLockLog, AuditLog |  Backend-only (audit trail, no UI needed) |

### 8.2 Backend Endpoints  Full Coverage Matrix

#### Public Guest Endpoints

| Endpoint | Status | Frontend Page |
|---|---|---|
| `GET /api/hotels` |  | DashboardPage, SearchPage |
| `GET /api/hotels/:id` |  | HotelPage |
| `GET /api/rooms/availability` |  | HotelPage, AdminInventory |
| `GET /api/promotions` |  | DashboardPage, HotelPage |
| `GET /api/locations` |  | DashboardPage (destinations) |
| `GET /api/locations/tree` |  | Not used (flat list sufficient for now) |
| `POST /api/auth/login` |  | LoginPage |
| `POST /api/auth/guest/register` |  | RegisterPage |
| `POST /api/auth/guest/login` |  | LoginPage |
| `GET /api/auth/me` |  | AuthContext |
| `POST /api/reservations` |  | BookingPage |
| `GET /api/reservations/:code` |  | ReservationPage |
| `GET /api/reservations/by-guest/:code` |  | ReservationPage |
| `POST /api/reservations/:id/guest-cancel` |  | ReservationPage |
| `POST /api/payments` |  | BookingPage |
| `GET /api/payments->reservation_id=` |  | ReservationPage |

#### Admin Endpoints

| Endpoint | Status | Frontend Component |
|---|---|---|
| `GET /api/admin/accounts` |  | AdminAccounts |
| `PUT /api/admin/rates/:id` |  | AdminInventory |
| `GET /api/admin/rates/alerts` |  | AdminPage (metric card) |
| `GET /api/admin/reports/revenue` |  | AdminReports |
| `GET /api/admin/reports/revenue-by-brand` |  | Exists, not surfaced in UI |
| `GET /api/admin/reports/summary` |  | AdminReports |
| `PUT /api/admin/availability/:id` |  | AdminInventory (optimistic lock) |
| `POST /api/reservations/:id/checkin` |  | **Missing  needs Front Desk UI** |
| `POST /api/reservations/:id/checkout` |  | **Missing  needs Front Desk UI** |
| `POST /api/reservations/:id/hotel-cancel` |  | **Missing  needs Front Desk UI** |
| `POST /api/reservations/:id/transfer` |  | **Missing  needs Front Desk UI** |

#### Service Endpoints

| Endpoint | Status | Frontend Component |
|---|---|---|
| `GET /api/services->hotel_id=` |  | **Missing  needs Services UI** |
| `POST /api/services/order` |  | **Missing  needs Services UI** |
| `GET /api/services/orders->reservation_id=` |  | **Missing  needs Services UI** |
| `PUT /api/services/orders/:id/status` |  | **Missing  needs Services UI** |
| `POST /api/services/orders/:id/pay` |  | **Missing  needs Services UI** |

#### Housekeeping Endpoints

| Endpoint | Status | Frontend Component |
|---|---|---|
| `GET /api/housekeeping->hotel_id=` |  | **Missing  needs Housekeeping UI** |
| `POST /api/housekeeping` |  | **Missing  needs Housekeeping UI** |
| `PUT /api/housekeeping/:id/assign` |  | **Missing  needs Housekeeping UI** |
| `PUT /api/housekeeping/:id/status` |  | **Missing  needs Housekeeping UI** |

#### Maintenance Endpoints

| Endpoint | Status | Frontend Component |
|---|---|---|
| `GET /api/maintenance->hotel_id=` |  | **Missing  needs Maintenance UI** |
| `POST /api/maintenance` |  | **Missing  needs Maintenance UI** |
| `PUT /api/maintenance/:id` |  | **Missing  needs Maintenance UI** |

#### Invoice Endpoints

| Endpoint | Status | Frontend Component |
|---|---|---|
| `GET /api/invoices->reservation_id=` |  | **Missing  needs Invoice UI** |
| `POST /api/invoices` |  | **Missing  needs Invoice UI** |
| `GET /api/invoices/:id` |  | **Missing  needs Invoice UI** |
| `POST /api/invoices/:id/issue` |  | **Missing  needs Invoice UI** |

#### Other Endpoints

| Endpoint | Status | Note |
|---|---|---|
| `GET /api/guests` |  | Admin-only, not needed for public v1 |
| `GET /api/guests/:id` |  | Admin-only |
| `POST /api/guests` |  | Used indirectly by registration |
| `POST /api/vnpay/create-payment` |  | Integrated, commented out |
| `GET /api/vnpay/return` |  | Integrated, commented out |
| `GET /api/vnpay/ipn` |  | Server-side only |

### 8.3 Summary of Gaps

**5 admin modules are missing frontend UI despite having complete backend APIs:**

1. **Front Desk**  check-in, check-out, hotel cancellation, room transfer (uses `sp_TransferRoom` stored procedure with pessimistic locking)
2. **Guest Services**  service catalog browsing, ordering, status tracking, incidental payment
3. **Housekeeping**  task list, staff assignment, status workflow (OPEN  ASSIGNED  IN_PROGRESS  DONE  VERIFIED), syncs with Room.housekeeping_status
4. **Maintenance**  ticket creation, assignment, resolution, auto-updates Room.maintenance_status
5. **Invoices**  generation from `vw_ReservationTotal`, line item breakdown (rooms + services + payments), issuing (DRAFT  ISSUED)

**Database tables with zero frontend exposure:**

- `StayRecord`  tracks actual check-in/check-out timestamps, front desk agent
- `ServiceCatalog`  hotel service catalog (SPA, dining, butler, tours...)
- `ReservationService`  ordered services linked to reservations
- `HousekeepingTask`  cleaning, turn-down, inspection, deep clean tasks
- `MaintenanceTicket`  repair tickets with severity levels
- `Invoice`  generated invoices with line items
- `HotelPolicy`  cancellation, deposit, child, pet, smoking policies (text fields)
- `GuestPreference`  bed, pillow, floor, diet, view preferences
- `GuestAddress`  home, work, billing addresses
- `PaymentCardToken`  saved card tokens

---

## 9. Proposed Admin Module Specifications

### 9.1 Front Desk Module

**Purpose:** Manage the guest stay lifecycle: check-in  in-house  check-out.

**Core Features:**

- **Check-in workflow:**
  - List today's arrivals (reservations with `checkin_date = TODAY` and status `CONFIRMED`)
  - Verify guest identity (identity_document_type, identity_document_no from Guest table)
  - Assign physical room if not pre-assigned (ReservationRoom.assignment_status)
  - Execute `POST /api/reservations/:id/checkin`
  - Creates StayRecord with `actual_checkin_at` timestamp

- **Check-out workflow:**
  - List today's departures (status `CHECKED_IN`, checkout_date = TODAY)
  - Show balance due from `vw_ReservationTotal`
  - Execute `POST /api/reservations/:id/checkout`
  - Option to generate invoice at checkout

- **Room transfer:**
  - Select reservation  select new room  provide reason
  - Execute `POST /api/reservations/:id/transfer` (uses `sp_TransferRoom` with pessimistic locking)
  - Shows transfer result with old/new room info

- **Hotel cancellation:**
  - Cancel with full refund via `POST /api/reservations/:id/hotel-cancel`
  - Different from guest-cancel (which forfeits deposit)

**Backend endpoints used:** checkin, checkout, transfer, hotel-cancel

### 9.2 Guest Services Module

**Purpose:** Browse hotel service catalog, order services for guests, track delivery.

**Core Features:**

- **Service catalog browser:**
  - List services by hotel (`GET /api/services->hotel_id=`)
  - Categories: SPA, AIRPORT_TRANSFER, DINING, BUTLER, YACHT, TOUR, BABYSITTING, EVENT, WELLNESS, OTHER
  - Pricing models: PER_USE, PER_HOUR, PER_PERSON, PACKAGE, PER_TRIP

- **Order service:**
  - Select reservation + service + quantity
  - `POST /api/services/order`
  - Status workflow: REQUESTED  CONFIRMED  DELIVERED  CANCELLED

- **Order management:**
  - View orders per reservation (`GET /api/services/orders->reservation_id=`)
  - Update status (`PUT /api/services/orders/:id/status`)
  - Process incidental payment (`POST /api/services/orders/:id/pay`)

**Backend endpoints used:** 5 service endpoints

### 9.3 Housekeeping Module

**Purpose:** Manage room cleaning tasks, staff assignment, and room readiness.

**Core Features:**

- **Task board:**
  - List by hotel with status/priority filters (`GET /api/housekeeping->hotel_id=&status=`)
  - Task types: CLEANING, TURN_DOWN, INSPECTION, DEEP_CLEAN
  - Priority levels: LOW, MEDIUM, HIGH, CRITICAL

- **Create task:**
  - Select hotel  room  task type  priority
  - `POST /api/housekeeping`

- **Assign staff:**
  - Assign system user to task
  - `PUT /api/housekeeping/:id/assign`

- **Status update:**
  - Workflow: OPEN  ASSIGNED  IN_PROGRESS  DONE  VERIFIED
  - Auto-syncs Room.housekeeping_status (CLEAN, DIRTY, INSPECTED, IN_PROGRESS)
  - `PUT /api/housekeeping/:id/status`

**Backend endpoints used:** 4 housekeeping endpoints

### 9.4 Maintenance Module

**Purpose:** Track and resolve room/facility maintenance issues.

**Core Features:**

- **Ticket list:**
  - Filter by hotel and status (`GET /api/maintenance->hotel_id=&status=`)
  - Severity: LOW, MEDIUM, HIGH, CRITICAL
  - Status: OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED

- **Create ticket:**
  - Hotel  Room (optional)  Category  Description  Severity
  - `POST /api/maintenance`
  - Auto-updates Room.maintenance_status to UNDER_REPAIR

- **Update/resolve ticket:**
  - `PUT /api/maintenance/:id`
  - Resolving restores Room.maintenance_status to NORMAL

**Backend endpoints used:** 3 maintenance endpoints

### 9.5 Invoice Module

**Purpose:** Generate, review, and issue invoices from reservation financial data.

**Core Features:**

- **Invoice list:**
  - Filter by reservation (`GET /api/invoices->reservation_id=`)

- **Generate invoice:**
  - From `vw_ReservationTotal` view
  - `POST /api/invoices` creates DRAFT invoice

- **Invoice detail:**
  - Line items: room charges + services + payments
  - `GET /api/invoices/:id`

- **Issue invoice:**
  - DRAFT  ISSUED transition
  - `POST /api/invoices/:id/issue`

**Backend endpoints used:** 4 invoice endpoints

---

## 10. Hotel Policy Display (Data exists but not surfaced)

The `HotelPolicy` table stores rich policy text fields that could enhance the hotel detail page:

| Field | Where to show |
|---|---|
| `cancellation_policy_text` | Hotel detail + Booking page |
| `deposit_policy_text` | Booking page (alongside deposit banner) |
| `child_policy_text` | Hotel detail |
| `pet_policy_text` | Hotel detail |
| `smoking_policy_text` | Hotel detail |
| `extra_bed_policy_text` | Hotel detail |
| `late_checkout_policy_text` | Hotel detail |
| `early_checkin_policy_text` | Hotel detail |
| `minimum_checkin_age` | Booking validation |

> **Note:** These require a new backend endpoint or adding to the existing `GET /api/hotels/:id` response.

---

## 11. Backend Mapping

The new frontend should use the current backend as the implementation foundation.

### Homepage / Search / Hotel Detail

- `GET /api/hotels`
- `GET /api/hotels/:id`
- `GET /api/promotions`
- `GET /api/rooms/availability`

### Guest Auth / Account

- `POST /api/auth/login`
- `POST /api/auth/guest/login`
- `POST /api/auth/guest/register`
- `GET /api/auth/me`

### Booking / Reservation

- `POST /api/reservations`
- `GET /api/reservations/:code`
- `POST /api/payments`

### Admin

- `/api/admin/*`

Important rule:

- filters, widgets, and comparisons must only depend on fields that actually exist in backend responses
- the UI must not invent marketplace-style features that backend data cannot truthfully support

## 12. Endpoint Utilization Strategy

The backend exposes far more endpoints than the first UI rebuild needs. The rebuild should not try to surface everything at once. Instead, every endpoint group should be classified clearly so the frontend roadmap uses the backend deliberately rather than partially by accident.

### 12.1 Public V1 Endpoints  All wired

- hotels, promotions, search/inventory, auth, booking/reservation, payments, guest-cancel

### 12.2 Guest Account / Loyalty Endpoints  Partially wired

- `/api/auth/me` 
- `/api/promotions->guest_id=` 
- `/api/reservations/:code` 
- `/api/payments->reservation_id=` 

### 12.3 Admin Portal Endpoints  17 endpoints missing UI

These should be considered first-class for the admin rebuild:

- **Front desk operations** (4 endpoints)  checkin, checkout, hotel-cancel, transfer
- **Services** (5 endpoints)  catalog, order, list orders, update status, pay
- **Housekeeping** (4 endpoints)  list, create, assign, update status
- **Maintenance** (3 endpoints)  list, create, update/resolve
- **Invoices** (4 endpoints)  list, generate, detail, issue

### 12.4 Existing But Not Prioritized For First UI Pass

- `/api/guests`  admin/data workflows
- `/api/guests/:id`  admin/data workflows
- `/api/guests` `POST`  used internally by registration
- `/api/admin/reports/revenue-by-brand`  available, not surfaced

### 12.5 Rule For Endpoint Coverage

The UI plan should not aim to use all backend endpoints in the first release.

Instead:

- all endpoint groups must be acknowledged
- each endpoint group must be assigned to a product surface
- anything not used in v1 must be intentionally deferred, not silently ignored
- backend breadth should shape the long-term roadmap, not overload the first rebuild

## 13. Deferred Features / Not In V1

These should be explicitly postponed:

- flights
- flight + hotel
- taxi
- attractions
- car rental
- wallet and reward redemption
- advanced smart filters
- huge review ecosystem
- large-scale landmark and neighborhood intelligence
- public invoice workflow
- public service operations
- admin tools inside guest pages

## 14. Acceptance Criteria

`plan_UI.md` is complete if a new implementer can answer all of these without guessing:

- which Booking.com patterns are intentionally reused
- which Booking.com features are excluded
- what the homepage should contain
- what the `/search` page is responsible for
- why hotel detail must always exist before booking
- how anonymous booking works
- how loyalty booking differs
- what belongs in `/reservation`
- what belongs in `/account`
- what belongs only in `/admin`
- which filters are valid in v1
- which endpoint groups belong to public v1, loyalty/account, admin, or deferred use
- which features are deferred

## 15. Default Build Rules

- workflow correctness comes before visual polish
- hotel comparison comes before booking
- room choice happens on hotel detail, not homepage
- booking is checkout-style, not search-style
- admin is fully separate from guest product flow
- backend truth is the limit for frontend complexity

## 16. Implementation Priority For Missing Admin Modules

Based on hotel PMS industry best practices and business flow dependencies:

| Priority | Module | Reason |
|---|---|---|
| **P0** | Front Desk | Core PMS function  check-in/check-out drives all other operations |
| **P1** | Invoices | Usually triggered at check-out  natural extension of front desk |
| **P2** | Guest Services | Enhances guest experience, generates ancillary revenue |
| **P3** | Housekeeping | Critical for room turnover, but can use backend directly initially |
| **P4** | Maintenance | Important but lower frequency, can use backend directly initially |

Recommended implementation order: Front Desk  Invoices  Services  Housekeeping  Maintenance.

## 17. Current File Structure (Post-Refactoring)

### Frontend Pages

| File | Lines | Purpose |
|---|---|---|
| `pages/DashboardPage.jsx` | 340 | Homepage |
| `pages/SearchPage.jsx` | 316 | Search results |
| `pages/BookingPage.jsx` | 322 | Booking checkout |
| `pages/RegisterPage.jsx` | 278 | Guest registration |
| `pages/HotelPage.jsx` | 241 | Hotel detail |
| `pages/ReservationPage.jsx` | 244 | Guest reservation self-service |
| `pages/AccountPage.jsx` | 224 | Guest account |
| `pages/AdminPage.jsx` | 145 | Admin shell (composes sub-components) |
| `pages/VnpayReturnPage.jsx` | 113 | VNPay payment result |
| `pages/LoginPage.jsx` | 70 | Login form |

### Admin Sub-Components

| File | Purpose |
|---|---|
| `pages/admin/AdminAccounts.jsx` | Account management |
| `pages/admin/AdminInventory.jsx` | Inventory control + optimistic locking |
| `pages/admin/AdminReports.jsx` | Reports + Export Excel/PDF |

### CSS Architecture

| File | Lines | Scope |
|---|---|---|
| `App.css` | 453 | Shared: shell, footer, auth, buttons, toast, responsive, VNPay |
| `styles/Home.css` | 250 | Homepage |
| `styles/Search.css` | 68 | Search page |
| `styles/Hotel.css` | 66 | Hotel detail |
| `styles/Booking.css` | 109 | Booking flow |
| `styles/Account.css` | 240 | Guest dashboard + reservation |
| `styles/Admin.css` | 370 | Admin dashboard |
