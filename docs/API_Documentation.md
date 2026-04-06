# LuxeReserve API Documentation

Welcome to the LuxeReserve Hybrid Backend API. This documentation outlines all available endpoints, their HTTP methods, required headers, URL parameters, and request body payloads.

---

## 🌍 Base URL
\`\`\`text
http://localhost:3000/api
\`\`\`

## 🛠️ Global Headers
For requests with a body, ensure you send the following header:
\`\`\`http
Content-Type: application/json
\`\`\`

---

## 1. Hotels 🏨

### 1.1 List All Hotels (Hybrid Merge)
Returns a list of all active hotels, merging structural SQL data with MongoDB rich catalogs.
- **Method**: \`GET\`
- **Endpoint**: \`/hotels\`

### 1.2 Get Hotel Details (Deep Merge)
Returns comprehensive hotel information including room types with live rate pricing and full amenities.
- **Method**: \`GET\`
- **Endpoint**: \`/hotels/:id\`
- **Path Params**: 
  - \`id\` (number) - ID of the hotel. Example: \`1\`

---

## 2. Rooms 🛏️

### 2.1 Check Room Availability
Search for available rooms between a check-in and check-out date.
- **Method**: \`GET\`
- **Endpoint**: \`/rooms/availability\`
- **Query Params**:
  - \`hotel_id\` (number, required) - ID of the hotel. Example: \`1\`
  - \`checkin\` (string, required) - Date formatted \`YYYY-MM-DD\`. Example: \`2026-04-05\`
  - \`checkout\` (string, required) - Date formatted \`YYYY-MM-DD\`. Example: \`2026-04-08\`

---

## 3. Guests 🤵

### 3.1 List All Guests
- **Method**: \`GET\`
- **Endpoint**: \`/guests\`

### 3.2 Get Guest Profile
- **Method**: \`GET\`
- **Endpoint**: \`/guests/:id\`
- **Path Params**: 
  - \`id\` (number) - ID of the guest. Example: \`1\`

### 3.3 Create New Guest
- **Method**: \`POST\`
- **Endpoint**: \`/guests\`
- **Body** (JSON):
\`\`\`json
{
  "guest_code": "G-NEW-20260401",
  "title": "Mr.",
  "first_name": "Tony",
  "last_name": "Stark",
  "gender": "M",
  "email": "tony@starkindustries.com",
  "phone_country_code": "+1",
  "phone_number": "555-0199",
  "nationality_country_code": "US"
}
\`\`\`

---

## 4. Reservations 📅

### 4.1 Create Reservation (Pessimistic Lock Engine)
Reserves a room, executing individual SQL Server locks for each night.
- **Method**: \`POST\`
- **Endpoint**: \`/reservations\`
- **Body** (JSON):
\`\`\`json
{
  "hotel_id": 1,
  "guest_id": 1,
  "room_id": 4,
  "room_type_id": 3,
  "rate_plan_id": 1,
  "checkin_date": "2026-04-05",
  "checkout_date": "2026-04-08",
  "adult_count": 2,
  "nightly_rate": 12000000.00,
  "currency_code": "VND",
  "guarantee_type": "CARD",
  "purpose_of_stay": "LEISURE",
  "special_request_text": "High floor with city view"
}
\`\`\`

### 4.2 Get Reservation by Code
Find a single reservation by its unique confirmation code.
- **Method**: \`GET\`
- **Endpoint**: \`/reservations/:code\`
- **Path Params**: 
  - \`code\` (string) - Example: \`RES-20260331-ABCDEF\`

### 4.3 Check-in Process
- **Method**: \`POST\`
- **Endpoint**: \`/reservations/:id/checkin\`
- **Path Params**: 
  - \`id\` (number) - Reservation ID. Example: \`1\`
- **Body** (JSON):
\`\`\`json
{
  "agent_id": 1
}
\`\`\`

### 4.4 Check-out Process
- **Method**: \`POST\`
- **Endpoint**: \`/reservations/:id/checkout\`
- **Path Params**: 
  - \`id\` (number) - Reservation ID. Example: \`1\`
- **Body** (JSON):
\`\`\`json
{
  "agent_id": 1
}
\`\`\`

### 4.5 Guest Cancellation (Forfeit Deposit)
Guest voluntarily cancels. Deposit is **NOT refunded** (forfeited). Only `CONFIRMED` reservations can be guest-cancelled.
- **Method**: `POST`
- **Endpoint**: `/reservations/:id/guest-cancel`
- **Path Params**: 
  - `id` (number) - Reservation ID. Example: `1`
- **Body** (JSON):
```json
{
  "reason": "Change of travel plans"
}
```
- **DB Techniques**: Multi-step transaction (6 tables), AFTER UPDATE Trigger `trg_Reservation_CancellationAudit` → auto-log to `AuditLog`

### 4.6 Hotel Cancellation (Full Refund)
Hotel cancels due to room issues. All payments are **fully refunded** via `REFUND` payment record.
- **Method**: `POST`
- **Endpoint**: `/reservations/:id/hotel-cancel`
- **Path Params**: 
  - `id` (number) - Reservation ID. Example: `1`
- **Body** (JSON):
```json
{
  "reason": "Room water pipe burst, no alternative available",
  "agent_id": 1
}
```
- **DB Techniques**: Multi-step transaction (7 tables), auto-creates `REFUND` Payment, triggers `trg_Reservation_CancellationAudit`

### 4.7 Room Transfer (Pessimistic Locking)
Transfer guest to a different room when current room has issues. Uses `sp_TransferRoom` stored procedure with `UPDLOCK + HOLDLOCK`.
- **Method**: `POST`
- **Endpoint**: `/reservations/:id/transfer`
- **Path Params**: 
  - `id` (number) - Reservation ID. Example: `1`
- **Body** (JSON):
```json
{
  "new_room_id": 5,
  "reason": "Air conditioning malfunction in current room",
  "agent_id": 1
}
```
- **DB Techniques**: `sp_TransferRoom` with Pessimistic Locking — atomically releases old room inventory and locks new room for all stay dates. Logs to `InventoryLockLog`.

---

## 5. Payments 💳

### 5.1 Add New Payment
- **Method**: `POST`
- **Endpoint**: `/payments`
- **Body** (JSON):
```json
{
  "reservation_id": 1,
  "payment_type": "DEPOSIT",
  "payment_method": "CREDIT_CARD",
  "amount": 4500000,
  "currency_code": "VND"
}
```
- **`payment_type` options**: `DEPOSIT`, `PREPAYMENT`, `FULL_PAYMENT`, `REFUND`, `INCIDENTAL_HOLD`
- **`payment_method` options**: `CREDIT_CARD`, `BANK_TRANSFER`, `WALLET`, `CASH`, `CORPORATE_BILLING`, `POINTS`

#### ⚠️ Validation Rules
| Rule | Description |
|------|-------------|
| LOGIC-6 | Cannot create payment for `CANCELLED` or `NO_SHOW` reservations |
| LOGIC-7 | Calculates total already paid (CAPTURED/AUTHORIZED, excluding REFUND) |
| LOGIC-8 | Rejects if `total_paid + new_amount > grand_total_amount` |
| LOGIC-9 | For `DEPOSIT` type: rejects if `total_deposit + new_amount > deposit_amount` |
| LOGIC-10 | For `FULL_PAYMENT` type: amount must equal the exact remaining balance |

**Success Response** includes `payment_summary`:
```json
{
  "success": true,
  "data": { ... },
  "payment_summary": {
    "grand_total": 14850000,
    "total_paid_after": 4500000,
    "remaining_balance": 10350000
  }
}
```

### 5.2 List Payments for a Reservation
- **Method**: `GET`
- **Endpoint**: `/payments`
- **Query Params**:
  - `reservation_id` (number) - Filter by reservation. Example: `1`

---

## 6. Services 🛎️ (Incidental Charges)

### 6.1 List Available Services
Returns the service catalog for a specific hotel.
- **Method**: `GET`
- **Endpoint**: `/services?hotel_id=1`
- **Query Params**:
  - `hotel_id` (number, required) - ID of the hotel. Example: `1`

### 6.2 Order a Service (Incidental Charge)
Creates a service order linked to a reservation. Only allowed for `CONFIRMED` or `CHECKED_IN` reservations.
- **Method**: `POST`
- **Endpoint**: `/services/order`
- **Body** (JSON):
```json
{
  "reservation_id": 1,
  "service_id": 1,
  "quantity": 2,
  "special_instruction": "Use organic essential oils",
  "scheduled_at": "2026-04-06T14:00:00"
}
```

### 6.3 List Service Orders for a Reservation
Returns all service orders with totals summary.
- **Method**: `GET`
- **Endpoint**: `/services/orders?reservation_id=1`
- **Query Params**:
  - `reservation_id` (number, required) - Example: `1`

### 6.4 Update Service Order Status
- **Method**: `PUT`
- **Endpoint**: `/services/orders/:id/status`
- **Path Params**:
  - `id` (number) - Service order ID. Example: `1`
- **Body** (JSON):
```json
{
  "status": "DELIVERED"
}
```
- **Valid statuses**: `CONFIRMED`, `DELIVERED`, `CANCELLED`

### 6.5 Pay for Incidental Service
Creates an `INCIDENTAL_HOLD` payment for a specific service order. Prevents double-payment.
- **Method**: `POST`
- **Endpoint**: `/services/orders/:id/pay`
- **Path Params**:
  - `id` (number) - Service order ID. Example: `1`
- **Body** (JSON):
```json
{
  "payment_method": "CREDIT_CARD"
}
```

---

## 7. Admin & Reporting 📊

### 7.1 Update Rate (Price Integrity Guard) ⚠️
Changes a room rate. If changed by > 50%, an automatic Alert is logged.
- **Method**: `PUT`
- **Endpoint**: `/admin/rates/:id`
- **Path Params**: 
  - `id` (number) - Rate ID. Example: `1`
- **Body** (JSON):
```json
{
  "final_rate": 8000000,
  "price_source": "MANUAL",
  "updated_by": 1
}
```

### 7.2 View Price Integrity Alerts
- **Method**: `GET`
- **Endpoint**: `/admin/rates/alerts`

### 7.3 Revenue Analytics (Window Functions)
Get intelligent financial reporting partitioned by quarter, year, and hotel.
- **Method**: `GET`
- **Endpoint**: `/admin/reports/revenue`

### 7.4 Update Availability (Optimistic Locking) 🔒
Update room availability with **version-based conflict detection**. If `expected_version` doesn't match, returns `409 Conflict`.
- **Method**: `PUT`
- **Endpoint**: `/admin/availability/:id`
- **Path Params**:
  - `id` (number) - Availability record ID. Example: `110`
- **Body** (JSON):
```json
{
  "availability_status": "BLOCKED",
  "expected_version": 1,
  "inventory_note": "Blocked for maintenance"
}
```
- **DB Techniques**: **Optimistic Locking** — `UPDATE ... WHERE version_no = @expected_version`. If `rowsAffected = 0` → conflict → 409
- **409 Response**:
```json
{
  "success": false,
  "error": "OPTIMISTIC LOCK CONFLICT: ...",
  "your_expected_version": 1,
  "current_version": 2,
  "current_status": "BLOCKED"
}
```

---

## 8. Locations 🏙️

### 8.1 Location Hierarchy Tree (Recursive CTE)
- **Method**: `GET`
- **Endpoint**: `/locations/tree`
- **Query Params** (Optional):
  - `root` (string) - Name of location root. Example: `Châu Á`
  - `root_id` (number) - ID of location root. Example: `1`

### 8.2 List All Locations (Flat)
- **Method**: `GET`
- **Endpoint**: `/locations`

---

## 9. Housekeeping 🧹

### 9.1 List Housekeeping Tasks
- **Method**: `GET`
- **Endpoint**: `/housekeeping?hotel_id=1`
- **Query Params**:
  - `hotel_id` (number, required) - Example: `1`
  - `status` (string, optional) - `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `DONE`, `VERIFIED`
  - `priority` (string, optional) - `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

### 9.2 Create Housekeeping Task
- **Method**: `POST`
- **Endpoint**: `/housekeeping`
- **Body** (JSON):
```json
{
  "hotel_id": 1,
  "room_id": 1,
  "task_type": "DEEP_CLEAN",
  "priority_level": "HIGH",
  "note": "Guest checkout deep clean",
  "assigned_staff_id": 2
}
```

### 9.3 Assign Staff to Task
- **Method**: `PUT`
- **Endpoint**: `/housekeeping/:id/assign`
- **Body** (JSON):
```json
{
  "staff_id": 2,
  "scheduled_for": "2026-04-06T10:00:00"
}
```

### 9.4 Update Task Status (Room Sync Transaction)
Status flow: `ASSIGNED → IN_PROGRESS → DONE → VERIFIED`. Auto-syncs `Room.housekeeping_status`.
- **Method**: `PUT`
- **Endpoint**: `/housekeeping/:id/status`
- **Body** (JSON):
```json
{
  "status": "DONE",
  "note": "Completed with extra sanitation"
}
```
- **DB Techniques**: Transaction — update HousekeepingTask + sync Room.housekeeping_status atomically
- **Room Sync Map**: `IN_PROGRESS→IN_PROGRESS`, `DONE→CLEAN`, `VERIFIED→INSPECTED`

---

## 10. Maintenance 🔧

### 10.1 List Maintenance Tickets
- **Method**: `GET`
- **Endpoint**: `/maintenance?hotel_id=1`
- **Query Params**:
  - `hotel_id` (number, required) - Example: `1`
  - `status` (string, optional) - `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
  - `severity` (string, optional) - `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

### 10.2 Create Maintenance Ticket
If `severity_level` is HIGH/CRITICAL and room is linked → auto-sets `Room.maintenance_status = 'UNDER_REPAIR'`.
- **Method**: `POST`
- **Endpoint**: `/maintenance`
- **Body** (JSON):
```json
{
  "hotel_id": 1,
  "room_id": 3,
  "reported_by": 2,
  "issue_category": "PLUMBING",
  "issue_description": "Water leak in bathroom ceiling",
  "severity_level": "HIGH"
}
```
- **DB Techniques**: Transaction — create ticket + auto-update Room.maintenance_status

### 10.3 Update/Resolve Ticket
When RESOLVED/CLOSED and no other open tickets for that room → `Room.maintenance_status → 'NORMAL'`.
- **Method**: `PUT`
- **Endpoint**: `/maintenance/:id`
- **Body** (JSON):
```json
{
  "status": "RESOLVED",
  "assigned_to": 2,
  "resolution_note": "Pipe fixed, ceiling patched"
}
```
- **DB Techniques**: Transaction with multi-ticket awareness — only restores Room status when ALL tickets for that room are resolved.

---

## 11. Invoices 🧾

### 11.1 Generate Invoice (from vw_ReservationTotal)
Creates invoice with financial data sourced from `vw_ReservationTotal` computed view.
- **Method**: `POST`
- **Endpoint**: `/invoices`
- **Body** (JSON):
```json
{
  "reservation_id": 1,
  "invoice_type": "FINAL",
  "billing_name": "Quoc Anh Nguyen",
  "billing_tax_no": "0312345678",
  "billing_address": "28 Dong Khoi, District 1, HCMC"
}
```
- **DB Techniques**: View-to-INSERT pattern using `vw_ReservationTotal` as financial source of truth

### 11.2 Get Invoice with Line Items
Returns full invoice with room breakdown, service breakdown, and payment history.
- **Method**: `GET`
- **Endpoint**: `/invoices/:id`
- **Path Params**:
  - `id` (number) - Invoice ID. Example: `1`

### 11.3 Issue Invoice (DRAFT → ISSUED)
- **Method**: `POST`
- **Endpoint**: `/invoices/:id/issue`
- **Path Params**:
  - `id` (number) - Invoice ID. Example: `1`
