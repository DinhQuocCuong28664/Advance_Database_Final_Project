# LuxeReserve - System Audit Report & Fixes Applied

## Tổng quan kiến trúc hệ thống

### Backend (Node.js/Express)
- **14 route modules** được mount trong `app.js`
- **Polyglot Persistence**: SQL Server (ACID transactions) + MongoDB (rich content)
- **Authentication**: JWT-based, phân biệt GUEST vs SYSTEM_USER
- **Middleware**: `requireAuth`, `requireSystemUser`, `requireAdminUser`, `requireManagerUser`

### Frontend (React/Vite)
- **13 pages**: Account, Admin, Booking, Cashier, Dashboard, ForgotPassword, Hotel, Login, Register, Reservation, ResetPassword, Search, VnpayReturn
- **Admin sub-pages**: Rates management, Invoice management
- **Context**: AuthContext, FlashContext
- **API layer**: `lib/api.js` + `hooks/useApi.js`

### Database (SQL Server)
- **~40 tables** + **4 views** + **~10 stored procedures**
- **MongoDB collections**: `Hotel_Catalog`, `room_type_catalog`, `amenity_master`

---

## ✅ CÁC FIX ĐÃ ĐƯỢC ÁP DỤNG

### 1. Fix Critical - Security & Business Logic

#### ✅ express-rate-limit cho auth endpoints
- File: `src/routes/auth.js`
- Added rate limiting: 10 requests/min cho OTP endpoints, 20 requests/min cho login
- Bảo vệ brute force attack

#### ✅ OTP brute force protection (rate-limit on `/send-otp` & `/verify-otp`)
- File: `src/routes/auth.js`
- Rate limiter riêng cho OTP endpoints: max 5 requests trong 1 phút

#### ✅ sp_ReserveRoom trong transaction với SAVEPOINT
- File: `src/routes/reservations.js`
- Dùng `savepoint` và `rollback to savepoint` thay vì rollback toàn bộ transaction khi có lỗi
- Đảm bảo tính toàn vẹn dữ liệu

#### ✅ Health check endpoint
- File: `src/app.js`
- `GET /api/v1/health` - kiểm tra kết nối database
- Trả về `{ status, database, timestamp }`

#### ✅ Validation adult_count, child_count trong reservations.js
- File: `src/routes/reservations.js`
- Validate số người lớn >= 1
- Validate không âm cho trẻ em

#### ✅ Check room_status & maintenance_status trước khi book
- File: `src/routes/reservations.js`
- Kiểm tra `status = 'ACTIVE'` và `maintenance_status = 'NONE'` trước khi cho phép booking

#### ✅ Validate quantity > 0 trong services.js
- File: `src/routes/services.js`
- Kiểm tra `quantity > 0` khi đặt dịch vụ

#### ✅ Validate severity_level hợp lệ trong maintenance.js
- File: `src/routes/maintenance.js`
- Kiểm tra `severity_level` phải là: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

### 2. Fix Medium - Performance & Code Quality

#### ✅ Pagination cho list endpoints
- File: `src/routes/hotels.js` - `GET /api/v1/hotels` với `page`, `page_size`, OFFSET/FETCH NEXT
- File: `src/routes/guests.js` - `GET /api/v1/guests` với pagination
- Trả về `total`, `page`, `page_size` trong response

#### ✅ Fix SQL Injection `TOP (${variable})`
- File: `src/routes/hotels.js` - dùng `@revLimit` parameter
- File: `src/routes/admin.js` - dùng `@limit` parameter với bound checking

#### ✅ Standardized Error Handling
- File: `src/config/errors.js` (new) - `AppError` class, `ErrorCodes`, `errorResponse`, `executeWithRetry`
- File: `src/app.js` - Updated error handler dùng centralized format
- Response format chuẩn: `{ success, error: { code, message, details } }`

#### ✅ Request Logging Middleware
- File: `src/app.js` - Log tất cả requests với duration, status code, user_id

---

## 2. PHẦN DB - CÁC BẢNG CHƯA ĐƯỢC SỬ DỤNG (UNUSED TABLES)

### Bảng hoàn toàn không được backend sử dụng:

| Bảng | Lý do | Gợi ý |
|------|-------|-------|
| **PaymentCardToken** | Lưu token thẻ thanh toán nhưng không có API nào tạo/đọc/xóa | Cần thêm route `POST /api/v1/payments/cards` và `GET /api/v1/payments/cards` |
| **AuditLog** | Không có API nào ghi hoặc đọc audit log | Cần thêm middleware auto-logging hoặc route riêng |

### Bảng chỉ được đọc 1 phần:

| Bảng | Mức độ sử dụng | Chi tiết |
|------|----------------|----------|
| **GuestPreference** | Chỉ đọc trong `GET /guests/:id` | Không có API để tạo/cập nhật preference |
| **GuestAddress** | Chỉ đọc trong `GET /guests/:id` | Không có API CRUD cho địa chỉ |
| **RatePlan** | Không được query trực tiếp | Chỉ dùng `rate_plan_id` như FK |
| **BookingChannel** | Không có API riêng | Chỉ dùng `booking_channel_id` như FK |
| **Role / UserRole** | Không có API quản lý | Chỉ dùng trong auth middleware |

### Views không được backend sử dụng:

| View | Trạng thái |
|------|------------|
| `vw_BookingChannelStats` | ❌ **Không được dùng** |
| `vw_LocationTree` | ❌ **Không được dùng** (có thể thay thế bằng locations/tree) |

### Columns không được backend sử dụng:

| Table | Column | Ghi chú |
|-------|--------|---------|
| Guest | `date_of_birth` | Không được set/update bởi API nào |
| Guest | `identity_document_type`, `identity_document_no`, `document_issue_country` | Không được dùng |
| Guest | `vip_flag` | Không có logic VIP nào |
| Reservation | `tax_amount`, `service_charge_amount` | Luôn NULL |
| Reservation | `arrival_time_estimate` | Không được set |
| Reservation | `created_by_user_id` | Không được set |
| ReservationRoom | `tax_amount` | Luôn NULL |
| ReservationRoom | `assigned_room_number_snapshot` | Không được set |
| Room | `near_elevator_flag`, `connecting_room_flag`, `connected_room_id`, `is_accessible`, `is_vip_preferred`, `last_renovated_at` | Không được dùng |
| RoomAvailability | `rate_plan_open_flag`, `min_los`, `max_los`, `cta_flag`, `ctd_flag`, `last_synced_at` | Không được dùng |
| RoomRate | `available_inventory_count`, `price_source`, `demand_level`, `created_by`, `updated_by` | Không được dùng |
| Hotel | `legal_name`, `opening_date`, `timezone`, `total_floors`, `primary_language_code`, `reservation_email`, `reservation_phone`, `address_line_2`, `postal_code` | Không được dùng |

---

## 3. FRONTEND - PAGES/FEATURES CHƯA ĐƯỢC IMPLEMENT

| Feature | Priority | Ghi chú |
|---------|----------|---------|
| Review/HotelReview Frontend | Medium | API có đủ nhưng không có trang xem/viết review |
| Loyalty Rewards Redemption UI | Medium | API có nhưng không có UI |
| VNPay Checkout Page | High | API VNPay có đủ nhưng frontend không có trang redirect/xử lý |
| Service Ordering in FE | Medium | API services có đủ nhưng không có giao diện đặt dịch vụ |
| Admin Dashboard | High | API reports có đủ nhưng frontend admin dashboard chưa hoàn thiện |
| Invoice View | Medium | API invoices có đủ nhưng không có trang xem hóa đơn |
| Room Features Management UI | Low | API có nhưng không có UI quản lý |
| Rate Plan Management UI | High | API có nhưng chưa có UI quản lý |

---

## 4. HƯỚNG TỐI ƯU HÓA CÒN LẠI

### 4.1 Performance Optimization

1. **Add database indexes**:
   ```sql
   CREATE INDEX IX_Reservation_guest_id ON Reservation(guest_id) INCLUDE (reservation_status, checkin_date, checkout_date);
   CREATE INDEX IX_ReservationRoom_reservation_id ON ReservationRoom(reservation_id) INCLUDE (room_id, room_type_id);
   CREATE INDEX IX_RoomAvailability_room_date ON RoomAvailability(room_id, stay_date) INCLUDE (availability_status, version_no);
   CREATE INDEX IX_Payment_reservation_id ON Payment(reservation_id) INCLUDE (payment_status, amount);
   ```

2. **Batch sp_ReserveRoom calls**: Tạo SP mới `sp_ReserveRoomBatch` nhận TVP (Table-Valued Parameter).

3. **Implement Redis caching**:
   - Cache hotel list (TTL 5 phút)
   - Cache room availability (TTL 30 giây)
   - Cache promotions list (TTL 10 phút)

### 4.2 Reliability Optimization

1. **Add graceful degradation**:
   - Nếu MongoDB down, hotels list vẫn trả về SQL data
   - Nếu mail service down, booking vẫn thành công (chỉ log lỗi)

### 4.3 Database Schema Optimization

1. **Remove unused columns** (sau khi xác nhận không cần)
2. **Add data archival strategy**: Archive reservations > 1 year vào history tables

### 4.4 Frontend Optimization

1. **Add missing admin UIs**: Promotion management, Housekeeping dashboard, Maintenance tickets, Service catalog
2. **Add guest self-service UIs**: Profile edit, Loyalty points history, Review submission
3. **Performance**: Lazy loading, Code splitting, Memoization
4. **UX improvements**: Loading skeletons, Error boundaries, Optimistic updates, Confirmation dialogs

---

## 5. TỔNG KẾT MỨC ĐỘ ƯU TIÊN

### 🔴 High (Đã fix xong - Security & Business Logic):
- ✅ Rate limiting cho auth endpoints
- ✅ OTP brute force protection
- ✅ sp_ReserveRoom transaction safety
- ✅ Health check endpoint
- ✅ Input validation (adult_count, child_count, quantity, severity_level)
- ✅ Room status check trước khi book

### 🟡 High (Cần làm tiếp):
1. Add database indexes
2. Batch sp_ReserveRoom calls
3. Redis caching
4. Missing admin UIs (Dashboard, Rate Plans)
5. VNPay frontend integration

### 🟢 Medium:
1. Guest self-service UIs (loyalty, reviews, profile)
2. Graceful degradation
3. Service ordering UI

### 🔵 Low:
1. Remove unused columns
2. Data archival
3. Optimistic updates trên frontend

---

*Report generated: 30/04/2026*
*Fixes applied: 12 items*
*Remaining recommendations: 10 items*
