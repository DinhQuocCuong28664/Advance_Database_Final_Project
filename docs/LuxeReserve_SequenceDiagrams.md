# LuxeReserve  Sequence Diagrams (Core Flows)

> **Source**: `GlobalLuxuryHotelReservationEngine_REMAKE.groovy`
> **Chi tap trung 4 flow cot loi**  bo qua cac flow phu (CRUD co ban, profile update, v.v.)

---

## Flow 1: Room Reservation  Pessimistic Locking (Core)

> **ay la flow quan trong nhat**  the hien ACID transaction, pessimistic locking chong double-booking, va tuong tac Hybrid SQL + MongoDB.

```mermaid
sequenceDiagram
    actor Guest
    participant Web as Web / Mobile App
    participant API as API Service Layer
    participant Mongo as MongoDB<br/>Hotel_Catalog
    participant SQL as SQL Server
    participant RA as RoomAvailability
    participant Lock as InventoryLockLog

    Note over Guest, Lock:  PHASE 1: Search & Browse (Read-heavy  MongoDB) 

    Guest->>Web: Tim phong (city, dates, guests)
    Web->>API: GET /hotels->city=HCMC&checkin=...
    API->>Mongo: db.Hotel_Catalog.find({<br/>"location.city": "Ho Chi Minh City"})
    Mongo-->>API: Hotel list + embedded amenities,<br/>room_types, images
    API-->>Web: Danh sach hotel + rich content
    Web-->>Guest: Hien thi hotel cards

    Guest->>Web: Chon hotel  xem room types
    Web->>API: GET /hotels/1/rooms->dates=...
    API->>SQL: SELECT rt.*, rr.final_rate<br/>FROM RoomType rt<br/>JOIN RoomRate rr ON ...<br/>WHERE hotel_id = 1
    SQL-->>API: Operational data (rate, availability)
    API->>Mongo: db.Hotel_Catalog.findOne({hotel_id: 1},<br/>{room_types: 1})
    Mongo-->>API: Rich content (descriptions, features, images)
    API->>API: Merge SQL rates + MongoDB content
    API-->>Web: Room types + gia + anh + features
    Web-->>Guest: Hien thi danh sach phong

    Note over Guest, Lock:  PHASE 2: Booking (ACID  SQL Server + Pessimistic Lock) 

    Guest->>Web: Chon phong  "at ngay"
    Web->>API: POST /reservations<br/>{room_id, dates, guest_info, payment}

    API->>SQL: BEGIN TRANSACTION

    rect rgb(255, 235, 235)
        Note over API, Lock:  PESSIMISTIC LOCKING  Chong Double-Booking

        API->>RA: SELECT availability_status<br/>FROM RoomAvailability<br/>WITH (UPDLOCK, HOLDLOCK)<br/>WHERE room_id=101 AND stay_date='2026-04-15'

        Note right of RA:  Transaction khac<br/>se BI BLOCK tai ay<br/>cho en khi COMMIT/ROLLBACK

        RA-->>API: status = 'OPEN' 
    end

    API->>SQL: INSERT Reservation (header)
    SQL-->>API: reservation_id = 5001

    API->>SQL: INSERT ReservationRoom<br/>(reservation_id=5001, room_id=101,<br/>rate_snapshot=2500000)
    API->>SQL: INSERT ReservationGuest<br/>(full_name snapshot)

    API->>RA: UPDATE RoomAvailability<br/>SET status='BOOKED', sellable_flag=0,<br/>version_no = version_no + 1
    API->>Lock: INSERT InventoryLockLog<br/>(status='SUCCESS', session_id=...)

    API->>SQL: INSERT ReservationStatusHistory<br/>(PENDING  CONFIRMED)

    Note over Guest, Lock:  PHASE 3: Payment 

    API->>SQL: INSERT Payment<br/>(type=DEPOSIT, status=INITIATED,<br/>currency_code snapshot)
    API-->>Web: payment_url (redirect to gateway)
    Web->>Guest: Redirect  Payment Gateway

    Guest->>Web: Thanh toan thanh cong
    Web->>API: Payment callback (success)
    API->>SQL: UPDATE Payment<br/>SET status='CAPTURED', paid_at=NOW()
    API->>SQL: UPDATE Reservation<br/>SET status='CONFIRMED'

    API->>SQL: COMMIT TRANSACTION 
    API-->>Web: Reservation confirmed
    Web-->>Guest:  Xac nhan at phong<br/>Ma: RES-20260415-001
```

---

## Flow 2: Check-in & Check-out

> The hien lifecycle phong: Reservation  StayRecord  HousekeepingTask  Available lai.

```mermaid
sequenceDiagram
    actor Guest
    participant FD as Front Desk Agent<br/>(SystemUser)
    participant SQL as SQL Server
    participant Room as Room Table
    participant Stay as StayRecord
    participant HK as HousekeepingTask
    participant Audit as AuditLog

    Note over Guest, Audit:  CHECK-IN FLOW 

    Guest->>FD: en quay le tan, trinh booking code

    FD->>SQL: SELECT r.*, rr.*, g.full_name<br/>FROM Reservation r<br/>JOIN ReservationRoom rr ON ...<br/>JOIN Guest g ON ...<br/>WHERE reservation_code = 'RES-...'<br/>AND status = 'CONFIRMED'
    SQL-->>FD: Reservation details + guest preferences

    FD->>SQL: SELECT preference_value<br/>FROM GuestPreference<br/>WHERE guest_id = @gid
    SQL-->>FD: So thich: KING bed, high floor, ocean view

    FD->>SQL: BEGIN TRANSACTION

    FD->>SQL: UPDATE ReservationRoom<br/>SET room_id = 1501,<br/>assignment_status = 'ASSIGNED',<br/>occupancy_status = 'IN_HOUSE'

    FD->>Room: UPDATE Room<br/>SET room_status = 'OCCUPIED'<br/>WHERE room_id = 1501

    FD->>Stay: INSERT StayRecord<br/>(reservation_room_id, actual_checkin_at=NOW(),<br/>frontdesk_agent_id, stay_status='IN_HOUSE')

    FD->>SQL: UPDATE Reservation<br/>SET status = 'CHECKED_IN'
    FD->>SQL: INSERT ReservationStatusHistory<br/>(CONFIRMED  CHECKED_IN)

    FD->>Audit: INSERT AuditLog<br/>(entity='Reservation', action='STATUS_CHANGE')

    FD->>SQL: COMMIT 

    FD-->>Guest:  Chao mung!<br/>Phong 1501, tang 15

    Note over Guest, Audit:  DURING STAY  Add-on Services 

    Guest->>FD: at dich vu Spa
    FD->>SQL: INSERT ReservationService<br/>(service_id  SPA, quantity=2,<br/>scheduled_at, status='REQUESTED')
    SQL-->>FD: Done
    FD-->>Guest: Spa a book luc 3PM 

    Note over Guest, Audit:  CHECK-OUT FLOW 

    Guest->>FD: Check-out

    FD->>SQL: BEGIN TRANSACTION

    FD->>Stay: UPDATE StayRecord<br/>SET actual_checkout_at = NOW(),<br/>stay_status = 'COMPLETED'

    FD->>SQL: SELECT grand_total, balance_due<br/>FROM vw_ReservationTotal<br/>WHERE reservation_id = 5001
    SQL-->>FD: grand_total=8,500,000 VND<br/>balance_due=6,000,000 VND

    FD->>SQL: INSERT Payment<br/>(FULL_PAYMENT, 6000000, CAPTURED)

    FD->>SQL: INSERT Invoice<br/>(FINAL, currency snapshot, total snapshot)

    FD->>SQL: UPDATE ReservationRoom<br/>SET occupancy_status = 'COMPLETED'
    FD->>SQL: UPDATE Reservation<br/>SET status = 'CHECKED_OUT'
    FD->>SQL: INSERT ReservationStatusHistory<br/>(CHECKED_IN  CHECKED_OUT)

    FD->>Room: UPDATE Room<br/>SET room_status = 'AVAILABLE',<br/>housekeeping_status = 'DIRTY'

    FD->>HK: INSERT HousekeepingTask<br/>(room_id=1501, task_type='CLEANING',<br/>priority='HIGH')

    FD->>SQL: COMMIT 

    FD-->>Guest:  Hoa on + Thank you!
```

---

## Flow 3: Rate Update  Price Integrity Guard (Trigger)

> The hien cach Trigger tu ong bao ve tinh toan ven gia khi Revenue Manager cap nhat rate.

```mermaid
sequenceDiagram
    actor RM as Revenue Manager<br/>(SystemUser)
    participant App as Admin Dashboard
    participant SQL as SQL Server
    participant RR as RoomRate Table
    participant TRG as AFTER UPDATE Trigger<br/>trg_PriceIntegrityGuard
    participant RCL as RateChangeLog
    participant Notify as Review Alert

    RM->>App: Cap nhat gia phong Deluxe<br/>tu 2,000,000  5,000,000 VND<br/>(tang 150%)

    App->>SQL: UPDATE RoomRate<br/>SET final_rate = 5000000,<br/>price_source = 'MANUAL',<br/>updated_by = @rm_user_id<br/>WHERE room_rate_id = 42

    Note over SQL, TRG: SQL Server tu ong fire Trigger

    SQL->>TRG: AFTER UPDATE fired

    TRG->>TRG: oc INSERTED (new) vs DELETED (old)<br/>old = 2,000,000<br/>new = 5,000,000<br/>change = |5M - 2M| / 2M = 150%

    alt change_percent > 50%
        rect rgb(255, 220, 220)
            TRG->>TRG:  VUOT NGUONG 50%!

            TRG->>RCL: INSERT RateChangeLog<br/>(room_rate_id=42,<br/>old_rate=2000000,<br/>new_rate=5000000,<br/>change_percent=150.00,<br/>severity='CRITICAL',<br/>review_status='OPEN')

            TRG->>Notify: Flag for review
        end

        RCL-->>TRG: Log saved 
        TRG-->>SQL: Trigger completed
    else change_percent <= 50%
        TRG->>TRG: Trong nguong cho phep  Bo qua
        TRG-->>SQL: No action needed
    end

    SQL-->>App: UPDATE successful
    App-->>RM:  Gia a cap nhat<br/>Canh bao: Thay oi 150% a uoc<br/>ghi log va cho review

    Note over RM, Notify: Supervisor review sau o

    RM->>App: Mo RateChangeLog e review
    App->>SQL: SELECT * FROM RateChangeLog<br/>WHERE review_status = 'OPEN'<br/>AND severity_level = 'CRITICAL'
    SQL-->>App: 1 alert: room_rate_id=42, +150%
    RM->>App: Acknowledge  ong review
    App->>SQL: UPDATE RateChangeLog<br/>SET review_status = 'ACKNOWLEDGED'
```

---

## Flow 4: Double-Booking Race Condition (Concurrency Defense)

> The hien **2 transactions ong thoi** cung at 1 phong  chi 1 thanh cong nho Pessimistic Locking.

```mermaid
sequenceDiagram
    participant A as  Transaction A<br/>(Guest Alice)
    participant SQL as SQL Server<br/>RoomAvailability
    participant Lock as InventoryLockLog
    participant B as  Transaction B<br/>(Guest Bob)

    Note over A, B: Room 101  ngay 15/04  status = OPEN<br/>Alice va Bob at ONG THOI

    A->>SQL: BEGIN TRAN A
    B->>SQL: BEGIN TRAN B

    A->>SQL: SELECT ... FROM RoomAvailability<br/>WITH (UPDLOCK, HOLDLOCK)<br/>WHERE room_id=101 AND stay_date='04-15'

    Note over A, SQL:  Alice lay UPDLOCK thanh cong<br/>oc status = 'OPEN'

    B->>SQL: SELECT ... FROM RoomAvailability<br/>WITH (UPDLOCK, HOLDLOCK)<br/>WHERE room_id=101 AND stay_date='04-15'

    Note over SQL, B:  Bob BI BLOCK!<br/>UPDLOCK a bi Alice giu<br/>Bob phai CHO...

    A->>SQL: UPDATE RoomAvailability<br/>SET status = 'BOOKED',<br/>sellable_flag = 0
    A->>Lock: INSERT InventoryLockLog<br/>(status = 'SUCCESS')
    A->>SQL: COMMIT TRAN A 

    Note over A, SQL: Alice xong  Giai phong lock

    Note over SQL, B:  Lock released!<br/>Bob uoc tiep tuc

    SQL-->>B: Bob oc uoc:<br/>status = 'BOOKED' 

    B->>B: status = 'OPEN'  REJECTED!

    B->>Lock: INSERT InventoryLockLog<br/>(status = 'FAILED',<br/>note = 'Room not available')
    B->>SQL: ROLLBACK TRAN B 

    Note over A, B:  KET QUA: Alice at thanh cong<br/> Bob bi tu choi  KHONG CO Double-Booking

    rect rgb(230, 245, 230)
        Note over A, B:  UPDLOCK + HOLDLOCK = Serialized access<br/>tren cung 1 row  Race Condition eliminated
    end
```

---

## Tong hop: Ma tran Flow  Tables  Ky thuat

| Flow | Tables chinh | Ky thuat noi bat |
------------------------------------------------------------
| **1. Reservation** | RoomAvailability, Reservation, ReservationRoom, ReservationGuest, Payment, InventoryLockLog | Pessimistic Lock (`UPDLOCK + HOLDLOCK`), ACID Transaction, Hybrid SQL+MongoDB merge |
| **2. Check-in/out** | Reservation, ReservationRoom, StayRecord, Room, HousekeepingTask, Invoice, vw_ReservationTotal | Status lifecycle, VIEW tinh toan tai chinh, auto-create HK task |
| **3. Rate Guard** | RoomRate, RateChangeLog | AFTER UPDATE Trigger, `INSERTED`/`DELETED` virtual tables, TRY...CATCH |
| **4. Double-Booking** | RoomAvailability, InventoryLockLog | Pessimistic Locking, Race Condition defense, concurrent transactions |
