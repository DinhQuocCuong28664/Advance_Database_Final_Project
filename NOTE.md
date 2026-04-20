# Frontend Current State Note

This file records what the frontend currently does after the reset.

It is meant to help review the current UI before rebuilding the next modules.

## 1. Current route map

- `/`
  - Full homepage with Hero Search, Hot Destinations, Featured Hotels, Promotions, Trust Strip
- `/search`
  - Search results page with sidebar filters and hotel cards
- `/hotel/:id`
  - Hotel detail page with rooms, amenities, stay summary
- `/booking/:hotelId/:roomId`
  - Checkout-style booking flow (3-step)
- `/login`
  - Shared login form for guest and admin
- `/register`
  - Guest registration form (Country code now uses flag dropdown)
- `/account`
  - Guest account hub
- `/reservation`
  - Reservation self-service page (lookup + my bookings) **[BUILT]**
- `/admin`
  - Admin dashboard foundation

## 2. Public shell

### Header
- Brand: `LuxeReserve`
- Brand link returns to `/`
- If not logged in:
  - `Sign in`
  - `Register`
- If logged in as guest:
  - guest name and loyalty tier badge
  - `My account`
  - `Sign out`
- If logged in as admin:
  - user name badge
  - `Admin portal`
  - `Sign out`

### Footer
- Booking-style footer structure
- Popular destinations section
- Support / Discover / Terms and settings / Partners / About columns
- Country and currency pills
- Footer is presentation-only for now

## 3. Home page

Current file:
- [frontend/src/pages/DashboardPage.jsx](C:\Users\cbzer\Downloads\HCSDLNC\frontend\src\pages\DashboardPage.jsx)

What it does now:
- **Hero section** with full Search Bar (Destination + Check-in / Check-out + Guests)
  - Destination autocomplete from `GET /api/locations` (filter CITY/DISTRICT level)
  - Uses `location_name` as option value
  - Submits to `/search` with query params
- **Hot Destinations** grid: destination cards with Unsplash photos, grouped from location_name
- **Featured Hotels** grid: 4 hotels from `GET /api/hotels` (`res.data`)
  - Uses `h.city_name` and `h.location_detail?.country` for location display
  - Uses `resolveHotelImage(h)` with onError fallback
- **Current Promotions** from `GET /api/promotions` (`res.data`)
  - Deduplicates by `promotion_id` to avoid React key warnings
  - Uses correct fields: `promotion_name`, `promotion_type`, `booking_end_date`
- **Trust Strip**: 4 brand value items

What it does not do yet:
- no real-time destination search autocomplete (uses basic HTML datalist)
- no personalized offers for logged-in guests on homepage
- no dynamic promo images

## 4. Login

Current file:
- [frontend/src/pages/LoginPage.jsx](C:\Users\cbzer\Downloads\HCSDLNC\frontend\src\pages\LoginPage.jsx)

What works:
- Uses a separate auth layout instead of the public header/footer shell
- One shared login form for both guest and admin
- Input accepts:
  - guest email
  - guest code
  - admin username
- Calls backend:
  - `POST /api/auth/login`
- Redirect behavior:
  - guest → `/` (home — NOT `/account`)
  - admin → `/admin`
- If already logged in:
  - guest stays away from login and is redirected to `/`
  - admin is redirected to `/admin`
- Brand click behavior:
  - clicking `LuxeReserve` on auth pages returns to `/`

What is not added yet:
- forgot password
- OAuth / Google / Facebook / Apple
- account recovery

## 5. Register

Current file:
- [frontend/src/pages/RegisterPage.jsx](C:\Users\cbzer\Downloads\HCSDLNC\frontend\src\pages\RegisterPage.jsx)

What works:
- Guest registration form
- Register is now a 2-step flow:
  - create account
  - verify email by OTP
- Fields:
  - first name
  - last name
  - login email
  - password
  - phone country code
  - phone number
- Calls backend:
  - `POST /api/auth/guest/register`
  - `POST /api/auth/guest/verify-email`
  - `POST /api/auth/guest/resend-verification`
- Success flow:
  - account is created in pending verification state
  - OTP is sent by email
  - user enters OTP
  - after verify, account becomes active
  - user is signed in
  - redirect to `/account`

What is not added yet:
- form validation polish
- password strength UI
- forgot password

### Register verification behavior

Current behavior:
- new guest account does not log in immediately after register
- backend sends a 6-digit OTP by email
- login before verification is blocked
- after successful OTP verification:
  - `email_verified_at` is set
  - guest account becomes `ACTIVE`
  - frontend receives auth token and session

Mail-related backend pieces now added:
- [src/services/mail.js](C:\Users\cbzer\Downloads\HCSDLNC\src\services\mail.js)
- [database/sql/11_email_verification.sql](C:\Users\cbzer\Downloads\HCSDLNC\database\sql\11_email_verification.sql)

## 6. Guest account page

Current file:
- [frontend/src/pages/AccountPage.jsx](C:\Users\cbzer\Downloads\HCSDLNC\frontend\src\pages\AccountPage.jsx)

What works now:
- Only guest users can access it
- If not logged in:
  - redirect to `/login`
- If logged in as admin:
  - redirect to `/admin`
- Layout is fixed — no more narrow card / text wrapping issue
- `Sign out` is now shown once in the header only

Visible sections:
- left sidebar
  - avatar
  - full name
  - email
  - menu buttons:
    - `Account overview`
    - `Bookings and trips`
    - `Loyalty program`
    - `Rewards and wallet`
    - `Saved preferences`
    - `Support`
  - `Start booking` button
- account overview section
  - large title
  - summary copy
- stat cards
  - guest code
  - loyalty account count
  - portal status
- quick actions (single-column list, flex-row layout)
  - `Start a new booking` → `/search` (**NOT `/booking`**)
  - `Find a reservation` → `/reservation`
  - `Manage profile` → `/account`
- account details card
  - full name
  - email
  - guest code
  - account type
- loyalty section
  - linked loyalty accounts from backend
  - tier and points if present
- next modules section
  - future account modules shown as planned cards

CSS layout fixes applied:
- `guest-action-list`: changed from `repeat(2, 1fr)` grid to single-column flex-row cards
- `guest-feature-grid`: changed to `auto-fit minmax(220px, 1fr)`
- responsive breakpoint raised from 900px to 1100px
- sidebar narrowed from 288px to 260px

What is real vs placeholder:
- Real:
  - guest identity from auth session
  - guest code
  - email
  - loyalty accounts returned by backend
- Placeholder:
  - sidebar menu buttons do not switch real subpages yet
  - bookings/trips not implemented
  - rewards/wallet not implemented
  - saved preferences not implemented
  - support center not implemented

## 7. Admin page

Current file:
- [frontend/src/pages/AdminPage.jsx](C:\Users\cbzer\Downloads\HCSDLNC\frontend\src\pages\AdminPage.jsx)

What works now:
- Only system users can access it
- If not admin:
  - redirect to `/login`
- Shows:
  - admin hero
  - admin summary cards
  - active inventory module
  - admin module map
- Has `Sign out`

### Admin inventory module

This is the first admin module currently wired to real backend data.

What works:
- hotel dropdown loads hotel list
- date range inputs for inventory range
- `Load inventory` button
- inventory summary cards
- sellable room list
- day-level availability records per room
- status dropdown per record
- `Save` button per availability record
- optimistic locking update flow

Summary cards currently shown:
- `Selected hotel`
- `Sellable rooms loaded`
- `Open rate alerts`

Inventory record details shown:
- room number
- room type
- floor
- room category
- max adults
- min nightly rate
- per-day availability record
- current status
- version number

Status options currently supported in UI:
- `OPEN`
- `HELD`
- `BLOCKED`
- `BOOKED`

Backend APIs currently used by admin inventory:
- `GET /api/hotels`
- `GET /api/rooms/availability?hotel_id&checkin&checkout`
- `PUT /api/admin/availability/:id`
- `GET /api/admin/rates/alerts`

Important business note:
- current admin inventory page is a `sellable inventory board`
- it is not yet a full PMS inventory matrix for all rooms
- because current room list comes from `/api/rooms/availability`
- that API only returns rooms that are currently sellable and have valid rate data in the selected range

What this means in practice:
- rooms without valid rates in the selected date range do not appear
- rooms already filtered out by booking-side availability rules may not appear
- the board is useful now for controlled inventory edits on returned records
- but it is not yet the final full-inventory admin view

Optimistic locking behavior now visible in UI:
- each day-level availability record shows `Version X`
- this comes from `version_no` in `RoomAvailability`
- frontend sends `expected_version` on save
- backend rejects stale updates with `409` conflict if another update already changed the record

Current admin modules shown in UI:
- Inventory
- Front desk
- Reservations
- Operations

What is still placeholder:
- Front desk is not yet implemented
- Reservations is not yet implemented
- Operations is not yet implemented
- Admin module cards are roadmap markers except for Inventory

### Admin account management

Admin page now also has a real account-management section.

What works now:
- shows `System users`
- shows `Guest login accounts`
- each account row now has:
  - status dropdown
  - save button

Supported statuses:
- `ACTIVE`
- `LOCKED`
- `DISABLED`

Backend APIs now used:
- `GET /api/admin/accounts`
- `PUT /api/admin/accounts/system/:id`
- `PUT /api/admin/accounts/guest/:id`

Current rule:
- admin cannot disable or lock the currently logged-in admin account

## 8. Search Results page

Current file:
- [frontend/src/pages/SearchPage.jsx](C:\Users\cbzer\Downloads\HCSDLNC\frontend\src\pages\SearchPage.jsx)

What works:
- Persistent search bar at the top (destination, check-in, check-out, guests)
- Sidebar filters: min stars, brand, min/max price per night
- Filters apply client-side in real-time using `useMemo` (derived state)
- Hotel cards showing name, brand, location, star rating, price/night (VND format)
- Search filters by `city_name` field (correct API field name)
- Click hotel card → `/hotel/:id`
- Loading / empty / error states
- `resolveHotelImage(h)` with `onError` fallback for broken CDN images
- Calls: `GET /api/hotels` → reads from `res.data`

## 8b. Hotel Detail page

Current file:
- [frontend/src/pages/HotelPage.jsx](C:\Users\cbzer\Downloads\HCSDLNC\frontend\src\pages\HotelPage.jsx)

What works:
- Hero image gallery with `resolveHotelImage` fallback
- Hotel header: brand, name, location (`city_name`, `country_name`), star rating, hotel type
- Stay summary strip showing check-in / check-out / nights / guests
- Amenities pills (array of objects from backend)
- Available rooms list with nightly rate (VND format), total cost, bed type, max adults, status
- "Select room" button per room → navigates to booking page
- Promotions sidebar from `GET /api/promotions`
  - Uses correct fields: `promotion_id`, `promotion_name`, `promotion_type`, `discount_value`
  - key uses `promotion_id ?? index` fallback
- Calls: `GET /api/hotels/:id` → `res.data`, `GET /api/rooms/availability` → `res.data`, `GET /api/promotions` → `res.data`

## 8c. Booking page (Checkout)

Current file:
- [frontend/src/pages/BookingPage.jsx](C:\Users\cbzer\Downloads\HCSDLNC\frontend\src\pages\BookingPage.jsx)

What works:
- 3-step checkout flow: **Details → Confirm → Done**
- Step 1: Guest details form (first name, last name, email, phone, special requests, payment method)
  - If logged in as guest: fields are pre-filled from auth session
  - Shows loyalty member badge when applicable
- Step 2: Review summary before submit
- Step 3: Confirmation page showing reservation code
- Summary sidebar showing room, dates, nights, price (VND format), total
- Calls:
  - `POST /api/reservations` — sends nested `guest_profile` object (correct schema)
  - `POST /api/payments` — sends `payment_type: 'FULL_PAYMENT'` (correct enum)
  - Amount uses `grand_total_amount` from reservation response (avoids float mismatch)

What is not present yet:
- Real payment gateway / card input
- Invoice generation from booking page
- Cancellation from booking page

## 9. Reservation page

Current file:
- [frontend/src/pages/ReservationPage.jsx](C:\Users\cbzer\Downloads\HCSDLNC\frontend\src\pages\ReservationPage.jsx)

Current state: **FULLY BUILT** ✅ (was placeholder before)

Features:
- **Lookup by code** (anyone, no login required)
  - Input reservation code e.g. `RES-20260418-2KU7Q9`
  - Calls `GET /api/reservations/:code`
  - Displays full reservation card on match
- **My bookings** (logged-in guests only)
  - Auto-loads from `GET /api/reservations/by-guest/:guestCode`
  - Lists all reservations with status badges
- **Reservation card** shows:
  - Reservation code
  - Hotel name, room type, room number
  - Status badge (Confirmed / Checked in / Checked out / Cancelled / No-show)
  - Check-in / Check-out dates, night count, total amount + currency
- **Cancel button**: shown only for CONFIRMED reservations
  - Calls `POST /api/reservations/:id/guest-cancel`
  - Optimistically updates status in UI

## 10. Image utility

Current file:
- [frontend/src/utils/hotelImages.js](C:\Users\cbzer\Downloads\HCSDLNC\frontend\src\utils\hotelImages.js)

What it does:
- `resolveHotelImage(hotel)` — returns Unsplash URL based on hotel type/city
- `imgError` — React onError handler that swaps broken image to fallback Unsplash URL
- Used in: DashboardPage, SearchPage, HotelPage

## 11. Auth session behavior

Current file:
- [frontend/src/context/AuthContext.jsx](C:\Users\cbzer\Downloads\HCSDLNC\frontend\src\context\AuthContext.jsx)

What works:
- Session stored in localStorage
- Session sync on reload:
  - `GET /api/auth/me`
- Login function
- Guest register function
- Guest email verification function
- Guest resend verification function
- Logout function
- Distinguishes:
  - `SYSTEM_USER`
  - `GUEST`
- Exposes guest loyalty accounts from auth payload

## 12. What is actually connected to backend right now

Connected:
- `/api/auth/login`
- `/api/auth/guest/register`
- `/api/auth/guest/verify-email`
- `/api/auth/guest/resend-verification`
- `/api/auth/me`
- `/api/admin/accounts`
- `/api/admin/accounts/system/:id`
- `/api/admin/accounts/guest/:id`
- `/api/locations` — hero search datalist (reads `res.data`, filters CITY/DISTRICT)
- `/api/hotels` — homepage featured section and search results (reads `res.data`)
- `/api/hotels/:id` — hotel detail page (reads `res.data`)
- `/api/rooms/availability` — hotel detail page room list (reads `res.data`)
- `/api/promotions` — homepage + hotel detail (reads `res.data`, deduplicates by promotion_id)
- `/api/reservations` (POST) — booking checkout
- `/api/reservations` (GET) — list with filters (NEW)
- `/api/reservations/by-guest/:guestCode` — reservation page My Bookings (NEW)
- `/api/reservations/:code` (GET) — reservation lookup
- `/api/reservations/:id/guest-cancel` (POST) — cancel from reservation page
- `/api/payments` (POST) — booking checkout

Not currently connected in active frontend pages:
- admin operational APIs (front desk, housekeeping, maintenance, invoices)

## 13. Backend changes (this session)

### src/routes/reservations.js — new endpoints added

```
GET /api/reservations
  Query params: guest_id, email, status, limit (default 20)
  Returns: list of reservations with hotel, room, guest info

GET /api/reservations/by-guest/:guestCode
  Returns: all reservations for a guest_code (e.g. G-DQC)
  IMPORTANT: must be defined BEFORE /:code route to avoid route conflict
```

### src/routes/promotions.js — duplicate row fix

- Added `GROUP BY` + `MAX()` to promotions query
- Root cause: `LEFT JOIN Hotel hb ON hb.brand_id = p.brand_id` produces N rows per promotion (one per hotel in the brand)
- Fix collapses them back into 1 row per promotion_id

## 14. Known API field names (reference)

| Endpoint | Response key | Notes |
|---|---|---|
| `/api/hotels` | `res.data` | `city_name`, `country_name`, `location_detail.country` |
| `/api/hotels/:id` | `res.data` | same fields |
| `/api/rooms/availability` | `res.data` | `room_type_name`, `nightly_rate` |
| `/api/promotions` | `res.data` | `promotion_id`, `promotion_name`, `promotion_type`, `booking_end_date` |
| `/api/locations` | `res.data` | `location_id`, `location_name`, `location_type` |
| `/api/reservations` (POST) | `res.data` | `reservation_code`, `grand_total_amount`, `total` |
| `/api/reservations/by-guest/:code` | `res.data` | array |

## 15. Current frontend status summary

The frontend currently has:
- working public shell (Header + Footer)
- working auth flow (login, register with OTP)
- working guest email verification flow
- working guest account foundation (layout fixed)
- working admin dashboard foundation
- working admin account-management status update flow
- **working homepage** with hero search, destinations, featured hotels, promotions ✅
- **working search results page** with sidebar filters ✅
- **working hotel detail page** with room selection ✅
- **working booking checkout flow** (3-step: details → confirm → done) ✅
- **working reservation page** (lookup + my bookings + cancel) ✅
- **country code dropdown** with flag images in Register page ✅
- **VND currency format** consistent across all pages ✅

The frontend does not currently have:
- full admin operations (Front Desk, Reservations, Operations modules)
- real payment gateway integration
- personalized offers for logged-in guests

## 16. Suggested test checklist

### Public shell
- [ ] Header appears correctly
- [ ] Footer appears correctly
- [ ] Home page loads

### Login
- [ ] Guest can log in
- [ ] Admin can log in
- [ ] Guest redirects to `/` (home)
- [ ] Admin redirects to `/admin`

### Register
- [ ] New guest can register
- [ ] OTP email is sent after register
- [ ] Login is blocked before OTP verify
- [ ] OTP verify activates the account
- [ ] After verify, redirect goes to `/account`

### Guest account
- [ ] Guest page loads without layout break
- [ ] Guest info is shown correctly
- [ ] Loyalty section renders correctly
- [ ] `Start a new booking` goes to `/search` (not `/booking`)
- [ ] `Find a reservation` goes to `/reservation`
- [ ] No duplicate `Sign out`

### Booking flow
- [ ] Search → hotel → select room → booking form
- [ ] Guest details pre-filled when logged in
- [ ] Reservation created (check code in response)
- [ ] Payment succeeds (no 500 error)
- [ ] Confirmation screen shows reservation code

### Reservation page
- [ ] Lookup by code works (e.g. `RES-20260418-2KU7Q9`)
- [ ] My bookings loads automatically when logged in
- [ ] Cancel button appears for CONFIRMED reservations only
- [ ] Cancel updates status in UI

### Admin
- [ ] Admin page loads
- [ ] Non-admin cannot access `/admin`
- [ ] Admin can see system users and guest accounts
- [ ] Admin can update account status

## 17. Current demo accounts

The current reset script keeps these demo logins active:

- `admin / admin`
- `dqc / dqc`
- `user / user`

Reference reset script:
- [database/sql/10_reset_accounts.sql](C:\Users\cbzer\Downloads\HCSDLNC\database\sql\10_reset_accounts.sql)

## 18. Recent reservations in DB (as of 2026-04-19)

| Code | Status | Check-in | Check-out | Total | Guest |
|---|---|---|---|---|---|
| RES-20260418-BB3BIT | CONFIRMED | 20/04 | 22/04 | 7,200,000 VND | John Doe |
| RES-20260418-2KU7Q9 | CONFIRMED | 18/04 | 20/04 | 7,200,000 VND | dqc dqc |
| RES-20260413-T0S19Q | CONFIRMED | 14/04 | 15/04 | 3,600,000 VND | dqc dqc |
| RES-20260413-EH1EZ9 | CONFIRMED | 14/04 | 15/04 | 3,600,000 VND | dqc dqc |
| RES-20260413-9QMIUK | CHECKED_OUT | 12/04 | 14/04 | 17,000 THB | New User |
| RES-20260401-001 | CONFIRMED | 05/04 | 08/04 | 14,850,000 VND | dqc dqc |

---

## 19. Session 2026-04-20 — Changes made

### 19.1 Deposit bắt buộc trong BookingPage

- `guarantee_type: 'DEPOSIT'` được gửi khi tạo reservation
- Deposit = **30%** tổng tiền (`DEPOSIT_RATE = 0.30`)
- Sidebar hiển thị: `Total stay`, `Deposit now (30%)`, `Balance at check-out`
- Step 1 (Details) và Step 2 (Confirm) đều có banner vàng thông báo deposit
- Nút confirm đổi thành `Pay deposit X VND`
- Done screen: hiển thị deposit đã trả + balance còn lại
- Mock payment ghi `payment_type: 'DEPOSIT'` vào DB
- File: `frontend/src/pages/BookingPage.jsx`

### 19.2 VNPay integration (code đã build, tạm comment out)

Đã tích hợp đầy đủ nhưng **chưa bật** (dùng mock flow):

| File | Nội dung |
|---|---|
| `src/services/vnpay.js` | Tạo URL, ký HMAC-SHA512, verify return |
| `src/routes/vnpay.js` | 3 endpoints: create-payment, return, ipn |
| `src/app.js` | Mount `GET/POST /api/vnpay/*` |
| `frontend/src/pages/VnpayReturnPage.jsx` | Trang kết quả sau khi VNPay redirect về |
| `frontend/src/App.jsx` | Route `/booking/vnpay-return` |
| `.env` | `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_URL`, `VNPAY_RETURN_URL`, `VNPAY_IPN_URL` |

**Để bật VNPay:** uncomment block `// ── TODO: Bật VNPay` trong `BookingPage.jsx` và xoá đoạn mock bên dưới.

Credentials sandbox hiện tại:
```
VNPAY_TMN_CODE=3ZEQZZ0D
VNPAY_HASH_SECRET=MINP9SMER1Y06GDU2U57SJ7GB505OQ82
```

### 19.3 Guests input — fix leading zeros + UX stepper

**Vấn đề cũ:** `type="number"` + `Number(e.target.value)` → gõ `2` khi đang là `1` → thành `12` hoặc `112`.

**Fix:** Custom stepper `−` / `[editable number]` / `+`:
- `−` và `+` click tăng giảm từng 1
- Số ở giữa là `<input type="text" inputMode="numeric">` có thể gõ thẳng  
- `onFocus`: select all → gõ thay thế hoàn toàn (không append)
- `onBlur`: fallback về `1` nếu trống
- Clamp giá trị trong khoảng `[1, 10]`
- Files: `DashboardPage.jsx`, `SearchPage.jsx`, `App.css`

### 19.4 Duplicate Sign in button đã xóa

- `ReservationPage.jsx`: Đã xóa nút Sign in inline trong `resv-header` (giữ lại nút ở SiteHeader toàn cục)

---

## 20. Session 20 – Admin Reports & Codebase Refactoring (2026-04-20)

### 20.1 Admin Reports & Analytics

**Backend:** Thêm endpoint `GET /api/admin/reports/summary` trong `src/routes/admin.js`:
- 4 queries chạy song song (Promise.all): overview KPIs, by_status, top_hotels, payment_stats
- File: `src/routes/admin.js`

**Frontend – Reports section trong Admin Dashboard:**

| Feature | Chi tiết |
|---|---|
| 4 KPI cards | Total / Active Reservations, Hotels with Bookings, Payment Methods |
| Reservations by Status | Bảng với color-coded badges (CONFIRMED, CANCELLED...) |
| Top 5 Hotels by Revenue | Bảng xếp hạng theo doanh thu |
| Payment Breakdown | Theo phương thức thanh toán + tổng tiền |
| Revenue Detail table | Dùng Window Functions — hotel × room type × quarter |
| ⬇ Export Excel | `.xlsx` với 4 sheets: Summary, Top Hotels, Payments, Revenue Detail |
| ⬇ Export PDF | Landscape PDF với tất cả tables, auto page break |

**Thư viện sử dụng:** `xlsx`, `jspdf`, `jspdf-autotable`

### 20.2 Refactor AdminPage.jsx → Sub-components

**Trước:** `AdminPage.jsx` = **855 dòng** (34KB) chứa tất cả logic + JSX.

**Sau:** Tách thành 4 files:

| File | Dòng | Vai trò |
|---|---|---|
| `pages/AdminPage.jsx` | ~145 | Shell: load data, compose sub-components |
| `pages/admin/AdminAccounts.jsx` | ~130 | Account management (system users + guests) |
| `pages/admin/AdminInventory.jsx` | ~210 | Inventory control + optimistic locking |
| `pages/admin/AdminReports.jsx` | ~220 | Reports + Export Excel/PDF |

Mỗi sub-component tự quản lý state riêng, nhận data qua props.

### 20.3 Refactor App.css → Per-page CSS files

**Trước:** `App.css` = **2087 dòng** (50KB) chứa CSS cho toàn bộ app.

**Sau:** Tách thành 6 files trong `src/styles/`:

| File | Dòng | Nội dung |
|---|---|---|
| `styles/Home.css` | 250 | Homepage hero, destinations, featured, promos, trust, search form, stepper |
| `styles/Search.css` | 68 | Search page layout, cards, sidebar, filters |
| `styles/Hotel.css` | 66 | Hotel detail page, gallery, rooms, amenities |
| `styles/Booking.css` | 109 | Booking flow, stepper, deposit notice |
| `styles/Account.css` | 240 | Guest dashboard, account page, reservation page |
| `styles/Admin.css` | 370 | Admin dashboard, inventory, reports, status pills |
| `App.css` (giữ lại) | 453 | **Chỉ shared:** shell header/footer, auth forms, buttons, inputs, toast, responsive, VNPay, table globals |

**Tổng giảm App.css:** 2087 → 453 dòng (**−78%**)

Mỗi page chỉ import đúng CSS file nó cần:
- `DashboardPage.jsx` → `import '../styles/Home.css'`
- `SearchPage.jsx` → `import '../styles/Search.css'`
- `HotelPage.jsx` → `import '../styles/Hotel.css'`
- `BookingPage.jsx` → `import '../styles/Booking.css'`
- `AccountPage.jsx` → `import '../styles/Account.css'`
- `ReservationPage.jsx` → `import '../styles/Account.css'`
- `AdminPage.jsx` → `import '../styles/Admin.css'`

### 20.4 Build verification

- `npx vite build` thành công, 0 lỗi
- CSS output giảm từ 44.32 KB → 42.34 KB (bỏ duplicate/dead code tự nhiên)
- Tất cả 256 modules transformed thành công
