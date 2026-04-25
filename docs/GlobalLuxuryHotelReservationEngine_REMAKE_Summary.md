# GlobalLuxuryHotelReservationEngine  REMAKE Summary

> **File**: `GlobalLuxuryHotelReservationEngine_REMAKE.groovy`
> **Format**: DBML (dbdiagram.io)  Physical database schema
> **Database**: SQL Server
> **Dong**: ~1387 dong

---

## 1. Muc ich he thong

He thong quan ly at phong khach san cao cap toan cau, ho tro:

- ACID-safe booking & payment transactions
- Quan ly inventory phong vat ly
- Audit thay oi gia (rate change auditing)
- Revenue analytics theo hotel / room / quarter
- Quan ly so thich khach hang luxury & dich vu add-on

---

## 2. Cac thay oi (FIX) so voi ban goc

| FIX | Mo ta | Bang bi anh huong |
------------------------------------------------------------
| **FIX-1** | Xoa `currency_code` trung lap  JOIN tu `Hotel.currency_code` | `HotelAmenity`, `RoomRate`, `ServiceCatalog` |
| **FIX-2** | Xoa `hotel_id` trung lap  JOIN tu bang cha (`RoomRate`, `Room`) | `RateChangeLog`, `InventoryLockLog` |
| **FIX-3** | Financial fields trong `Reservation` nen dung computed/VIEW thay vi luu cung | `Reservation` |
| **FIX-4** | `full_name`  computed column (`CONCAT` + `PERSISTED`) | `Guest` |
| **FIX-5** | Xoa `amenity_name`, `amenity_category`  chuyen sang MongoDB `amenity_master` | `HotelAmenity` |
| **FIX-6** | Xoa `base_description`, boolean features  chuyen sang MongoDB `room_type_catalog` | `RoomType` |
| **FIX-7** | Them bang `Location` cho hierarchy vi tri ia ly (adjacency list + Recursive CTE) | `Location` (NEW), `Hotel` |
| **FIX-8** | Them CHECK constraint: it nhat 1 FK (`room_id` hoac `room_type_id`) phai NOT NULL | `RoomFeature` |

---

## 3. Kien truc Hybrid SQL + MongoDB

### SQL Server giu:
- Du lieu transactional (booking, payment, inventory, rate)
- Operational mappings (hotel-amenity, room-rate)
- Audit & logging

### MongoDB collections:
| Collection | Noi dung |
------------------------------------------------------------
| `Hotel_Catalog` | Rich content, images, embedded amenities & room_types |
| `Amenities` (amenity_master) | Master data: name, category, description, images, tags |
| `Images` | Hotel/room media gallery |
| `guest_profile_projection` | Read-optimized guest profile |
| `review_summary` | Review aggregation |
| `search_audit_log` | Search audit |
| `room_type_catalog` | Room type rich content, features, images |

**Link key giua SQL  MongoDB**: `amenity_code`, `room_type_code`

---

## 4. Danh sach Enums (42 enums)

| Nhom | Enums |
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
| **Location** | `location_type` (NEW  FIX-7) |

---

## 5. Danh sach Tables (30 bang) & Quan he

### 5.1. Hotel Management (Chuoi  Thuong hieu  Khach san)

```
HotelChain (1) < Brand (N)
Brand (1) < Hotel (N)
Location (self-ref) < Hotel (N)     [FIX-7]
Hotel (1) < HotelPolicy (N)
Hotel (1) < HotelAmenity (N)
```

| Bang | PK | Vai tro |
------------------------------------------------------------
| `HotelChain` | `chain_id` | Chuoi khach san (vd: Marriott International) |
| `Brand` | `brand_id` | Thuong hieu con (vd: Ritz-Carlton, W Hotels) |
| `Location` | `location_id` | **[NEW]** Hierarchy vi tri: Region  Country  State  City  District |
| `Hotel` | `hotel_id` | Khach san vat ly. Chua `currency_code` (source of truth cho currency) |
| `HotelPolicy` | `policy_id` | Chinh sach huy phong, tre em, thu cung, v.v. |
| `HotelAmenity` | `hotel_amenity_id` | Mapping amenity  hotel. Rich data o MongoDB |

### 5.2. Room Management

```
Hotel (1) < RoomType (N) < Room (N)
Room (1) < RoomAvailability (N)
RoomFeature > Room | RoomType      [FIX-8] CHECK constraint
Room > Room (self-ref, connecting)
```

| Bang | PK | Vai tro |
------------------------------------------------------------
| `RoomType` | `room_type_id` | Loai phong thuong mai (Deluxe, Suite, Villa...). Rich content o MongoDB |
| `Room` | `room_id` | Phong vat ly, trang thai housekeeping & maintenance |
| `RoomFeature` | `room_feature_id` | Feature gan vao room hoac room_type |
| `RoomAvailability` | `availability_id` | Inventory hang ngay, ho tro pessimistic locking. `hotel_id` giu denormalized |

### 5.3. Rate & Pricing

```
Hotel (1) < RatePlan (N)
RoomType + RatePlan + Date < RoomRate (N)
RoomRate (1) < RateChangeLog (N)     [FIX-2] chi giu FK toi RoomRate
Promotion > Hotel | Brand
```

| Bang | PK | Vai tro |
------------------------------------------------------------
| `RatePlan` | `rate_plan_id` | Ke hoach gia (BAR, Non-refundable, Member, Package...) |
| `RoomRate` | `room_rate_id` | Gia ban hang ngay theo room_type + rate_plan. **Unique**: (room_type_id, rate_plan_id, rate_date) |
| `RateChangeLog` | `rate_change_log_id` | Audit log khi gia thay oi vuot nguong (trigger-populated) |
| `Promotion` | `promotion_id` | Khuyen mai, co the cross-hotel  giu `currency_code` rieng |

### 5.4. Guest Management

```
Guest (1) < GuestAddress (N)
Guest (1) < GuestPreference (N)
Guest (1) < LoyaltyAccount (N) > HotelChain
Guest (1) < PaymentCardToken (N)
```

| Bang | PK | Vai tro |
------------------------------------------------------------
| `Guest` | `guest_id` | Khach hang. `full_name` = computed column [FIX-4] |
| `GuestAddress` | `guest_address_id` | ia chi khach (HOME, WORK, BILLING) |
| `GuestPreference` | `preference_id` | So thich (BED, PILLOW, DIET, VIEW...) |
| `LoyaltyAccount` | `loyalty_account_id` | Tai khoan loyalty, unique per (guest, chain) |
| `PaymentCardToken` | `card_token_id` | Tokenized card cho PCI compliance |

### 5.5. Reservation & Booking

```
Reservation (1) < ReservationRoom (N) > Room, RoomType, RatePlan
Reservation (1) < ReservationGuest (N)
Reservation (1) < ReservationStatusHistory (N)
Reservation (1) < Payment (N)
Reservation (1) < Invoice (N)
Reservation (1) < ReservationService (N) > ServiceCatalog
ReservationRoom (1) < StayRecord (1)
```

| Bang | PK | Vai tro |
------------------------------------------------------------
| `BookingChannel` | `booking_channel_id` | Kenh at phong (DIRECT, OTA, GDS, CORPORATE...) |
| `Reservation` | `reservation_id` | Header at phong. Financial fields nen dung VIEW [FIX-3] |
| `ReservationRoom` | `reservation_room_id` | Line item phong trong reservation |
| `ReservationGuest` | `reservation_guest_id` | Khach trong booking, `full_name` = snapshot |
| `ReservationStatusHistory` | `status_history_id` | Lich su thay oi trang thai |
| `Payment` | `payment_id` | Giao dich thanh toan. `currency_code` = snapshot |
| `Invoice` | `invoice_id` | Hoa on. `currency_code` = snapshot |
| `ServiceCatalog` | `service_id` | Danh muc dich vu add-on (SPA, BUTLER, YACHT...) |
| `ReservationService` | `reservation_service_id` | Dich vu a at trong reservation |
| `StayRecord` | `stay_id` | Record luu tru thuc te (checkin/checkout thuc) |

### 5.6. Operations

| Bang | PK | Vai tro |
------------------------------------------------------------
| `HousekeepingTask` | `hk_task_id` | Task don phong. `hotel_id` giu denormalized |
| `MaintenanceTicket` | `maintenance_ticket_id` | Ticket bao tri |

### 5.7. System & Audit

```
SystemUser (1) < UserRole (N) > Role
```

| Bang | PK | Vai tro |
------------------------------------------------------------
| `SystemUser` | `user_id` | Nguoi dung he thong (staff) |
| `Role` | `role_id` | Vai tro (RBAC) |
| `UserRole` | `user_role_id` | Mapping user  role |
| `InventoryLockLog` | `lock_log_id` | Log pessimistic lock cho concurrency [FIX-2] |
| `AuditLog` | `audit_log_id` | Audit log tong quat (entity-level) |

---

## 6. Nguyen tac thiet ke quan trong

1. **Denormalization co chu ich**: Mot so bang giu `hotel_id` denormalized cho performance query (vd: `RoomAvailability`, `HousekeepingTask`). Cac truong nay uoc ghi chu ro rang.

2. **Snapshot fields**: Cac truong `currency_code` trong `Reservation`, `Payment`, `Invoice`, `ReservationGuest.full_name` la **snapshot tai thoi iem giao dich**  giu nguyen, khong normalize.

3. **Link key SQL  MongoDB**: Dung `amenity_code` va `room_type_code` lam key lien ket giua SQL operational data va MongoDB rich content.

4. **Pessimistic locking**: `RoomAvailability` + `InventoryLockLog` ho tro concurrency control cho booking.

5. **Computed columns**: `Guest.full_name` la computed + PERSISTED thay vi stored field.

6. **Recursive CTE**: Bang `Location` dung adjacency list (self-referencing FK) ho tro query hierarchy vung/quoc gia/thanh pho.

---

## 7. Quan he FK chinh (tom tat)

```
HotelChain  Brand  Hotel  Location (FIX-7)
Hotel  HotelPolicy, HotelAmenity, RoomType, Room, RatePlan,
          RoomRate, Reservation, ServiceCatalog, HousekeepingTask,
          MaintenanceTicket, SystemUser

Guest  GuestAddress, GuestPreference, LoyaltyAccount,
          PaymentCardToken, Reservation, ReservationGuest

Reservation  ReservationRoom, ReservationGuest,
                ReservationStatusHistory, Payment, Invoice,
                ReservationService

ReservationRoom  StayRecord

RoomRate  RateChangeLog (FIX-2: chi FK nay)

SystemUser  UserRole, RoomRate (created_by/updated_by),
               RateChangeLog, ReservationStatusHistory,
               StayRecord, HousekeepingTask, MaintenanceTicket,
               AuditLog
```

---

## 8. Luu y khi implement

- **Currency**: Luon JOIN `Hotel.currency_code` cho cac bang operational. Chi giu `currency_code` rieng khi la snapshot (Payment, Invoice) hoac cross-hotel (Promotion).
- **FIX-3 VIEW**: Nen tao `vw_ReservationTotal` e tinh financial totals tu `ReservationRoom` thay vi luu cung trong `Reservation`.
- **MongoDB integration**: Can API layer hoac service layer e merge SQL operational data + MongoDB rich content khi tra ve cho client.
- **RoomFeature CHECK**: Can chay `ALTER TABLE RoomFeature ADD CONSTRAINT CK_RoomFeature_AtLeastOneFK CHECK (room_id IS NOT NULL OR room_type_id IS NOT NULL);`
- **Guest computed column**: Can chay `ALTER TABLE Guest ADD full_name AS (CONCAT(...)) PERSISTED;`
