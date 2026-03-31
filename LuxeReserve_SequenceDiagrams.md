# LuxeReserve — Sequence Diagrams (Core Flows)

> **Source**: `GlobalLuxuryHotelReservationEngine_REMAKE.groovy`
> **Chỉ tập trung 4 flow cốt lõi** — bỏ qua các flow phụ (CRUD cơ bản, profile update, v.v.)

---

## Flow 1: Room Reservation — Pessimistic Locking (Core)

> **Đây là flow quan trọng nhất** — thể hiện ACID transaction, pessimistic locking chống double-booking, và tương tác Hybrid SQL + MongoDB.

```mermaid
sequenceDiagram
    actor Guest
    participant Web as Web / Mobile App
    participant API as API Service Layer
    participant Mongo as MongoDB<br/>Hotel_Catalog
    participant SQL as SQL Server
    participant RA as RoomAvailability
    participant Lock as InventoryLockLog

    Note over Guest, Lock: ═══ PHASE 1: Search & Browse (Read-heavy → MongoDB) ═══

    Guest->>Web: Tìm phòng (city, dates, guests)
    Web->>API: GET /hotels?city=HCMC&checkin=...
    API->>Mongo: db.Hotel_Catalog.find({<br/>"location.city": "Ho Chi Minh City"})
    Mongo-->>API: Hotel list + embedded amenities,<br/>room_types, images
    API-->>Web: Danh sách hotel + rich content
    Web-->>Guest: Hiển thị hotel cards

    Guest->>Web: Chọn hotel → xem room types
    Web->>API: GET /hotels/1/rooms?dates=...
    API->>SQL: SELECT rt.*, rr.final_rate<br/>FROM RoomType rt<br/>JOIN RoomRate rr ON ...<br/>WHERE hotel_id = 1
    SQL-->>API: Operational data (rate, availability)
    API->>Mongo: db.Hotel_Catalog.findOne({hotel_id: 1},<br/>{room_types: 1})
    Mongo-->>API: Rich content (descriptions, features, images)
    API->>API: Merge SQL rates + MongoDB content
    API-->>Web: Room types + giá + ảnh + features
    Web-->>Guest: Hiển thị danh sách phòng

    Note over Guest, Lock: ═══ PHASE 2: Booking (ACID → SQL Server + Pessimistic Lock) ═══

    Guest->>Web: Chọn phòng → "Đặt ngay"
    Web->>API: POST /reservations<br/>{room_id, dates, guest_info, payment}

    API->>SQL: BEGIN TRANSACTION

    rect rgb(255, 235, 235)
        Note over API, Lock: 🔒 PESSIMISTIC LOCKING — Chống Double-Booking

        API->>RA: SELECT availability_status<br/>FROM RoomAvailability<br/>WITH (UPDLOCK, HOLDLOCK)<br/>WHERE room_id=101 AND stay_date='2026-04-15'

        Note right of RA: ⚠️ Transaction khác<br/>sẽ BỊ BLOCK tại đây<br/>cho đến khi COMMIT/ROLLBACK

        RA-->>API: status = 'OPEN' ✅
    end

    API->>SQL: INSERT Reservation (header)
    SQL-->>API: reservation_id = 5001

    API->>SQL: INSERT ReservationRoom<br/>(reservation_id=5001, room_id=101,<br/>rate_snapshot=2500000)
    API->>SQL: INSERT ReservationGuest<br/>(full_name snapshot)

    API->>RA: UPDATE RoomAvailability<br/>SET status='BOOKED', sellable_flag=0,<br/>version_no = version_no + 1
    API->>Lock: INSERT InventoryLockLog<br/>(status='SUCCESS', session_id=...)

    API->>SQL: INSERT ReservationStatusHistory<br/>(PENDING → CONFIRMED)

    Note over Guest, Lock: ═══ PHASE 3: Payment ═══

    API->>SQL: INSERT Payment<br/>(type=DEPOSIT, status=INITIATED,<br/>currency_code snapshot)
    API-->>Web: payment_url (redirect to gateway)
    Web->>Guest: Redirect → Payment Gateway

    Guest->>Web: Thanh toán thành công
    Web->>API: Payment callback (success)
    API->>SQL: UPDATE Payment<br/>SET status='CAPTURED', paid_at=NOW()
    API->>SQL: UPDATE Reservation<br/>SET status='CONFIRMED'

    API->>SQL: COMMIT TRANSACTION ✅
    API-->>Web: Reservation confirmed
    Web-->>Guest: 🎉 Xác nhận đặt phòng<br/>Mã: RES-20260415-001
```

---

## Flow 2: Check-in & Check-out

> Thể hiện lifecycle phòng: Reservation → StayRecord → HousekeepingTask → Available lại.

```mermaid
sequenceDiagram
    actor Guest
    participant FD as Front Desk Agent<br/>(SystemUser)
    participant SQL as SQL Server
    participant Room as Room Table
    participant Stay as StayRecord
    participant HK as HousekeepingTask
    participant Audit as AuditLog

    Note over Guest, Audit: ═══ CHECK-IN FLOW ═══

    Guest->>FD: Đến quầy lễ tân, trình booking code

    FD->>SQL: SELECT r.*, rr.*, g.full_name<br/>FROM Reservation r<br/>JOIN ReservationRoom rr ON ...<br/>JOIN Guest g ON ...<br/>WHERE reservation_code = 'RES-...'<br/>AND status = 'CONFIRMED'
    SQL-->>FD: Reservation details + guest preferences

    FD->>SQL: SELECT preference_value<br/>FROM GuestPreference<br/>WHERE guest_id = @gid
    SQL-->>FD: Sở thích: KING bed, high floor, ocean view

    FD->>SQL: BEGIN TRANSACTION

    FD->>SQL: UPDATE ReservationRoom<br/>SET room_id = 1501,<br/>assignment_status = 'ASSIGNED',<br/>occupancy_status = 'IN_HOUSE'

    FD->>Room: UPDATE Room<br/>SET room_status = 'OCCUPIED'<br/>WHERE room_id = 1501

    FD->>Stay: INSERT StayRecord<br/>(reservation_room_id, actual_checkin_at=NOW(),<br/>frontdesk_agent_id, stay_status='IN_HOUSE')

    FD->>SQL: UPDATE Reservation<br/>SET status = 'CHECKED_IN'
    FD->>SQL: INSERT ReservationStatusHistory<br/>(CONFIRMED → CHECKED_IN)

    FD->>Audit: INSERT AuditLog<br/>(entity='Reservation', action='STATUS_CHANGE')

    FD->>SQL: COMMIT ✅

    FD-->>Guest: 🔑 Chào mừng!<br/>Phòng 1501, tầng 15

    Note over Guest, Audit: ═══ DURING STAY — Add-on Services ═══

    Guest->>FD: Đặt dịch vụ Spa
    FD->>SQL: INSERT ReservationService<br/>(service_id → SPA, quantity=2,<br/>scheduled_at, status='REQUESTED')
    SQL-->>FD: Done
    FD-->>Guest: Spa đã book lúc 3PM ✅

    Note over Guest, Audit: ═══ CHECK-OUT FLOW ═══

    Guest->>FD: Check-out

    FD->>SQL: BEGIN TRANSACTION

    FD->>Stay: UPDATE StayRecord<br/>SET actual_checkout_at = NOW(),<br/>stay_status = 'COMPLETED'

    FD->>SQL: SELECT grand_total, balance_due<br/>FROM vw_ReservationTotal<br/>WHERE reservation_id = 5001
    SQL-->>FD: grand_total=8,500,000 VND<br/>balance_due=6,000,000 VND

    FD->>SQL: INSERT Payment<br/>(FULL_PAYMENT, 6000000, CAPTURED)

    FD->>SQL: INSERT Invoice<br/>(FINAL, currency snapshot, total snapshot)

    FD->>SQL: UPDATE ReservationRoom<br/>SET occupancy_status = 'COMPLETED'
    FD->>SQL: UPDATE Reservation<br/>SET status = 'CHECKED_OUT'
    FD->>SQL: INSERT ReservationStatusHistory<br/>(CHECKED_IN → CHECKED_OUT)

    FD->>Room: UPDATE Room<br/>SET room_status = 'AVAILABLE',<br/>housekeeping_status = 'DIRTY'

    FD->>HK: INSERT HousekeepingTask<br/>(room_id=1501, task_type='CLEANING',<br/>priority='HIGH')

    FD->>SQL: COMMIT ✅

    FD-->>Guest: 🧾 Hóa đơn + Thank you!
```

---

## Flow 3: Rate Update — Price Integrity Guard (Trigger)

> Thể hiện cách Trigger tự động bảo vệ tính toàn vẹn giá khi Revenue Manager cập nhật rate.

```mermaid
sequenceDiagram
    actor RM as Revenue Manager<br/>(SystemUser)
    participant App as Admin Dashboard
    participant SQL as SQL Server
    participant RR as RoomRate Table
    participant TRG as AFTER UPDATE Trigger<br/>trg_PriceIntegrityGuard
    participant RCL as RateChangeLog
    participant Notify as Review Alert

    RM->>App: Cập nhật giá phòng Deluxe<br/>từ 2,000,000 → 5,000,000 VND<br/>(tăng 150%)

    App->>SQL: UPDATE RoomRate<br/>SET final_rate = 5000000,<br/>price_source = 'MANUAL',<br/>updated_by = @rm_user_id<br/>WHERE room_rate_id = 42

    Note over SQL, TRG: SQL Server tự động fire Trigger

    SQL->>TRG: AFTER UPDATE fired

    TRG->>TRG: Đọc INSERTED (new) vs DELETED (old)<br/>old = 2,000,000<br/>new = 5,000,000<br/>change = |5M - 2M| / 2M = 150%

    alt change_percent > 50%
        rect rgb(255, 220, 220)
            TRG->>TRG: 🚨 VƯỢT NGƯỠNG 50%!

            TRG->>RCL: INSERT RateChangeLog<br/>(room_rate_id=42,<br/>old_rate=2000000,<br/>new_rate=5000000,<br/>change_percent=150.00,<br/>severity='CRITICAL',<br/>review_status='OPEN')

            TRG->>Notify: Flag for review
        end

        RCL-->>TRG: Log saved ✅
        TRG-->>SQL: Trigger completed
    else change_percent <= 50%
        TRG->>TRG: Trong ngưỡng cho phép → Bỏ qua
        TRG-->>SQL: No action needed
    end

    SQL-->>App: UPDATE successful
    App-->>RM: ⚠️ Giá đã cập nhật<br/>Cảnh báo: Thay đổi 150% đã được<br/>ghi log và chờ review

    Note over RM, Notify: Supervisor review sau đó

    RM->>App: Mở RateChangeLog để review
    App->>SQL: SELECT * FROM RateChangeLog<br/>WHERE review_status = 'OPEN'<br/>AND severity_level = 'CRITICAL'
    SQL-->>App: 1 alert: room_rate_id=42, +150%
    RM->>App: Acknowledge → đóng review
    App->>SQL: UPDATE RateChangeLog<br/>SET review_status = 'ACKNOWLEDGED'
```

---

## Flow 4: Double-Booking Race Condition (Concurrency Defense)

> Thể hiện **2 transactions đồng thời** cùng đặt 1 phòng — chỉ 1 thành công nhờ Pessimistic Locking.

```mermaid
sequenceDiagram
    participant A as 👤 Transaction A<br/>(Guest Alice)
    participant SQL as SQL Server<br/>RoomAvailability
    participant Lock as InventoryLockLog
    participant B as 👤 Transaction B<br/>(Guest Bob)

    Note over A, B: Room 101 → ngày 15/04 → status = OPEN<br/>Alice và Bob đặt ĐỒNG THỜI

    A->>SQL: BEGIN TRAN A
    B->>SQL: BEGIN TRAN B

    A->>SQL: SELECT ... FROM RoomAvailability<br/>WITH (UPDLOCK, HOLDLOCK)<br/>WHERE room_id=101 AND stay_date='04-15'

    Note over A, SQL: ✅ Alice lấy UPDLOCK thành công<br/>Đọc status = 'OPEN'

    B->>SQL: SELECT ... FROM RoomAvailability<br/>WITH (UPDLOCK, HOLDLOCK)<br/>WHERE room_id=101 AND stay_date='04-15'

    Note over SQL, B: ⏳ Bob BỊ BLOCK!<br/>UPDLOCK đã bị Alice giữ<br/>Bob phải CHỜ...

    A->>SQL: UPDATE RoomAvailability<br/>SET status = 'BOOKED',<br/>sellable_flag = 0
    A->>Lock: INSERT InventoryLockLog<br/>(status = 'SUCCESS')
    A->>SQL: COMMIT TRAN A ✅

    Note over A, SQL: Alice xong → Giải phóng lock

    Note over SQL, B: 🔓 Lock released!<br/>Bob được tiếp tục

    SQL-->>B: Bob đọc được:<br/>status = 'BOOKED' ❌

    B->>B: status ≠ 'OPEN' → REJECTED!

    B->>Lock: INSERT InventoryLockLog<br/>(status = 'FAILED',<br/>note = 'Room not available')
    B->>SQL: ROLLBACK TRAN B ❌

    Note over A, B: ✅ KẾT QUẢ: Alice đặt thành công<br/>❌ Bob bị từ chối → KHÔNG CÓ Double-Booking

    rect rgb(230, 245, 230)
        Note over A, B: 🛡️ UPDLOCK + HOLDLOCK = Serialized access<br/>trên cùng 1 row → Race Condition eliminated
    end
```

---

## Tổng hợp: Ma trận Flow ↔ Tables ↔ Kỹ thuật

| Flow | Tables chính | Kỹ thuật nổi bật |
|------|-------------|------------------|
| **1. Reservation** | RoomAvailability, Reservation, ReservationRoom, ReservationGuest, Payment, InventoryLockLog | Pessimistic Lock (`UPDLOCK + HOLDLOCK`), ACID Transaction, Hybrid SQL+MongoDB merge |
| **2. Check-in/out** | Reservation, ReservationRoom, StayRecord, Room, HousekeepingTask, Invoice, vw_ReservationTotal | Status lifecycle, VIEW tính toán tài chính, auto-create HK task |
| **3. Rate Guard** | RoomRate, RateChangeLog | AFTER UPDATE Trigger, `INSERTED`/`DELETED` virtual tables, TRY...CATCH |
| **4. Double-Booking** | RoomAvailability, InventoryLockLog | Pessimistic Locking, Race Condition defense, concurrent transactions |
