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

- `npx vite build` thành công, 0 lỗi
- CSS output giảm từ 44.32 KB → 42.34 KB (bỏ duplicate/dead code tự nhiên)
- Tất cả 256 modules transformed thành công

---

## 21. Cashier Portal & RBAC (2026-04-20 → 2026-04-21)

### 21.1 AuthContext — thêm role helpers
File: `frontend/src/context/AuthContext.jsx` (dòng 31–37, 141–143)
- Thêm `systemRoles`, `hasSystemRole()`, `isAdminUser`, `isCashierUser`
- Expose toàn bộ qua context value để các component dùng

### 21.2 LoginPage — redirect đúng portal theo role
File: `frontend/src/pages/LoginPage.jsx` (toàn bộ, ~110 dòng)
- SYSTEM_USER có role ADMIN → `/admin`
- SYSTEM_USER có role CASHIER/FRONT_DESK → `/cashier`
- Đã đăng nhập (system) → hiển thị "switch account" screen thay vì redirect mù

### 21.3 CashierPage — portal lễ tân riêng
File: `frontend/src/pages/CashierPage.jsx` (file mới, 81 dòng)
- Chỉ hiển thị `AdminFrontDesk` module (check-in/out, arrivals, departures, transfer)
- Topbar riêng dạng card bo góc (class `.cashier-topbar`)
- Guard: non-system → `/login`, admin → `/admin`

### 21.4 App.jsx — thêm route `/cashier`
File: `frontend/src/App.jsx` (dòng 11, 34)
- Import `CashierPage`
- Thêm `<Route path="cashier" element={<CashierPage />} />`

### 21.5 AdminPage — thêm ADMIN role guard
File: `frontend/src/pages/AdminPage.jsx` (dòng 22, 35–40)
- Cashier cố vào `/admin` → redirect `/cashier`

### 21.6 SiteHeader — portal button theo role
File: `frontend/src/components/layout/SiteHeader.jsx` (dòng 7, 32–37)
- ADMIN → "Admin portal" → `/admin`
- CASHIER → "Front Desk portal" → `/cashier`

### 21.7 Payment modal khi check-in
File: `frontend/src/pages/admin/AdminFrontDesk.jsx` (dòng 1–108 thêm mới, state dòng ~119, confirmCheckin ~188)
- Component `PaymentModal` với 3 phương thức: Tiền mặt (CASH), Chuyển khoản/VNPay (BANK_TRANSFER), Thẻ (CREDIT_CARD)
- Click "Check in" → mở modal → chọn PT → Xác nhận → call API
- Close khi click overlay hoặc nút Huỷ

### 21.8 Admin.css — styles mới
File: `frontend/src/styles/Admin.css` (dòng 618–815)
- `.cashier-topbar` — card bo góc 22px, sticky, gradient teal tối
- `.cashier-signout` — màu Teal #143d42 (thương hiệu), chữ trắng ngà `#f7f1e7`
- `.pm-overlay`, `.pm-dialog`, `.pm-method-btn`, `.pm-method-btn--active` — payment modal

### 21.9 Database — tài khoản cashier
- File: `database/sql/13_add_cashier_account.sql` (migration)
- File: `database/reset_and_setup.js` (one-shot reset cho máy mới)
- Credentials: `cashier / cashier`, roles: `CASHIER + FRONT_DESK`

### 21.10 Docs
- `docs/API_Documentation.md` — 55 endpoints đầy đủ
- `docs/SYSTEM_SPECIFICATION.md` — đặc tả hệ thống tiếng Việt

### 21.11 AccountPage � In-house Services tab
File: `frontend/src/pages/AccountPage.jsx` (vi?t l?i to�n b?, ~320 d?ng)
- Th�m tab navigation: T?ng qu�t / �?t ph?ng / D?ch v? t?i ch? / Loyalty / H? s�
- GuestServices component (n?i b?):
  - Load reservation CHECKED_IN c?a guest (GET /reservations?guest_id=&status=CHECKED_IN)
  - Load ServiceCatalog c?a hotel �� (GET /services?hotel_id=)
  - Hi?n th? catalog nh�m theo category v?i icon
  - Form �?t d?ch v?: ch?n d?ch v? ? nh?p s? l�?ng, th?i gian, ghi ch� ? POST /services/order
  - Hi?n th? danh s�ch y�u c?u �? g?i cho reservation �� (GET /services/orders?reservation_id=)
- N?u kh�ng c� stay �ang active ? hi?n th? m�n h?nh tr?ng th�n thi?n
File: `frontend/src/styles/Account.css` (th�m cu?i, ~155 d?ng)
- Styles: .guest-svc-shell, .guest-svc-stay-banner, .guest-svc-grid, .guest-svc-card, .guest-svc-order-form
- .guest-sidebar-link.active � highlight sidebar tab �ang ch?n

### 21.12 Service catalog � English descriptions re-seed
File: `database/sql/14_seed_service_catalog.sql` (vi?t l?i v2)
- Xoa toan bo mo ta tieng Viet la-tinh, thay bang English hoan toan
- 92 dich vu x 9 hotels voi English description_short
- Reset lai bang DELETE FROM ReservationService + ServiceCatalog truoc khi seed

### 21.13 AccountPage � fix currency display
File: `frontend/src/pages/AccountPage.jsx` (dong 65, 86-91, 157, 194, 208, 228)
- Them state `hotelCurrency` lay tu `currency_code` cua ServiceCatalog (join Hotel)
- Fix: W Bali hien IDR, Tokyo hien JPY, Singapore hien SGD (khong con dung currency cua reservation)
- Stay banner total, order form price, estimated total, order history � tat ca dung `hotelCurrency`

---

## 22. Housekeeping, Invoice, Promotions & Guest Account Enhancements (2026-04-22)

### 22.1 AdminHousekeeping — quan ly nhiem vu don phong
File: `frontend/src/pages/admin/AdminHousekeeping.jsx` (file moi)
- Vong doi nhiem vu: OPEN -> ASSIGNED -> IN_PROGRESS -> DONE -> VERIFIED
- Tao nhiem vu moi: chon phong, loai, priority, lich hen, ghi chu
- Modal gan nhan vien (staff assignment)
- Thanh trang thai tong hop (stats bar)
- Khi DONE/VERIFIED -> tu dong cap nhat Room.housekeeping_status = CLEAN/INSPECTED

### 22.2 AdminInvoice — quan ly hoa don
File: `frontend/src/pages/admin/AdminInvoice.jsx` (file moi)
- Lookup reservation theo ma hoac reservation_id
- Tao invoice (DRAFT) tu reservation
- Modal xem chi tiet: line items (phong + dich vu), lich su thanh toan
- Workflow: DRAFT -> ISSUED

### 22.3 Backend — API moi
- `GET/POST /api/housekeeping`, `PUT /api/housekeeping/:id/status`
- `GET/POST /api/invoices`, `GET /api/invoices/:id`, `POST /api/invoices/:id/issue`
- `GET /api/guests/:id/stays` — lich su luu tru qua StayRecord -> ReservationRoom -> Reservation -> Hotel
  - Fix: bo cot `h.city` khong ton tai trong bang Hotel

### 22.4 AdminPromotions — CRUD khuyen mai
File: `frontend/src/pages/admin/AdminPromotions.jsx` (file moi)
- Filter theo hotel, hien danh sach promotion dang ACTIVE
- Form tao moi: code, name, type (PERCENTAGE/FIXED_AMOUNT/FREE_NIGHT...), discount, currency, applies_to, booking dates, stay dates, member_only, min_nights, description, hotel scope
- Inline edit: name, discount, dates, member_only, min_nights
- Soft-delete: chuyen status -> INACTIVE

Backend (`src/routes/promotions.js`):
- `POST /api/promotions` — tao moi
- `PUT /api/promotions/:id` — cap nhat (ISNULL partial update)
- `DELETE /api/promotions/:id` — soft deactivate

### 22.5 AdminPage — dang ky module moi
File: `frontend/src/pages/AdminPage.jsx`
- Import + tab: Housekeeping (dung 10), Invoice (dung 12), Promotions (dung 14)
- Tab Promotions them vao ADMIN_TABS voi icon 🎁

### 22.6 AccountPage — Medium Priority: Loyalty, Profile, Stay History
File: `frontend/src/pages/AccountPage.jsx`

**Loyalty tab (viet lai):**
- Fetch `GET /api/guests/:id` lay loyalty_accounts + preferences
- Hien thi tier badge dong (BLACK/PLATINUM/GOLD/SILVER voi mau rieng)
- Points balance, lifetime points, membership no., enrollment date, status, expiry

**Profile tab (viet lai):**
- Personal details: name, email, guest code, nationality, phone, VIP status
- Stay preferences: tat ca GuestPreference rows hien thi theo type+value

**Overview tab — Stay History:**
- Lazy-load tu `GET /api/guests/:id/stays` khi vao Overview
- Hien thi 5 stays gan nhat: hotel, room type, dates, total, status badge

**Fix quan trong — Rules of Hooks:**
- useEffect duoc goi SAU 2 early return (if !authSession, if !isGuestUser)
- Vi pham React Rules of Hooks -> Vite/OXC PARSE_ERROR
- Fix: chuyen tat ca useState + useEffect len truoc guard returns
- Them optional chaining `authSession?.user?.guest_id` tranh crash

**Fix JSX comment:**
- PowerShell Set-Content lam garble emoji trong comment header Loyalty tab
- Mat } dong -> parser bao loi PARSE_ERROR o dong ke tiep (===)
- Fix: them lai } dong comment

### 22.7 HotelPage — Policies & Amenity improvements
File: `frontend/src/pages/HotelPage.jsx`, `src/routes/hotels.js`

**Hotel Policies:**
- Query `HotelPolicy` (schema columnar: moi loai la 1 cot)
- Flatten thanh `[{type, text}]` array (cancellation, deposit, children, pets, smoking, extra bed, late checkout, early check-in, ID required, minimum age)
- Fix: ban dau dung `policies.recordset` thay vi `policies` -> luon tra ve []
- Hien thi grid cards voi type tag

**Amenity pills:**
- Badge "paid" (mau xam) va dot xanh "complimentary"
- Tooltip voi description

### 22.8 CSS additions
- `Admin.css`: promo-list, promo-card, type badge, member badge, code tag, inline edit form, deactivate button
- `Hotel.css`: amenity-paid, amenity-free-dot, policy-list, policy-card, policy-mandatory border
- `Account.css`: acct-stays-list, acct-stay-row, acct-loyalty-card, acct-loyalty-tier, acct-loyalty-stats, acct-profile-grid, acct-pref-row

### 22.9 Ket qua / Trang thai
- Tat ca commit da push len main branch
- Backend server: tranh xung dot port 3000 giua 2 nodemon process — nen dong terminal cu truoc khi mo terminal moi

| Priority | Feature | Trang thai |
|---|---|---|
| Medium | AccountPage Loyalty tab (real data) | DONE |
| Medium | AccountPage Profile tab (preferences) | DONE |
| Medium | AccountPage Stay History | DONE |
| Low | HotelPage Policies section | DONE |
| Low | HotelPage Amenity pill improvements | DONE |
| Low | AdminPromotions CRUD | DONE |
