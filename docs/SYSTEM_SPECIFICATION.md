# ĐẶC TẢ HỆ THỐNG — LuxeReserve
## Hotel Reservation Management System

> **Phiên bản:** 1.0  
> **Ngày:** 2026-04-20  
> **Nhóm:** DAF04 — Cơ sở dữ liệu nâng cao

---

## Mục lục

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Kiến trúc kỹ thuật](#2-kiến-trúc-kỹ-thuật)
3. [Yêu cầu chức năng](#3-yêu-cầu-chức-năng)
4. [Yêu cầu phi chức năng](#4-yêu-cầu-phi-chức-năng)
5. [Thiết kế cơ sở dữ liệu](#5-thiết-kế-cơ-sở-dữ-liệu)
6. [Phân quyền và bảo mật](#6-phân-quyền-và-bảo-mật)
7. [Luồng nghiệp vụ chính](#7-luồng-nghiệp-vụ-chính)
8. [Giao diện người dùng](#8-giao-diện-người-dùng)
9. [Tích hợp bên ngoài](#9-tích-hợp-bên-ngoài)
10. [Ràng buộc và quy tắc nghiệp vụ](#10-ràng-buộc-và-quy-tắc-nghiệp-vụ)
11. [Glossary](#11-glossary)

---

## 1. Tổng quan hệ thống

### 1.1 Mục đích

**LuxeReserve** là hệ thống quản lý đặt phòng khách sạn (Hotel Reservation Management System — HRMS) dành cho chuỗi khách sạn cao cấp. Hệ thống cung cấp:

- **Cổng đặt phòng trực tuyến** cho khách hàng (guest booking portal)
- **Cổng quản lý nghiệp vụ** cho nhân viên (admin/cashier portals)
- **API nền tảng** cho tích hợp với các hệ thống OTA và kênh phân phối

### 1.2 Phạm vi

| Trong phạm vi | Ngoài phạm vi |
|---|---|
| Đặt phòng trực tiếp (direct booking) | Tích hợp Booking.com / Agoda |
| Quản lý phòng và inventory | Quản lý nhân sự (HR) |
| Check-in / Check-out / Room transfer | Hệ thống kế toán doanh nghiệp |
| Thanh toán deposit và settlement | Loyalty points full lifecycle |
| Housekeeping và Maintenance | Revenue management AI |
| Báo cáo doanh thu | Multi-property accounting |
| Dịch vụ phụ trợ (spa, F&B) | App mobile native |

### 1.3 Người dùng hệ thống

| Actor | Mô tả | Portal |
|---|---|---|
| **Guest (Khách hàng)** | Khách đặt phòng trực tiếp, có hoặc không có tài khoản | `/` (public site) |
| **Admin** | Quản trị viên hệ thống, quyền toàn bộ | `/admin` |
| **Cashier (Thu ngân)** | Nhân viên lễ tân thu tiền, check-in/out | `/cashier` |
| **Front Desk** | Nhân viên lễ tân, thực hiện nghiệp vụ | `/cashier` (shared) |

---

## 2. Kiến trúc kỹ thuật

### 2.1 Tổng quan kiến trúc

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT TIER                       │
│           React + Vite SPA (port 5173)              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Public  │  │  Admin   │  │  Cashier Portal  │  │
│  │   Site   │  │  Portal  │  │  (Front Desk)    │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────┬───────────────────────────┘
                          │ HTTP REST / JSON
                          │ JWT Bearer Token
┌─────────────────────────▼───────────────────────────┐
│                  APPLICATION TIER                    │
│           Node.js + Express (port 3000)             │
│  ┌─────────────────────────────────────────────┐   │
│  │   Auth Middleware   │   Route Handlers       │   │
│  │   (JWT verify)      │   (Business Logic)     │   │
│  │   Role-Based Auth   │   55 endpoints         │   │
│  └─────────────────────────────────────────────┘   │
└───────────────┬─────────────────┬───────────────────┘
                │                 │
┌───────────────▼──┐   ┌──────────▼──────────────────┐
│  DATA TIER SQL   │   │     DATA TIER NOSQL         │
│  SQL Server 2022 │   │     MongoDB Atlas           │
│  (ACID / Locks)  │   │  (Flexible content)         │
│  30 tables       │   │  3 collections              │
└──────────────────┘   └─────────────────────────────┘
```

### 2.2 Stack công nghệ

| Layer | Công nghệ | Mục đích |
|---|---|---|
| **Frontend** | React 18 + Vite | SPA, component-based UI |
| **Routing** | React Router v6 | Client-side navigation |
| **State** | React Context API | Auth, Flash messages |
| **Backend** | Node.js + Express | REST API server |
| **ORM** | mssql (node-mssql) | SQL Server driver |
| **MongoDB driver** | mongodb v6 | NoSQL driver |
| **Auth** | JWT (jsonwebtoken) | Stateless authentication |
| **Password** | bcryptjs | Password hashing (cost=10) |
| **Mail** | Nodemailer + Gmail SMTP | Transactional email |
| **Payment** | VNPay SDK | Vietnamese payment gateway |
| **DB (SQL)** | SQL Server 2022 Express | RDBMS |
| **DB (NoSQL)** | MongoDB Atlas | Document store |

### 2.3 Polyglot Persistence

Hệ thống sử dụng **hai cơ sở dữ liệu song song** với nguyên tắc phân chia rõ ràng:

| Loại dữ liệu | Lưu tại | Lý do |
|---|---|---|
| Đặt phòng, thanh toán, inventory | **SQL Server** | ACID, transactions, locks |
| Thông tin khách, tài khoản | **SQL Server** | Referential integrity |
| Nội dung mô tả khách sạn | **MongoDB** | Flexible schema, text search |
| Ảnh, gallery, amenity icons | **MongoDB** | Embedded document hiệu quả |
| Room type feature lists | **MongoDB** | Thay đổi thường xuyên |

---

## 3. Yêu cầu chức năng

### 3.1 F01 — Quản lý khách sạn

| ID | Tên chức năng | Mô tả |
|---|---|---|
| F01.1 | Danh sách khách sạn | Hiển thị danh sách khách sạn với ảnh, rating, giá từ |
| F01.2 | Chi tiết khách sạn | Thông tin đầy đủ: mô tả, ảnh gallery, amenities, loại phòng |
| F01.3 | Tìm kiếm & lọc | Lọc theo điểm đến, giá, sao, brand |
| F01.4 | Kiểm tra phòng trống | Tra cứu phòng available theo ngày nhận/trả |

### 3.2 F02 — Đặt phòng

| ID | Tên chức năng | Mô tả |
|---|---|---|
| F02.1 | Đặt phòng có tài khoản | Guest đã đăng nhập, thông tin tự điền |
| F02.2 | Đặt phòng ẩn danh | Không cần tài khoản, nhập thông tin trực tiếp |
| F02.3 | Thanh toán deposit | Bắt buộc đặt cọc 30% tổng tiền phòng |
| F02.4 | Xác nhận qua email | Gửi email xác nhận kèm reservation code |
| F02.5 | Tra cứu đặt phòng | Tra cứu bằng reservation code |
| F02.6 | Huỷ đặt phòng (guest) | Guest tự huỷ, mất deposit |
| F02.7 | Xem lịch sử đặt phòng | Guest xem các reservation của mình |

### 3.3 F03 — Tài khoản khách hàng

| ID | Tên chức năng | Mô tả |
|---|---|---|
| F03.1 | Đăng ký tài khoản | Tạo tài khoản mới, xác thực email OTP |
| F03.2 | Đăng nhập | Đăng nhập bằng email / guest code |
| F03.3 | Hồ sơ cá nhân | Xem/sửa thông tin cá nhân |
| F03.4 | Chương trình loyalty | Xem điểm tích lũy, tier (SILVER/GOLD/PLATINUM/BLACK) |
| F03.5 | Quên mật khẩu | Reset qua email (OTP) |

### 3.4 F04 — Nghiệp vụ lễ tân (Front Desk)

| ID | Tên chức năng | Mô tả | Phân quyền |
|---|---|---|---|
| F04.1 | Bảng arrivals | Danh sách khách sắp đến hôm nay | ADMIN, CASHIER |
| F04.2 | Bảng departures | Danh sách khách sắp đi hôm nay | ADMIN, CASHIER |
| F04.3 | Check-in | Xác nhận khách nhận phòng | ADMIN, CASHIER |
| F04.4 | Check-out | Xác nhận khách trả phòng | ADMIN, CASHIER |
| F04.5 | Huỷ đặt phòng (hotel) | Hotel chủ động huỷ | ADMIN, CASHIER |
| F04.6 | Chuyển phòng | Chuyển khách sang phòng khác | ADMIN, CASHIER |
| F04.7 | Tra cứu reservation | Lookup theo reservation code | ADMIN, CASHIER |
| F04.8 | Xem tổng tài chính | Balance due, total paid | ADMIN, CASHIER |

### 3.5 F05 — Quản trị (Admin)

| ID | Tên chức năng | Mô tả |
|---|---|---|
| F05.1 | Dashboard KPI | Tổng booking, doanh thu, phòng trống, alerts |
| F05.2 | Quản lý tài khoản | CRUD system user + guest accounts |
| F05.3 | Quản lý inventory | Cập nhật trạng thái phòng theo ngày |
| F05.4 | Báo cáo doanh thu | Revenue theo khách sạn, brand, thời gian |
| F05.5 | Rate alerts | Cảnh báo giá thay đổi > 50% |
| F05.6 | Cập nhật giá phòng | Thay đổi room rate |
| F05.7 | Export báo cáo | Xuất Excel/PDF |

### 3.6 F06 — Housekeeping

| ID | Tên chức năng | Mô tả |
|---|---|---|
| F06.1 | Tạo task dọn phòng | Tự động khi checkout, hoặc tạo thủ công |
| F06.2 | Assign nhân viên | Phân công nhân viên housekeeping |
| F06.3 | Cập nhật trạng thái | OPEN → ASSIGNED → IN_PROGRESS → DONE → VERIFIED |
| F06.4 | Đồng bộ trạng thái phòng | Khi VERIFIED thì Room.housekeeping_status = INSPECTED |

### 3.7 F07 — Bảo trì (Maintenance)

| ID | Tên chức năng | Mô tả |
|---|---|---|
| F07.1 | Tạo ticket bảo trì | Báo cáo sự cố thiết bị, cơ sở vật chất |
| F07.2 | Assign kỹ thuật viên | Phân công người xử lý |
| F07.3 | Cập nhật tiến độ | Theo dõi quá trình xử lý |
| F07.4 | Đóng ticket | Resolve → tự động trả phòng về AVAILABLE |

### 3.8 F08 — Dịch vụ phụ trợ (Guest Services)

| ID | Tên chức năng | Mô tả |
|---|---|---|
| F08.1 | Catalog dịch vụ | Danh sách dịch vụ của khách sạn (spa, laundry, F&B...) |
| F08.2 | Đặt dịch vụ | Thêm dịch vụ vào reservation |
| F08.3 | Thanh toán dịch vụ | Incidental charge |
| F08.4 | Quản lý đơn dịch vụ | Xem, cập nhật trạng thái, cancel |

### 3.9 F09 — Hoá đơn

| ID | Tên chức năng | Mô tả |
|---|---|---|
| F09.1 | Tạo hoá đơn | Generate từ vw_ReservationTotal (tiền phòng + dịch vụ − thanh toán) |
| F09.2 | Phát hành hoá đơn | DRAFT → ISSUED |
| F09.3 | Xem hoá đơn | Full line items: rooms, services, payments |

### 3.10 F10 — Promotions

| ID | Tên chức năng | Mô tả |
|---|---|---|
| F10.1 | Hiển thị promotions | Theo hotel, brand, chain |
| F10.2 | Eligibility check | Kiểm tra thành viên có đủ điều kiện nhận promo |
| F10.3 | Member-only offers | Khuyến mãi dành riêng thành viên loyalty |

---

## 4. Yêu cầu phi chức năng

### 4.1 Hiệu năng

| Chỉ tiêu | Yêu cầu |
|---|---|
| API response time | < 500ms cho 95% requests |
| Booking concurrency | Xử lý đồng thời ≥ 50 booking requests |
| Room lock timeout | < 2s cho pessimistic lock trên 90 ngày |
| Page load | < 2s first contentful paint |

### 4.2 Tính sẵn sàng

| Chỉ tiêu | Yêu cầu |
|---|---|
| Uptime | ≥ 99% |
| Graceful shutdown | SIGINT → đóng DB connections trước khi tắt |
| Error recovery | Transaction rollback automatic trên mọi lỗi |

### 4.3 Bảo mật

| Yêu cầu | Thực hiện |
|---|---|
| Mật khẩu | bcrypt (cost=10), không lưu plain text |
| Authentication | JWT Bearer token, 8h expiry |
| Authorization | Role-based middleware, enforce per endpoint |
| Injection | Parameterized queries (mssql input binding) |
| CORS | Configured, chỉ allow frontend origin |
| Sensitive data | Credentials trong `.env`, không commit |

### 4.4 Tính toàn vẹn dữ liệu

| Yêu cầu | Thực hiện |
|---|---|
| Race condition | Pessimistic lock (UPDLOCK+HOLDLOCK) khi booking |
| Inventory consistency | Optimistic lock (version_no) khi update availability |
| Payment integrity | Validation: tổng payment ≤ grand_total |
| Audit trail | ReservationStatusHistory ghi mọi thay đổi trạng thái |

### 4.5 Khả năng mở rộng

| Yêu cầu | Thiết kế |
|---|---|
| Multi-hotel | Hotel_id trên mọi bảng liên quan |
| Multi-chain | Chain → Brand → Hotel hierarchy |
| Multi-currency | currency_code trên mọi giao dịch |
| Multi-language | i18n ready (nội dung MongoDB) |
| Multi-role | Role-based system, dễ thêm role mới |

---

## 5. Thiết kế cơ sở dữ liệu

### 5.1 Tổng quan (30 bảng SQL + 3 collections MongoDB)

```
DOMAIN 1: Location Hierarchy
  └── Location (tự tham chiếu, 5 cấp)

DOMAIN 2: Hotel Organization  
  └── HotelChain → Brand → Hotel
  └── HotelPolicy, HotelAmenity

DOMAIN 3: Room Management
  └── RoomType → Room
  └── RoomRate, RoomAvailability

DOMAIN 4: Guest Management
  └── Guest → GuestAuth → EmailVerificationOtp
  └── GuestAddress, GuestPreference

DOMAIN 5: System Users & Roles
  └── SystemUser ← UserRole → Role

DOMAIN 6: Pricing & Promotions
  └── RatePlan, BookingChannel
  └── Promotion

DOMAIN 7: Reservation Core
  └── Reservation → ReservationRoom
  └── ReservationStatusHistory

DOMAIN 8: Financial
  └── Payment, Invoice, InvoiceLineItem

DOMAIN 9: Stay & Services
  └── StayRecord
  └── ServiceCatalog → ReservationService

DOMAIN 10: Operations
  └── HousekeepingTask
  └── MaintenanceTicket

DOMAIN 11: Loyalty
  └── LoyaltyAccount

DOMAIN 12: Audit & Locks
  └── InventoryLockLog
```

### 5.2 Entity Relationship — Core Flow

```
Guest ──────────────────┐
  │                     │
  │                     ▼
  │               GuestAuth (login credentials)
  │
  ▼
Reservation ────────────────── Hotel
  │                               │
  ├── ReservationRoom ────── Room ─┘
  │       │                  │
  │       │           RoomAvailability (1 row/night)
  │       │
  ├── ReservationService ── ServiceCatalog
  │
  ├── Payment
  │
  ├── Invoice ── InvoiceLineItem
  │
  └── ReservationStatusHistory
```

### 5.3 Bảng quan trọng

#### Reservation
```sql
reservation_id          BIGINT PK
reservation_code        VARCHAR(50)  -- e.g. RES-20260510-ABC123
hotel_id                BIGINT FK
guest_id                BIGINT FK
reservation_status      VARCHAR(20)  -- CONFIRMED|CHECKED_IN|CHECKED_OUT|CANCELLED|NO_SHOW
checkin_date            DATE
checkout_date           DATE
nights                  INT
grand_total_amount      DECIMAL(18,2)
deposit_required_flag   BIT
deposit_amount          DECIMAL(18,2)  -- 30% of grand_total
guarantee_type          VARCHAR(20)    -- DEPOSIT|CARD|CORPORATE
booking_source          VARCHAR(20)    -- DIRECT_WEB|OTA|WALK_IN
```

#### RoomAvailability
```sql
availability_id         BIGINT PK
room_id                 BIGINT FK
stay_date               DATE         -- 1 row per room per night
availability_status     VARCHAR(15)  -- OPEN|BOOKED|BLOCKED|MAINTENANCE
sellable_flag           BIT
version_no              INT          -- for Optimistic Locking
```

#### Payment
```sql
payment_id              BIGINT PK
reservation_id          BIGINT FK
payment_reference       VARCHAR(80)  -- PAY-{timestamp}-{random}
payment_type            VARCHAR(20)  -- DEPOSIT|PREPAYMENT|FULL_PAYMENT|INCIDENTAL_HOLD|REFUND
payment_method          VARCHAR(20)  -- CREDIT_CARD|CASH|BANK_TRANSFER|VNPAY
payment_status          VARCHAR(15)  -- PENDING|AUTHORIZED|CAPTURED|FAILED|REFUNDED
amount                  DECIMAL(18,2)
```

### 5.4 Views quan trọng

#### vw_ReservationTotal
Tổng hợp tài chính theo reservation — single source of truth cho số tài chính:

```sql
CREATE VIEW vw_ReservationTotal AS
SELECT
  r.reservation_id,
  r.reservation_code,
  r.reservation_status,
  SUM(rr.final_amount)          AS room_subtotal,
  SUM(rs.final_amount)          AS service_subtotal,
  SUM(rr.final_amount) + ISNULL(SUM(rs.final_amount), 0)  AS grand_total,
  SUM(p.amount)                 AS total_paid,
  grand_total - total_paid      AS balance_due
FROM Reservation r ...
```

### 5.5 Stored Procedures

| Procedure | Mục đích |
|---|---|
| `sp_ReserveRoom` | Lock và booking một phòng cho một đêm (UPDLOCK+HOLDLOCK) |
| `sp_TransferRoom` | Chuyển phòng với lock mới, giải phóng phòng cũ |

### 5.6 MongoDB Collections

| Collection | Mục đích | Key fields |
|---|---|---|
| `Hotel_Catalog` | Mô tả, ảnh, địa chỉ chi tiết | `hotel_id`, `description`, `images[]`, `amenities[]`, `contact` |
| `room_type_catalog` | Mô tả, features, ảnh loại phòng | `room_type_code`, `description`, `features[]`, `images[]` |
| `amenity_master` | Tên, icon, category của amenity | `amenity_code`, `name`, `icon`, `category`, `tags[]` |

---

## 6. Phân quyền và bảo mật

### 6.1 Role matrix

| Chức năng | Guest | CASHIER | FRONT_DESK | ADMIN |
|---|---|---|---|---|
| Xem hotel / phòng | ✅ | ✅ | ✅ | ✅ |
| Đặt phòng | ✅ | — | — | — |
| Huỷ đặt phòng (own) | ✅ | — | — | — |
| Check-in / Check-out | — | ✅ | ✅ | ✅ |
| Huỷ đặt phòng (hotel) | — | ✅ | ✅ | ✅ |
| Room transfer | — | ✅ | ✅ | ✅ |
| Tra cứu reservation | — | ✅ | ✅ | ✅ |
| Quản lý accounts | — | — | — | ✅ |
| Báo cáo doanh thu | — | — | — | ✅ |
| Cập nhật giá / inventory | — | — | — | ✅ |
| Housekeeping tasks | — | — | ✅ | ✅ |
| Maintenance tickets | — | — | ✅ | ✅ |

### 6.2 JWT Token Structure

```json
{
  "sub": "7",
  "user_type": "SYSTEM_USER",
  "username": "cashier",
  "roles": ["CASHIER", "FRONT_DESK"],
  "iat": 1776658398,
  "exp": 1776687198
}
```

### 6.3 Middleware Stack

```
Request
  │
  ├── attachAuthContext()   ← Giải mã JWT, set req.auth (optional)
  │
  ├── requireAuth()         ← Bắt buộc đăng nhập
  │
  └── requireSystemUser()  ← Kiểm tra authenticated system user
```

### 6.4 Tài khoản demo

| Username | Password | Roles | Portal |
|---|---|---|---|
| `admin` | `admin` | ADMIN | `/admin` |
| `cashier` | `cashier` | CASHIER, FRONT_DESK | `/cashier` |
| `dqc` | `dqc` | Guest — PLATINUM | `/` |

---

## 7. Luồng nghiệp vụ chính

### 7.1 Luồng đặt phòng hoàn chỉnh

```
[Guest] Tìm kiếm khách sạn (hotel_id, checkin, checkout)
    │
    ▼
[GET /rooms/availability] → Danh sách phòng available
    │   Logic: NOT EXISTS BOOKED/BLOCKED trong RoomAvailability
    │
    ▼
[Guest] Chọn phòng, điền thông tin
    │
    ▼
[POST /reservations] → Tạo reservation với PESSIMISTIC LOCK
    │
    ├── BEGIN TRANSACTION
    │   ├── Tạo/resolve Guest record
    │   ├── FOR EACH night: SELECT ... WITH (UPDLOCK, HOLDLOCK)
    │   │   ├── Kiểm tra status = 'OPEN'
    │   │   └── UPDATE status = 'BOOKED'
    │   ├── INSERT Reservation (status='CONFIRMED')
    │   ├── INSERT ReservationRoom
    │   └── INSERT ReservationStatusHistory
    └── COMMIT TRANSACTION
    │
    ▼
[Email] Gửi booking confirmation
    │
    ▼
[POST /payments] → Thanh toán deposit 30%
    │   Validate: amount ≤ deposit_amount, reservation CONFIRMED
    │
    ▼
[Reservation status: CONFIRMED + deposit paid]
```

### 7.2 Luồng Check-in

```
[Cashier] Tra cứu reservation code
    │
    ▼
[GET /reservations/:code] → vw_ReservationTotal
    │   Hiển thị: balance_due, total_paid, danh sách phòng
    │
    ▼
Kiểm tra balance_due = 0? (không còn nợ)
    ├── Nếu CÒN NỢ → yêu cầu thanh toán trước [POST /payments]
    └── Nếu OK →
        │
        ▼
[POST /reservations/:id/checkin]
    │
    ├── BEGIN TRANSACTION
    │   ├── UPDATE Reservation → CHECKED_IN (guard: phải là CONFIRMED)
    │   ├── UPDATE ReservationRoom.occupancy_status = 'IN_HOUSE'
    │   ├── UPDATE Room.room_status = 'OCCUPIED'
    │   ├── INSERT StayRecord (actual_checkin_at = NOW)
    │   └── INSERT ReservationStatusHistory
    └── COMMIT
```

### 7.3 Luồng Check-out

```
[Cashier] Xác nhận check-out
    │
    ▼
[POST /reservations/:id/checkout]
    │
    ├── BEGIN TRANSACTION
    │   ├── UPDATE Reservation → CHECKED_OUT (guard: phải là CHECKED_IN)
    │   ├── UPDATE ReservationRoom.occupancy_status = 'COMPLETED'
    │   ├── UPDATE Room → AVAILABLE, housekeeping_status = 'DIRTY'
    │   ├── UPDATE StayRecord.actual_checkout_at = NOW
    │   └── INSERT HousekeepingTask (type=CLEANING, priority=HIGH)
    └── COMMIT
    │
    ▼
Response bao gồm financials: grand_total, total_paid, balance_due
```

### 7.4 Luồng Room Transfer

```
[Cashier] Chọn reservation + phòng mới
    │
    ▼
[POST /reservations/:id/transfer]
    │
    ├── BEGIN TRANSACTION
    │   ├── Lock phòng mới (UPDLOCK per night)
    │   ├── Verify phòng mới OPEN
    │   ├── Update RoomAvailability phòng mới → BOOKED
    │   ├── Release RoomAvailability phòng cũ → OPEN
    │   ├── Update ReservationRoom → phòng mới
    │   └── INSERT ReservationStatusHistory
    └── COMMIT
```

### 7.5 Luồng Housekeeping sau Checkout

```
[Checkout trigger] AUTO: INSERT HousekeepingTask (CLEANING, HIGH)
    │
    ▼
[Staff] Nhận task, cập nhật trạng thái
    │
    ├── PUT /housekeeping/:id/assign → gán nhân viên
    ├── PUT /housekeeping/:id/status → IN_PROGRESS
    ├── PUT /housekeeping/:id/status → DONE
    └── PUT /housekeeping/:id/status → VERIFIED
              │
              └── Auto sync:
                        IN_PROGRESS → Room.housekeeping_status = 'IN_PROGRESS'
                        DONE        → Room.housekeeping_status = 'CLEAN'
                        VERIFIED    → Room.housekeeping_status = 'INSPECTED'
```

---

## 8. Giao diện người dùng

### 8.1 Cấu trúc routes frontend

| Route | Component | Mô tả |
|---|---|---|
| `/` | `HomePage` | Trang chủ: hero search, featured hotels, promotions |
| `/search` | `SearchPage` | Kết quả tìm kiếm với filter sidebar |
| `/hotels/:id` | `HotelPage` | Chi tiết khách sạn, danh sách phòng |
| `/booking` | `BookingPage` | Form đặt phòng, xác nhận, thanh toán deposit |
| `/reservations` | `ReservationPage` | Tra cứu đặt phòng theo code |
| `/account` | `AccountPage` | Tài khoản: lịch sử, loyalty, hồ sơ |
| `/login` | `LoginPage` | Đăng nhập (unified cho guest + system) |
| `/register` | `RegisterPage` | Đăng ký tài khoản guest |
| `/admin` | `AdminPage` | Admin portal (yêu cầu ADMIN role) |
| `/cashier` | `CashierPage` | Cashier portal (yêu cầu CASHIER role) |

### 8.2 Components chính

| Component | Mô tả |
|---|---|
| `SiteHeader` | Navigation, login/logout, portal link |
| `SearchBar` | Hero search: destination, dates, guests |
| `HotelCard` | Card trong danh sách tìm kiếm |
| `RoomCard` | Card loại phòng kèm giá và booking |
| `AdminFrontDesk` | Module lễ tân: arrivals/departures board + lookup |
| `FlashMessage` | Toast notifications |

### 8.3 State management

| Context | Nội dung |
|---|---|
| `AuthContext` | `authSession`, `isSystemUser`, `isAdminUser`, `isCashierUser` |
| `FlashContext` | `setFlash({tone, text})` — global toast |

---

## 9. Tích hợp bên ngoài

### 9.1 VNPay (Payment Gateway)

| Thông số | Giá trị |
|---|---|
| Môi trường hiện tại | Sandbox |
| TMN Code | `3ZEQZZ0D` |
| Endpoint | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` |
| Return URL | `http://localhost:5173/booking/vnpay-return` |
| IPN URL | `http://localhost:3000/api/vnpay/ipn` |
| **Trạng thái** | ⚠️ **Code sẵn sàng, chưa kích hoạt** (cần production IPN URL) |

**Flow:**
```
Frontend → POST /api/vnpay/create-payment → VNPay URL
VNPay → redirect GET /vnpay/return → verify signature → frontend
VNPay → callback GET /vnpay/ipn → ghi payment record
```

### 9.2 Gmail SMTP (Transactional Email)

| Sự kiện | Email template |
|---|---|
| Đặt phòng thành công | Booking confirmation + reservation code |
| Huỷ đặt phòng | Cancellation notice |
| Reminder check-in | Mail template available; automatic scheduler chưa được wire |
| OTP xác thực | Email verification code (6 chữ số, hết hạn 10 phút) |

### 9.3 MongoDB Atlas

- **Cluster:** `luxereserve.ckfwy6o.mongodb.net`
- **Database:** `luxereserve`
- **Collections:** `Hotel_Catalog`, `room_type_catalog`, `amenity_master`
- **Truy cập:** Từ backend tại startup, không expose ra client

---

## 10. Ràng buộc và quy tắc nghiệp vụ

### 10.1 Đặt phòng

| Quy tắc | Mô tả |
|---|---|
| BR-01 | `checkout_date` phải sau `checkin_date` |
| BR-02 | `nightly_rate` > 0 |
| BR-03 | Tối đa 90 đêm mỗi reservation |
| BR-04 | Phải đặt cọc 30% nếu `guarantee_type = 'DEPOSIT'` |
| BR-05 | Phòng phải có `availability_status = 'OPEN'` cho TẤT CẢ các đêm |
| BR-06 | Chỉ lock và đặt khi nằm trong TRANSACTION — nếu lỗi thì ROLLBACK |

### 10.2 Thanh toán

| Quy tắc | Mô tả |
|---|---|
| BR-10 | Tổng payment không được vượt `grand_total_amount` |
| BR-11 | DEPOSIT payment không được vượt `deposit_amount` |
| BR-12 | FULL_PAYMENT phải bằng đúng số dư còn lại |
| BR-13 | Không được tạo payment cho reservation `CANCELLED`, `CHECKED_OUT`, `NO_SHOW` |

### 10.3 Check-in / Check-out

| Quy tắc | Mô tả |
|---|---|
| BR-20 | Chỉ check-in được khi `reservation_status = 'CONFIRMED'` |
| BR-21 | Chỉ check-out được khi `reservation_status = 'CHECKED_IN'` |
| BR-22 | Sau checkout: phòng → `AVAILABLE + DIRTY`, tạo HK task tự động |

### 10.4 Huỷ đặt phòng

| Quy tắc | Guest Cancel | Hotel Cancel |
|---|---|---|
| Điều kiện | Chỉ huỷ được khi CONFIRMED | Quyền admin/cashier |
| Hoàn tiền deposit | ❌ Không hoàn | ✅ Hoàn toàn bộ |
| Phóng thích phòng | ✅ RoomAvailability → OPEN | ✅ RoomAvailability → OPEN |
| Quyền thực hiện | Chỉ guest SỞ HỮU reservation | ADMIN, CASHIER, FRONT_DESK |

### 10.5 Inventory

| Quy tắc | Mô tả |
|---|---|
| BR-30 | Mỗi phòng có 1 row `RoomAvailability` per ngày |
| BR-31 | Khi booking: UPDLOCK + HOLDLOCK để chống concurrent booking |
| BR-32 | Admin update phòng: kiểm tra `version_no` (Optimistic Lock) |
| BR-33 | Price Guard: cảnh báo nếu giá thay đổi > 50% |

---

## 11. Glossary

| Thuật ngữ | Định nghĩa |
|---|---|
| **Reservation Code** | Mã xác nhận đặt phòng, format `RES-YYYYMMDD-XXXXXX` |
| **Deposit** | Đặt cọc 30% tổng tiền phòng, bắt buộc khi `guarantee_type=DEPOSIT` |
| **Pessimistic Lock** | Khóa row với UPDLOCK+HOLDLOCK trong transaction để ngăn concurrent booking |
| **Optimistic Lock** | Dùng `version_no` để detect conflict khi không cần lock mạnh |
| **Polyglot Persistence** | Dùng nhiều loại database (SQL + NoSQL) cho các mục đích khác nhau |
| **Front Desk** | Bộ phận lễ tân: check-in, check-out, room transfer |
| **Stay Record** | Bản ghi thực tế của một lượt lưu trú (actual checkin/checkout time) |
| **Incidental Charge** | Phụ phí phát sinh trong kỳ lưu trú (dịch vụ, minibar...) |
| **Rate Plan** | Kế hoạch giá (Rack Rate, Member Rate, Advance Purchase...) |
| **OTA** | Online Travel Agency (Booking.com, Agoda, Expedia) |
| **HRMS** | Hotel Reservation Management System |
| **IPN** | Instant Payment Notification — webhook từ VNPay |
| **Tier** | Cấp độ thành viên loyalty: SILVER, GOLD, PLATINUM, BLACK |
| **Balance Due** | Số tiền còn cần thanh toán = grand_total − total_paid |
| **RevPAR** | Revenue Per Available Room — chỉ số hiệu quả doanh thu phòng |
| **Availability Status** | Trạng thái phòng theo ngày: OPEN / BOOKED / BLOCKED / MAINTENANCE |
| **JWT** | JSON Web Token — credential stateless |
| **RBAC** | Role-Based Access Control — phân quyền theo vai trò |

---

*Tài liệu này được tạo từ source code thực tế — LuxeReserve v1.0*  
*Nhóm DAF04 — Môn Cơ sở dữ liệu nâng cao — 2026*
