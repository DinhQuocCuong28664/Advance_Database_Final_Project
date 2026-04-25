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
19_seed_demo_operations.sql  # optional operational demo data
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

- Reservation status timeline from `ReservationStatusHistory`.
- Filters by hotel, destination status, date range, reservation code.

### AdminReports

- KPI summary.
- Revenue by hotel and room type.
- Revenue by brand and chain.
- Excel and PDF export.

### AccountPage

- Tabs: Overview, Reservations, In-house Services, Loyalty, Profile.
- In-house Services tab uses active `CHECKED_IN` reservation.
- Profile tab includes change password form.

### BookingPage

- Supports direct route and search-driven route.
- Handles booking email collision flow:
  - check whether email exists
  - send OTP if email already has an account
  - submit booking with OTP validation

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

---

## Seed Data

### Baseline seed: `06_seed_data.sql`

Current consolidated baseline includes:

- 9 hotels
- hotel, location, room, rate, promotion, service catalog, and room feature data
- 3 demo login accounts only:
  - `admin / admin`
  - `cashier / cashier`
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

---

## Credentials

| Type | Login | Password |
|---|---|---|
| Admin | `admin` | `admin` |
| Cashier | `cashier` | `cashier` |
| Guest | `dqc` | `dqc` |

---

## Current Gaps and Follow-up

| Item | Priority | Notes |
|---|---|---|
| Embed `AdditionalGuests` directly inside Front Desk detail UI | Medium | API and component already exist |
| Surface `AuditLog` in admin UI | Medium | Table exists but no UI yet |
| Production auth and RBAC hardening | High | Current note tracks feature scope, not security readiness |
| Realtime updates for operations modules | Low | Would improve housekeeping and maintenance workflows |
| Internationalization | Low | UI is still mostly English-first |

---

## Scope rule for this file

This note is intended to match the current repository state:

- frontend routes and current tabs
- backend endpoints that exist now
- baseline SQL seed and optional demo seed
- current UI modules that are already wired

If code and this file drift, update this file after the code is stabilized.
