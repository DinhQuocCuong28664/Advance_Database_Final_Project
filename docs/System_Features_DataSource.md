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
| Tạo thanh toán | `POST /api/payments` | `Payment`, `Reservation` | Validate reservation tồn tại trước khi tạo payment |
| Danh sách thanh toán (lọc theo reservation) | `GET /api/payments?reservation_id=` | `Payment` | Dynamic query building |

### 1.5 Quản Lý Giá & Báo Cáo (Admin)

| Chức năng | API Endpoint | Bảng SQL liên quan | Kỹ thuật DB nâng cao |
|---|---|---|---|
| Cập nhật giá phòng (kích hoạt Price Guard) | `PUT /api/admin/rates/:id` | `RoomRate`, `RateChangeLog` | **AFTER UPDATE Trigger** `trg_RoomRate_PriceIntegrityGuard`: tự động ghi log nếu thay đổi giá > 50% với severity = `CRITICAL` |
| Xem cảnh báo Price Guard | `GET /api/admin/rates/alerts` | `RateChangeLog`, `RoomRate`, `RoomType`, `Hotel`, `SystemUser` | JOIN 5 bảng để hiển thị alert đầy đủ context |
| Báo cáo doanh thu (Revenue Analytics) | `GET /api/admin/reports/revenue` | `Reservation`, `ReservationRoom`, `Hotel`, `RoomType` | **Window Functions**: `DENSE_RANK() OVER()` xếp hạng doanh thu; `SUM() OVER()` tính doanh thu tích lũy; Revenue share percentage |

### 1.6 Cây Phân Cấp Vị Trí (Location Hierarchy)

| Chức năng | API Endpoint | Bảng SQL liên quan | Kỹ thuật DB nâng cao |
|---|---|---|---|
| Xem cây vị trí phân cấp | `GET /api/locations/tree?root=&root_id=` | `Location` (self-referencing) | **Recursive CTE** (`WITH LocationTree AS ...`): duyệt cây từ root đến leaf với depth tracking |
| Danh sách vị trí (flat) | `GET /api/locations` | `Location` | Sắp xếp theo level + name |

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
| **SQL Server only** | 13 | Reservations (4), Rooms (1), Guests (3), Payments (2), Admin (3), Locations (2) |
| **MongoDB only** | 0 | *(MongoDB luôn được merge với SQL trong endpoint Hybrid)* |
| **Hybrid (SQL + MongoDB)** | 2 | Hotels (2) |
| **Tổng** | **15** | |

### Tỷ lệ sử dụng

```
SQL Server ███████████████████████████████████████░░ 87% (13/15 endpoints)
Hybrid     ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 13% (2/15 endpoints)
MongoDB    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0% (0 standalone endpoints)
```

> **Nhận xét**: SQL Server đóng vai trò **hệ thống chính** xử lý toàn bộ business logic, ACID transactions, và data integrity. MongoDB đóng vai trò **bổ trợ** cho rich content (mô tả, ảnh, features linh hoạt) và chỉ xuất hiện trong 2 endpoints Hybrid khi cần hiển thị thông tin khách sạn cho khách hàng.
