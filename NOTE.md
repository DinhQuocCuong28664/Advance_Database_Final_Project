# LuxeReserve - Development Notes

> Full-stack hotel reservation and operations system.
> Stack: Node.js / Express backend, React (Vite) frontend, SQL Server, MongoDB catalog data.

---

## System Overview

| Layer | Stack |
|---|---|
| Backend | Node.js + Express + mssql |
| Frontend | React + Vite + CSS |
| Database | SQL Server + MongoDB |
| Auth | JWT in localStorage via AuthContext |
| Routing | react-router-dom v6 |
| Notifications | FlashContext + ToastContainer |

### Core commands

```bash
npm run dev
npm run frontend:dev
npm run db:init
npm run db:views
npm run db:triggers
npm run db:procedures
npm run db:email
npm run db:seed
npm run db:auth
npm run db:demo
node database/mongodb/02_seed_data.js
node database/mongodb/03_expand_catalog.js
node database/mongodb/04_seed_real_hotel_images.js
```

### DB setup order

```text
01_create_database.sql
02_create_tables.sql
03_create_views.sql
04_create_triggers.sql
05_create_procedures.sql
11_email_verification.sql
06_seed_data.sql
07_auth_extension.sql        # optional sync for demo auth baseline
20_loyalty_rewards.sql       # loyalty redemption table/backfill if needed
21_add_manager_role.sql      # manager role/user migration if needed
22_add_hotel_reviews.sql     # hotel review migration if needed
23_seed_city_filter_hotels.sql # optional city filter demo hotels
19_seed_demo_operations.sql  # optional operational demo data
```

### MongoDB setup order

```text
02_seed_data.js              # base Hotel_Catalog, amenity_master, room_type_catalog
03_expand_catalog.js         # expanded hotel catalog for network hotels
04_seed_real_hotel_images.js # replaces fake CDN image URLs with demo-safe public image URLs
```

---

## Frontend Route Map

| URL | Component | Status |
|---|---|---|
| `/` | DashboardPage | Done |
| `/search` | SearchPage | Done |
| `/hotel/:id` | HotelPage | Done |
| `/booking` | BookingPage | Done |
| `/booking/:hotelId/:roomId` | BookingPage | Done |
| `/booking/vnpay-return` | VnpayReturnPage | Done |
| `/login` | LoginPage | Done |
| `/register` | RegisterPage | Done |
| `/forgot-password` | ForgotPasswordPage | Done |
| `/reset-password` | ResetPasswordPage | Done |
| `/account` | AccountPage | Done |
| `/reservation` | ReservationPage | Done |
| `/admin` | AdminPage | Done |
| `/cashier` | CashierPage | Done |

---

## Admin Workspace Tabs

Admin and manager access are split:

- `ADMIN` sees the full workspace below.
- `MANAGER` sees a reduced workspace with `Rates` and `Reports` only.

| Tab Key | Label | Component |
|---|---|---|
| `frontdesk` | Front Desk | `AdminFrontDesk` |
| `inventory` | Inventory | `AdminInventory` |
| `housekeeping` | Housekeeping | `AdminHousekeeping` |
| `maintenance` | Maintenance | `AdminMaintenance` |
| `invoice` | Invoices | `AdminInvoice` |
| `rates` | Rates | `AdminRates` |
| `promotions` | Promotions | `AdminPromotions` |
| `channels` | Channels | `AdminLocationChannels` |
| `payments` | Payments | `AdminPayments` |
| `accounts` | Accounts | `AdminAccounts` |
| `timeline` | Timeline | `AdminTimeline` |
| `reports` | Reports | `AdminReports` |

---

## Backend API Reference

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Unified login for guest or system user |
| `POST` | `/api/auth/guest/register` | Register guest account |
| `POST` | `/api/auth/guest/verify-email` | Verify OTP for guest registration |
| `POST` | `/api/auth/guest/resend-verification` | Resend registration OTP |
| `POST` | `/api/auth/guest/booking-email-status` | Check whether booking email already has an account |
| `POST` | `/api/auth/guest/booking-email-otp` | Send OTP for booking flow when email already exists |
| `POST` | `/api/auth/guest/forgot-password` | Send password reset OTP |
| `POST` | `/api/auth/guest/reset-password` | Reset password with OTP |
| `POST` | `/api/auth/guest/change-password` | Change password for logged-in user |
| `GET` | `/api/auth/me` | Get current session |

### Hotels and rooms

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/hotels` | List hotels |
| `GET` | `/api/hotels/:id` | Hotel detail with room types, amenities, policies, room features |
| `GET` | `/api/hotels/:id/reviews` | Public published hotel reviews |
| `POST` | `/api/hotels/:id/reviews` | Guest publishes one review for a checked-out reservation |
| `GET` | `/api/hotels/:id/features` | List room features for a hotel |
| `POST` | `/api/hotels/:id/features` | Create room feature |
| `DELETE` | `/api/hotels/:id/features/:fid` | Delete room feature |
| `GET` | `/api/rooms/availability` | Availability by hotel, room type, date range |

### Locations

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/locations` | Flat location list |
| `GET` | `/api/locations/tree` | Recursive location tree |

### Guests

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/guests/:id` | Guest profile, loyalty, preferences |
| `GET` | `/api/guests/:id/stays` | Stay history |
| `GET` | `/api/guests/:id/reviews` | Reviews submitted by guest |
| `GET` | `/api/guests/:id/loyalty-rewards` | Redeemable loyalty promotions |
| `GET` | `/api/guests/:id/loyalty-redemptions` | Guest redemption history |
| `POST` | `/api/guests/:id/loyalty-rewards/:promotionId/redeem` | Redeem points for promotion voucher |

### Reservations

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reservations` | Reservation list with filters |
| `POST` | `/api/reservations` | Create reservation via `sp_ReserveRoom` |
| `GET` | `/api/reservations/by-guest/:code` | Lookup reservations by guest code |
| `GET` | `/api/reservations/:code` | Reservation detail with rooms and history |
| `POST` | `/api/reservations/:id/checkin` | Check-in |
| `POST` | `/api/reservations/:id/checkout` | Check-out |
| `POST` | `/api/reservations/:id/guest-cancel` | Guest-side cancel |
| `POST` | `/api/reservations/:id/hotel-cancel` | Hotel-side cancel |
| `POST` | `/api/reservations/:id/transfer` | Room transfer via `sp_TransferRoom` |
| `GET` | `/api/reservations/:id/guests` | Additional guest list |
| `POST` | `/api/reservations/:id/guests` | Add additional guest |
| `DELETE` | `/api/reservations/:id/guests/:guestId` | Remove additional guest |

### Payments and VNPay

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/payments` | Payment history with filters |
| `POST` | `/api/payments` | Create payment |
| `POST` | `/api/vnpay/create-payment` | Start VNPay payment |
| `GET` | `/api/vnpay/return` | VNPay return callback |
| `GET` | `/api/vnpay/ipn` | VNPay IPN callback |

### Services

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/services` | Service catalog for a hotel |
| `POST` | `/api/services/order` | Create service order |
| `GET` | `/api/services/orders` | List service orders |
| `PUT` | `/api/services/orders/:id/status` | Update service order status |
| `POST` | `/api/services/orders/:id/pay` | Charge incidental order |

### Housekeeping

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/housekeeping` | List housekeeping tasks |
| `POST` | `/api/housekeeping` | Create task |
| `PUT` | `/api/housekeeping/:id/assign` | Assign staff |
| `PUT` | `/api/housekeeping/:id/status` | Advance task lifecycle and sync room status |

### Maintenance

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/maintenance` | List maintenance tickets |
| `POST` | `/api/maintenance` | Create ticket |
| `PUT` | `/api/maintenance/:id` | Update or resolve ticket |

### Invoices

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/invoices` | List invoices |
| `POST` | `/api/invoices` | Create invoice from `vw_ReservationTotal` |
| `GET` | `/api/invoices/:id` | Invoice detail |
| `POST` | `/api/invoices/:id/issue` | Draft to issued |

### Promotions

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/promotions` | List promotions |
| `POST` | `/api/promotions` | Create promotion |
| `PUT` | `/api/promotions/:id` | Update promotion |
| `DELETE` | `/api/promotions/:id` | Soft delete promotion |

### Admin

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/accounts` | System users and guest accounts snapshot |
| `PUT` | `/api/admin/accounts/system/:id` | Update system user status |
| `PUT` | `/api/admin/accounts/guest/:id` | Update guest account status |
| `GET` | `/api/admin/rates` | Nightly rate list |
| `PUT` | `/api/admin/rates/:id` | Update nightly rate |
| `GET` | `/api/admin/rates/alerts` | Rate change alerts |
| `PUT` | `/api/admin/availability/:id` | Availability update with optimistic locking |
| `GET` | `/api/admin/history` | Reservation status history timeline |
| `GET` | `/api/admin/operations-log` | Focused booking, cancellation, check-in, and check-out log |
| `GET` | `/api/admin/channels` | Booking channel stats |
| `GET` | `/api/admin/location-tree` | Nested location tree with hotel counts |
| `GET` | `/api/admin/reports/summary` | KPI summary |
| `GET` | `/api/admin/reports/revenue` | Revenue by hotel and room type |
| `GET` | `/api/admin/reports/revenue-by-brand` | Revenue by chain, brand, hotel |
| `GET` | `/api/admin/rate-plans` | List rate plans |
| `GET` | `/api/admin/rate-plans/:id` | Get rate plan detail |
| `POST` | `/api/admin/rate-plans` | Create rate plan |
| `PUT` | `/api/admin/rate-plans/:id` | Update rate plan |
| `DELETE` | `/api/admin/rate-plans/:id` | Soft delete rate plan |

---

## Frontend Module Notes

### AdminFrontDesk

- Arrival board for `CONFIRMED` reservations.
- Departure board for `CHECKED_IN` reservations.
- Actions: check-in, check-out, hotel cancel, transfer room.
- Service orders tab: confirm, deliver, charge guest.
- Uses payment modal for stay balance and incidental charges.

### AdditionalGuests

- Reusable panel for `ReservationGuest`.
- CRUD against `/reservations/:id/guests`.

### AdminInventory

- Availability management by hotel and date.
- Uses optimistic locking through `expected_version`.

### AdminHousekeeping

- Task lifecycle: `OPEN -> ASSIGNED -> IN_PROGRESS -> DONE -> VERIFIED`.
- Assignment modal and summary counters.
- Syncs `Room.housekeeping_status`.

### AdminMaintenance

- Ticket lifecycle: `OPEN -> ASSIGNED -> IN_PROGRESS -> RESOLVED -> CLOSED`.
- High and critical room-linked tickets move room to `UNDER_REPAIR`.

### AdminInvoice

- Lookup reservation by code.
- Create draft invoice.
- View invoice lines for rooms, services, and payments.
- Issue invoice from `DRAFT` to `ISSUED`.

### AdminRates

- Two areas:
  - `Rate Plans` management
  - `Nightly Rates` management
- Rate plans support create, update, deactivate, hotel/type/status filters.
- Nightly rates support inline editing and Price Guard confirmation for >50 percent change.

### AdminPromotions

- Promotion list, create form, inline update, deactivate.

### AdminLocationChannels

- Booking channel stats view.
- Location tree view from recursive CTE data.

### AdminPayments

- On-demand search.
- Filters by hotel, date range, type, method, status.
- KPI summary and payment table.

### AdminTimeline

- Two modes:
  - `Operations log`: focused hotel history for successful bookings, cancellations, check-ins, and check-outs.
  - `Full audit timeline`: detailed status transitions from `ReservationStatusHistory`.
- Filters by hotel, operation/status, date range, reservation code.

### AdminReports

- KPI summary.
- Revenue by hotel and room type.
- Revenue by brand and chain.
- Excel and PDF export.

### AccountPage

- Tabs: Overview, Bookings & Reviews, In-house Services, Loyalty, Profile.
- In-house Services tab uses active `CHECKED_IN` reservation.
- Room issue reports persist after reload through `/api/maintenance?hotel_id=&room_id=`.
- Bookings & Reviews lets checked-out guests publish short hotel reviews.
- Loyalty tab supports point redemption into promotion voucher codes.
- Profile tab includes change password form.

### BookingPage

- Supports direct route and search-driven route.
- Uses the selected hotel's native currency from the room/hotel payload.
- Supports redeemed loyalty voucher codes for eligible promotions.
- Handles booking email collision flow:
  - check whether email exists
  - send OTP if email already has an account
  - submit booking with OTP validation

### SearchPage

- Destination dropdown is available on both Dashboard and Search.
- Search matches hotel, city, country, and district names.
- Hotel cards display native hotel currency.
- Route preview uses browser geolocation, embedded map preview, and Google Maps handoff.

### LoginPage

- Login has a media panel with optional video background.
- Video files are expected under `frontend/public/videos`:
  - `luxury-hotel-login.webm`
  - `luxury-hotel-login.mp4`
- If no video exists, the poster image fallback is used.

---

## Technical Patterns

### Locking

| Pattern | Where used |
|---|---|
| Pessimistic locking | `sp_ReserveRoom`, `sp_TransferRoom` |
| Optimistic locking | `PUT /api/admin/availability/:id` |
| Price Guard | `PUT /api/admin/rates/:id` plus `RateChangeLog` |

### SQL objects

| Object | Purpose |
|---|---|
| `vw_ReservationTotal` | Financial source of truth for invoices and reservation totals |
| `sp_ReserveRoom` | Reservation creation with inventory locking |
| `sp_TransferRoom` | Atomic room transfer |
| `trg_RoomRate_PriceIntegrityGuard` | Auto-log large rate changes |
| `trg_Reservation_CancellationAudit` | Auto-log cancellation audit rows |

### Location hierarchy

`Location.location_type` currently uses:

- `REGION`
- `COUNTRY`
- `STATE_PROVINCE`
- `CITY`
- `DISTRICT`

---

## Database Scope

### Important tables

| Table | Purpose |
|---|---|
| `Location` | Geography hierarchy |
| `HotelChain`, `Brand`, `Hotel` | Business hierarchy |
| `RoomType`, `Room`, `RoomFeature` | Room modeling |
| `RoomAvailability` | Per-night inventory |
| `RatePlan`, `RoomRate`, `RateChangeLog` | Pricing |
| `Guest`, `GuestPreference`, `LoyaltyAccount`, `GuestAuth` | Guest identity and profile |
| `SystemUser`, `Role`, `UserRole` | System auth and roles |
| `Reservation`, `ReservationRoom`, `ReservationGuest`, `ReservationStatusHistory` | Stay lifecycle |
| `Payment`, `Invoice` | Financials |
| `ServiceCatalog`, `ReservationService`, `StayRecord` | In-stay operations |
| `HousekeepingTask`, `MaintenanceTicket` | Operations management |
| `InventoryLockLog`, `AuditLog` | Audit and locking logs |
| `LoyaltyRedemption` | Redeemed promotion vouchers from loyalty points |
| `HotelReview` | Public guest reviews after checked-out stays |

---

## MongoDB Scope

MongoDB is used as a rich-content store. SQL Server remains the source of truth for transactional data.

| Collection | Purpose |
|---|---|
| `Hotel_Catalog` | Hotel descriptions, image gallery metadata, location detail, embedded amenity and room summaries |
| `room_type_catalog` | Room type descriptions, feature text, image metadata |
| `amenity_master` | Amenity names, icons, tags, descriptions |

### Image and video policy

- Store image/video files in `frontend/public`, CDN, or object storage.
- Store only URLs/paths and metadata in MongoDB.
- Do not store large binary images/videos directly in SQL Server or MongoDB for this project.
- Current hotel demo images are updated by `database/mongodb/04_seed_real_hotel_images.js`.

---

## Seed Data

### Baseline seed: `06_seed_data.sql`

Current consolidated baseline includes:

- 9 hotels
- hotel, location, room, rate, promotion, service catalog, and room feature data
- 4 demo login accounts:
  - `admin / admin`
  - `cashier / cashier`
  - `manager / manager`
  - `dqc / dqc`

Guest demo account details:

- guest code login: `dqc`
- email: `dqc@luxereserve.local`

### Demo operations seed: `19_seed_demo_operations.sql`

Adds rerunnable sample data for feature demos:

- 4 reservations across `CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`, `CANCELLED`
- 3 invoices
- 5 payments
- 3 service orders
- 4 housekeeping tasks
- 3 maintenance tickets

This script is intended for UI demos and QA, not baseline initialization.

### City filter seed: `23_seed_city_filter_hotels.sql`

Adds three extra hotels so city-level search/filter demos have multiple properties:

- Bangkok: `W Bangkok`, `The Ritz-Carlton, Bangkok Riverside`
- Singapore City: `InterContinental Singapore`, `W Singapore Marina Bay`
- Ho Chi Minh City: `The Ritz-Carlton, Saigon`, `W Saigon Riverside`

After this optional seed, the demo network has 12 hotels.

### Mongo image seed: `04_seed_real_hotel_images.js`

Replaces fake `cdn.luxereserve.com` image URLs with public demo image URLs in `Hotel_Catalog.images`.
Dashboard destinations and hotel/search cards consume these URLs through `/api/hotels`.

---

## Credentials

| Type | Login | Password |
|---|---|---|
| Admin | `admin` | `admin` |
| Cashier | `cashier` | `cashier` |
| Manager | `manager` | `manager` |
| Guest | `dqc` | `dqc` |

---

## Current Gaps and Follow-up

| Item | Priority | Notes |
|---|---|---|
| Embed `AdditionalGuests` directly inside Front Desk detail UI | Medium | API and component already exist |
| Surface `AuditLog` in admin UI | Medium | Table exists but no UI yet |
| Production auth and RBAC hardening | High | Current note tracks feature scope, not security readiness |
| True realtime updates with WebSocket/SSE | Low | Front Desk has auto-refresh on filter/tab changes; push updates are not implemented |
| Internationalization | Low | UI is still mostly English-first |
| Mixed-currency reporting normalization | Medium | Reports display transactional values; no FX conversion layer is implemented |
| VNPay for non-VND hotels | Low | VNPay is VND-specific; non-VND hotels should use cash/card mock or future gateway integration |

---

## Scope rule for this file

This note is intended to match the current repository state:

- frontend routes and current tabs
- backend endpoints that exist now
- baseline SQL seed and optional demo seed
- current UI modules that are already wired

If code and this file drift, update this file after the code is stabilized.

---

## 2026-04-28 — Apply RULE.md conventions to all database files

Changes: fix all PRINT / console.log / console.error messages to use ASCII prefix
(`[OK]`, `[ERROR]`) per Rule 2 (no emoji, no non-prefixed output). Also removed
plain-text password strings from PRINT statements (moved reference to ACCOUNT.md).

- database/sql/01_create_database.sql (line 23): Added [OK] prefix to PRINT
- database/sql/02_create_tables.sql (lines 42-1113): Added [OK] prefix to all 30 table PRINT statements and summary block
- database/sql/03_create_views.sql (line 77): Added [OK] prefix to PRINT
- database/sql/04_create_triggers.sql (lines 64, 127): Added [OK] prefix to PRINT
- database/sql/05_create_procedures.sql (lines 139, 355): Added [OK] prefix to PRINT
- database/sql/07_auth_extension.sql (lines 60-64): Added [OK] prefix, removed plain-text credentials from PRINT
- database/sql/20_loyalty_rewards.sql (line 93): Added [OK] prefix to PRINT
- database/sql/21_add_manager_role.sql (lines 56-57): Added [OK] prefix, removed plain-text credentials from PRINT
- database/sql/22_add_hotel_reviews.sql (line 36): Added [OK] prefix to PRINT
- database/mongodb/02_seed_data.js (lines 17, 29, 114, 187, 314, 316-321, 324): Added [OK]/[ERROR] prefix to all console messages
- database/mongodb/03_expand_catalog.js (lines 433-435, 437): Added [OK]/[ERROR] prefix to all console messages
- database/mongodb/03_expand_catalog.js (lines 433-435, 437): Added [OK]/[ERROR] prefix to all console messages
- database/mongodb/04_seed_real_hotel_images.js (lines 181, 188): Added [OK]/[ERROR] prefix to all console messages

---

## 2026-04-28 — Apply RULE.md conventions to all backend (src/) files

Changes: fix all emoji/Unicode characters in JSDoc headers, comment banners,
console messages, and string literals per Rule 1 (English-only in code) and
Rule 2 (no emoji/special Unicode in code files).

- src/app.js (lines 1-177): Fixed JSDoc header, comment banners (// -> // ===), emoji in console messages and JSON response string literals
- src/config/database.js (lines 1-87): Fixed JSDoc header, comment banners, emoji in console.log/error messages
- src/services/mail.js (lines 22-277): Fixed comment section banners, emoji in console messages, emoji in email subject strings and HTML footer text
- src/services/vnpay.js: No changes needed (already clean)
- src/routes/rooms.js (line 2): Fixed JSDoc header emoji
- src/routes/payments.js (line 2): Fixed JSDoc header emoji
- src/routes/maintenance.js (line 2): Fixed JSDoc header emoji
- src/routes/housekeeping.js (line 2): Fixed JSDoc header emoji
- src/routes/hotels.js (line 2): Fixed JSDoc header emoji
- src/routes/guests.js (line 2): Fixed JSDoc header emoji
- src/routes/admin.js (line 2): Fixed JSDoc header emoji
- src/routes/reservations.js (line 2): Fixed JSDoc header emoji
- src/routes/services.js (lines 2, 200, 240): Fixed JSDoc header and inline comment section banners
- src/routes/vnpay.js (lines 140, 172): Fixed inline comment and helper comment banner

## 2026-04-29 - Add SQL views for advanced database feature documentation

Added three new SQL VIEWs to `database/sql/03_create_views.sql` to match
the advanced database features described in Abstract.md and related docs:

- database/sql/03_create_views.sql (line 81-148): Added `vw_LocationTree`
  - Recursive CTE that flattens the Location adjacency-list hierarchy
  - Returns: depth, full_path (e.g. "Asia > Vietnam > Ho Chi Minh City"), hotel_count per node
- database/sql/03_create_views.sql (line 150-218): Added `vw_RevenueByHotel`
  - Uses Window Functions: DENSE_RANK() OVER, SUM() OVER with ROWS BETWEEN (running total)
  - Returns: monthly_revenue, cumulative_revenue, hotel_rank_in_brand, brand_revenue_share_pct
- database/sql/03_create_views.sql (line 220-265): Added `vw_BookingChannelStats`
  - Aggregates reservation counts and revenue by booking_source per hotel
  - Uses Window Function: SUM(COUNT()) OVER (PARTITION BY hotel_id) for channel share %

## 2026-04-29 - Cross-layer validation: add missing GET /rooms endpoint

FE-BE-DB cross-check found that Housekeeping and Maintenance pages call
GET /rooms?hotel_id=... for room dropdowns, but the backend only exposed
GET /rooms/availability (which requires checkin+checkout date params).

- src/routes/rooms.js (line 88-121): Added GET / endpoint for simple room list
  - Returns: room_id, room_number, floor_number, room_status, housekeeping_status,
    maintenance_status, room_type_name, category, bed_type, max_adults, etc.
  - Required param: hotel_id; optional: limit (default 100, max 500)
  - Used by: AdminHousekeeping.jsx, AdminMaintenance.jsx
