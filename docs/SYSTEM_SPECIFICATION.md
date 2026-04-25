# AC TA HE THONG  LuxeReserve
## Hotel Reservation Management System

> **Phien ban:** 1.0  
> **Ngay:** 2026-04-20  
> **Nhom:** DAF04  Co so du lieu nang cao

---

## Muc luc

1. [Tong quan he thong](#1-tong-quan-he-thong)
2. [Kien truc ky thuat](#2-kien-truc-ky-thuat)
3. [Yeu cau chuc nang](#3-yeu-cau-chuc-nang)
4. [Yeu cau phi chuc nang](#4-yeu-cau-phi-chuc-nang)
5. [Thiet ke co so du lieu](#5-thiet-ke-co-so-du-lieu)
6. [Phan quyen va bao mat](#6-phan-quyen-va-bao-mat)
7. [Luong nghiep vu chinh](#7-luong-nghiep-vu-chinh)
8. [Giao dien nguoi dung](#8-giao-dien-nguoi-dung)
9. [Tich hop ben ngoai](#9-tich-hop-ben-ngoai)
10. [Rang buoc va quy tac nghiep vu](#10-rang-buoc-va-quy-tac-nghiep-vu)
11. [Glossary](#11-glossary)

---

## 1. Tong quan he thong

### 1.1 Muc ich

**LuxeReserve** la he thong quan ly at phong khach san (Hotel Reservation Management System  HRMS) danh cho chuoi khach san cao cap. He thong cung cap:

- **Cong at phong truc tuyen** cho khach hang (guest booking portal)
- **Cong quan ly nghiep vu** cho nhan vien (admin/cashier portals)
- **API nen tang** cho tich hop voi cac he thong OTA va kenh phan phoi

### 1.2 Pham vi

| Trong pham vi | Ngoai pham vi |
|---|---|
| at phong truc tiep (direct booking) | Tich hop Booking.com / Agoda |
| Quan ly phong va inventory | Quan ly nhan su (HR) |
| Check-in / Check-out / Room transfer | He thong ke toan doanh nghiep |
| Thanh toan deposit va settlement | Loyalty points full lifecycle |
| Housekeeping va Maintenance | Revenue management AI |
| Bao cao doanh thu | Multi-property accounting |
| Dich vu phu tro (spa, F&B) | App mobile native |

### 1.3 Nguoi dung he thong

| Actor | Mo ta | Portal |
|---|---|---|
| **Guest (Khach hang)** | Khach at phong truc tiep, co hoac khong co tai khoan | `/` (public site) |
| **Admin** | Quan tri vien he thong, quyen toan bo | `/admin` |
| **Cashier (Thu ngan)** | Nhan vien le tan thu tien, check-in/out | `/cashier` |
| **Front Desk** | Nhan vien le tan, thuc hien nghiep vu | `/cashier` (shared) |

---

## 2. Kien truc ky thuat

### 2.1 Tong quan kien truc

```

                    CLIENT TIER                       
           React + Vite SPA (port 5173)              
        
    Public      Admin       Cashier Portal    
     Site       Portal      (Front Desk)      
        

                           HTTP REST / JSON
                           JWT Bearer Token

                  APPLICATION TIER                    
           Node.js + Express (port 3000)             
     
     Auth Middleware      Route Handlers          
     (JWT verify)         (Business Logic)        
     Role-Based Auth      55 endpoints            
     

                                 
   
  DATA TIER SQL           DATA TIER NOSQL         
  SQL Server 2022         MongoDB Atlas           
  (ACID / Locks)       (Flexible content)         
  30 tables            3 collections              
   
```

### 2.2 Stack cong nghe

| Layer | Cong nghe | Muc ich |
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

He thong su dung **hai co so du lieu song song** voi nguyen tac phan chia ro rang:

| Loai du lieu | Luu tai | Ly do |
|---|---|---|
| at phong, thanh toan, inventory | **SQL Server** | ACID, transactions, locks |
| Thong tin khach, tai khoan | **SQL Server** | Referential integrity |
| Noi dung mo ta khach san | **MongoDB** | Flexible schema, text search |
| Anh, gallery, amenity icons | **MongoDB** | Embedded document hieu qua |
| Room type feature lists | **MongoDB** | Thay oi thuong xuyen |

---

## 3. Yeu cau chuc nang

### 3.1 F01  Quan ly khach san

| ID | Ten chuc nang | Mo ta |
|---|---|---|
| F01.1 | Danh sach khach san | Hien thi danh sach khach san voi anh, rating, gia tu |
| F01.2 | Chi tiet khach san | Thong tin ay u: mo ta, anh gallery, amenities, loai phong |
| F01.3 | Tim kiem & loc | Loc theo iem en, gia, sao, brand |
| F01.4 | Kiem tra phong trong | Tra cuu phong available theo ngay nhan/tra |

### 3.2 F02  at phong

| ID | Ten chuc nang | Mo ta |
|---|---|---|
| F02.1 | at phong co tai khoan | Guest a ang nhap, thong tin tu ien |
| F02.2 | at phong an danh | Khong can tai khoan, nhap thong tin truc tiep |
| F02.3 | Thanh toan deposit | Bat buoc at coc 30% tong tien phong |
| F02.4 | Xac nhan qua email | Gui email xac nhan kem reservation code |
| F02.5 | Tra cuu at phong | Tra cuu bang reservation code |
| F02.6 | Huy at phong (guest) | Guest tu huy, mat deposit |
| F02.7 | Xem lich su at phong | Guest xem cac reservation cua minh |

### 3.3 F03  Tai khoan khach hang

| ID | Ten chuc nang | Mo ta |
|---|---|---|
| F03.1 | ang ky tai khoan | Tao tai khoan moi, xac thuc email OTP |
| F03.2 | ang nhap | ang nhap bang email / guest code |
| F03.3 | Ho so ca nhan | Xem/sua thong tin ca nhan |
| F03.4 | Chuong trinh loyalty | Xem iem tich luy, tier (SILVER/GOLD/PLATINUM/BLACK) |
| F03.5 | Quen mat khau | Reset qua email (OTP) |

### 3.4 F04  Nghiep vu le tan (Front Desk)

| ID | Ten chuc nang | Mo ta | Phan quyen |
|---|---|---|---|
| F04.1 | Bang arrivals | Danh sach khach sap en hom nay | ADMIN, CASHIER |
| F04.2 | Bang departures | Danh sach khach sap i hom nay | ADMIN, CASHIER |
| F04.3 | Check-in | Xac nhan khach nhan phong | ADMIN, CASHIER |
| F04.4 | Check-out | Xac nhan khach tra phong | ADMIN, CASHIER |
| F04.5 | Huy at phong (hotel) | Hotel chu ong huy | ADMIN, CASHIER |
| F04.6 | Chuyen phong | Chuyen khach sang phong khac | ADMIN, CASHIER |
| F04.7 | Tra cuu reservation | Lookup theo reservation code | ADMIN, CASHIER |
| F04.8 | Xem tong tai chinh | Balance due, total paid | ADMIN, CASHIER |

### 3.5 F05  Quan tri (Admin)

| ID | Ten chuc nang | Mo ta |
|---|---|---|
| F05.1 | Dashboard KPI | Tong booking, doanh thu, phong trong, alerts |
| F05.2 | Quan ly tai khoan | CRUD system user + guest accounts |
| F05.3 | Quan ly inventory | Cap nhat trang thai phong theo ngay |
| F05.4 | Bao cao doanh thu | Revenue theo khach san, brand, thoi gian |
| F05.5 | Rate alerts | Canh bao gia thay oi > 50% |
| F05.6 | Cap nhat gia phong | Thay oi room rate |
| F05.7 | Export bao cao | Xuat Excel/PDF |

### 3.6 F06  Housekeeping

| ID | Ten chuc nang | Mo ta |
|---|---|---|
| F06.1 | Tao task don phong | Tu ong khi checkout, hoac tao thu cong |
| F06.2 | Assign nhan vien | Phan cong nhan vien housekeeping |
| F06.3 | Cap nhat trang thai | OPEN  ASSIGNED  IN_PROGRESS  DONE  VERIFIED |
| F06.4 | ong bo trang thai phong | Khi VERIFIED thi Room.housekeeping_status = INSPECTED |

### 3.7 F07  Bao tri (Maintenance)

| ID | Ten chuc nang | Mo ta |
|---|---|---|
| F07.1 | Tao ticket bao tri | Bao cao su co thiet bi, co so vat chat |
| F07.2 | Assign ky thuat vien | Phan cong nguoi xu ly |
| F07.3 | Cap nhat tien o | Theo doi qua trinh xu ly |
| F07.4 | ong ticket | Resolve  tu ong tra phong ve AVAILABLE |

### 3.8 F08  Dich vu phu tro (Guest Services)

| ID | Ten chuc nang | Mo ta |
|---|---|---|
| F08.1 | Catalog dich vu | Danh sach dich vu cua khach san (spa, laundry, F&B...) |
| F08.2 | at dich vu | Them dich vu vao reservation |
| F08.3 | Thanh toan dich vu | Incidental charge |
| F08.4 | Quan ly on dich vu | Xem, cap nhat trang thai, cancel |

### 3.9 F09  Hoa on

| ID | Ten chuc nang | Mo ta |
|---|---|---|
| F09.1 | Tao hoa on | Generate tu vw_ReservationTotal (tien phong + dich vu  thanh toan) |
| F09.2 | Phat hanh hoa on | DRAFT  ISSUED |
| F09.3 | Xem hoa on | Full line items: rooms, services, payments |

### 3.10 F10  Promotions

| ID | Ten chuc nang | Mo ta |
|---|---|---|
| F10.1 | Hien thi promotions | Theo hotel, brand, chain |
| F10.2 | Eligibility check | Kiem tra thanh vien co u ieu kien nhan promo |
| F10.3 | Member-only offers | Khuyen mai danh rieng thanh vien loyalty |

---

## 4. Yeu cau phi chuc nang

### 4.1 Hieu nang

| Chi tieu | Yeu cau |
|---|---|
| API response time | < 500ms cho 95% requests |
| Booking concurrency | Xu ly ong thoi  50 booking requests |
| Room lock timeout | < 2s cho pessimistic lock tren 90 ngay |
| Page load | < 2s first contentful paint |

### 4.2 Tinh san sang

| Chi tieu | Yeu cau |
|---|---|
| Uptime |  99% |
| Graceful shutdown | SIGINT  ong DB connections truoc khi tat |
| Error recovery | Transaction rollback automatic tren moi loi |

### 4.3 Bao mat

| Yeu cau | Thuc hien |
|---|---|
| Mat khau | bcrypt (cost=10), khong luu plain text |
| Authentication | JWT Bearer token, 8h expiry |
| Authorization | Role-based middleware, enforce per endpoint |
| Injection | Parameterized queries (mssql input binding) |
| CORS | Configured, chi allow frontend origin |
| Sensitive data | Credentials trong `.env`, khong commit |

### 4.4 Tinh toan ven du lieu

| Yeu cau | Thuc hien |
|---|---|
| Race condition | Pessimistic lock (UPDLOCK+HOLDLOCK) khi booking |
| Inventory consistency | Optimistic lock (version_no) khi update availability |
| Payment integrity | Validation: tong payment  grand_total |
| Audit trail | ReservationStatusHistory ghi moi thay oi trang thai |

### 4.5 Kha nang mo rong

| Yeu cau | Thiet ke |
|---|---|
| Multi-hotel | Hotel_id tren moi bang lien quan |
| Multi-chain | Chain  Brand  Hotel hierarchy |
| Multi-currency | currency_code tren moi giao dich |
| Multi-language | i18n ready (noi dung MongoDB) |
| Multi-role | Role-based system, de them role moi |

---

## 5. Thiet ke co so du lieu

### 5.1 Tong quan (30 bang SQL + 3 collections MongoDB)

```
DOMAIN 1: Location Hierarchy
   Location (tu tham chieu, 5 cap)

DOMAIN 2: Hotel Organization  
   HotelChain  Brand  Hotel
   HotelPolicy, HotelAmenity

DOMAIN 3: Room Management
   RoomType  Room
   RoomRate, RoomAvailability

DOMAIN 4: Guest Management
   Guest  GuestAuth  EmailVerificationOtp
   GuestAddress, GuestPreference

DOMAIN 5: System Users & Roles
   SystemUser  UserRole  Role

DOMAIN 6: Pricing & Promotions
   RatePlan, BookingChannel
   Promotion

DOMAIN 7: Reservation Core
   Reservation  ReservationRoom
   ReservationStatusHistory

DOMAIN 8: Financial
   Payment, Invoice, InvoiceLineItem

DOMAIN 9: Stay & Services
   StayRecord
   ServiceCatalog  ReservationService

DOMAIN 10: Operations
   HousekeepingTask
   MaintenanceTicket

DOMAIN 11: Loyalty
   LoyaltyAccount

DOMAIN 12: Audit & Locks
   InventoryLockLog
```

### 5.2 Entity Relationship  Core Flow

```
Guest 
                       
                       
                 GuestAuth (login credentials)
  
  
Reservation  Hotel
                                 
   ReservationRoom  Room 
                           
                    RoomAvailability (1 row/night)
         
   ReservationService  ServiceCatalog
  
   Payment
  
   Invoice  InvoiceLineItem
  
   ReservationStatusHistory
```

### 5.3 Bang quan trong

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

### 5.4 Views quan trong

#### vw_ReservationTotal
Tong hop tai chinh theo reservation  single source of truth cho so tai chinh:

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

| Procedure | Muc ich |
|---|---|
| `sp_ReserveRoom` | Lock va booking mot phong cho mot em (UPDLOCK+HOLDLOCK) |
| `sp_TransferRoom` | Chuyen phong voi lock moi, giai phong phong cu |

### 5.6 MongoDB Collections

| Collection | Muc ich | Key fields |
|---|---|---|
| `Hotel_Catalog` | Mo ta, anh, ia chi chi tiet | `hotel_id`, `description`, `images[]`, `amenities[]`, `contact` |
| `room_type_catalog` | Mo ta, features, anh loai phong | `room_type_code`, `description`, `features[]`, `images[]` |
| `amenity_master` | Ten, icon, category cua amenity | `amenity_code`, `name`, `icon`, `category`, `tags[]` |

---

## 6. Phan quyen va bao mat

### 6.1 Role matrix

| Chuc nang | Guest | CASHIER | FRONT_DESK | ADMIN |
------------------------------------------------------------
| Xem hotel / phong |  |  |  |  |
| at phong |  |  |  |  |
| Huy at phong (own) |  |  |  |  |
| Check-in / Check-out |  |  |  |  |
| Huy at phong (hotel) |  |  |  |  |
| Room transfer |  |  |  |  |
| Tra cuu reservation |  |  |  |  |
| Quan ly accounts |  |  |  |  |
| Bao cao doanh thu |  |  |  |  |
| Cap nhat gia / inventory |  |  |  |  |
| Housekeeping tasks |  |  |  |  |
| Maintenance tickets |  |  |  |  |

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
  
   attachAuthContext()    Giai ma JWT, set req.auth (optional)
  
   requireAuth()          Bat buoc ang nhap
  
   requireSystemUser()   Kiem tra authenticated system user
```

### 6.4 Tai khoan demo

| Username | Password | Roles | Portal |
|---|---|---|---|
| `admin` | `admin` | ADMIN | `/admin` |
| `cashier` | `cashier` | CASHIER, FRONT_DESK | `/cashier` |
| `dqc` | `dqc` | Guest  PLATINUM | `/` |

---

## 7. Luong nghiep vu chinh

### 7.1 Luong at phong hoan chinh

```
[Guest] Tim kiem khach san (hotel_id, checkin, checkout)
    
    
[GET /rooms/availability]  Danh sach phong available
       Logic: NOT EXISTS BOOKED/BLOCKED trong RoomAvailability
    
    
[Guest] Chon phong, ien thong tin
    
    
[POST /reservations]  Tao reservation voi PESSIMISTIC LOCK
    
     BEGIN TRANSACTION
        Tao/resolve Guest record
        FOR EACH night: SELECT ... WITH (UPDLOCK, HOLDLOCK)
           Kiem tra status = 'OPEN'
           UPDATE status = 'BOOKED'
        INSERT Reservation (status='CONFIRMED')
        INSERT ReservationRoom
        INSERT ReservationStatusHistory
     COMMIT TRANSACTION
    
    
[Email] Gui booking confirmation
    
    
[POST /payments]  Thanh toan deposit 30%
       Validate: amount  deposit_amount, reservation CONFIRMED
    
    
[Reservation status: CONFIRMED + deposit paid]
```

### 7.2 Luong Check-in

```
[Cashier] Tra cuu reservation code
    
    
[GET /reservations/:code]  vw_ReservationTotal
       Hien thi: balance_due, total_paid, danh sach phong
    
    
Kiem tra balance_due = 0-> (khong con no)
     Neu CON NO  yeu cau thanh toan truoc [POST /payments]
     Neu OK 
        
        
[POST /reservations/:id/checkin]
    
     BEGIN TRANSACTION
        UPDATE Reservation  CHECKED_IN (guard: phai la CONFIRMED)
        UPDATE ReservationRoom.occupancy_status = 'IN_HOUSE'
        UPDATE Room.room_status = 'OCCUPIED'
        INSERT StayRecord (actual_checkin_at = NOW)
        INSERT ReservationStatusHistory
     COMMIT
```

### 7.3 Luong Check-out

```
[Cashier] Xac nhan check-out
    
    
[POST /reservations/:id/checkout]
    
     BEGIN TRANSACTION
        UPDATE Reservation  CHECKED_OUT (guard: phai la CHECKED_IN)
        UPDATE ReservationRoom.occupancy_status = 'COMPLETED'
        UPDATE Room  AVAILABLE, housekeeping_status = 'DIRTY'
        UPDATE StayRecord.actual_checkout_at = NOW
        INSERT HousekeepingTask (type=CLEANING, priority=HIGH)
     COMMIT
    
    
Response bao gom financials: grand_total, total_paid, balance_due
```

### 7.4 Luong Room Transfer

```
[Cashier] Chon reservation + phong moi
    
    
[POST /reservations/:id/transfer]
    
     BEGIN TRANSACTION
        Lock phong moi (UPDLOCK per night)
        Verify phong moi OPEN
        Update RoomAvailability phong moi  BOOKED
        Release RoomAvailability phong cu  OPEN
        Update ReservationRoom  phong moi
        INSERT ReservationStatusHistory
     COMMIT
```

### 7.5 Luong Housekeeping sau Checkout

```
[Checkout trigger] AUTO: INSERT HousekeepingTask (CLEANING, HIGH)
    
    
[Staff] Nhan task, cap nhat trang thai
    
     PUT /housekeeping/:id/assign  gan nhan vien
     PUT /housekeeping/:id/status  IN_PROGRESS
     PUT /housekeeping/:id/status  DONE
     PUT /housekeeping/:id/status  VERIFIED
              
               Auto sync:
                        IN_PROGRESS  Room.housekeeping_status = 'IN_PROGRESS'
                        DONE         Room.housekeeping_status = 'CLEAN'
                        VERIFIED     Room.housekeeping_status = 'INSPECTED'
```

---

## 8. Giao dien nguoi dung

### 8.1 Cau truc routes frontend

| Route | Component | Mo ta |
|---|---|---|
| `/` | `HomePage` | Trang chu: hero search, featured hotels, promotions |
| `/search` | `SearchPage` | Ket qua tim kiem voi filter sidebar |
| `/hotels/:id` | `HotelPage` | Chi tiet khach san, danh sach phong |
| `/booking` | `BookingPage` | Form at phong, xac nhan, thanh toan deposit |
| `/reservations` | `ReservationPage` | Tra cuu at phong theo code |
| `/account` | `AccountPage` | Tai khoan: lich su, loyalty, ho so |
| `/login` | `LoginPage` | ang nhap (unified cho guest + system) |
| `/register` | `RegisterPage` | ang ky tai khoan guest |
| `/admin` | `AdminPage` | Admin portal (yeu cau ADMIN role) |
| `/cashier` | `CashierPage` | Cashier portal (yeu cau CASHIER role) |

### 8.2 Components chinh

| Component | Mo ta |
|---|---|
| `SiteHeader` | Navigation, login/logout, portal link |
| `SearchBar` | Hero search: destination, dates, guests |
| `HotelCard` | Card trong danh sach tim kiem |
| `RoomCard` | Card loai phong kem gia va booking |
| `AdminFrontDesk` | Module le tan: arrivals/departures board + lookup |
| `FlashMessage` | Toast notifications |

### 8.3 State management

| Context | Noi dung |
|---|---|
| `AuthContext` | `authSession`, `isSystemUser`, `isAdminUser`, `isCashierUser` |
| `FlashContext` | `setFlash({tone, text})`  global toast |

---

## 9. Tich hop ben ngoai

### 9.1 VNPay (Payment Gateway)

| Thong so | Gia tri |
|---|---|
| Moi truong hien tai | Sandbox |
| TMN Code | `3ZEQZZ0D` |
| Endpoint | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` |
| Return URL | `http://localhost:5173/booking/vnpay-return` |
| IPN URL | `http://localhost:3000/api/vnpay/ipn` |
| **Trang thai** |  **Code san sang, chua kich hoat** (can production IPN URL) |

**Flow:**
```
Frontend  POST /api/vnpay/create-payment  VNPay URL
VNPay  redirect GET /vnpay/return  verify signature  frontend
VNPay  callback GET /vnpay/ipn  ghi payment record
```

### 9.2 Gmail SMTP (Transactional Email)

| Su kien | Email template |
|---|---|
| at phong thanh cong | Booking confirmation + reservation code |
| Huy at phong | Cancellation notice |
| Reminder check-in | Mail template available; automatic scheduler chua uoc wire |
| OTP xac thuc | Email verification code (6 chu so, het han 10 phut) |

### 9.3 MongoDB Atlas

- **Cluster:** `luxereserve.ckfwy6o.mongodb.net`
- **Database:** `luxereserve`
- **Collections:** `Hotel_Catalog`, `room_type_catalog`, `amenity_master`
- **Truy cap:** Tu backend tai startup, khong expose ra client

---

## 10. Rang buoc va quy tac nghiep vu

### 10.1 at phong

| Quy tac | Mo ta |
|---|---|
| BR-01 | `checkout_date` phai sau `checkin_date` |
| BR-02 | `nightly_rate` > 0 |
| BR-03 | Toi a 90 em moi reservation |
| BR-04 | Phai at coc 30% neu `guarantee_type = 'DEPOSIT'` |
| BR-05 | Phong phai co `availability_status = 'OPEN'` cho TAT CA cac em |
| BR-06 | Chi lock va at khi nam trong TRANSACTION  neu loi thi ROLLBACK |

### 10.2 Thanh toan

| Quy tac | Mo ta |
|---|---|
| BR-10 | Tong payment khong uoc vuot `grand_total_amount` |
| BR-11 | DEPOSIT payment khong uoc vuot `deposit_amount` |
| BR-12 | FULL_PAYMENT phai bang ung so du con lai |
| BR-13 | Khong uoc tao payment cho reservation `CANCELLED`, `CHECKED_OUT`, `NO_SHOW` |

### 10.3 Check-in / Check-out

| Quy tac | Mo ta |
|---|---|
| BR-20 | Chi check-in uoc khi `reservation_status = 'CONFIRMED'` |
| BR-21 | Chi check-out uoc khi `reservation_status = 'CHECKED_IN'` |
| BR-22 | Sau checkout: phong  `AVAILABLE + DIRTY`, tao HK task tu ong |

### 10.4 Huy at phong

| Quy tac | Guest Cancel | Hotel Cancel |
|---|---|---|
| ieu kien | Chi huy uoc khi CONFIRMED | Quyen admin/cashier |
| Hoan tien deposit |  Khong hoan |  Hoan toan bo |
| Phong thich phong |  RoomAvailability  OPEN |  RoomAvailability  OPEN |
| Quyen thuc hien | Chi guest SO HUU reservation | ADMIN, CASHIER, FRONT_DESK |

### 10.5 Inventory

| Quy tac | Mo ta |
|---|---|
| BR-30 | Moi phong co 1 row `RoomAvailability` per ngay |
| BR-31 | Khi booking: UPDLOCK + HOLDLOCK e chong concurrent booking |
| BR-32 | Admin update phong: kiem tra `version_no` (Optimistic Lock) |
| BR-33 | Price Guard: canh bao neu gia thay oi > 50% |

---

## 11. Glossary

| Thuat ngu | inh nghia |
|---|---|
| **Reservation Code** | Ma xac nhan at phong, format `RES-YYYYMMDD-XXXXXX` |
| **Deposit** | at coc 30% tong tien phong, bat buoc khi `guarantee_type=DEPOSIT` |
| **Pessimistic Lock** | Khoa row voi UPDLOCK+HOLDLOCK trong transaction e ngan concurrent booking |
| **Optimistic Lock** | Dung `version_no` e detect conflict khi khong can lock manh |
| **Polyglot Persistence** | Dung nhieu loai database (SQL + NoSQL) cho cac muc ich khac nhau |
| **Front Desk** | Bo phan le tan: check-in, check-out, room transfer |
| **Stay Record** | Ban ghi thuc te cua mot luot luu tru (actual checkin/checkout time) |
| **Incidental Charge** | Phu phi phat sinh trong ky luu tru (dich vu, minibar...) |
| **Rate Plan** | Ke hoach gia (Rack Rate, Member Rate, Advance Purchase...) |
| **OTA** | Online Travel Agency (Booking.com, Agoda, Expedia) |
| **HRMS** | Hotel Reservation Management System |
| **IPN** | Instant Payment Notification  webhook tu VNPay |
| **Tier** | Cap o thanh vien loyalty: SILVER, GOLD, PLATINUM, BLACK |
| **Balance Due** | So tien con can thanh toan = grand_total  total_paid |
| **RevPAR** | Revenue Per Available Room  chi so hieu qua doanh thu phong |
| **Availability Status** | Trang thai phong theo ngay: OPEN / BOOKED / BLOCKED / MAINTENANCE |
| **JWT** | JSON Web Token  credential stateless |
| **RBAC** | Role-Based Access Control  phan quyen theo vai tro |

---

*Tai lieu nay uoc tao tu source code thuc te  LuxeReserve v1.0*  
*Nhom DAF04  Mon Co so du lieu nang cao  2026*
