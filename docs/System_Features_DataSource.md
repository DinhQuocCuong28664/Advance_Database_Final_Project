# LuxeReserve  Chuc Nang He Thong & Nguon Du Lieu

> Phan loai cac chuc nang theo nguon du lieu: **SQL Server**, **MongoDB Atlas**, hoac **Hybrid** (ca hai).

---

## 1. Chuc Nang Su Dung DU LIEU SQL SERVER

### 1.1 Quan Ly at Phong (Reservation)

| Chuc nang | API Endpoint | Bang SQL lien quan | Ky thuat DB nang cao |
|---|---|---|---|
| Tao at phong moi voi Pessimistic Locking | `POST /api/reservations` | `Reservation`, `ReservationRoom`, `ReservationStatusHistory`, `RoomAvailability`, `InventoryLockLog` | **Pessimistic Locking** (`UPDLOCK + HOLDLOCK`) qua `sp_ReserveRoom`; Transaction multi-step voi rollback |
| Xem chi tiet at phong theo ma xac nhan | `GET /api/reservations/:code` | `Reservation`, `ReservationRoom`, `ReservationStatusHistory`, `Guest`, `Hotel`, `RoomType`, `Room`, `SystemUser` | **View** `vw_ReservationTotal` (aggregation tu 3 bang: ReservationRoom + ReservationService + Payment) |
| Check-in khach | `POST /api/reservations/:id/checkin` | `Reservation`, `ReservationRoom`, `Room`, `StayRecord`, `ReservationStatusHistory` | Transaction multi-step: cap nhat 4 bang ong thoi |
| Check-out khach | `POST /api/reservations/:id/checkout` | `Reservation`, `ReservationRoom`, `Room`, `StayRecord`, `HousekeepingTask`, `ReservationStatusHistory` | Transaction multi-step: cap nhat 5 bang + auto-tao HousekeepingTask; Query `vw_ReservationTotal` sau commit e tranh deadlock |
| Khach huy at phong (mat coc) | `POST /api/reservations/:id/guest-cancel` | `Reservation`, `ReservationRoom`, `Room`, `RoomAvailability`, `ReservationStatusHistory`, `AuditLog` | Transaction 6 bang; **Trigger** `trg_Reservation_CancellationAudit` tu ong ghi `AuditLog`; Forfeit deposit (khong hoan tien) |
| Khach san huy (hoan tien 100%) | `POST /api/reservations/:id/hotel-cancel` | `Reservation`, `ReservationRoom`, `Room`, `RoomAvailability`, `Payment`, `ReservationStatusHistory`, `AuditLog` | Transaction 7 bang; Auto-tao `REFUND` Payment; **Trigger** `trg_Reservation_CancellationAudit` |
| Chuyen phong (Pessimistic Locking) | `POST /api/reservations/:id/transfer` | `ReservationRoom`, `Room`, `RoomAvailability`, `InventoryLockLog`, `ReservationStatusHistory` | **Stored Procedure** `sp_TransferRoom` voi `UPDLOCK + HOLDLOCK`; Atomic release old + lock new cho tat ca em |

### 1.2 Kiem Tra Phong Trong (Room Availability)

| Chuc nang | API Endpoint | Bang SQL lien quan | Ky thuat DB nang cao |
|---|---|---|---|
| Tim phong trong theo khach san va khoang ngay | `GET /api/rooms/availability->hotel_id&checkin&checkout` | `Room`, `RoomType`, `RoomRate`, `RoomAvailability` | Subquery `NOT EXISTS` kiem tra trang thai availability; `LEFT JOIN` voi `RoomRate` e lay gia thap nhat |

### 1.3 Quan Ly Khach Hang (Guest)

| Chuc nang | API Endpoint | Bang SQL lien quan | Ky thuat DB nang cao |
|---|---|---|---|
| Danh sach khach hang | `GET /api/guests` | `Guest` | **Computed Column** `full_name` (`PERSISTED`)  auto-concatenated, indexable |
| Xem ho so chi tiet khach hang | `GET /api/guests/:id` | `Guest`, `GuestPreference`, `LoyaltyAccount`, `HotelChain`, `GuestAddress` | Aggregation tu 4 bang con |
| Tao khach hang moi | `POST /api/guests` | `Guest` | `OUTPUT INSERTED` tra ve `full_name` (computed column tu ong tinh) |

### 1.4 Quan Ly Thanh Toan (Payment)

| Chuc nang | API Endpoint | Bang SQL lien quan | Ky thuat DB nang cao |
|---|---|---|---|
| Tao thanh toan (co validation chong vuot muc) | `POST /api/payments` | `Payment`, `Reservation` | LOGIC-610: Validate reservation status, tinh SUM payments a CAPTURED, chan vuot `grand_total`, chan deposit vuot `deposit_amount`, `FULL_PAYMENT` phai bang ung remaining balance |
| Danh sach thanh toan (loc theo reservation) | `GET /api/payments->reservation_id=` | `Payment` | Dynamic query building |

### 1.5 Quan Ly Dich Vu Phat Sinh (Services & Incidental Charges)

| Chuc nang | API Endpoint | Bang SQL lien quan | Ky thuat DB nang cao |
|---|---|---|---|
| Xem danh muc dich vu khach san | `GET /api/services->hotel_id=` | `ServiceCatalog`, `Hotel` | JOIN lay `currency_code` tu Hotel; filter `is_active = 1` |
| at dich vu phat sinh (spa, an uong, transfer...) | `POST /api/services/order` | `ReservationService`, `ServiceCatalog`, `Reservation`, `ReservationRoom` | Validate reservation status (chi CONFIRMED/CHECKED_IN), validate service thuoc ung hotel, auto-calculate `final_amount` |
| Xem danh sach dich vu a at | `GET /api/services/orders->reservation_id=` | `ReservationService`, `ServiceCatalog` | JOIN lay ten dich vu; tinh tong tien active orders vs all orders |
| Cap nhat trang thai dich vu | `PUT /api/services/orders/:id/status` | `ReservationService` | Validate status transitions: CONFIRMED, DELIVERED, CANCELLED |
| Thanh toan dich vu phat sinh | `POST /api/services/orders/:id/pay` | `ReservationService`, `Payment`, `ServiceCatalog` | Tao `INCIDENTAL_HOLD` payment; chong double-payment bang unique `payment_reference`; auto-update service status  DELIVERED |

### 1.6 Quan Ly Gia & Bao Cao (Admin)

| Chuc nang | API Endpoint | Bang SQL lien quan | Ky thuat DB nang cao |
|---|---|---|---|
| Cap nhat gia phong (kich hoat Price Guard) | `PUT /api/admin/rates/:id` | `RoomRate`, `RateChangeLog` | **AFTER UPDATE Trigger** `trg_RoomRate_PriceIntegrityGuard`: tu ong ghi log neu thay oi gia > 50% voi severity = `CRITICAL` |
| Xem canh bao Price Guard | `GET /api/admin/rates/alerts` | `RateChangeLog`, `RoomRate`, `RoomType`, `Hotel`, `SystemUser` | JOIN 5 bang e hien thi alert ay u context |
| Bao cao doanh thu theo Hotel (Revenue Analytics) | `GET /api/admin/reports/revenue` | `Reservation`, `ReservationRoom`, `Hotel`, `RoomType` | **Window Functions**: `DENSE_RANK() OVER()` xep hang doanh thu; `SUM() OVER()` tinh doanh thu tich luy; Revenue share percentage |
| Bao cao doanh thu theo Brand & Chain | `GET /api/admin/reports/revenue-by-brand` | `Reservation`, `ReservationRoom`, `Hotel`, `Brand`, `HotelChain`, `RoomType` | **Window Functions** multi-level: `DENSE_RANK() OVER (PARTITION BY brand_id)` ranking trong brand; `SUM() OVER (PARTITION BY brand_id)` doanh thu tich luy; Revenue share % trong chain va brand |
| Cap nhat trang thai phong (Optimistic Locking) | `PUT /api/admin/availability/:id` | `RoomAvailability` | **Optimistic Locking**: `UPDATE ... WHERE version_no = @expected_version`; Tra 409 Conflict neu version khong khop |

### 1.7 Cay Phan Cap Vi Tri (Location Hierarchy)

| Chuc nang | API Endpoint | Bang SQL lien quan | Ky thuat DB nang cao |
|---|---|---|---|
| Xem cay vi tri phan cap | `GET /api/locations/tree->root=&root_id=` | `Location` (self-referencing) | **Recursive CTE** (`WITH LocationTree AS ...`): duyet cay tu root en leaf voi depth tracking |
| Danh sach vi tri (flat) | `GET /api/locations` | `Location` | Sap xep theo level + name |

### 1.8 Quan Ly Housekeeping (Don phong)

| Chuc nang | API Endpoint | Bang SQL lien quan | Ky thuat DB nang cao |
|---|---|---|---|
| Danh sach task don phong | `GET /api/housekeeping->hotel_id=&status=` | `HousekeepingTask`, `Room`, `RoomType`, `SystemUser` | JOIN 4 bang; priority sorting; summary stats GROUP BY |
| Tao task don phong | `POST /api/housekeeping` | `HousekeepingTask` | Auto-set status `ASSIGNED` neu co staff |
| Phan cong nhan vien | `PUT /api/housekeeping/:id/assign` | `HousekeepingTask` | Validate task_status phai la OPEN/ASSIGNED |
| Cap nhat trang thai (sync Room) | `PUT /api/housekeeping/:id/status` | `HousekeepingTask`, `Room` | **Transaction**: update task + sync `Room.housekeeping_status` (IN_PROGRESSCLEANINSPECTED); status flow validation |

### 1.9 Quan Ly Bao Tri (Maintenance)

| Chuc nang | API Endpoint | Bang SQL lien quan | Ky thuat DB nang cao |
|---|---|---|---|
| Danh sach ticket bao tri | `GET /api/maintenance->hotel_id=&status=` | `MaintenanceTicket`, `Room`, `SystemUser` | JOIN + severity sorting; resolution hours tracking |
| Tao ticket bao tri | `POST /api/maintenance` | `MaintenanceTicket`, `Room` | **Transaction**: create ticket + auto-update `Room.maintenance_status = 'UNDER_REPAIR'` neu severity HIGH/CRITICAL |
| Cap nhat/Giai quyet ticket | `PUT /api/maintenance/:id` | `MaintenanceTicket`, `Room` | **Transaction multi-ticket aware**: chi reset `Room.maintenance_status  'NORMAL'` khi TAT CA tickets cua room eu resolved |

### 1.10 Quan Ly Hoa on (Invoice)

| Chuc nang | API Endpoint | Bang SQL lien quan | Ky thuat DB nang cao |
|---|---|---|---|
| Tao hoa on tu View | `POST /api/invoices` | `Invoice`, `vw_ReservationTotal`, `Guest`, `Hotel` | **View-to-INSERT pattern**: dung `vw_ReservationTotal` (computed view) lam nguon tai chinh duy nhat; chong duplicate invoice |
| Xem chi tiet hoa on | `GET /api/invoices/:id` | `Invoice`, `Reservation`, `ReservationRoom`, `ReservationService`, `Payment`, `Guest`, `Hotel` | JOIN 7 bang: invoice header + line items (rooms + services) + payment history |
| Xuat hoa on (DRAFT  ISSUED) | `POST /api/invoices/:id/issue` | `Invoice` | Status transition validation |

---

## 2. Chuc Nang Su Dung DU LIEU MONGODB

> MongoDB ong vai tro **kho noi dung phong phu** (rich content store). Khong co API endpoint nao chi dung rieng MongoDB  du lieu MongoDB luon uoc merge voi SQL Server trong cac endpoint Hybrid (xem muc 3).

### 2.1 Du Lieu uoc Luu Trong MongoDB

| Collection | Du lieu | Ly do dung MongoDB thay vi SQL |
|---|---|---|
| `Hotel_Catalog` | Mo ta khach san (short/long/highlights), gallery anh (embedded array voi caption, category, sort_order), danh sach amenities & room types (embedded), toa o chi tiet, thong tin lien he | Schema linh hoat: moi hotel co so luong anh/amenities/highlights khac nhau  embedded documents hieu qua hon normalized tables |
| `room_type_catalog` | Mo ta chi tiet loai phong, boolean features (has_balcony, has_private_pool, has_lounge_access, has_butler_service), gallery anh, highlight text | Cac features co the mo rong tu do ma khong can ALTER TABLE |
| `amenity_master` | Ten, mo ta, icon, tags (array), anh minh hoa | Tags la array ong  phu hop MongoDB hon SQL |

---

## 3. Chuc Nang Su Dung DU LIEU HYBRID (SQL Server + MongoDB)

### 3.1 Danh Sach Khach San (Hybrid Merge)

| Chuc nang | API Endpoint |
|---|---|
| Danh sach tat ca khach san | `GET /api/hotels` |

**Luong du lieu:**

| Buoc | Nguon | Du lieu lay |
|---|---|---|
| 1 | **SQL Server** | `Hotel` JOIN `Brand` JOIN `HotelChain` JOIN `Location`  hotel_name, star_rating, status, currency, brand_name, chain_name, city_name |
| 2 | **MongoDB** | `Hotel_Catalog.find()`  description, images, amenities, location detail |
| 3 | **API Layer** | Merge bang `hotel_id` mapping (in-memory Map lookup)  them `description`, `hero_image`, `amenity_count`, `location_detail` |

### 3.2 Chi Tiet Khach San (Full Hybrid)

| Chuc nang | API Endpoint |
|---|---|
| Chi tiet ay u 1 khach san | `GET /api/hotels/:id` |

**Luong du lieu:**

| Buoc | Nguon | Du lieu lay |
|---|---|---|
| 1 | **SQL Server** | Hotel + Brand + Chain + Location (parent)  thong tin van hanh |
| 2 | **SQL Server** | `RoomType` LEFT JOIN `RoomRate`  danh sach loai phong + min/max gia hien tai |
| 3 | **SQL Server** | `HotelAmenity`  danh sach amenity codes + phi + gio hoat ong |
| 4 | **MongoDB** | `Hotel_Catalog.findOne({hotel_id})`  description, images, contact |
| 5 | **MongoDB** | `room_type_catalog.find({room_type_code: {$in: [...]}})`  mo ta chi tiet, features, anh, highlight |
| 6 | **MongoDB** | `amenity_master.find({amenity_code: {$in: [...]}})`  ten, category, mo ta, icon, tags |
| 7 | **API Layer** | Merge room types: SQL (gia, operational) + MongoDB (mo ta, features, anh) |
| 8 | **API Layer** | Merge amenities: SQL (phi, gio) + MongoDB (ten, mo ta, icon, tags) |

---

## 4. Tong Hop

| Nguon du lieu | So chuc nang | Endpoints |
|---|---|---|
| **SQL Server only** | 33 | Reservations (7), Rooms (1), Guests (3), Payments (2), Services (5), Admin (5), Locations (2), Housekeeping (4), Maintenance (3), Invoices (3) |
| **MongoDB only** | 0 | *(MongoDB luon uoc merge voi SQL trong endpoint Hybrid)* |
| **Hybrid (SQL + MongoDB)** | 2 | Hotels (2) |
| **Tong** | **35** | |

### Ty le su dung

```
SQL Server  94% (33/35 endpoints)
Hybrid       6% (2/35 endpoints)
MongoDB      0% (0 standalone endpoints)
```

> **Nhan xet**: SQL Server ong vai tro **he thong chinh** xu ly toan bo business logic, ACID transactions, va data integrity. MongoDB ong vai tro **bo tro** cho rich content (mo ta, anh, features linh hoat) va chi xuat hien trong 2 endpoints Hybrid khi can hien thi thong tin khach san cho khach hang.
