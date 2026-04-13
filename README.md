# LuxeReserve — Global Luxury Hotel Reservation Engine
**Advanced Database Systems - Final Project**

LuxeReserve is a sophisticated hotel reservation platform designed with a **Polyglot Persistence Architecture**. It combines the transactional integrity of SQL Server with the rich content management capabilities of MongoDB Atlas.

---

## 🏛️ System Architecture

### 1. SQL Server (Operational Data)
Handles core business logic, ACID transactions, and inventory.
- **Scope**: 30 Normalized Tables
- **Features**: Pessimistic Locking (`UPDLOCK, HOLDLOCK`), Views, Triggers, Denormalization for performance.
- **Domains**: Reservations, Room Rates, Inventory, Payment, Roles & Users.

### 2. MongoDB Atlas (Rich Content Management)
Handles flexible schemaless data, catalogs, and fast reads.
- **Scope**: 3 NoSQL Collections (`Hotel_Catalog`, `room_type_catalog`, `amenity_master`)
- **Features**: Embedded documents, horizontal scalability.
- **Domains**: Property images, dynamic features, long-form descriptions.

### 3. Node.js Express API (Hybrid Backend)
Serves as the integration layer merging both databases in real-time.
- **Dependencies**: `mssql` (via `msnodesqlv8` for Windows Auth), `mongodb`.

---

## 🔥 Advanced Database Concepts Implemented

1. **Pessimistic Locking & Race-Condition Prevention**
   - Implemented in the live booking API by directly locking `RoomAvailability` rows with `UPDLOCK, HOLDLOCK`.
   - Blocks simultaneous attempts to book the same room on the same date.
   - Admin inventory updates use version-based optimistic locking on `RoomAvailability.version_no`.

2. **Price Integrity Guard Trigger**
   - `trg_RoomRate_PriceIntegrityGuard` fires `AFTER UPDATE` on `RoomRate`.
   - Automatically logs any rate change exceeding 50% into `RateChangeLog` as a `CRITICAL` alert.

3. **Window Functions & Revenue Analytics**
   - `GET /api/admin/reports/revenue` — Revenue per hotel with `DENSE_RANK()` and cumulative `SUM() OVER()`.
   - `GET /api/admin/reports/revenue-by-brand` — Revenue across the full **HotelChain → Brand → Hotel** hierarchy with multi-level `PARTITION BY brand_id` and `PARTITION BY chain_id`.

4. **Recursive CTE (Hierarchical Data)**
   - `Location` table stores worldwide regions, countries, cities, and districts.
   - `GET /api/locations/tree` uses a Common Table Expression to build a dynamic tree structure of any depth.

5. **Computed Columns & Constraints**
   - `Guest.full_name` is an auto-concatenated `PERSISTED` indexable column.
   - Cross-table constraint triggers and `CHECK` logic to enforce at least one Foreign Key in junction tables.

---

## 🚀 Running the Project

### Prerequisites
1. **SQL Server 2022 Express** (Running on `localhost\SQLEXPRESS` via Windows Authentication).
2. **MongoDB Atlas** (Cluster provisioned & URI acquired).
3. **Node.js** (v18+).

### 1. Database Setup
The architecture is set up via automated SQL scripts:
```bash
# Order of execution (located in /database/sql/)
1. 01_create_database.sql
2. 02_create_tables.sql
3. 03_create_views.sql
4. 04_create_triggers.sql
5. 05_create_procedures.sql
6. 06_seed_data.sql
```
*A Node.js seed script (`/database/mongodb/02_seed_data.js`) populates MongoDB Atlas.*

### 2. Configure Environment
Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=development

# SQL Server
SQL_SERVER=localhost
SQL_INSTANCE=SQLEXPRESS
SQL_DATABASE=LuxeReserve
SQL_TRUSTED_CONNECTION=true

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/luxereserve?retryWrites=true&w=majority
MONGODB_DB_NAME=luxereserve
```

### 3. Start the API Server
```bash
npm install
npm run dev
```

The API will be running at `http://localhost:3000/api`.

### Demo Authentication

Admin:
- username: `admin`
- password: `admin123`

Guest:
- login: `quoc.nguyen@gmail.com`
- password: `guest12345`

Guest:
- login: `sakura.t@yahoo.co.jp`
- password: `member12345`

### 4. Start the Frontend MVP
```bash
npm run frontend:dev
```

The Vite frontend runs at `http://localhost:5173` and proxies `/api` requests to the backend on port `3000`.

If you need an explicit API URL for another environment, copy `frontend/.env.example` to `frontend/.env` and set:

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

---

*Academic Project — Advanced Database Systems Final Submission.*
