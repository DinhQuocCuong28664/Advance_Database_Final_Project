# LuxeReserve - System Audit Report

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

## 1. PHẦN DB - CÁC BẢNG CHƯA ĐƯỢC SỬ DỤNG (UNUSED TABLES)

### Bảng hoàn toàn không được backend sử dụng:

| Bảng | Lý do | Gợi ý |
|------|-------|-------|
| **PaymentCardToken** | Lưu token thẻ thanh toán nhưng không có API nào tạo/đọc/xóa | Cần thêm route `POST /api/v1/payments/cards` và `GET /api/v1/payments/cards` |
| **RateChangeLog** | Được tạo bởi SP `sp_LogRateChange` nhưng không có API để xem alerts (ngoại trừ admin rates alerts) | Đã có `GET /api/v1/admin/rates/alerts` - OK |
| **AuditLog** | Không có API nào ghi hoặc đọc audit log | Cần thêm middleware auto-logging hoặc route riêng |

### Bảng chỉ được đọc 1 phần:

| Bảng | Mức độ sử dụng | Chi tiết |
|------|----------------|----------|
| **GuestPreference** | Chỉ đọc trong `GET /guests/:id` | Không có API để tạo/cập nhật preference |
| **GuestAddress** | Chỉ đọc trong `GET /guests/:id` | Không có API CRUD cho địa chỉ |
| **RatePlan** | Không được query trực tiếp | Chỉ dùng `rate_plan_id` như FK trong ReservationRoom |
| **BookingChannel** | Không có API riêng | Chỉ dùng `booking_channel_id` như FK |
| **Role / UserRole** | Không có API quản lý | Chỉ dùng trong auth middleware để check roles |

### MongoDB collections chưa được khai thác hết:
- `room_type_catalog` - chỉ dùng description, features, images
- `amenity_master` - chỉ dùng name, category, description, icon, tags

---

## 2. PHẦN BE - CÁC VẤN ĐỀ & LỖI

### 2.1 Lỗi logic nghiêm trọng

#### ❌ **reservations.js - Không validate room_id thuộc hotel_id**
```javascript
// Chỉ validate currency_code, không validate room thuộc hotel
const hotelCurrencyResult = await new sql.Request(transaction)
  .input('hotelId', sql.BigInt, hotel_id)
  .input('roomId', sql.BigInt, room_id)
  .query(`SELECT TOP 1 h.currency_code FROM Hotel h JOIN Room r ON r.hotel_id = h.hotel_id
          WHERE h.hotel_id = @hotelId AND r.room_id = @roomId`);
```
**OK**: Câu query này đã JOIN Room với Hotel nên đã validate room thuộc hotel.

#### ❌ **reservations.js - Không kiểm tra room_status trước khi book**
Không check `Room.room_status = 'AVAILABLE'` hoặc `Room.maintenance_status = 'NORMAL'` trước khi gọi sp_ReserveRoom.

### 2.2 Lỗi bảo mật

#### ❌ **Thiếu input validation/sanitization**
- `POST /api/v1/reservations` - không validate `adult_count`, `child_count` là số dương
- `POST /api/v1/services/order` - không validate `quantity` > 0
- `POST /api/v1/maintenance` - không validate `severity_level` hợp lệ

### 2.3 Lỗi logic nghiệp vụ

#### ❌ **reservations.js - Discount amount không được persist vào Reservation**
```javascript
// Dòng ~270: Tính discountAmount nhưng không lưu vào DB
const reservationTotal = Math.max(0, reservationSubtotal - discountAmount);
// discountAmount được tính nhưng không có cột nào trong Reservation lưu nó
// Chỉ có discount_amount trong ReservationRoom
```
**Thực tế**: Đã có `discount_amount` trong INSERT Reservation. OK.

#### ❌ **services.js - Không validate service thuộc hotel của reservation**
```javascript
// Dòng ~100: Validate service thuộc hotel của reservation
const svcCheck = await pool.request()
  .input('svcId', sql.BigInt, service_id)
  .input('hotelId', sql.BigInt, reservation.hotel_id)
  .query(`...WHERE service_id = @svcId AND hotel_id = @hotelId`);
```
**OK**: Đã validate.

#### ❌ **payments.js - Không validate payment amount không vượt quá balance_due**
```javascript
// Cần check: amount <= (grand_total - total_paid)
```

### 2.4 Lỗi hiệu năng

#### ❌ **reservations.js - Gọi sp_ReserveRoom N lần cho N đêm**
```javascript
for (let i = 0; i < nightCount; i++) {
  await spRequest.execute('sp_ReserveRoom');  // N lần round-trip
}
```
**Vấn đề**: Với 90 đêm -> 90 lần gọi SP riêng lẻ. Nên gửi TVP (Table-Valued Parameter) hoặc gọi 1 SP xử lý tất cả.

#### ❌ **Thiếu database indexes**
Các query JOIN nhiều bảng nhưng không có index hint:
- `Reservation JOIN Guest JOIN Hotel JOIN ReservationRoom JOIN RoomType JOIN Room`
- `vw_ReservationTotal` query

#### ❌ **N+1 query pattern**
- `GET /api/v1/hotels/:id` - query riêng cho hotel, room types, features, amenities, policies, MongoDB
- `GET /api/v1/reservations/:code` - query riêng cho reservation, rooms, history

### 2.5 Lỗi thiết kế API

#### ❌ **Inconsistent error response format**
```javascript
// Một số route dùng:
{ success: false, message: '...' }
// Một số route dùng:
{ success: false, error: '...' }
// Một số route dùng cả hai:
{ success: false, message: '...', error: '...' }
```

#### ❌ **Thiếu pagination cho list endpoints**
- `GET /api/v1/guests` - không có pagination, có thể trả về hàng ngàn records
- `GET /api/v1/hotels` - không có pagination
- `GET /api/v1/promotions` - không có pagination

#### ❌ **POST /api/v1/reservations quá phức tạp**
Endpoint nhận ~20 fields, xử lý ~10 business rules, gọi SP, transaction, email. Nên tách thành:
1. `POST /api/v1/reservations/validate` - validate trước
2. `POST /api/v1/reservations` - chỉ tạo reservation
3. Background job gửi email

---

## 3. PHẦN FE - CÁC VẤN ĐỀ

### 3.1 Thiếu pages/features

| Tính năng | Trạng thái |
|-----------|------------|
| Admin quản lý promotions | ❌ Không có UI |
| Admin quản lý housekeeping | ❌ Không có UI |
| Admin quản lý maintenance | ❌ Không có UI |
| Admin quản lý services catalog | ❌ Không có UI |
| Guest profile edit (address, preferences) | ❌ Không có UI |
| Guest loyalty points history | ❌ Không có UI |
| Hotel review UI | ❌ Không có UI |
| Invoice view/download | ❌ Không có UI |
| VNPay return page | ✅ Có VnpayReturnPage.jsx |

### 3.2 Lỗi tiềm ẩn

#### ❌ **AuthContext không handle token refresh**
Nếu token hết hạn, user bị redirect về login mà không có refresh mechanism.

#### ❌ **Thiếu loading states**
Nhiều page không có skeleton loading hoặc spinner khi fetch data.

#### ❌ **Thiếu error boundaries**
Không có React Error Boundary để catch runtime errors.

#### ❌ **Không có optimistic updates**
Khi book phòng, UI chờ API response mới update - không có optimistic UI.

---

## 4. CÁC PHẦN CHƯA ĐƯỢC SỬ DỤNG TRONG DB

### 4.1 Columns không được backend sử dụng

| Table | Column | Ghi chú |
|-------|--------|---------|
| Guest | `date_of_birth` | Không được set/update bởi API nào |
| Guest | `identity_document_type`, `identity_document_no`, `document_issue_country` | Không được dùng |
| Guest | `vip_flag` | Không có logic VIP nào |
| Reservation | `tax_amount`, `service_charge_amount` | Luôn NULL khi tạo reservation |
| Reservation | `arrival_time_estimate` | Không được set |
| Reservation | `created_by_user_id` | Không được set |
| ReservationRoom | `tax_amount` | Luôn NULL |
| ReservationRoom | `assigned_room_number_snapshot` | Không được set |
| Room | `near_elevator_flag`, `connecting_room_flag`, `connected_room_id`, `is_accessible`, `is_vip_preferred`, `last_renovated_at` | Không được dùng trong logic nào |
| RoomAvailability | `rate_plan_open_flag`, `min_los`, `max_los`, `cta_flag`, `ctd_flag`, `last_synced_at` | Không được dùng |
| RoomRate | `available_inventory_count`, `price_source`, `demand_level`, `created_by`, `updated_by` | Không được dùng |
| Hotel | `legal_name`, `opening_date`, `timezone`, `total_floors`, `primary_language_code`, `reservation_email`, `reservation_phone`, `address_line_2`, `postal_code` | Không được dùng |
| HotelPolicy | `refundable_flag` | Không được dùng |
| Promotion | `description` (không có trong schema) | - |
| Payment | `exchange_rate`, `gateway_transaction_id`, `failure_reason` | Không được set |
| Payment | `payment_reference` | Chỉ dùng cho VNPay |

### 4.2 Stored Procedures không được gọi từ backend

| SP | Trạng thái |
|----|------------|
| `sp_LogRateChange` | ✅ Được gọi từ admin rates update |
| `sp_ReserveRoom` | ✅ Được gọi từ POST reservations |
| `sp_CheckIn` | ✅ Được gọi từ POST checkin |
| `sp_CheckOut` | ✅ Được gọi từ POST checkout |
| `sp_GuestCancel` | ✅ Được gọi từ POST guest-cancel |
| `sp_HotelCancel` | ✅ Được gọi từ POST hotel-cancel |
| `sp_TransferRoom` | ✅ Được gọi từ POST transfer |
| `sp_CancelAbandonedReservation` | ✅ Được gọi từ VNPay cleanup |
| `sp_CleanupAbandonedReservations` | ✅ Được gọi từ VNPay cleanup |

### 4.3 Views không được backend sử dụng

| View | Trạng thái |
|------|------------|
| `vw_ReservationTotal` | ✅ Được dùng trong invoices, reservations detail |
| `vw_RevenueByHotel` | ✅ Được dùng trong admin reports |
| `vw_BookingChannelStats` | ❌ **Không được dùng** |
| `vw_LocationTree` | ❌ **Không được dùng** (có thể thay thế bằng locations/tree) |

---

## 5. HƯỚNG TỐI ƯU HÓA

### 5.1 Performance Optimization

#### ✅ **Immediate wins:**
1. **Add database indexes**:
   ```sql
   CREATE INDEX IX_Reservation_guest_id ON Reservation(guest_id) INCLUDE (reservation_status, checkin_date, checkout_date);
   CREATE INDEX IX_ReservationRoom_reservation_id ON ReservationRoom(reservation_id) INCLUDE (room_id, room_type_id);
   CREATE INDEX IX_RoomAvailability_room_date ON RoomAvailability(room_id, stay_date) INCLUDE (availability_status, version_no);
   CREATE INDEX IX_Payment_reservation_id ON Payment(reservation_id) INCLUDE (payment_status, amount);
   ```

2. **Batch sp_ReserveRoom calls**: Tạo SP mới `sp_ReserveRoomBatch` nhận TVP (Table-Valued Parameter) để lock nhiều đêm trong 1 call.

3. **Add pagination to all list endpoints**: `page` và `page_size` params với `OFFSET...FETCH NEXT`.

#### ✅ **Medium-term:**
4. **Implement Redis caching**:
   - Cache hotel list (TTL 5 phút)
   - Cache room availability (TTL 30 giây)
   - Cache promotions list (TTL 10 phút)

5. **Query optimization**: 
   - `GET /api/v1/hotels/:id` - merge SQL queries thành 1-2 queries lớn thay vì 5-6 queries nhỏ
   - Sử dụng `FOR JSON PATH` để SQL Server serialize JSON thay vì JS map

### 5.2 Security Optimization

1. **Input validation middleware**: 
   - Sử dụng `express-validator` hoặc `joi` cho tất cả endpoints
   - Validate types, ranges, formats

2. **SQL Injection protection**: 
   - Hiện tại đã dùng parameterized queries - OK
   - Nhưng cần kiểm tra các chỗ dùng string concatenation (ví dụ: `TOP (${limit})`)

### 5.3 Reliability Optimization

1. **Add transaction retry logic**:
   - Khi gặp deadlock, retry transaction 3 lần với exponential backoff

2. **Add request logging middleware**:
   - Log tất cả requests với duration, status code, user_id

3. **Implement graceful degradation**:
   - Nếu MongoDB down, hotels list vẫn trả về SQL data (không có description/images)
   - Nếu mail service down, booking vẫn thành công (chỉ log lỗi)

### 5.4 Code Quality Optimization

1. **Error handling standardization**:
   - Tạo custom `AppError` class với status code, error code, message
   - Centralized error handler middleware

2. **Response format standardization**:
   ```javascript
   // Thống nhất format:
   { success: true, data: {...} }
   { success: false, error: { code: 'VALIDATION_ERROR', message: '...', details: [...] } }
   ```

3. **Add TypeScript** (long-term):
   - Định nghĩa interfaces cho tất cả models
   - Type-safe database queries

4. **Add unit tests**:
   - Test các helper functions (computePromotionDiscount, generateGuestCode, etc.)
   - Test business logic (cancellation policies, deposit calculation)

### 5.5 Database Schema Optimization

1. **Remove unused columns** (sau khi xác nhận không cần):
   - `Guest.date_of_birth`, `Guest.identity_document_type`, etc.
   - `Reservation.tax_amount`, `Reservation.service_charge_amount`
   - `Room.near_elevator_flag`, `Room.connecting_room_flag`, etc.

2. **Add missing indexes** (xem 5.1)

3. **Add data archival strategy**:
   - Archive reservations > 1 year vào history tables
   - Archive audit logs > 6 months

### 5.6 Frontend Optimization

1. **Add missing admin UIs**:
   - Promotion management (CRUD)
   - Housekeeping dashboard
   - Maintenance ticket management
   - Service catalog management

2. **Add guest self-service UIs**:
   - Profile edit (address, preferences, documents)
   - Loyalty points history & redemption
   - Review submission for completed stays

3. **Performance**:
   - Lazy loading cho admin pages
   - Code splitting cho các route
   - Memoization cho expensive computations

4. **UX improvements**:
   - Add loading skeletons
   - Add error boundaries
   - Add optimistic updates for booking
   - Add confirmation dialogs for destructive actions

---

## 6. TỔNG KẾT MỨC ĐỘ ƯU TIÊN

### 🟡 High (Cần fix trong tuần):
1. Thêm database indexes
2. Batch sp_ReserveRoom calls
3. Pagination cho list endpoints
4. Standardize error response format
5. Thêm validation cho quantity, adult_count, etc.

### 🟢 Medium (Cần fix trong tháng):
1. Redis caching
2. Transaction retry logic
3. Missing admin UIs
4. Guest self-service UIs

### 🔵 Low (Nice to have):
1. TypeScript migration
2. Unit tests
3. Data archival
4. Remove unused columns
5. Optimistic updates trên frontend

---

*Report generated: 30/04/2026*
*Audited by: Cline AI Assistant*
