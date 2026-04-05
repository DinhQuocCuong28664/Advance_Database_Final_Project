# GlobalLuxuryHotelReservationEngine — REMAKE Summary

> **File**: `GlobalLuxuryHotelReservationEngine_REMAKE.groovy`
> **Format**: DBML (dbdiagram.io) — Physical database schema
> **Database**: SQL Server
> **Dòng**: ~1387 dòng

---

## 1. Mục đích hệ thống

Hệ thống quản lý đặt phòng khách sạn cao cấp toàn cầu, hỗ trợ:

- ACID-safe booking & payment transactions
- Quản lý inventory phòng vật lý
- Audit thay đổi giá (rate change auditing)
- Revenue analytics theo hotel / room / quarter
- Quản lý sở thích khách hàng luxury & dịch vụ add-on

---

## 2. Các thay đổi (FIX) so với bản gốc

| FIX | Mô tả | Bảng bị ảnh hưởng |
|-----|--------|-------------------|
| **FIX-1** | Xóa `currency_code` trùng lắp → JOIN từ `Hotel.currency_code` | `HotelAmenity`, `RoomRate`, `ServiceCatalog` |
| **FIX-2** | Xóa `hotel_id` trùng lắp → JOIN từ bảng cha (`RoomRate`, `Room`) | `RateChangeLog`, `InventoryLockLog` |
| **FIX-3** | Financial fields trong `Reservation` nên dùng computed/VIEW thay vì lưu cứng | `Reservation` |
| **FIX-4** | `full_name` → computed column (`CONCAT` + `PERSISTED`) | `Guest` |
| **FIX-5** | Xóa `amenity_name`, `amenity_category` → chuyển sang MongoDB `amenity_master` | `HotelAmenity` |
| **FIX-6** | Xóa `base_description`, boolean features → chuyển sang MongoDB `room_type_catalog` | `RoomType` |
| **FIX-7** | Thêm bảng `Location` cho hierarchy vị trí địa lý (adjacency list + Recursive CTE) | `Location` (NEW), `Hotel` |
| **FIX-8** | Thêm CHECK constraint: ít nhất 1 FK (`room_id` hoặc `room_type_id`) phải NOT NULL | `RoomFeature` |

---

## 3. Kiến trúc Hybrid SQL + MongoDB

### SQL Server giữ:
- Dữ liệu transactional (booking, payment, inventory, rate)
- Operational mappings (hotel-amenity, room-rate)
- Audit & logging

### MongoDB collections:
| Collection | Nội dung |
|-----------|---------|
| `Hotel_Catalog` | Rich content, images, embedded amenities & room_types |
| `Amenities` (amenity_master) | Master data: name, category, description, images, tags |
| `Images` | Hotel/room media gallery |
| `guest_profile_projection` | Read-optimized guest profile |
| `review_summary` | Review aggregation |
| `search_audit_log` | Search audit |
| `room_type_catalog` | Room type rich content, features, images |

**Link key giữa SQL ↔ MongoDB**: `amenity_code`, `room_type_code`

---

## 4. Danh sách Enums (42 enums)

| Nhóm | Enums |
|------|-------|
| **Hotel** | `hotel_status`, `hotel_type`, `luxury_segment`, `brand_status` |
| **Room** | `room_category`, `bed_type`, `view_type`, `room_status`, `housekeeping_status`, `maintenance_status`, `availability_status` |
| **Policy & Amenity** | `policy_status`, `amenity_category` |
| **Rate & Pricing** | `rate_plan_type`, `meal_inclusion`, `demand_level`, `price_source`, `pricing_model` |
| **Alert & Review** | `severity_level`, `review_status` |
| **Guest** | `guest_gender`, `address_type`, `preference_type`, `priority_level`, `loyalty_tier_code`, `loyalty_status` |
| **Booking** | `booking_source`, `reservation_status`, `guarantee_type`, `purpose_of_stay`, `assignment_status`, `occupancy_status`, `age_category`, `channel_type` |
| **Payment** | `payment_type`, `payment_method`, `payment_status`, `invoice_type`, `invoice_status` |
| **Service** | `service_category`, `service_status` |
| **Operations** | `stay_status`, `hk_task_type`, `hk_task_status`, `ticket_status` |
| **System** | `account_status`, `department_code`, `lock_status`, `audit_action_type` |
| **Location** | `location_type` (NEW — FIX-7) |

---

## 5. Danh sách Tables (30 bảng) & Quan hệ

### 5.1. Hotel Management (Chuỗi → Thương hiệu → Khách sạn)

```
HotelChain (1) ──< Brand (N)
Brand (1) ──< Hotel (N)
Location (self-ref) ──< Hotel (N)    ← [FIX-7]
Hotel (1) ──< HotelPolicy (N)
Hotel (1) ──< HotelAmenity (N)
```

| Bảng | PK | Vai trò |
|------|-----|---------|
| `HotelChain` | `chain_id` | Chuỗi khách sạn (vd: Marriott International) |
| `Brand` | `brand_id` | Thương hiệu con (vd: Ritz-Carlton, W Hotels) |
| `Location` | `location_id` | **[NEW]** Hierarchy vị trí: Region → Country → State → City → District |
| `Hotel` | `hotel_id` | Khách sạn vật lý. Chứa `currency_code` (source of truth cho currency) |
| `HotelPolicy` | `policy_id` | Chính sách hủy phòng, trẻ em, thú cưng, v.v. |
| `HotelAmenity` | `hotel_amenity_id` | Mapping amenity ↔ hotel. Rich data ở MongoDB |

### 5.2. Room Management

```
Hotel (1) ──< RoomType (N) ──< Room (N)
Room (1) ──< RoomAvailability (N)
RoomFeature ──> Room | RoomType     ← [FIX-8] CHECK constraint
Room ──> Room (self-ref, connecting)
```

| Bảng | PK | Vai trò |
|------|-----|---------|
| `RoomType` | `room_type_id` | Loại phòng thương mại (Deluxe, Suite, Villa...). Rich content ở MongoDB |
| `Room` | `room_id` | Phòng vật lý, trạng thái housekeeping & maintenance |
| `RoomFeature` | `room_feature_id` | Feature gắn vào room hoặc room_type |
| `RoomAvailability` | `availability_id` | Inventory hàng ngày, hỗ trợ pessimistic locking. `hotel_id` giữ denormalized |

### 5.3. Rate & Pricing

```
Hotel (1) ──< RatePlan (N)
RoomType + RatePlan + Date ──< RoomRate (N)
RoomRate (1) ──< RateChangeLog (N)    ← [FIX-2] chỉ giữ FK tới RoomRate
Promotion ──> Hotel | Brand
```

| Bảng | PK | Vai trò |
|------|-----|---------|
| `RatePlan` | `rate_plan_id` | Kế hoạch giá (BAR, Non-refundable, Member, Package...) |
| `RoomRate` | `room_rate_id` | Giá bán hàng ngày theo room_type + rate_plan. **Unique**: (room_type_id, rate_plan_id, rate_date) |
| `RateChangeLog` | `rate_change_log_id` | Audit log khi giá thay đổi vượt ngưỡng (trigger-populated) |
| `Promotion` | `promotion_id` | Khuyến mãi, có thể cross-hotel → giữ `currency_code` riêng |

### 5.4. Guest Management

```
Guest (1) ──< GuestAddress (N)
Guest (1) ──< GuestPreference (N)
Guest (1) ──< LoyaltyAccount (N) ──> HotelChain
Guest (1) ──< PaymentCardToken (N)
```

| Bảng | PK | Vai trò |
|------|-----|---------|
| `Guest` | `guest_id` | Khách hàng. `full_name` = computed column [FIX-4] |
| `GuestAddress` | `guest_address_id` | Địa chỉ khách (HOME, WORK, BILLING) |
| `GuestPreference` | `preference_id` | Sở thích (BED, PILLOW, DIET, VIEW...) |
| `LoyaltyAccount` | `loyalty_account_id` | Tài khoản loyalty, unique per (guest, chain) |
| `PaymentCardToken` | `card_token_id` | Tokenized card cho PCI compliance |

### 5.5. Reservation & Booking

```
Reservation (1) ──< ReservationRoom (N) ──> Room, RoomType, RatePlan
Reservation (1) ──< ReservationGuest (N)
Reservation (1) ──< ReservationStatusHistory (N)
Reservation (1) ──< Payment (N)
Reservation (1) ──< Invoice (N)
Reservation (1) ──< ReservationService (N) ──> ServiceCatalog
ReservationRoom (1) ──< StayRecord (1)
```

| Bảng | PK | Vai trò |
|------|-----|---------|
| `BookingChannel` | `booking_channel_id` | Kênh đặt phòng (DIRECT, OTA, GDS, CORPORATE...) |
| `Reservation` | `reservation_id` | Header đặt phòng. Financial fields nên dùng VIEW [FIX-3] |
| `ReservationRoom` | `reservation_room_id` | Line item phòng trong reservation |
| `ReservationGuest` | `reservation_guest_id` | Khách trong booking, `full_name` = snapshot |
| `ReservationStatusHistory` | `status_history_id` | Lịch sử thay đổi trạng thái |
| `Payment` | `payment_id` | Giao dịch thanh toán. `currency_code` = snapshot |
| `Invoice` | `invoice_id` | Hóa đơn. `currency_code` = snapshot |
| `ServiceCatalog` | `service_id` | Danh mục dịch vụ add-on (SPA, BUTLER, YACHT...) |
| `ReservationService` | `reservation_service_id` | Dịch vụ đã đặt trong reservation |
| `StayRecord` | `stay_id` | Record lưu trú thực tế (checkin/checkout thực) |

### 5.6. Operations

| Bảng | PK | Vai trò |
|------|-----|---------|
| `HousekeepingTask` | `hk_task_id` | Task dọn phòng. `hotel_id` giữ denormalized |
| `MaintenanceTicket` | `maintenance_ticket_id` | Ticket bảo trì |

### 5.7. System & Audit

```
SystemUser (1) ──< UserRole (N) ──> Role
```

| Bảng | PK | Vai trò |
|------|-----|---------|
| `SystemUser` | `user_id` | Người dùng hệ thống (staff) |
| `Role` | `role_id` | Vai trò (RBAC) |
| `UserRole` | `user_role_id` | Mapping user ↔ role |
| `InventoryLockLog` | `lock_log_id` | Log pessimistic lock cho concurrency [FIX-2] |
| `AuditLog` | `audit_log_id` | Audit log tổng quát (entity-level) |

---

## 6. Nguyên tắc thiết kế quan trọng

1. **Denormalization có chủ đích**: Một số bảng giữ `hotel_id` denormalized cho performance query (vd: `RoomAvailability`, `HousekeepingTask`). Các trường này được ghi chú rõ ràng.

2. **Snapshot fields**: Các trường `currency_code` trong `Reservation`, `Payment`, `Invoice`, `ReservationGuest.full_name` là **snapshot tại thời điểm giao dịch** — giữ nguyên, không normalize.

3. **Link key SQL ↔ MongoDB**: Dùng `amenity_code` và `room_type_code` làm key liên kết giữa SQL operational data và MongoDB rich content.

4. **Pessimistic locking**: `RoomAvailability` + `InventoryLockLog` hỗ trợ concurrency control cho booking.

5. **Computed columns**: `Guest.full_name` là computed + PERSISTED thay vì stored field.

6. **Recursive CTE**: Bảng `Location` dùng adjacency list (self-referencing FK) hỗ trợ query hierarchy vùng/quốc gia/thành phố.

---

## 7. Quan hệ FK chính (tóm tắt)

```
HotelChain ←── Brand ←── Hotel ←── Location (FIX-7)
Hotel ←── HotelPolicy, HotelAmenity, RoomType, Room, RatePlan,
          RoomRate, Reservation, ServiceCatalog, HousekeepingTask,
          MaintenanceTicket, SystemUser

Guest ←── GuestAddress, GuestPreference, LoyaltyAccount,
          PaymentCardToken, Reservation, ReservationGuest

Reservation ←── ReservationRoom, ReservationGuest,
                ReservationStatusHistory, Payment, Invoice,
                ReservationService

ReservationRoom ←── StayRecord

RoomRate ←── RateChangeLog (FIX-2: chỉ FK này)

SystemUser ←── UserRole, RoomRate (created_by/updated_by),
               RateChangeLog, ReservationStatusHistory,
               StayRecord, HousekeepingTask, MaintenanceTicket,
               AuditLog
```

---

## 8. Lưu ý khi implement

- **Currency**: Luôn JOIN `Hotel.currency_code` cho các bảng operational. Chỉ giữ `currency_code` riêng khi là snapshot (Payment, Invoice) hoặc cross-hotel (Promotion).
- **FIX-3 VIEW**: Nên tạo `vw_ReservationTotal` để tính financial totals từ `ReservationRoom` thay vì lưu cứng trong `Reservation`.
- **MongoDB integration**: Cần API layer hoặc service layer để merge SQL operational data + MongoDB rich content khi trả về cho client.
- **RoomFeature CHECK**: Cần chạy `ALTER TABLE RoomFeature ADD CONSTRAINT CK_RoomFeature_AtLeastOneFK CHECK (room_id IS NOT NULL OR room_type_id IS NOT NULL);`
- **Guest computed column**: Cần chạy `ALTER TABLE Guest ADD full_name AS (CONCAT(...)) PERSISTED;`
