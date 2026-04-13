# LuxeReserve API Documentation

This file documents the current Express implementation in `src/routes/*`.

Source of truth:
- Route mounting: `src/app.js`
- Request and response behavior: `src/routes/*.js`

Design documents such as sequence diagrams or test scenarios may describe the intended architecture, but this file is meant to match the API behavior that is currently implemented.

---

## Base URL

```text
http://localhost:3000/api
```

## Global Headers

For requests with a JSON body:

```http
Content-Type: application/json
```

## Standard Response Shape

Most endpoints return:

```json
{
  "success": true,
  "data": {}
}
```

Collection endpoints usually also include `count`, and some workflow endpoints include `message`, `summary`, or other helper fields.

---

## 0. API Root

### 0.1 API Index

- Method: `GET`
- Endpoint: `/`
- Description: Returns API metadata and a route summary.

---

## 1. Hotels

### 1.1 List All Hotels

- Method: `GET`
- Endpoint: `/hotels`
- Description: Returns active hotels by merging SQL operational data with MongoDB catalog content.

Returned fields include:
- SQL-side fields such as `hotel_id`, `hotel_code`, `hotel_name`, `hotel_type`, `currency_code`, `brand_name`, `chain_name`
- Mongo-enriched fields such as `description`, `hero_image`, `amenity_count`, `location_detail`

### 1.2 Get Hotel Details

- Method: `GET`
- Endpoint: `/hotels/:id`
- Path params:
  - `id` (number, required)
- Description: Returns detailed hotel data, room types, operational amenities, and MongoDB content.

Additional merged sections include:
- `room_types`
- `amenities`
- `images`
- `contact`

---

## 2. Rooms

### 2.1 Check Room Availability

- Method: `GET`
- Endpoint: `/rooms/availability`
- Query params:
  - `hotel_id` (number, required)
  - `checkin` (`YYYY-MM-DD`, required)
  - `checkout` (`YYYY-MM-DD`, required)
- Description: Returns rooms that are currently sellable for the whole requested date range.

Current response now includes `availability_records` for each returned room. This is important because admin optimistic locking uses those records.

Example response item:

```json
{
  "room_id": 7,
  "room_number": "1205",
  "floor_number": 12,
  "room_type_name": "Deluxe King",
  "category": "DELUXE",
  "bed_type": "KING",
  "max_adults": 2,
  "room_size_sqm": 42,
  "view_type": "CITY",
  "room_type_code": "DLX-KING",
  "min_nightly_rate": 8500000,
  "availability_records": [
    {
      "availability_id": 110,
      "stay_date": "2026-04-14",
      "availability_status": "OPEN",
      "version_no": 3
    }
  ]
}
```

Validation:
- Missing `hotel_id`, `checkin`, or `checkout` -> `400`

---

## 3. Guests

### 3.1 List All Guests

- Method: `GET`
- Endpoint: `/guests`

### 3.2 Get Guest Profile

- Method: `GET`
- Endpoint: `/guests/:id`
- Path params:
  - `id` (number, required)

Response includes:
- guest base record
- `preferences`
- `loyalty_accounts`
- `addresses`

Validation:
- Invalid `id` -> `400`
- Guest not found -> `404`

### 3.3 Create Guest

- Method: `POST`
- Endpoint: `/guests`

Required body fields:
- `guest_code`
- `first_name`
- `last_name`

Example body:

```json
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
```

Validation:
- Missing required fields -> `400`

---

## 4. Authentication

### 4.1 Admin Login

- Method: `POST`
- Endpoint: `/auth/admin/login`

Body:

```json
{
  "username": "admin",
  "password": "admin123"
}
```

Response returns:
- `token`
- `user` with `user_type = SYSTEM_USER`
- `roles`

### 4.2 Guest Register

- Method: `POST`
- Endpoint: `/auth/guest/register`

Body:

```json
{
  "guest_id": 1,
  "login_email": "quoc.nguyen@gmail.com",
  "password": "guest12345"
}
```

Notes:
- Creates login credentials for an existing guest profile
- Does not replace anonymous booking flow

### 4.3 Guest Login

- Method: `POST`
- Endpoint: `/auth/guest/login`

Body:

```json
{
  "login": "quoc.nguyen@gmail.com",
  "password": "guest12345"
}
```

`login` may be:
- `login_email`
- `guest_code`

Response returns:
- `token`
- `user` with `user_type = GUEST`
- `loyalty_accounts`

### 4.4 Current Authenticated User

- Method: `GET`
- Endpoint: `/auth/me`
- Headers:
  - `Authorization: Bearer <token>`

---

## 5. Reservations

### 4.1 Create Reservation

- Method: `POST`
- Endpoint: `/reservations`
- Description: Creates a reservation and directly locks inventory rows in `RoomAvailability` using pessimistic locking inside a SQL transaction.

Important implementation note:
- The current API no longer depends on `sp_ReserveRoom` at runtime for this route.
- It locks inventory per stay date using `UPDLOCK, HOLDLOCK` and then updates those rows to `BOOKED`.

Required body fields:
- `hotel_id`
- `guest_id`
- `room_id`
- `checkin_date`
- `checkout_date`

Common optional body fields:
- `room_type_id`
- `rate_plan_id`
- `booking_channel_id`
- `booking_source`
- `nights`
- `adult_count`
- `child_count`
- `nightly_rate`
- `currency_code`
- `guarantee_type`
- `purpose_of_stay`
- `special_request_text`

Example body:

```json
{
  "hotel_id": 1,
  "guest_id": 1,
  "room_id": 7,
  "room_type_id": 3,
  "rate_plan_id": 1,
  "checkin_date": "2026-04-14",
  "checkout_date": "2026-04-16",
  "adult_count": 2,
  "nightly_rate": 8500000,
  "currency_code": "VND",
  "guarantee_type": "DEPOSIT",
  "purpose_of_stay": "LEISURE",
  "special_request_text": "High floor if available"
}
```

Current validation rules:
- Missing `hotel_id`, `guest_id`, `room_id`, `checkin_date`, `checkout_date` -> `400`
- `nightly_rate <= 0` or missing -> `400`
- Invalid date format -> `400`
- `checkout_date` must be after `checkin_date` -> `400`
- Maximum stay length is `90` nights -> `400`
- Missing inventory row for a stay date -> `409`
- Inventory row not `OPEN` for a stay date -> `409`

Current success response:

```json
{
  "success": true,
  "data": {
    "reservation_id": 123,
    "reservation_code": "RES-20260413-ABC123",
    "status": "CONFIRMED",
    "hotel_id": 1,
    "room_id": 7,
    "checkin_date": "2026-04-14",
    "checkout_date": "2026-04-16",
    "nights": 2,
    "total": 17000000,
    "deposit_required": true,
    "deposit_amount": 5100000
  }
}
```

Deposit behavior:
- If `guarantee_type = "DEPOSIT"`, the API currently sets:
  - `deposit_required_flag = 1`
  - `deposit_amount = 30%` of reservation total
- Otherwise `deposit_amount = 0`

### 4.2 Get Reservation by Code

- Method: `GET`
- Endpoint: `/reservations/:code`
- Path params:
  - `code` (string, required)

Response includes:
- reservation financial summary from `vw_ReservationTotal`
- `rooms`
- `status_history`
- guest and hotel display fields

Validation:
- Reservation not found -> `404`

### 4.3 Check In

- Method: `POST`
- Endpoint: `/reservations/:id/checkin`
- Path params:
  - `id` (number, required)
- Body:

```json
{
  "agent_id": 1
}
```

Behavior:
- Only reservations in `CONFIRMED` state can check in.
- Updates:
  - `Reservation.reservation_status -> CHECKED_IN`
  - `ReservationRoom.occupancy_status -> IN_HOUSE`
  - `Room.room_status -> OCCUPIED`
  - inserts `StayRecord`
  - inserts `ReservationStatusHistory`

Validation:
- Invalid reservation ID -> `400`
- Reservation not found or not `CONFIRMED` -> `409`

### 4.4 Check Out

- Method: `POST`
- Endpoint: `/reservations/:id/checkout`
- Path params:
  - `id` (number, required)
- Body:

```json
{
  "agent_id": 1
}
```

Behavior:
- Only reservations in `CHECKED_IN` state can check out.
- Updates:
  - `Reservation.reservation_status -> CHECKED_OUT`
  - `ReservationRoom.occupancy_status -> COMPLETED`
  - `Room.room_status -> AVAILABLE`
  - `Room.housekeeping_status -> DIRTY`
  - updates `StayRecord`
  - auto-creates a `HousekeepingTask`
  - inserts `ReservationStatusHistory`
- After commit, it reads `vw_ReservationTotal` and returns `financials`

Validation:
- Invalid reservation ID -> `400`
- Reservation not found or not `CHECKED_IN` -> `409`

### 4.5 Guest Cancel

- Method: `POST`
- Endpoint: `/reservations/:id/guest-cancel`
- Path params:
  - `id` (number, required)
- Body:

```json
{
  "reason": "Change of travel plans"
}
```

Behavior:
- Only `CONFIRMED` reservations can be guest-cancelled.
- Releases booked inventory back to `OPEN`
- Sets related room back to `AVAILABLE`
- Marks `ReservationRoom.occupancy_status = CANCELLED`
- Writes `ReservationStatusHistory`
- Deposit already paid is treated as forfeited, not refunded

Validation:
- Invalid reservation ID -> `400`
- Reservation not found -> `404`
- Reservation not in `CONFIRMED` -> `409`

### 4.6 Hotel Cancel

- Method: `POST`
- Endpoint: `/reservations/:id/hotel-cancel`
- Path params:
  - `id` (number, required)
- Body:

```json
{
  "reason": "Room issue, cannot honor booking",
  "agent_id": 1
}
```

Behavior:
- Hotel-side cancellation may happen from active reservation states.
- The route:
  - sets reservation to `CANCELLED`
  - releases inventory back to `OPEN`
  - restores room availability
  - marks `ReservationRoom` as cancelled
  - creates a `REFUND` payment if captured money exists
  - writes `ReservationStatusHistory`

Validation:
- Invalid reservation ID -> `400`
- Missing `reason` -> `400`
- Reservation not found -> `404`
- Reservation already `CANCELLED`, `CHECKED_OUT`, or `NO_SHOW` -> `409`

### 4.7 Room Transfer

- Method: `POST`
- Endpoint: `/reservations/:id/transfer`
- Path params:
  - `id` (number, required)
- Body:

```json
{
  "new_room_id": 9,
  "reason": "Air conditioning malfunction",
  "agent_id": 1
}
```

Behavior:
- This route still uses stored procedure `sp_TransferRoom`.
- Reservation must be in `CONFIRMED` or `CHECKED_IN`.
- New room must belong to the same hotel.

Validation:
- Invalid reservation ID -> `400`
- Missing `new_room_id` or `reason` -> `400`
- Reservation not found -> `404`
- Invalid reservation state -> `409`
- Transfer conflict from stored procedure -> `409`

---

## 6. Payments

### 5.1 Create Payment

- Method: `POST`
- Endpoint: `/payments`

Required body fields:
- `reservation_id`
- `amount`

Common optional body fields:
- `payment_type`
- `payment_method`
- `currency_code`

Defaults:
- `payment_type` defaults to `FULL_PAYMENT`
- `payment_method` defaults to `CREDIT_CARD`
- `currency_code` defaults to `VND`

Example body:

```json
{
  "reservation_id": 123,
  "payment_type": "DEPOSIT",
  "payment_method": "CREDIT_CARD",
  "amount": 5100000,
  "currency_code": "VND"
}
```

Current payment types used by the codebase:
- `DEPOSIT`
- `PREPAYMENT`
- `FULL_PAYMENT`
- `REFUND`
- `INCIDENTAL_HOLD`

Current payment methods used by the codebase:
- `CREDIT_CARD`
- `BANK_TRANSFER`
- `WALLET`
- `CASH`
- `CORPORATE_BILLING`
- `POINTS`

Current validation rules:
- Missing `reservation_id` or `amount` -> `400`
- `amount <= 0` -> `400`
- Reservation not found -> `404`
- Reservation in `CANCELLED`, `CHECKED_OUT`, or `NO_SHOW` -> `400`
- Reject if total paid would exceed `grand_total_amount`
- For `DEPOSIT`, reject if total deposited would exceed `deposit_amount`
- For `FULL_PAYMENT`, `amount` must equal the exact remaining balance

Current success response includes `payment_summary`:

```json
{
  "success": true,
  "data": {
    "payment_id": 88,
    "reservation_id": 123,
    "payment_reference": "PAY-1713000000000-ABCD",
    "payment_type": "DEPOSIT",
    "payment_method": "CREDIT_CARD",
    "payment_status": "CAPTURED",
    "amount": 5100000
  },
  "payment_summary": {
    "grand_total": 17000000,
    "total_paid_after": 5100000,
    "remaining_balance": 11900000
  }
}
```

### 5.2 List Payments

- Method: `GET`
- Endpoint: `/payments`
- Query params:
  - `reservation_id` (number, optional)

Behavior:
- If `reservation_id` is provided, returns only that reservation's payments
- Otherwise returns all payments

---

## 7. Services

### 6.1 List Available Services

- Method: `GET`
- Endpoint: `/services`
- Query params:
  - `hotel_id` (number, required)

Validation:
- Missing `hotel_id` -> `400`

### 6.2 Order Service

- Method: `POST`
- Endpoint: `/services/order`

Required body fields:
- `reservation_id`
- `service_id`

Common optional body fields:
- `quantity`
- `special_instruction`
- `scheduled_at`

Example body:

```json
{
  "reservation_id": 123,
  "service_id": 4,
  "quantity": 2,
  "special_instruction": "Use organic products",
  "scheduled_at": "2026-04-15T14:00:00"
}
```

Behavior:
- Reservation must be `CONFIRMED` or `CHECKED_IN`
- Service must belong to the same hotel as the reservation
- Initial `service_status` is `REQUESTED`

Validation:
- Missing `reservation_id` or `service_id` -> `400`
- Reservation not found -> `404`
- Reservation status invalid -> `400`
- Service not found for hotel -> `404`
- Service inactive -> `400`

### 6.3 List Service Orders

- Method: `GET`
- Endpoint: `/services/orders`
- Query params:
  - `reservation_id` (number, required)

Response includes:
- `summary.total_orders`
- `summary.active_orders`
- `summary.total_amount`
- `summary.active_amount`

Validation:
- Missing `reservation_id` -> `400`

### 6.4 Update Service Order Status

- Method: `PUT`
- Endpoint: `/services/orders/:id/status`
- Path params:
  - `id` (number, required)
- Body:

```json
{
  "status": "DELIVERED"
}
```

Valid statuses:
- `CONFIRMED`
- `DELIVERED`
- `CANCELLED`

Validation:
- Invalid order ID -> `400`
- Invalid status -> `400`
- Service order not found -> `404`

### 6.5 Pay for Service Order

- Method: `POST`
- Endpoint: `/services/orders/:id/pay`
- Path params:
  - `id` (number, required)
- Body:

```json
{
  "payment_method": "CREDIT_CARD"
}
```

Behavior:
- Creates a `Payment` row with:
  - `payment_type = INCIDENTAL_HOLD`
  - `payment_reference = INCIDENTAL-ORDER-{orderId}`
- Prevents double payment by checking the same reference
- If the order is not already `DELIVERED`, it is updated to `DELIVERED`

Validation:
- Invalid order ID -> `400`
- Service order not found -> `404`
- Cancelled service order -> `400`
- Already paid -> `400`

---

## 8. Admin and Reporting

### 7.1 Update Room Rate

- Method: `PUT`
- Endpoint: `/admin/rates/:id`
- Path params:
  - `id` (number, required)
- Body:

```json
{
  "final_rate": 9200000,
  "price_source": "MANUAL",
  "updated_by": 1
}
```

Behavior:
- Updates `RoomRate`
- If price change is greater than `50%`, trigger-based logging may create a `RateChangeLog` entry
- All `/api/admin/*` endpoints now require a valid system-user bearer token

Validation:
- Invalid rate ID -> `400`
- Missing `final_rate` -> `400`
- Rate not found -> `404`
- Missing or invalid auth -> `401`

### 7.2 View Rate Alerts

- Method: `GET`
- Endpoint: `/admin/rates/alerts`

### 7.3 Revenue Report by Hotel

- Method: `GET`
- Endpoint: `/admin/reports/revenue`
- Description: Revenue analytics with SQL window functions, partitioned by hotel.

### 7.4 Revenue Report by Brand and Chain

- Method: `GET`
- Endpoint: `/admin/reports/revenue-by-brand`
- Description: Revenue analytics across `HotelChain -> Brand -> Hotel` hierarchy with SQL window functions.

### 7.5 Update Availability with Optimistic Locking

- Method: `PUT`
- Endpoint: `/admin/availability/:id`
- Path params:
  - `id` (number, required)
- Body:

```json
{
  "availability_status": "BLOCKED",
  "expected_version": 3,
  "inventory_note": "Blocked for maintenance"
}
```

Behavior:
- Uses optimistic locking on `RoomAvailability.version_no`
- Update condition is effectively:

```sql
WHERE availability_id = @id AND version_no = @expected_version
```

How to get `availability_id` and `expected_version`:
- Call `GET /api/rooms/availability`
- Read them from each room's `availability_records[]`

Validation:
- Invalid availability ID -> `400`
- Missing `availability_status` -> `400`
- Missing `expected_version` -> `400`
- Availability row not found -> `404`
- Version mismatch -> `409`

Conflict response shape:

```json
{
  "success": false,
  "error": "OPTIMISTIC LOCK CONFLICT: This record was modified by another user since you last read it. Please re-read and retry.",
  "your_expected_version": 3,
  "current_version": 4,
  "current_status": "BLOCKED"
}
```

---

## 9. Locations

### 8.1 Get Location Tree

- Method: `GET`
- Endpoint: `/locations/tree`
- Query params:
  - `root` (string, optional)
  - `root_id` (number, optional)

Behavior:
- If `root_id` is provided, tree starts there
- Else if `root` is provided, tree starts from that name
- Else returns the full hierarchy from root nodes

### 8.2 List Locations

- Method: `GET`
- Endpoint: `/locations`

---

## 10. Housekeeping

### 9.1 List Housekeeping Tasks

- Method: `GET`
- Endpoint: `/housekeeping`
- Query params:
  - `hotel_id` (number, required)
  - `status` (string, optional)
  - `priority` (string, optional)

Response includes:
- task list
- `summary` counts by task status

Validation:
- Missing `hotel_id` -> `400`

### 9.2 Create Housekeeping Task

- Method: `POST`
- Endpoint: `/housekeeping`

Required body fields:
- `hotel_id`
- `room_id`
- `task_type`

Optional body fields:
- `priority_level`
- `note`
- `scheduled_for`
- `assigned_staff_id`

Behavior:
- If `assigned_staff_id` is provided, initial `task_status = ASSIGNED`
- Otherwise initial `task_status = OPEN`

Validation:
- Missing required fields -> `400`

### 9.3 Assign Housekeeping Task

- Method: `PUT`
- Endpoint: `/housekeeping/:id/assign`
- Path params:
  - `id` (number, required)
- Body:

```json
{
  "staff_id": 2,
  "scheduled_for": "2026-04-15T10:00:00"
}
```

Behavior:
- Allowed only when current task status is `OPEN` or `ASSIGNED`
- Sets:
  - `assigned_staff_id`
  - `task_status = ASSIGNED`
  - optional `scheduled_for`

Validation:
- Invalid task ID or missing `staff_id` -> `400`
- Task not found or already in progress/completed -> `404`

### 9.4 Update Housekeeping Status

- Method: `PUT`
- Endpoint: `/housekeeping/:id/status`
- Path params:
  - `id` (number, required)
- Body:

```json
{
  "status": "DONE",
  "note": "Completed with extra sanitation"
}
```

Allowed transitions:
- `ASSIGNED -> IN_PROGRESS`
- `IN_PROGRESS -> DONE`
- `DONE -> VERIFIED`

Room sync mapping:
- `IN_PROGRESS -> IN_PROGRESS`
- `DONE -> CLEAN`
- `VERIFIED -> INSPECTED`

Validation:
- Invalid task ID -> `400`
- Invalid status target -> `400`
- Invalid current state for transition -> `409`

---

## 11. Maintenance

### 10.1 List Maintenance Tickets

- Method: `GET`
- Endpoint: `/maintenance`
- Query params:
  - `hotel_id` (number, required)
  - `status` (string, optional)
  - `severity` (string, optional)

Validation:
- Missing `hotel_id` -> `400`

### 10.2 Create Maintenance Ticket

- Method: `POST`
- Endpoint: `/maintenance`

Required body fields:
- `hotel_id`
- `issue_category`
- `issue_description`

Optional body fields:
- `room_id`
- `reported_by`
- `severity_level`

Example body:

```json
{
  "hotel_id": 1,
  "room_id": 7,
  "reported_by": 2,
  "issue_category": "PLUMBING",
  "issue_description": "Water leak in bathroom ceiling",
  "severity_level": "HIGH"
}
```

Behavior:
- Creates `MaintenanceTicket`
- If `room_id` is present and severity is `HIGH` or `CRITICAL`, room is marked `UNDER_REPAIR`

Validation:
- Missing required fields -> `400`

### 10.3 Update Maintenance Ticket

- Method: `PUT`
- Endpoint: `/maintenance/:id`
- Path params:
  - `id` (number, required)

Common body fields:
- `status`
- `assigned_to`
- `resolution_note`

Behavior:
- Updates ticket status and assignee
- If status becomes `RESOLVED` or `CLOSED` and there are no other active tickets for the same room, the room is restored to `maintenance_status = NORMAL`

Validation:
- Invalid ticket ID -> `400`
- Missing `status` -> `400`
- Ticket not found -> `404`

---

## 12. Invoices

### 11.1 Create Invoice

- Method: `POST`
- Endpoint: `/invoices`

Required body fields:
- `reservation_id`

Optional body fields:
- `invoice_type`
- `billing_name`
- `billing_tax_no`
- `billing_address`

Example body:

```json
{
  "reservation_id": 123,
  "invoice_type": "FINAL",
  "billing_name": "Quoc Anh Nguyen",
  "billing_tax_no": "0312345678",
  "billing_address": "28 Dong Khoi, District 1, HCMC"
}
```

Behavior:
- Reads reservation totals from `vw_ReservationTotal`
- Creates invoice with initial `status = DRAFT`
- Prevents duplicate active invoice of the same `invoice_type`

Validation:
- Missing `reservation_id` -> `400`
- Reservation not found -> `404`
- Existing non-cancelled invoice of same type -> `409`

### 11.2 Get Invoice

- Method: `GET`
- Endpoint: `/invoices/:id`
- Path params:
  - `id` (number, required)

Response includes:
- invoice header
- reservation and guest context
- `line_items.rooms`
- `line_items.services`
- `payments`

Validation:
- Invalid invoice ID -> `400`
- Invoice not found -> `404`

### 11.3 Issue Invoice

- Method: `POST`
- Endpoint: `/invoices/:id/issue`
- Path params:
  - `id` (number, required)

Behavior:
- Only invoices in `DRAFT` can be issued
- Updates:
  - `status = ISSUED`
  - `issued_at = GETDATE()`

Validation:
- Invalid invoice ID -> `400`
- Invoice not found or not `DRAFT` -> `409`

---

## Notes on Current Implementation

- `POST /api/reservations` now documents the actual runtime behavior: direct pessimistic locking on `RoomAvailability`, not a stored procedure call.
- `GET /api/rooms/availability` now exposes `availability_records`, which the admin optimistic locking flow depends on.
- `POST /api/payments` currently blocks payments for reservations in `CANCELLED`, `CHECKED_OUT`, and `NO_SHOW`.
- `/api/auth/*` now provides admin login, guest login, guest registration, and `/api/auth/me`.
- `/api/admin/*` now requires a system-user bearer token.
- `POST /api/reservations/:id/transfer` still depends on `sp_TransferRoom`.
- `POST /api/invoices` uses `vw_ReservationTotal` as the financial source of truth.
