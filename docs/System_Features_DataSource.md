# LuxeReserve — Chức Năng Hệ Thống & Nguồn Dữ Liệu

> Phân loại các chức năng theo nguồn dữ liệu: **SQL Server**, **MongoDB Atlas**, hoặc **Hybrid** (cả hai).

---

## 1. Chức Năng Sử Dụng DỮ LIỆU SQL SERVER

### 1.1 Quản Lý Đặt Phòng (Reservation)

| Chức năng | API Endpoint | Bảng SQL liên quan | Kỹ thuật DB nâng cao |
|---|---|---|---|
| Tạo đặt phòng mới với Pessimistic Locking | `POST /api/reservations` | `Reservation`, `ReservationRoom`, `ReservationStatusHistory`, `RoomAvailability`, `InventoryLockLog` | **Pessimistic Locking** (`UPDLOCK + HOLDLOCK`) qua `sp_ReserveRoom`; Transaction multi-step với rollback |
| Xem chi tiết đặt phòng theo mã xác nhận | `GET /api/reservations/:code` | `Reservation`, `ReservationRoom`, `ReservationStatusHistory`, `Guest`, `Hotel`, `RoomType`, `Room`, `SystemUser` | **View** `vw_ReservationTotal` (aggregation từ 3 bảng: ReservationRoom + ReservationService + Payment) |
| Check-in khách | `POST /api/reservations/:id/checkin` | `Reservation`, `ReservationRoom`, `Room`, `StayRecord`, `ReservationStatusHistory` | Transaction multi-step: cập nhật 4 bảng đồng thời |
| Check-out khách | `POST /api/reservations/:id/checkout` | `Reservation`, `ReservationRoom`, `Room`, `StayRecord`, `HousekeepingTask`, `ReservationStatusHistory` | Transaction multi-step: cập nhật 5 bảng + auto-tạo HousekeepingTask; Query `vw_ReservationTotal` sau commit để tránh deadlock |
| Khách hủy đặt phòng (mất cọc) | `POST /api/reservations/:id/guest-cancel` | `Reservation`, `ReservationRoom`, `Room`, `RoomAvailability`, `ReservationStatusHistory`, `AuditLog` | Transaction 6 bảng; **Trigger** `trg_Reservation_CancellationAudit` tự động ghi `AuditLog`; Forfeit deposit (không hoàn tiền) |
| Khách sạn hủy (hoàn tiền 100%) | `POST /api/reservations/:id/hotel-cancel` | `Reservation`, `ReservationRoom`, `Room`, `RoomAvailability`, `Payment`, `ReservationStatusHistory`, `AuditLog` | Transaction 7 bảng; Auto-tạo `REFUND` Payment; **Trigger** `trg_Reservation_CancellationAudit` |
| Chuyển phòng (Pessimistic Locking) | `POST /api/reservations/:id/transfer` | `ReservationRoom`, `Room`, `RoomAvailability`, `InventoryLockLog`, `ReservationStatusHistory` | **Stored Procedure** `sp_TransferRoom` với `UPDLOCK + HOLDLOCK`; Atomic release old + lock new cho tất cả đêm |

### 1.2 Kiểm Tra Phòng Trống (Room Availability)

| Chức năng | API Endpoint | Bảng SQL liên quan | Kỹ thuật DB nâng cao |
|---|---|---|---|
| Tìm phòng trống theo khách sạn và khoảng ngày | `GET /api/rooms/availability?hotel_id&checkin&checkout` | `Room`, `RoomType`, `RoomRate`, `RoomAvailability` | Subquery `NOT EXISTS` kiểm tra trạng thái availability; `LEFT JOIN` với `RoomRate` để lấy giá thấp nhất |

### 1.3 Quản Lý Khách Hàng (Guest)

| Chức năng | API Endpoint | Bảng SQL liên quan | Kỹ thuật DB nâng cao |
|---|---|---|---|
| Danh sách khách hàng | `GET /api/guests` | `Guest` | **Computed Column** `full_name` (`PERSISTED`) — auto-concatenated, indexable |
| Xem hồ sơ chi tiết khách hàng | `GET /api/guests/:id` | `Guest`, `GuestPreference`, `LoyaltyAccount`, `HotelChain`, `GuestAddress` | Aggregation từ 4 bảng con |
| Tạo khách hàng mới | `POST /api/guests` | `Guest` | `OUTPUT INSERTED` trả về `full_name` (computed column tự động tính) |

### 1.4 Quản Lý Thanh Toán (Payment)

| Chức năng | API Endpoint | Bảng SQL liên quan | Kỹ thuật DB nâng cao |
|---|---|---|---|
| Tạo thanh toán (có validation chống vượt mức) | `POST /api/payments` | `Payment`, `Reservation` | LOGIC-6→10: Validate reservation status, tính SUM payments đã CAPTURED, chặn vượt `grand_total`, chặn deposit vượt `deposit_amount`, `FULL_PAYMENT` phải bằng đúng remaining balance |
| Danh sách thanh toán (lọc theo reservation) | `GET /api/payments?reservation_id=` | `Payment` | Dynamic query building |

### 1.5 Quản Lý Dịch Vụ Phát Sinh (Services & Incidental Charges)

| Chức năng | API Endpoint | Bảng SQL liên quan | Kỹ thuật DB nâng cao |
|---|---|---|---|
| Xem danh mục dịch vụ khách sạn | `GET /api/services?hotel_id=` | `ServiceCatalog`, `Hotel` | JOIN lấy `currency_code` từ Hotel; filter `is_active = 1` |
| Đặt dịch vụ phát sinh (spa, ăn uống, transfer...) | `POST /api/services/order` | `ReservationService`, `ServiceCatalog`, `Reservation`, `ReservationRoom` | Validate reservation status (chỉ CONFIRMED/CHECKED_IN), validate service thuộc đúng hotel, auto-calculate `final_amount` |
| Xem danh sách dịch vụ đã đặt | `GET /api/services/orders?reservation_id=` | `ReservationService`, `ServiceCatalog` | JOIN lấy tên dịch vụ; tính tổng tiền active orders vs all orders |
| Cập nhật trạng thái dịch vụ | `PUT /api/services/orders/:id/status` | `ReservationService` | Validate status transitions: CONFIRMED, DELIVERED, CANCELLED |
| Thanh toán dịch vụ phát sinh | `POST /api/services/orders/:id/pay` | `ReservationService`, `Payment`, `ServiceCatalog` | Tạo `INCIDENTAL_HOLD` payment; chống double-payment bằng unique `payment_reference`; auto-update service status → DELIVERED |

### 1.6 Quản Lý Giá & Báo Cáo (Admin)

| Chức năng | API Endpoint | Bảng SQL liên quan | Kỹ thuật DB nâng cao |
|---|---|---|---|
| Cập nhật giá phòng (kích hoạt Price Guard) | `PUT /api/admin/rates/:id` | `RoomRate`, `RateChangeLog` | **AFTER UPDATE Trigger** `trg_RoomRate_PriceIntegrityGuard`: tự động ghi log nếu thay đổi giá > 50% với severity = `CRITICAL` |
| Xem cảnh báo Price Guard | `GET /api/admin/rates/alerts` | `RateChangeLog`, `RoomRate`, `RoomType`, `Hotel`, `SystemUser` | JOIN 5 bảng để hiển thị alert đầy đủ context |
| Báo cáo doanh thu theo Hotel (Revenue Analytics) | `GET /api/admin/reports/revenue` | `Reservation`, `ReservationRoom`, `Hotel`, `RoomType` | **Window Functions**: `DENSE_RANK() OVER()` xếp hạng doanh thu; `SUM() OVER()` tính doanh thu tích lũy; Revenue share percentage |
| Báo cáo doanh thu theo Brand & Chain | `GET /api/admin/reports/revenue-by-brand` | `Reservation`, `ReservationRoom`, `Hotel`, `Brand`, `HotelChain`, `RoomType` | **Window Functions** multi-level: `DENSE_RANK() OVER (PARTITION BY brand_id)` ranking trong brand; `SUM() OVER (PARTITION BY brand_id)` doanh thu tích lũy; Revenue share % trong chain và brand |
| Cập nhật trạng thái phòng (Optimistic Locking) | `PUT /api/admin/availability/:id` | `RoomAvailability` | **Optimistic Locking**: `UPDATE ... WHERE version_no = @expected_version`; Trả 409 Conflict nếu version không khớp |

### 1.7 Cây Phân Cấp Vị Trí (Location Hierarchy)

| Chức năng | API Endpoint | Bảng SQL liên quan | Kỹ thuật DB nâng cao |
|---|---|---|---|
| Xem cây vị trí phân cấp | `GET /api/locations/tree?root=&root_id=` | `Location` (self-referencing) | **Recursive CTE** (`WITH LocationTree AS ...`): duyệt cây từ root đến leaf với depth tracking |
| Danh sách vị trí (flat) | `GET /api/locations` | `Location` | Sắp xếp theo level + name |

### 1.8 Quản Lý Housekeeping (Dọn phòng)

| Chức năng | API Endpoint | Bảng SQL liên quan | Kỹ thuật DB nâng cao |
|---|---|---|---|
| Danh sách task dọn phòng | `GET /api/housekeeping?hotel_id=&status=` | `HousekeepingTask`, `Room`, `RoomType`, `SystemUser` | JOIN 4 bảng; priority sorting; summary stats GROUP BY |
| Tạo task dọn phòng | `POST /api/housekeeping` | `HousekeepingTask` | Auto-set status `ASSIGNED` nếu có staff |
| Phân công nhân viên | `PUT /api/housekeeping/:id/assign` | `HousekeepingTask` | Validate task_status phải là OPEN/ASSIGNED |
| Cập nhật trạng thái (sync Room) | `PUT /api/housekeeping/:id/status` | `HousekeepingTask`, `Room` | **Transaction**: update task + sync `Room.housekeeping_status` (IN_PROGRESS→CLEAN→INSPECTED); status flow validation |

### 1.9 Quản Lý Bảo Trì (Maintenance)

| Chức năng | API Endpoint | Bảng SQL liên quan | Kỹ thuật DB nâng cao |
|---|---|---|---|
| Danh sách ticket bảo trì | `GET /api/maintenance?hotel_id=&status=` | `MaintenanceTicket`, `Room`, `SystemUser` | JOIN + severity sorting; resolution hours tracking |
| Tạo ticket bảo trì | `POST /api/maintenance` | `MaintenanceTicket`, `Room` | **Transaction**: create ticket + auto-update `Room.maintenance_status = 'UNDER_REPAIR'` nếu severity HIGH/CRITICAL |
| Cập nhật/Giải quyết ticket | `PUT /api/maintenance/:id` | `MaintenanceTicket`, `Room` | **Transaction multi-ticket aware**: chỉ reset `Room.maintenance_status → 'NORMAL'` khi TẤT CẢ tickets của room đều resolved |

### 1.10 Quản Lý Hóa Đơn (Invoice)

| Chức năng | API Endpoint | Bảng SQL liên quan | Kỹ thuật DB nâng cao |
|---|---|---|---|
| Tạo hóa đơn từ View | `POST /api/invoices` | `Invoice`, `vw_ReservationTotal`, `Guest`, `Hotel` | **View-to-INSERT pattern**: dùng `vw_ReservationTotal` (computed view) làm nguồn tài chính duy nhất; chống duplicate invoice |
| Xem chi tiết hóa đơn | `GET /api/invoices/:id` | `Invoice`, `Reservation`, `ReservationRoom`, `ReservationService`, `Payment`, `Guest`, `Hotel` | JOIN 7 bảng: invoice header + line items (rooms + services) + payment history |
| Xuất hóa đơn (DRAFT → ISSUED) | `POST /api/invoices/:id/issue` | `Invoice` | Status transition validation |

---

## 2. Chức Năng Sử Dụng DỮ LIỆU MONGODB

> MongoDB đóng vai trò **kho nội dung phong phú** (rich content store). Không có API endpoint nào chỉ dùng riêng MongoDB — dữ liệu MongoDB luôn được merge với SQL Server trong các endpoint Hybrid (xem mục 3).

### 2.1 Dữ Liệu Được Lưu Trong MongoDB

| Collection | Dữ liệu | Lý do dùng MongoDB thay vì SQL |
|---|---|---|
| `Hotel_Catalog` | Mô tả khách sạn (short/long/highlights), gallery ảnh (embedded array với caption, category, sort_order), danh sách amenities & room types (embedded), tọa độ chi tiết, thông tin liên hệ | Schema linh hoạt: mỗi hotel có số lượng ảnh/amenities/highlights khác nhau → embedded documents hiệu quả hơn normalized tables |
| `room_type_catalog` | Mô tả chi tiết loại phòng, boolean features (has_balcony, has_private_pool, has_lounge_access, has_butler_service), gallery ảnh, highlight text | Các features có thể mở rộng tự do mà không cần ALTER TABLE |
| `amenity_master` | Tên, mô tả, icon, tags (array), ảnh minh họa | Tags là array động — phù hợp MongoDB hơn SQL |

---

## 3. Chức Năng Sử Dụng DỮ LIỆU HYBRID (SQL Server + MongoDB)

### 3.1 Danh Sách Khách Sạn (Hybrid Merge)

| Chức năng | API Endpoint |
|---|---|
| Danh sách tất cả khách sạn | `GET /api/hotels` |

**Luồng dữ liệu:**

| Bước | Nguồn | Dữ liệu lấy |
|---|---|---|
| 1 | **SQL Server** | `Hotel` JOIN `Brand` JOIN `HotelChain` JOIN `Location` → hotel_name, star_rating, status, currency, brand_name, chain_name, city_name |
| 2 | **MongoDB** | `Hotel_Catalog.find()` → description, images, amenities, location detail |
| 3 | **API Layer** | Merge bằng `hotel_id` mapping (in-memory Map lookup) → thêm `description`, `hero_image`, `amenity_count`, `location_detail` |

### 3.2 Chi Tiết Khách Sạn (Full Hybrid)

| Chức năng | API Endpoint |
|---|---|
| Chi tiết đầy đủ 1 khách sạn | `GET /api/hotels/:id` |

**Luồng dữ liệu:**

| Bước | Nguồn | Dữ liệu lấy |
|---|---|---|
| 1 | **SQL Server** | Hotel + Brand + Chain + Location (parent) → thông tin vận hành |
| 2 | **SQL Server** | `RoomType` LEFT JOIN `RoomRate` → danh sách loại phòng + min/max giá hiện tại |
| 3 | **SQL Server** | `HotelAmenity` → danh sách amenity codes + phí + giờ hoạt động |
| 4 | **MongoDB** | `Hotel_Catalog.findOne({hotel_id})` → description, images, contact |
| 5 | **MongoDB** | `room_type_catalog.find({room_type_code: {$in: [...]}})` → mô tả chi tiết, features, ảnh, highlight |
| 6 | **MongoDB** | `amenity_master.find({amenity_code: {$in: [...]}})` → tên, category, mô tả, icon, tags |
| 7 | **API Layer** | Merge room types: SQL (giá, operational) + MongoDB (mô tả, features, ảnh) |
| 8 | **API Layer** | Merge amenities: SQL (phí, giờ) + MongoDB (tên, mô tả, icon, tags) |

---

## 4. Tổng Hợp

| Nguồn dữ liệu | Số chức năng | Endpoints |
|---|---|---|
| **SQL Server only** | 33 | Reservations (7), Rooms (1), Guests (3), Payments (2), Services (5), Admin (5), Locations (2), Housekeeping (4), Maintenance (3), Invoices (3) |
| **MongoDB only** | 0 | *(MongoDB luôn được merge với SQL trong endpoint Hybrid)* |
| **Hybrid (SQL + MongoDB)** | 2 | Hotels (2) |
| **Tổng** | **35** | |

### Tỷ lệ sử dụng

```
SQL Server ████████████████████████████████████████ 94% (33/35 endpoints)
Hybrid     ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  6% (2/35 endpoints)
MongoDB    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0% (0 standalone endpoints)
```

> **Nhận xét**: SQL Server đóng vai trò **hệ thống chính** xử lý toàn bộ business logic, ACID transactions, và data integrity. MongoDB đóng vai trò **bổ trợ** cho rich content (mô tả, ảnh, features linh hoạt) và chỉ xuất hiện trong 2 endpoints Hybrid khi cần hiển thị thông tin khách sạn cho khách hàng.
