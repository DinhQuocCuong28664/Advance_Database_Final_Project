# LuxeReserve — Data Source Classification

> **Polyglot Persistence Architecture:** SQL Server (ACID transactions, operational data) + MongoDB Atlas (flexible rich content, catalogs)

---

## Legend

| Icon | Data Source | Description |
|------|-------------|-------------|
| 🗄️ | **SQL Server** | ACID transactions, relational operational data, stored procedures, triggers, views |
| 🍃 | **MongoDB Atlas** | Flexible documents, rich content, images, descriptions, catalogs |
| 🔀 | **Hybrid (Both)** | SQL Server for operational data + MongoDB for rich content, merged at API layer |

---

## 1. Auth Routes (`/api/v1/auth`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `POST /auth/login` | Unified login (auto-detect system user vs guest) | 🗄️ SQL | `SystemUser`, `GuestAuth`, `Guest`, `UserRole`, `Role`, `LoyaltyAccount` |
| `POST /auth/admin/login` | System user login | 🗄️ SQL | `SystemUser` |
| `POST /auth/guest/register` | Create guest account + login credentials | 🗄️ SQL | `Guest`, `GuestAuth`, `EmailVerificationOtp` |
| `POST /auth/guest/login` | Guest login | 🗄️ SQL | `GuestAuth`, `Guest` |
| `POST /auth/guest/verify-email` | Verify email with OTP | 🗄️ SQL | `GuestAuth`, `EmailVerificationOtp` |
| `POST /auth/guest/resend-verification` | Resend verification OTP | 🗄️ SQL | `GuestAuth`, `EmailVerificationOtp` |
| `POST /auth/guest/forgot-password` | Send password reset OTP | 🗄️ SQL | `GuestAuth`, `EmailVerificationOtp` |
| `POST /auth/guest/reset-password` | Reset password with OTP | 🗄️ SQL | `GuestAuth`, `EmailVerificationOtp` |
| `POST /auth/guest/booking-email-status` | Check if email exists for booking | 🗄️ SQL | `GuestAuth` |
| `POST /auth/guest/booking-email-otp` | Send booking access OTP | 🗄️ SQL | `GuestAuth`, `EmailVerificationOtp` |
| `POST /auth/guest/change-password` | Change password (authenticated) | 🗄️ SQL | `GuestAuth`, `SystemUser` |
| `GET /auth/me` | Resolve current authenticated user | 🗄️ SQL | `SystemUser`, `Guest`, `GuestAuth`, `LoyaltyAccount`, `UserRole`, `Role` |

---

## 2. Hotel Routes (`/api/v1/hotels`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `GET /hotels` | List all hotels (paginated) | 🔀 **Hybrid** | 🗄️ `Hotel`, `Brand`, `HotelChain`, `Location` (Recursive CTE) + 🍃 `Hotel_Catalog` |
| `GET /hotels/:id` | Hotel detail with room types, amenities, policies | 🔀 **Hybrid** | 🗄️ `Hotel`, `Brand`, `HotelChain`, `Location` (Recursive CTE), `RoomType`, `RoomRate`, `RoomFeature`, `HotelAmenity`, `HotelPolicy` + 🍃 `Hotel_Catalog`, `room_type_catalog`, `amenity_master` |
| `GET /hotels/:id/reviews` | Public hotel reviews | 🗄️ SQL | `HotelReview`, `Guest`, `Reservation` |
| `POST /hotels/:id/reviews` | Submit review after completed stay | 🗄️ SQL | `HotelReview`, `Reservation`, `Guest` |
| `GET /hotels/:id/features` | List room features (admin) | 🗄️ SQL | `RoomFeature`, `RoomType` |
| `POST /hotels/:id/features` | Add room feature (admin) | 🗄️ SQL | `RoomFeature`, `RoomType` |
| `DELETE /hotels/:id/features/:fid` | Remove room feature (admin) | 🗄️ SQL | `RoomFeature`, `RoomType` |

---

## 3. Room Routes (`/api/v1/rooms`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `GET /rooms?hotel_id=` | List rooms for a hotel | 🗄️ SQL | `Room`, `RoomType` |
| `GET /rooms/availability?hotel_id=&checkin=&checkout=` | Check room availability by date range | 🗄️ SQL | `Room`, `RoomType`, `Hotel`, `RoomRate`, `RoomAvailability` |

---

## 4. Reservation Routes (`/api/v1/reservations`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `POST /reservations` | Create reservation with Pessimistic Locking | 🗄️ SQL | `sp_ReserveRoom` (stored proc), `Reservation`, `ReservationRoom`, `ReservationStatusHistory`, `Guest`, `GuestAuth`, `EmailVerificationOtp`, `LoyaltyRedemption`, `Promotion`, `Hotel`, `Room`, `RoomAvailability` |
| `GET /reservations` | List reservations (filterable) | 🗄️ SQL | `Reservation`, `Guest`, `Hotel`, `ReservationRoom`, `RoomType`, `Room` |
| `GET /reservations/by-guest/:guestCode` | List by guest code | 🗄️ SQL | `Reservation`, `Guest`, `Hotel`, `ReservationRoom`, `RoomType`, `Room` |
| `GET /reservations/:code` | Get reservation detail | 🗄️ SQL | `vw_ReservationTotal` (view), `Guest`, `Hotel`, `ReservationRoom`, `RoomType`, `Room`, `ReservationStatusHistory`, `SystemUser` |
| `POST /reservations/:id/checkin` | Check-in (stored procedure) | 🗄️ SQL | `sp_CheckIn` (stored proc) |
| `POST /reservations/:id/checkout` | Check-out (stored procedure) | 🗄️ SQL | `sp_CheckOut` (stored proc) |
| `POST /reservations/:id/guest-cancel` | Guest cancellation (forfeit deposit) | 🗄️ SQL | `sp_GuestCancel` (stored proc) |
| `POST /reservations/:id/hotel-cancel` | Hotel cancellation (full refund) | 🗄️ SQL | `sp_HotelCancel` (stored proc) |
| `POST /reservations/:id/transfer` | Room transfer with Pessimistic Locking | 🗄️ SQL | `sp_TransferRoom` (stored proc), `Reservation`, `ReservationRoom`, `Room`, `RoomAvailability` |

---

## 5. Payment Routes (`/api/v1/payments`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `POST /payments` | Create payment with balance validation | 🗄️ SQL | `Payment`, `Reservation` |
| `GET /payments` | List payments (filterable, admin) | 🗄️ SQL | `Payment`, `Reservation`, `Guest`, `ReservationRoom`, `Room`, `Hotel` |

---

## 6. Service Routes (`/api/v1/services`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `GET /services?hotel_id=` | List available services | 🗄️ SQL | `ServiceCatalog`, `Hotel` |
| `POST /services/order` | Order a service (incidental charge) | 🗄️ SQL | `ReservationService`, `ServiceCatalog`, `Reservation`, `ReservationRoom` |
| `GET /services/orders` | List service orders (guest or staff view) | 🗄️ SQL | `ReservationService`, `ServiceCatalog`, `Reservation`, `Guest`, `ReservationRoom`, `Room`, `Hotel`, `Payment` |
| `PUT /services/orders/:id/status` | Update service order status | 🗄️ SQL | `ReservationService`, `Reservation` |
| `POST /services/orders/:id/pay` | Pay for incidental service | 🗄️ SQL | `Payment`, `ReservationService`, `ServiceCatalog`, `Reservation` |

---

## 7. Guest Routes (`/api/v1/guests`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `GET /guests` | List all guests (admin) | 🗄️ SQL | `Guest` |
| `GET /guests/:id` | Full guest profile | 🗄️ SQL | `Guest`, `GuestPreference`, `LoyaltyAccount`, `HotelChain`, `GuestAddress` |
| `POST /guests` | Create guest (admin) | 🗄️ SQL | `Guest` |
| `PUT /guests/:id` | Update own profile (name + phone) | 🗄️ SQL | `Guest` |
| `GET /guests/:id/stays` | Stay history | 🗄️ SQL | `StayRecord`, `ReservationRoom`, `Reservation`, `Hotel`, `Room`, `RoomType` |
| `GET /guests/:id/reviews` | Guest review history | 🗄️ SQL | `HotelReview`, `Hotel`, `Reservation` |
| `GET /guests/:id/loyalty-rewards` | Available loyalty rewards | 🗄️ SQL | `LoyaltyAccount`, `Promotion`, `Hotel`, `Brand`, `HotelChain`, `LoyaltyRedemption` |
| `GET /guests/:id/loyalty-redemptions` | Loyalty redemption history | 🗄️ SQL | `LoyaltyRedemption`, `Promotion`, `Reservation` |
| `POST /guests/:id/loyalty-rewards/:promotionId/redeem` | Redeem loyalty points for voucher | 🗄️ SQL | `LoyaltyAccount` (UPDLOCK), `LoyaltyRedemption`, `Promotion`, `Hotel`, `Brand`, `HotelChain` |

---

## 8. Admin Routes (`/api/v1/admin`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `PUT /admin/rates/:id` | Update room rate (triggers Price Guard) | 🗄️ SQL | `RoomRate`, `RateChangeLog` (trigger) |
| `GET /admin/rates/alerts` | View Price Guard alerts | 🗄️ SQL | `RateChangeLog`, `RoomRate`, `RoomType`, `Hotel`, `SystemUser` |
| `GET /admin/rates` | List room rates (filterable) | 🗄️ SQL | `RoomRate`, `RoomType`, `Hotel`, `RatePlan`, `RateChangeLog` |
| `GET /admin/reports/summary` | Dashboard KPIs | 🗄️ SQL | `Reservation`, `ReservationRoom`, `Hotel`, `Payment` |
| `GET /admin/reports/revenue` | Revenue analytics (Window Functions) | 🗄️ SQL | `Reservation`, `ReservationRoom`, `Hotel`, `RoomType` |
| `GET /admin/reports/revenue-by-brand` | Revenue by Brand & Chain (Window Functions) | 🗄️ SQL | `Reservation`, `ReservationRoom`, `Hotel`, `Brand`, `HotelChain`, `RoomType` |
| `PUT /admin/availability/:id` | Update availability (Optimistic Locking) | 🗄️ SQL | `RoomAvailability` (version_no) |
| `GET /admin/accounts` | Account management snapshot | 🗄️ SQL | `SystemUser`, `UserRole`, `Role`, `GuestAuth`, `Guest`, `LoyaltyAccount` |
| `POST /admin/accounts/system` | Create system user + assign role | 🗄️ SQL | `SystemUser`, `UserRole`, `Role` |
| `PUT /admin/accounts/system/:id` | Update system user status | 🗄️ SQL | `SystemUser` |
| `PUT /admin/accounts/system/:id/profile` | Update system user profile | 🗄️ SQL | `SystemUser`, `UserRole`, `Role` (MERGE) |
| `PUT /admin/accounts/guest/:id` | Update guest account status | 🗄️ SQL | `GuestAuth` |
| `GET /admin/history` | Reservation status history (audit) | 🗄️ SQL | `ReservationStatusHistory`, `Reservation`, `Guest`, `SystemUser`, `UserRole`, `Role`, `ReservationRoom`, `Room`, `Hotel` |
| `GET /admin/operations-log` | Hotel reservation lifecycle log | 🗄️ SQL | `Reservation`, `Hotel`, `Guest`, `ReservationRoom`, `Room`, `ReservationStatusHistory`, `SystemUser` |
| `GET /admin/channels` | Booking channel stats | 🗄️ SQL | `BookingChannel`, `Reservation`, `ReservationRoom` |
| `GET /admin/location-tree` | Location hierarchy with hotel counts | 🗄️ SQL | `Location` (Recursive CTE), `Hotel` |
| `GET /admin/rate-plans` | List rate plans | 🗄️ SQL | `RatePlan`, `Hotel` |

---

## 9. Promotion Routes (`/api/v1/promotions`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `GET /promotions` | List active promotions (filterable) | 🗄️ SQL | `Promotion`, `Hotel`, `Brand`, `HotelChain`, `LoyaltyAccount` |
| `POST /promotions` | Create promotion (admin) | 🗄️ SQL | `Promotion` |
| `PUT /promotions/:id` | Update promotion (admin) | 🗄️ SQL | `Promotion` |
| `DELETE /promotions/:id` | Deactivate promotion (admin) | 🗄️ SQL | `Promotion` |

---

## 10. Location Routes (`/api/v1/locations`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `GET /locations` | Flat list of locations | 🗄️ SQL | `Location` |
| `GET /locations/tree` | Location hierarchy tree (Recursive CTE) | 🗄️ SQL | `Location` (Recursive CTE) |

---

## 11. Housekeeping Routes (`/api/v1/housekeeping`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `GET /housekeeping/staff` | List HK staff | 🗄️ SQL | `SystemUser`, `UserRole`, `Role` |
| `GET /housekeeping` | List housekeeping tasks | 🗄️ SQL | `HousekeepingTask`, `Room`, `RoomType`, `SystemUser` |
| `POST /housekeeping` | Create housekeeping task | 🗄️ SQL | `HousekeepingTask` |
| `PUT /housekeeping/:id/assign` | Assign staff to task | 🗄️ SQL | `HousekeepingTask` |
| `PUT /housekeeping/:id/status` | Update task status + sync Room | 🗄️ SQL | `HousekeepingTask`, `Room` (transaction) |

---

## 12. Maintenance Routes (`/api/v1/maintenance`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `GET /maintenance` | List maintenance tickets | 🗄️ SQL | `MaintenanceTicket`, `Room`, `SystemUser` |
| `POST /maintenance` | Create ticket + auto-update Room status | 🗄️ SQL | `MaintenanceTicket`, `Room` (transaction) |
| `PUT /maintenance/:id` | Update ticket + restore Room status | 🗄️ SQL | `MaintenanceTicket`, `Room` (transaction) |

---

## 13. Invoice Routes (`/api/v1/invoices`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `GET /invoices` | List invoices | 🗄️ SQL | `Invoice`, `Reservation`, `Hotel`, `Guest` |
| `POST /invoices` | Generate invoice from view | 🗄️ SQL | `vw_ReservationTotal` (view), `Invoice`, `Guest`, `Hotel` |
| `GET /invoices/:id` | Invoice detail with line items | 🗄️ SQL | `Invoice`, `Reservation`, `Guest`, `Hotel`, `ReservationRoom`, `RoomType`, `Room`, `ReservationService`, `ServiceCatalog`, `Payment` |
| `POST /invoices/:id/issue` | Issue invoice (DRAFT → ISSUED) | 🗄️ SQL | `Invoice` |

---

## 14. VNPay Routes (`/api/v1/vnpay`)

| Endpoint | Function | Data Source | Tables / Collections Used |
|----------|----------|-------------|--------------------------|
| `POST /vnpay/create-payment` | Create VNPay payment URL | 🗄️ SQL | `Reservation` |
| `GET /vnpay/return` | VNPay return (browser redirect) | 🗄️ SQL | `Payment`, `sp_CancelAbandonedReservation` |
| `GET /vnpay/ipn` | VNPay IPN server callback | 🗄️ SQL | `Payment`, `Reservation`, `Guest`, `Hotel` |
| `POST /vnpay/cleanup-abandoned` | Cleanup abandoned reservations | 🗄️ SQL | `sp_CleanupAbandonedReservations` |

---

## 15. MongoDB-Only Collections

These collections are **not** directly exposed via API endpoints but are queried as part of **Hybrid** endpoints:

| Collection | Used By | Content |
|------------|---------|---------|
| `Hotel_Catalog` | `GET /hotels`, `GET /hotels/:id` | Hotel descriptions, images, amenities list, contact info, location detail |
| `room_type_catalog` | `GET /hotels/:id` | Room type descriptions, features, images, highlights |
| `amenity_master` | `GET /hotels/:id` | Amenity names, categories, descriptions, icons, tags |

---

## Summary: Data Source Distribution

| Data Source | Route Groups | Count |
|-------------|-------------|-------|
| 🗄️ **SQL Server** | Auth, Rooms, Reservations, Payments, Services, Guests, Admin, Promotions, Locations, Housekeeping, Maintenance, Invoices, VNPay | **13 groups** |
| 🍃 **MongoDB Atlas** | (No standalone endpoints — used as enrichment layer) | **0 standalone** |
| 🔀 **Hybrid (Both)** | Hotels (list + detail) | **1 group** |

> **Key Insight:** The architecture follows a **SQL-primary, MongoDB-enrichment** pattern. All transactional, operational, and audit data lives in SQL Server. MongoDB stores rich content (descriptions, images, amenities) that is merged at the API layer for hotel catalog endpoints.
