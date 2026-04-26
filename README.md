# LuxeReserve  Global Luxury Hotel Reservation Engine

**Advanced Database Systems - Final Project**

LuxeReserve is a full-stack luxury hotel reservation platform built with a **Polyglot Persistence Architecture**. It combines the transactional integrity of SQL Server with the rich content capabilities of MongoDB Atlas, exposed through a Node.js Express REST API and a React/Vite frontend.

---

##  System Architecture

```

       React + Vite Frontend       http://localhost:5173
  (GuestLayout + AuthLayout)     

              /api proxy

     Node.js Express API           http://localhost:3000
   (Hybrid SQL + MongoDB layer)  

                    
  
 SQL Server   MongoDB Atlas  
  (ACID)      (Rich Content) 
  
```

### 1. SQL Server (Operational Data)
Handles core business logic, ACID transactions, and inventory.
- **Scope**: 37 normalized tables
- **Features**: Pessimistic Locking (`UPDLOCK, HOLDLOCK`), Views, Triggers, Stored Procedures
- **Domains**: Reservations, Room Rates, Inventory, Payment, Roles & Users

### 2. MongoDB Atlas (Rich Content Management)
Handles flexible schemaless data and fast catalog reads.
- **Collections**: `Hotel_Catalog`, `room_type_catalog`, `amenity_master`
- **Features**: Embedded documents, horizontal scalability
- **Domains**: Property images, dynamic features, long-form descriptions

### 3. Node.js + Express API (Hybrid Backend)
Integration layer merging both databases in real-time.
- **Port**: `3000`
- **Key deps**: `mssql` (Windows Auth via `msnodesqlv8`), `mongodb`, `nodemailer`

### 4. React + Vite Frontend
Full guest-facing and admin UI.
- **Port**: `5173`
- **Key deps**: `react-router-dom`, Vite proxy to backend

---

##  Advanced Database Concepts Implemented

| # | Concept | Where |
|---|---|---|
| 1 | **Pessimistic Locking** (`UPDLOCK, HOLDLOCK`) | `POST /api/reservations`  blocks race conditions on same room/date |
| 2 | **Optimistic Locking** (`version_no`) | Admin inventory `PUT /api/admin/availability/:id`  rejects stale updates (409) |
| 3 | **Price Integrity Guard Trigger** | `trg_RoomRate_PriceIntegrityGuard`  logs rate changes > 50% as CRITICAL alerts |
| 4 | **Window Functions + Revenue Analytics** | `GET /api/admin/reports/revenue`  `DENSE_RANK()`, cumulative `SUM() OVER()` |
| 5 | **Recursive CTE** | `GET /api/locations/tree`  dynamic tree of any depth (`REGION -> COUNTRY -> STATE_PROVINCE -> CITY -> DISTRICT`) |
| 6 | **Computed Persisted Column** | `Guest.full_name`  auto-concatenated, indexable |
| 7 | **Polyglot Merge** | Hotels API merges SQL rows + MongoDB catalog at runtime |
| 8 | **Views** | `vw_ReservationTotal`  computes grand total with taxes and deposits |

---

##  Running the Project

### Prerequisites
- **SQL Server 2022 Express** on `localhost\SQLEXPRESS` (Windows Authentication)
- **MongoDB Atlas** cluster with connection URI
- **Node.js** v18+

### 1. Database Setup

Run SQL scripts in order (located in `/database/sql/`):

```
01_create_database.sql
02_create_tables.sql
03_create_views.sql
04_create_triggers.sql
05_create_procedures.sql
11_email_verification.sql
06_seed_data.sql
```

`06_seed_data.sql` is now the single consolidated demo seed.
It already includes the expanded hotel network, promotions, full service catalog,
room features, and the normalized demo accounts:

- `admin / admin`
- `cashier / cashier`
- `dqc / dqc`

The guest demo account logs in with guest code `dqc`.
Its email is `dqc@luxereserve.local` for reset-password flows.

Seed MongoDB Atlas:
```bash
node database/mongodb/02_seed_data.js
```

### 2. Configure Environment

Create `.env` in the project root:

```env
PORT=3000
NODE_ENV=development

# SQL Server
SQL_SERVER=localhost
SQL_INSTANCE=SQLEXPRESS
SQL_DATABASE=LuxeReserve
SQL_TRUSTED_CONNECTION=true

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/luxereserve->retryWrites=true&w=majority
MONGODB_DB_NAME=luxereserve

# SMTP (for email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=LuxeReserve <your_email@gmail.com>

# App base URL (used in email links)
APP_URL=http://localhost:5173

# VNPay Merchant (sandbox  optional, inactive by default)
VNPAY_TMN_CODE=YOUR_TMN_CODE
VNPAY_HASH_SECRET=YOUR_HASH_SECRET
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:5173/booking/vnpay-return
VNPAY_IPN_URL=http://localhost:3000/api/vnpay/ipn
```

### 3. Install Dependencies

```bash
# Root (backend)
npm install

# Frontend
cd frontend && npm install && cd ..
```

### 4. Start Development Servers

```bash
# Start backend API (port 3000)
npm run dev

# Start frontend (port 5173)  in a separate terminal
npm run frontend:dev
```

Frontend is at **http://localhost:5173**  proxies all `/api` requests to the backend.

---

##  Frontend Route Map

| Route | Page | Auth |
|---|---|---|
| `/` | Homepage  Hero search, Destinations, Featured Hotels, Promotions | Public |
| `/search` | Search results with sidebar filters | Public |
| `/hotel/:id` | Hotel detail  gallery, rooms, amenities | Public |
| `/booking/:hotelId/:roomId` | 3-step checkout (Details  Confirm  Done) | Public |
| `/booking/vnpay-return` | VNPay payment result page | Public |
| `/reservation` | Lookup by code + My Bookings + Cancel | Public / Guest |
| `/login` | Shared login (guest + admin) | Public |
| `/register` | Guest registration with OTP email verification | Public |
| `/account` | Guest account hub  bookings, loyalty | Guest only |
| `/admin` | Admin dashboard  inventory, accounts, revenue | Admin only |

---

##  Demo Accounts

| Type | Login | Password |
|---|---|---|
| Admin | `admin` | `admin` |
| Cashier | `cashier` | `cashier` |
| Guest (dqc) | `dqc` | `dqc` |

---

##  Email Notifications

The system sends transactional emails via SMTP (Nodemailer):

| Event | Template |
|---|---|
| Guest registration | OTP verification code |
| Booking confirmed | Reservation code, dates, deposit paid |
| Booking cancelled | Cancellation confirmation |
| Check-in reminder | Mail template available; automatic scheduling is not wired yet |

Configure `SMTP_*` variables in `.env` to activate.  
Uses **fire-and-forget**  email failures never block the main API response.

---

##  Payment

### Current (Mock)
When booking, a `DEPOSIT` payment (30% of total) is recorded directly in the DB without external gateway.  
Remaining 70% (`Balance`) is due at check-out.

### VNPay Integration (Ready, Inactive)
Full VNPay Merchant integration is built but commented out:
- `src/services/vnpay.js`  HMAC-SHA512 URL signing & return verification
- `src/routes/vnpay.js`  `create-payment`, `return`, `ipn` endpoints

To activate: uncomment the `TODO: Bat VNPay` block in `frontend/src/pages/BookingPage.jsx`.

---

##  Key API Endpoints

```
GET  /api/hotels                        List hotels (SQL + MongoDB merge)
GET  /api/hotels/:id                    Hotel detail with rooms & amenities
GET  /api/rooms/availability            Available rooms by date range
GET  /api/locations/tree                Location hierarchy (Recursive CTE)
GET  /api/promotions                    Active promotions

POST /api/auth/login                    Unified login (guest + admin)
POST /api/auth/guest/register           Guest registration
POST /api/auth/guest/verify-email       OTP verification

GET  /api/reservations/:code            Lookup by reservation code
GET  /api/reservations/by-guest/:code   All reservations for a guest
POST /api/reservations                  Create reservation (pessimistic lock)
POST /api/reservations/:id/guest-cancel Cancel reservation (auth required)

POST /api/payments                      Record payment
POST /api/vnpay/create-payment          Create VNPay payment URL
GET  /api/vnpay/return                  VNPay browser redirect handler
GET  /api/vnpay/ipn                     VNPay server-to-server callback

GET  /api/admin/accounts                List system + guest accounts
PUT  /api/admin/availability/:id        Update room availability (optimistic lock)
GET  /api/admin/reports/revenue         Revenue analytics (window functions)
```

---

##  Project Structure

```
HCSDLNC/
 src/
    app.js                  Express app entry point
    config/
       database.js         SQL + MongoDB connection pool
    middleware/
       auth.js             JWT auth middleware (requireAuth, requireSystemUser)
    routes/
       hotels.js
       rooms.js
       reservations.js
       payments.js
       guests.js
       auth.js
       admin.js
       promotions.js
       locations.js
       invoices.js
       vnpay.js            VNPay integration (inactive)
    services/
        mail.js             Nodemailer email templates
        vnpay.js            VNPay HMAC signing & verification
 frontend/
    src/
        pages/              All page components
        components/
           layout/         GuestLayout, AuthLayout, SiteHeader, SiteFooter
        context/            AuthContext, FlashContext (toast system)
        lib/api.js          Fetch wrapper with auth headers
 database/
    sql/                    SQL setup scripts (01-16; no 12_*.sql in current repo)
    mongodb/                MongoDB seed scripts
 .env                        Environment variables (not committed)
 NOTE.md                     Developer session notes
```

---

*Academic Project  Advanced Database Systems Final Submission.*
