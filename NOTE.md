# LuxeReserve — Development Notes

> Full-stack hotel management system — Node.js / Express backend + React (Vite) frontend.
> This file is the single source of truth for what has been built, what is working,
> and what remains to be done.

---

## System Overview

| Layer | Stack |
|---|---|
| Backend | Node.js + Express + mssql (MSSQL / SQL Server) |
| Frontend | React (Vite) + Vanilla CSS |
| Auth | JWT stored in localStorage (AuthContext) |
| Toast | FlashContext → ToastContainer (per-layout) |
| Routing | react-router-dom v6 |

### Dev Commands
```
npm run dev           # Start backend (port 3000) with nodemon
npm run frontend:dev  # Start Vite dev server (port 5173)
```

> **Port conflict warning:** Never run two `npm run dev` processes simultaneously.
> Close the old terminal before opening a new one.

---

## Route Map

| URL | Component | Status |
|---|---|---|
| `/` | DashboardPage | ✅ Done |
| `/search` | SearchPage | ✅ Done |
| `/hotel/:id` | HotelPage | ✅ Done |
| `/booking/:hotelId/:roomId` | BookingPage | ✅ Done |
| `/booking/vnpay-return` | VnpayReturnPage | ✅ Done |
| `/login` | LoginPage | ✅ Done |
| `/register` | RegisterPage | ✅ Done |
| `/account` | AccountPage | ✅ Done |
| `/reservation` | ReservationPage | ✅ Done |
| `/admin` | AdminPage | ✅ Done |
| `/cashier` | CashierPage | ✅ Done |

---

## Admin Workspace Tabs

| Tab Key | Label | Component | Status |
|---|---|---|---|
| frontdesk | 🏨 Front Desk | AdminFrontDesk | ✅ Done |
| inventory | ⚙️ Inventory | AdminInventory | ✅ Done |
| housekeeping | 🧹 Housekeeping | AdminHousekeeping | ✅ Done |
| maintenance | 🔧 Maintenance | AdminMaintenance | ✅ Done |
| invoice | 📋 Invoices | AdminInvoice | ✅ Done |
| rates | 💰 Rates | AdminRates | ✅ Done |
| promotions | 🎁 Promotions | AdminPromotions | ✅ Done |
| channels | 🌐 Channels | AdminLocationChannels | ✅ Done |
| payments | 💳 Payments | AdminPayments | ✅ Done |
| accounts | 👤 Accounts | AdminAccounts | ✅ Done |
| timeline | 📋 Timeline | AdminTimeline | ✅ Done |
| reports | 📊 Reports | AdminReports | ✅ Done |

---

## Backend API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/login | Login for guest or system user |
| POST | /api/auth/guest/register | Register new guest account |
| POST | /api/auth/guest/verify-email | Verify guest email with OTP |
| POST | /api/auth/guest/resend-verification | Resend OTP email |
| GET  | /api/auth/me | Get current session user |

### Hotels & Rooms
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/hotels | List all hotels |
| GET | /api/hotels/:id | Hotel detail with room types, amenities, policies |
| GET | /api/rooms/availability | Room availability by date range (Optimistic Locking base) |

### Locations
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/locations | Flat location list |
| GET | /api/locations/tree | Recursive CTE hierarchy (Country → Region → City) |

### Reservations
| Method | Endpoint | Description |
|---|---|---|
| GET  | /api/reservations | List reservations (filters: guest_id, hotel_id, status) |
| POST | /api/reservations | Create reservation via sp_ReserveRoom (Pessimistic Locking) |
| GET  | /api/reservations/by-guest/:code | Lookup by guest code |
| GET  | /api/reservations/:code | Reservation detail + rooms + status history |
| POST | /api/reservations/:id/checkin | Check-in (payment modal) |
| POST | /api/reservations/:id/checkout | Check-out |
| POST | /api/reservations/:id/cancel | Cancel reservation |
| POST | /api/reservations/:id/transfer | Room transfer via sp_TransferRoom (Pessimistic Locking) |
| GET  | /api/reservations/:id/guests | List additional guests for reservation |
| POST | /api/reservations/:id/guests | Add additional guest (name, age category, document) |
| DELETE | /api/reservations/:id/guests/:guestId | Remove additional guest (primary protected) |

### Payments
| Method | Endpoint | Description |
|---|---|---|
| GET  | /api/payments | Payment history (filters: hotel_id, date, type, method, status) |
| POST | /api/payments | Create payment record |
| POST | /api/vnpay/create-payment | Initiate VNPay transaction |
| GET  | /api/vnpay/return | VNPay return callback handler |

### Services (Incidental / In-house)
| Method | Endpoint | Description |
|---|---|---|
| GET  | /api/services | List service catalog (filter: hotel_id, category) |
| POST | /api/services/order | Guest places service order |
| GET  | /api/services/orders | List service orders (filter: hotel_id, reservation_id, status) |
| PUT  | /api/services/orders/:id/status | Update order status (CONFIRM/DELIVER/CANCEL) |
| POST | /api/services/orders/:id/pay | Charge guest for delivered service order |

### Housekeeping
| Method | Endpoint | Description |
|---|---|---|
| GET  | /api/housekeeping | List tasks (filter: hotel_id, status) |
| POST | /api/housekeeping | Create task |
| PUT  | /api/housekeeping/:id/status | Update status → syncs Room.housekeeping_status |

### Maintenance
| Method | Endpoint | Description |
|---|---|---|
| GET  | /api/maintenance | List tickets (filter: hotel_id) |
| POST | /api/maintenance | Create ticket → sets Room.maintenance_status |
| PUT  | /api/maintenance/:id | Resolve/update ticket → restores Room status |

### Invoices
| Method | Endpoint | Description |
|---|---|---|
| GET  | /api/invoices | List invoices |
| POST | /api/invoices | Generate invoice from vw_ReservationTotal |
| GET  | /api/invoices/:id | Invoice detail with line items |
| POST | /api/invoices/:id/issue | Change status from DRAFT to ISSUED |

### Promotions
| Method | Endpoint | Description |
|---|---|---|
| GET  | /api/promotions | List active promotions |
| POST | /api/promotions | Create promotion |
| PUT  | /api/promotions/:id | Update promotion (ISNULL partial update) |
| DELETE | /api/promotions/:id | Soft-deactivate promotion |

### Guests
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/guests/:id | Guest profile, loyalty accounts, preferences |
| GET | /api/guests/:id/stays | Stay history via StayRecord → ReservationRoom → Reservation |

### Admin (Protected)
| Method | Endpoint | Description |
|---|---|---|
| GET  | /api/admin/accounts | List system users + guest accounts snapshot |
| GET  | /api/admin/rates | Room rate list (filter: hotel_id, date range, room_type_id) |
| PUT  | /api/admin/rates/:id | Update room rate — triggers Price Integrity Guard if >50% change |
| GET  | /api/admin/rates/alerts | Price Guard alert log (RateChangeLog) |
| GET  | /api/admin/availability/:id | — |
| PUT  | /api/admin/availability/:id | Optimistic Locking availability update |
| GET  | /api/admin/history | ReservationStatusHistory audit log (filter: hotel_id, status, dates) |
| GET  | /api/admin/channels | BookingChannel list + reservation/revenue stats |
| GET  | /api/admin/location-tree | Recursive CTE → nested JSON tree with hotel counts |
| GET  | /api/admin/reports/summary | KPI summary: reservation counts, top hotels, payment stats |
| GET  | /api/admin/reports/revenue | Revenue by hotel & room type (Window Functions: DENSE_RANK, cumulative, share %) |
| GET  | /api/admin/reports/revenue-by-brand | Revenue by HotelChain → Brand → Hotel (Window Functions) |

---

## Frontend Module Details

### AdminFrontDesk
**File:** `frontend/src/pages/admin/AdminFrontDesk.jsx`

- **Arrivals & Departures tab:**
  - Lists reservations grouped by status (CONFIRMED → check-in candidates, CHECKED_IN → check-out)
  - Actions: Check In, Check Out, Cancel, Transfer Room
  - Check-in opens a PaymentModal (Cash / Card / Bank Transfer)
  - Transfer Room opens a modal with available rooms
- **Service Orders tab:**
  - Lists hotel-wide service orders from GET /services/orders
  - Status badges: REQUESTED / CONFIRMED / DELIVERED / CANCELLED / ✅ Paid
  - Actions: Confirm, Mark Delivered, Charge Guest (opens payment modal for incidental charges)
  - Charge Guest → POST /services/orders/:id/pay → marks order as paid
- **AdditionalGuests component** imported, ready to embed in reservation detail panels

**Import note:** `AdditionalGuests` is imported but embedding in the reservation card UI
can be done by placing `<AdditionalGuests reservationId={...} />` in the detail section.

---

### AdditionalGuests
**File:** `frontend/src/pages/admin/AdditionalGuests.jsx`

- Reusable panel component: `<AdditionalGuests reservationId={id} />`
- Loads from GET /reservations/:id/guests
- Shows primary guest badge + list of additional guests with age icon
- Add Guest form: full_name (required), age_category (ADULT/CHILD/INFANT), 2-letter nationality, document type/no, special note
- Remove button for non-primary guests (with confirmation)

---

### AdminInventory
**File:** `frontend/src/pages/admin/AdminInventory.jsx`

- Room availability calendar view per hotel
- Update availability status with Optimistic Locking (expected_version required)
- Conflict detection on stale reads → user sees current version

---

### AdminHousekeeping
**File:** `frontend/src/pages/admin/AdminHousekeeping.jsx`

- Task lifecycle: OPEN → ASSIGNED → IN_PROGRESS → DONE → VERIFIED
- Create task: select room, task type, priority, scheduled time, note
- Staff assignment modal
- Summary stats bar (count per status)
- DONE/VERIFIED → auto-syncs Room.housekeeping_status (CLEAN/INSPECTED)

---

### AdminMaintenance
**File:** `frontend/src/pages/admin/AdminMaintenance.jsx`

- Create maintenance ticket → auto-sets Room.maintenance_status
- Resolve ticket with resolution note → restores room status
- Ticket lifecycle: OPEN → IN_PROGRESS → RESOLVED / CLOSED

---

### AdminInvoice
**File:** `frontend/src/pages/admin/AdminInvoice.jsx`

- Lookup reservation by code or ID
- Generate invoice (DRAFT) from reservation via vw_ReservationTotal
- View invoice detail modal: line items (rooms + services), payment history
- Workflow: DRAFT → ISSUED

---

### AdminRates
**File:** `frontend/src/pages/admin/AdminRates.jsx`

- Filter toolbar: hotel, date range (default: today → +14 days), room type
- Price Guard alerts panel (top 5 triggered alerts)
- Rate grid per room type: Date | Base Rate | Final Rate (click-to-edit) | Override badge | Source | Updated
- **Inline editing:** Click any Final Rate cell → input field → Enter to save, Esc to cancel
- **Price Guard:** If change > 50% → confirmation modal (orange warning) before saving
- PUT /admin/rates/:id with price_source = MANUAL_OVERRIDE

---

### AdminPromotions
**File:** `frontend/src/pages/admin/AdminPromotions.jsx`

- Filter by hotel, show active promotions list
- Create form: code, name, type (PERCENTAGE / FIXED_AMOUNT / FREE_NIGHT / etc.), discount value, currency, applies_to, booking dates, stay dates, member_only, min_nights, description, hotel scope
- Inline edit: name, discount, dates, member_only, min_nights
- Soft-delete: change status to INACTIVE

---

### AdminLocationChannels
**File:** `frontend/src/pages/admin/AdminLocationChannels.jsx`

Toggle between two views:

**Booking Channels view:**
- KPI cards: Total Revenue, Active Channels, Total Reservations, Active Reservations, Top Channel
- Table: channel name/code, type badge (OTA/DIRECT/GDS/AGENT), commission %, reservation counts, revenue, revenue share bar, status pill

**Location Tree view:**
- Recursive CTE tree via GET /admin/location-tree → nested JSON
- Collapsible nodes (auto-expand depth < 2)
- Icons per type: 🌍 CONTINENT · 🏳️ COUNTRY · 📍 REGION · 🏙️ CITY
- Hotel count badge on each node

---

### AdminPayments
**File:** `frontend/src/pages/admin/AdminPayments.jsx`

- Filter toolbar: hotel, date range, payment type, payment method, status
- KPI cards: Total Captured, Transaction Count, breakdown by type
- Data table: ID, date, guest, hotel, reservation code, type badge, method, amount, status pill, reference
- Loads on-demand (Search button, not auto-fetch)

---

### AdminTimeline
**File:** `frontend/src/pages/admin/AdminTimeline.jsx`

- Full audit trail of ReservationStatusHistory
- Filter toolbar: hotel, destination status, date range, reservation code
- Transition stats bar: pill per transition type (color-coded by destination status)
- Visual timeline grouped by calendar day
- Vertical spine with colored status dots
- Expandable cards: FROM → TO pills + timestamp + agent | reservation code + guest + hotel + room | reason quote | detail panel (resv ID, dates, email, agent role)

---

### AdminReports
**File:** `frontend/src/pages/admin/AdminReports.jsx`

- KPI strip: Total Reservations, Active Reservations, Hotels With Bookings, Payment Methods
- Two-column: Reservations by Status | Top Hotels by Revenue
- Payment Breakdown table (method, count, total)
- Revenue by Hotel & Room Type — Window Functions (DENSE_RANK, cumulative, share %)
- **Revenue by Brand & Chain** — HotelChain → Brand → Hotel hierarchy + Window Functions:
  - Rank in Brand: gold/silver/bronze circle badges
  - Cumulative Brand Revenue
  - Chain Share % progress bar
  - Brand Share %
- Export buttons: **Excel** (multi-sheet: Summary, Revenue Detail, Revenue by Brand) | **PDF** (autoTable)

---

### AccountPage (Guest)
**File:** `frontend/src/pages/AccountPage.jsx`

Tabs: Overview / Reservations / In-house Services / Loyalty / Profile

- **Overview:** 5 most recent stays from StayRecord → ReservationRoom → Reservation → Hotel
- **Reservations:** Guest reservation list with status badges
- **In-house Services (GuestServices):**
  - Detects active CHECKED_IN reservation
  - Loads ServiceCatalog for that hotel (grouped by category with icons)
  - Order form: select service, quantity, time preference, notes → POST /services/order
  - Order history for active stay
  - Currency matches hotel (IDR / JPY / SGD etc.)
- **Loyalty:** Tier badge (BLACK/PLATINUM/GOLD/SILVER), points balance, lifetime points, membership no., enrollment date
- **Profile:** Personal details (name, email, guest code, nationality, phone, VIP), stay preferences from GuestPreference

---

## Key Technical Patterns

### Locking Mechanisms
| Type | Where used | Pattern |
|---|---|---|
| **Pessimistic Locking** | sp_ReserveRoom, sp_TransferRoom | Transaction + UPDLOCK on RoomAvailability |
| **Optimistic Locking** | PUT /admin/availability/:id | WHERE version_no = @expectedVersion, 409 on conflict |
| **Price Guard** | PUT /admin/rates/:id | >50% change → RateChangeLog entry + alert flag |

### Window Functions Used (SQL)
| Function | Context |
|---|---|
| DENSE_RANK() OVER (PARTITION BY brand_id) | Revenue rank within brand |
| SUM(...) OVER (PARTITION BY hotel_id ORDER BY year, quarter) | Cumulative hotel revenue |
| SUM(...) OVER (PARTITION BY chain_id) | Total chain revenue for share % |
| ROW_NUMBER() | Deduplication in some views |

### Recursive CTE (SQL)
- `GET /api/locations/tree` — Location hierarchy (anchor: root nodes, recursive: children)
- `GET /api/admin/location-tree` — Same + hotel_count JOIN per node

### Stored Procedures
| Name | Purpose |
|---|---|
| sp_ReserveRoom | Create reservation with Pessimistic Locking |
| sp_TransferRoom | Room transfer with Pessimistic Locking |

---

## Toast / Flash Notification System

**FlashContext** (`frontend/src/context/FlashContext.jsx`):
- `setFlash({ tone, text, duration })` — add toast (auto-dismiss after duration ms)
- `dismiss(id)` — manually dismiss by ID
- `clearToasts()` — flush all pending toasts (used on logout)

**ToastContainer** rendered in:
- `GuestLayout` — covers all guest pages (/, /search, /hotel, /booking, /account, /reservation)
- `AuthLayout` — covers /login and /register
- `AdminPage` — standalone route, needs its own ToastContainer ✅ added
- `CashierPage` — standalone route, needs its own ToastContainer ✅ added

**Logout flow (fixed):**
1. `clearToasts()` — remove any stale login toast
2. `logout()` — clear session
3. `navigate('/')`
4. `setTimeout(() => setFlash(...), 80)` — show "Signed out" after navigation settles

---

## Database Schema Highlights

### Key Tables
| Table | Purpose |
|---|---|
| Location | Recursive hierarchy (CONTINENT → COUNTRY → REGION → CITY) |
| HotelChain → Brand → Hotel | 3-level business hierarchy |
| RoomRate | Nightly rates per room type, triggers RateChangeLog |
| RateChangeLog | Price Guard audit log (alert_triggered flag) |
| BookingChannel | OTA / DIRECT / GDS / AGENT / WALK_IN channels |
| Reservation | Core booking record with booking_channel_id FK |
| ReservationGuest | Primary + additional guests per reservation |
| ReservationStatusHistory | Full audit trail of status transitions |
| ReservationRoom | Room assignment per reservation |
| ReservationService | In-house service orders |
| ServiceCatalog | Hotel-specific service menu |
| Payment | Payment capture records |
| Invoice | Generated invoices (DRAFT → ISSUED) |
| HousekeepingTask | Cleaning task lifecycle |
| MaintenanceTicket | Maintenance issue lifecycle |
| GuestPreference | Guest stay preferences (type + value rows) |
| LoyaltyAccount | Loyalty tier, points, membership |
| SystemUser + Role + UserRole | RBAC for admin/cashier/front_desk roles |
| RoomAvailability | Per-night availability with version_no (Optimistic Lock) |

### Seed Data Summary
- 9 hotels across Asia (Bali, Tokyo, Singapore, Bangkok, etc.)
- Hotel currencies: IDR / JPY / SGD / THB / USD etc.
- 92 service catalog items × 9 hotels (English descriptions)
- 32+ rows in ReservationStatusHistory
- BookingChannel entries: OTA (Booking.com, Agoda, Expedia), DIRECT, GDS, AGENT, WALK_IN
- System accounts: admin / admin, cashier / cashier

### Credentials (Development)
| Username | Password | Role |
|---|---|---|
| admin | admin | ADMIN |
| cashier | cashier | CASHIER + FRONT_DESK |

---

## Known Gotchas

### 1. Emoji encoding — Use Node.js not PowerShell
**Problem:** PowerShell `Set-Content` writes string literals with emoji as `??` (broken bytes).  
**Fix:** Always use `node fix_script.js` with `fs.writeFileSync(file, content, 'utf8')` for any file containing emoji.  
**Affected areas:** ADMIN_TABS labels — all emoji labels must be maintained via Node scripts.

### 2. React Rules of Hooks — hooks must be before early returns
**Problem:** `useEffect` / `useState` inside component but after `if (!authSession) return ...` guards violates the Rules of Hooks. Vite/OXC throws PARSE_ERROR.  
**Fix:** Always declare all hooks at the top of the component, before any conditional returns.

### 3. AdminPage standalone route — ToastContainer required
**Problem:** `/admin` and `/cashier` are standalone routes (not wrapped in GuestLayout or AuthLayout), so they had no ToastContainer. Toast notifications were added to state but never rendered.  
**Fix:** Both AdminPage and CashierPage now import and render their own `<ToastContainer />`.

### 4. Vite/OXC parser — JSX must have single root
**Problem:** Returning sibling JSX elements (fragment missing) causes OXC parse error.  
**Fix:** Wrap multi-element returns in `<>...</>` or a single div.

### 5. Port conflict — two backend processes
**Problem:** Running `npm run dev` twice creates two nodemon processes on port 3000.  
**Fix:** Always kill the old terminal before starting a new backend instance.

### 6. Optimistic Lock conflict (409)
When calling `PUT /admin/availability/:id`, always send `expected_version` obtained from the latest GET. A 409 response includes `current_version` to help retry.

---

## Git History (Recent Sessions)

| Commit Subject | Features |
|---|---|
| feat: Additional Guests CRUD + Location Tree + Booking Channels | ReservationGuest API, AdditionalGuests panel, AdminLocationChannels, GET /admin/channels + /admin/location-tree |
| feat: Reservation Status Timeline (AdminTimeline + GET /admin/history) | Audit trail, visual timeline, transition stats, expandable cards |
| feat: Revenue by Brand section in AdminReports | GET /admin/reports/revenue-by-brand, rank badges, share bar, Excel sheet |
| feat: Rate Management UI (AdminRates + GET /admin/rates) | Click-to-edit rate grid, Price Guard modal, alerts panel |
| feat: Payment History module (AdminPayments + enhanced GET /payments) | Filter toolbar, KPI cards, payment table |
| fix: AdminPage blank screen — restore missing imports | AdminReports + ToastContainer import chain fix |
| fix: Toast notification timing | ToastContainer added to AdminPage + CashierPage, clearToasts on logout |
| fix: Restore emoji labels in all ADMIN_TABS | All 9 tab emojis rewritten via Node.js script |
| feat: Service Order Charging ("Charge Guest") | POST /services/orders/:id/pay, payment modal in FrontDesk |

---

## Remaining / Future Work

| Feature | Priority | Notes |
|---|---|---|
| AdditionalGuests embedded in FrontDesk card | Medium | Import done, just needs `<AdditionalGuests reservationId={...} />` placed in UI |
| Print Receipt for payment rows | Low | Button in AdminPayments table → browser print / PDF |
| Audit/AuditLog table surfacing | Low | AuditLog table exists in DB, not yet surfaced in UI |
| Guest loyalty points award on checkout | Low | Backend trigger/logic needed |
| Real-time WebSocket notifications | Low | For housekeeping/maintenance status updates |
| Dark mode toggle | Low | CSS variables already use token system |
| Multi-language (i18n) | Low | Currently English-only |
