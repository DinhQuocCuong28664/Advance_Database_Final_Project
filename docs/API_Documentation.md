# LuxeReserve  API Documentation

> **Base URL:** `http://localhost:3000/api`  
> **Format:** JSON  
> **Auth:** Bearer token  `Authorization: Bearer <token>`  
> **Total endpoints:** 82 across 14 route groups

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Hotels](#2-hotels)
3. [Rooms](#3-rooms)
4. [Promotions](#4-promotions)
5. [Reservations](#5-reservations)
6. [Payments](#6-payments)
7. [Services](#7-services)
8. [Invoices](#8-invoices)
9. [Housekeeping](#9-housekeeping)
10. [Maintenance](#10-maintenance)
11. [Guests](#11-guests)
12. [Locations](#12-locations)
13. [Admin](#13-admin)
14. [VNPay](#14-vnpay)

---

## 1. Authentication

### POST `/auth/login`
Unified login for both guests and system users. App auto-detects and redirects to the correct portal.

**Request Body**
```json
{ "login": "cashier", "password": "cashier" }
```

**Response**
```json
{
  "success": true,
  "token": "<jwt>",
  "user": {
    "user_type": "SYSTEM_USER",
    "user_id": 7,
    "username": "cashier",
    "full_name": "Front Desk Cashier",
    "roles": ["CASHIER", "FRONT_DESK"]
  }
}
```

**Guest login response user object**
```json
{
  "user_type": "GUEST",
  "guest_id": 1,
  "guest_code": "G-DQC",
  "full_name": "Dinh Quoc Cuong",
  "email": "dqc@luxereserve.local",
  "loyalty_accounts": [
    { "membership_no": "MAR-PLT-DQC", "tier_code": "PLATINUM", "points_balance": 150000 }
  ]
}
```

---

### POST `/auth/admin/login`
System user only login (alternative endpoint).

**Request Body:** `{ "username": "admin", "password": "admin" }`

---

### POST `/auth/guest/login`
Guest only login.

**Request Body:** `{ "login": "dqc", "password": "dqc" }`

---

### POST `/auth/guest/register`
Register a new guest account.

**Request Body**
```json
{
  "login_email": "john@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Doe",
  "phone_country_code": "+84",
  "phone_number": "0901234567"
}
```

**Note:** New accounts are `LOCKED` until email is verified.

**Response**
```json
{
  "success": true,
  "verification_required": true,
  "login_email": "john@example.com",
  "message": "Account created. Check your email for the verification code."
}
```

---

### POST `/auth/guest/verify-email`
Verify email with OTP sent after registration.

**Request Body:** `{ "login_email": "john@example.com", "otp_code": "123456" }`

---

### POST `/auth/guest/resend-verification`
Resend OTP verification email.

**Request Body:** `{ "login_email": "john@example.com" }`

---

### GET `/auth/me` 
Get current authenticated user details.

**Headers:** `Authorization: Bearer <token>`

---

## 2. Hotels

### GET `/hotels`
List all active hotels. **Hybrid**  merges SQL operational data with MongoDB rich content.

**Response fields per hotel**
| Field | Source | Description |
|---|---|---|
| `hotel_id`, `hotel_name`, `hotel_code` | SQL | Identification |
| `star_rating`, `hotel_type`, `status` | SQL | Classification |
| `check_in_time`, `check_out_time` | SQL | Policy |
| `brand_name`, `chain_name` | SQL | Hierarchy |
| `city_name` | SQL | Location |
| `description` | MongoDB | Rich text |
| `hero_image` | MongoDB | Hero image URL |
| `amenity_count` | MongoDB | Count of amenities |
| `location_detail` | MongoDB | Coordinates, address |

**Example Response**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "hotel_id": 1,
      "hotel_name": "LuxeReserve Hanoi",
      "star_rating": 5,
      "brand_name": "LuxeReserve",
      "city_name": "Hanoi",
      "hero_image": "https://...",
      "description": "A 5-star property in the heart of Hanoi..."
    }
  ]
}
```

---

### GET `/hotels/:id`
Full hotel detail including room types, amenities, and MongoDB rich content.

**Path param:** `id`  hotel_id (integer)

**Response includes**
- Full hotel info (SQL + MongoDB merged)
- `room_types[]`  each with pricing, features, images from MongoDB
- `amenities[]`  each with name, category, icon from MongoDB
- `images[]`  gallery from MongoDB
- `contact`  contact info from MongoDB

---

## 3. Rooms

### GET `/rooms/availability`
Check available rooms for a date range.

**Query Parameters**
| Param | Required | Description |
|---|---|---|
| `hotel_id` |  | Hotel ID |
| `checkin` |  | Date `YYYY-MM-DD` |
| `checkout` |  | Date `YYYY-MM-DD` |

**Logic:** Returns rooms where `RoomAvailability.availability_status = 'OPEN'` for ALL requested nights. Joins with `RoomRate` to get nightly rates.

**Response per room**
```json
{
  "room_id": 10,
  "room_number": "101",
  "floor_number": 1,
  "room_type_name": "Deluxe Room",
  "bed_type": "KING",
  "max_adults": 2,
  "room_size_sqm": 45,
  "min_nightly_rate": 1500000,
  "availability_records": [
    { "stay_date": "2026-05-01", "availability_status": "OPEN", "version_no": 1 }
  ]
}
```

---

## 4. Promotions

### GET `/promotions`
List active promotions, optionally filtered and with guest eligibility.

**Query Parameters**
| Param | Required | Description |
|---|---|---|
| `hotel_id` |  | Filter by hotel |
| `guest_id` |  | Check eligibility for this guest |
| `member_only` |  | `true` / `false` |

**Response per promotion**
```json
{
  "promotion_id": 1,
  "promotion_code": "SUMMER25",
  "promotion_name": "Summer 25% Off",
  "promotion_type": "PERCENTAGE",
  "discount_value": 25,
  "member_only_flag": false,
  "min_nights": 2,
  "scope_type": "HOTEL",
  "eligible_for_guest": 1
}
```

---

## 5. Reservations

### POST `/reservations`
Create a new reservation with **pessimistic locking** (UPDLOCK + HOLDLOCK per night).

**Request Body**
```json
{
  "hotel_id": 1,
  "room_id": 10,
  "room_type_id": 2,
  "rate_plan_id": 1,
  "checkin_date": "2026-05-10",
  "checkout_date": "2026-05-13",
  "adult_count": 2,
  "child_count": 0,
  "nightly_rate": 1500000,
  "currency_code": "VND",
  "guarantee_type": "DEPOSIT",
  "purpose_of_stay": "LEISURE",
  "special_request_text": "High floor please",
  "guest_id": 1
}
```

**For anonymous booking**  provide `guest_profile` instead of `guest_id`:
```json
{
  "guest_profile": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone_country_code": "+84",
    "phone_number": "0901234567"
  }
}
```

**Business Rules**
- `nightly_rate` must be > 0
- `checkout_date` must be after `checkin_date`
- Max stay: 90 nights
- If `guarantee_type = 'DEPOSIT'`: deposit = 30% of total
- Locks `RoomAvailability` rows with UPDLOCK for each night atomically

**Response**
```json
{
  "success": true,
  "data": {
    "reservation_id": 42,
    "reservation_code": "RES-20260510-ABC123",
    "status": "CONFIRMED",
    "nights": 3,
    "total": 4500000,
    "deposit_required": true,
    "deposit_amount": 1350000,
    "guest_id": 1
  }
}
```

**Error codes**
| Status | Meaning |
|---|---|
| `400` | Validation failed |
| `404` | Guest not found |
| `409` | Room not available on one or more nights |

---

### GET `/reservations`
List reservations with optional filters.

**Query Parameters**
| Param | Description |
|---|---|
| `guest_id` | Filter by guest |
| `email` | Filter by guest email |
| `hotel_id` | Filter by hotel |
| `status` | `CONFIRMED` / `CHECKED_IN` / `CHECKED_OUT` / `CANCELLED` |
| `checkin_date` | Filter by check-in date `YYYY-MM-DD` |
| `checkout_date` | Filter by check-out date `YYYY-MM-DD` |
| `reservation_code` | Exact match |
| `limit` | Max results (default 20, max 100) |

---

### GET `/reservations/:code`
Get full reservation detail by reservation code.

**Uses `vw_ReservationTotal`**  includes `balance_due`, `total_paid`, `room_subtotal`, `service_subtotal`.

**Response includes**
- Core reservation data
- `rooms[]`  room line items with room type and number
- `status_history[]`  audit trail of status changes

---

### GET `/reservations/by-guest/:guestCode`
List all reservations by guest code (e.g. `G-DQC`).

---

### POST `/reservations/:id/checkin`
Check in a reservation. Status must be `CONFIRMED`.

**Request Body:** `{ "agent_id": 1 }` (optional)

**Side effects**
- Sets `reservation_status = 'CHECKED_IN'`
- Sets `Room.room_status = 'OCCUPIED'`
- Creates `StayRecord`
- Adds status history entry

---

### POST `/reservations/:id/checkout`
Check out a reservation. Status must be `CHECKED_IN`.

**Request Body:** `{ "agent_id": 1 }` (optional)

**Side effects**
- Sets `reservation_status = 'CHECKED_OUT'`
- Sets `Room.room_status = 'AVAILABLE'`, `housekeeping_status = 'DIRTY'`
- Completes `StayRecord`
- Creates `HousekeepingTask` with HIGH priority

**Response includes `financials`:** `grand_total`, `total_paid`, `balance_due`

---

### POST `/reservations/:id/guest-cancel`  GUEST
Cancel a reservation as guest. Status must be `CONFIRMED`.

**Request Body:** `{ "reason": "Change of plans" }`

**Policy:** Deposit is **forfeited** (no refund). Room availability released.

---

### POST `/reservations/:id/hotel-cancel`  ADMIN/FRONT_DESK/CASHIER
Cancel a reservation as hotel staff.

**Request Body:** `{ "reason": "Hotel maintenance", "agent_id": 1 }`

---

### POST `/reservations/:id/transfer`  ADMIN/FRONT_DESK/CASHIER
Transfer guest to a different room using `sp_TransferRoom`.

**Request Body:**
```json
{
  "new_room_id": 15,
  "reason": "Guest requested upgrade",
  "agent_id": 1
}
```

---

## 6. Payments

### POST `/payments`
Create a payment for a reservation.

**Request Body**
```json
{
  "reservation_id": 42,
  "payment_type": "DEPOSIT",
  "payment_method": "CREDIT_CARD",
  "amount": 1350000,
  "currency_code": "VND"
}
```

**Payment types**
| Type | Description |
|---|---|
| `DEPOSIT` | 30% deposit (must not exceed deposit_amount) |
| `PREPAYMENT` | Partial payment |
| `FULL_PAYMENT` | Must equal remaining balance exactly |

**Business Rules**
- Cannot pay on `CANCELLED`, `CHECKED_OUT`, or `NO_SHOW` reservations
- Total payments cannot exceed `grand_total_amount`
- `DEPOSIT` type cannot exceed `deposit_amount`
- `FULL_PAYMENT` must equal exactly the remaining balance

**Response includes `payment_summary`:** `grand_total`, `total_paid_after`, `remaining_balance`

---

### GET `/payments`
List payments.

**Query Parameters:** `reservation_id` (optional)

---

## 7. Services

### GET `/services->hotel_id=1`
List available services in the hotel's service catalog.

**Response per service**
```json
{
  "service_id": 1,
  "service_code": "SPA-MASSAGE",
  "service_name": "Thai Massage 60min",
  "service_category": "SPA",
  "pricing_model": "PER_SESSION",
  "base_price": 800000,
  "currency_code": "VND"
}
```

---

### POST `/services/order`
Order a service for a reservation.

**Request Body**
```json
{
  "reservation_id": 42,
  "service_id": 1,
  "quantity": 2,
  "special_instruction": "Aromatherapy please",
  "scheduled_at": "2026-05-11T14:00:00Z"
}
```

**Restrictions:** Reservation must be `CONFIRMED` or `CHECKED_IN`.

---

### GET `/services/orders->reservation_id=42`
List all service orders for a reservation with totals summary.

---

### PUT `/services/orders/:id/status`
Update service order status.

**Request Body:** `{ "status": "DELIVERED" }`

**Valid statuses:** `CONFIRMED`, `DELIVERED`, `CANCELLED`

---

### POST `/services/orders/:id/pay`
Pay for a specific service order (creates incidental payment).

**Request Body:** `{ "payment_method": "CREDIT_CARD" }` (optional)

---

## 8. Invoices

### POST `/invoices`
Generate an invoice for a reservation (from `vw_ReservationTotal`).

**Request Body:** `{ "reservation_id": 42 }`

---

### GET `/invoices`
List invoices.

**Query Parameters:** `reservation_id`, `status`

---

### GET `/invoices/:id`
Get invoice detail.

---

### POST `/invoices/:id/issue`
Issue an invoice (change status from `DRAFT` to `ISSUED`).

---

## 9. Housekeeping

### POST `/housekeeping`
Create a housekeeping task.

**Request Body**
```json
{
  "hotel_id": 1,
  "room_id": 10,
  "task_type": "CLEANING",
  "priority_level": "HIGH",
  "note": "Deep clean required",
  "scheduled_for": "2026-05-10T09:00:00",
  "assigned_staff_id": 5
}
```

**Task types:** `CLEANING`, `TURN_DOWN`, `INSPECTION`, `DEEP_CLEAN`

---

### GET `/housekeeping`
List housekeeping tasks.

**Query Parameters:** `hotel_id`, `status`, `priority`

---

### PUT `/housekeeping/:id/assign`
Assign a task to a staff member.

**Request Body:** `{ "staff_id": 5, "scheduled_for": "2026-05-10T09:00:00" }`

---

### PUT `/housekeeping/:id/status`
Update task status.

**Request Body:** `{ "status": "DONE" }`

**Flow:** `OPEN` -> `ASSIGNED` -> `IN_PROGRESS` -> `DONE` -> `VERIFIED`

**Valid status updates for this endpoint:** `IN_PROGRESS`, `DONE`, `VERIFIED`

---

## 10. Maintenance

### POST `/maintenance`
Create a maintenance ticket.

**Request Body**
```json
{
  "hotel_id": 1,
  "room_id": 10,
  "reported_by": 1,
  "issue_category": "PLUMBING",
  "issue_description": "Sink is leaking",
  "severity_level": "HIGH"
}
```

---

### GET `/maintenance`
List maintenance tickets.

**Query Parameters:** `hotel_id`, `status`, `severity`

---

### PUT `/maintenance/:id`
Update maintenance ticket (assign, resolve, change status).

---

## 11. Guests

### GET `/guests`
List guests.

**Query Parameters:** `email`, `guest_code`, `limit`

---

### GET `/guests/:id`
Get guest profile by `guest_id`.

---

### POST `/guests`
Create a guest profile (without auth account).

**Request Body**
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane@example.com",
  "phone_country_code": "+84",
  "phone_number": "0912345678",
  "nationality_country_code": "VN"
}
```

---

## 12. Locations

### GET `/locations`
List all locations (flat list).

---

### GET `/locations/tree`
Get location hierarchy as a tree (Country  City  District).

---

## 13. Admin

> Current backend middleware requires an authenticated `SYSTEM_USER` token via `requireSystemUser`.

### GET `/admin/accounts`
List all accounts (system users + guests).

---

### PUT `/admin/accounts/guest/:id`
Update guest account status or info.

---

### PUT `/admin/accounts/system/:id`
Update system user account.

---

### GET `/admin/reports/summary`
Dashboard KPI summary.

**Response**
```json
{
  "total_reservations": 120,
  "confirmed": 45,
  "checked_in": 12,
  "checked_out": 55,
  "cancelled": 8,
  "total_revenue": 450000000,
  "this_month_revenue": 85000000,
  "available_rooms": 87
}
```

---

### GET `/admin/reports/revenue`
Revenue breakdown by hotel with date filtering.

**Query Parameters:** `hotel_id`, `from`, `to` (dates)

---

### GET `/admin/reports/revenue-by-brand`
Revenue grouped by brand using SQL Window Functions.

---

### GET `/admin/rates/alerts`
Price anomaly alerts  rates that changed >50%.

---

### PUT `/admin/availability/:id`
Update room availability status manually.

**Request Body:** `{ "availability_status": "MAINTENANCE", "note": "AC repair" }`

---

### PUT `/admin/rates/:id`
Update a room rate.

---

## 14. VNPay

>  Integration ready but **not activated**  waiting for production `IPN_URL`.

### POST `/vnpay/create-payment`
Create a VNPay payment URL for redirect.

**Request Body**
```json
{
  "reservation_id": 42,
  "amount": 1350000,
  "order_desc": "Deposit for RES-20260510-ABC123"
}
```

---

### GET `/vnpay/return`
Handles redirect back from VNPay after payment attempt.

---

### GET `/vnpay/ipn`
VNPay IPN (Instant Payment Notification) webhook endpoint.

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

| HTTP Status | Meaning |
|---|---|
| `400` | Bad request / validation error |
| `401` | Unauthorized  missing or invalid token |
| `403` | Forbidden  insufficient permissions |
| `404` | Resource not found |
| `409` | Conflict  e.g. room already booked, wrong status |
| `500` | Internal server error |

---

## Authentication Reference

| Account | Password | Type | Roles | Portal |
------------------------------------------------------------
| `admin` | `admin` | System | ADMIN | `/admin` |
| `cashier` | `cashier` | System | CASHIER, FRONT_DESK | `/cashier` |
| `dqc` | `dqc` | Guest |  (PLATINUM member) | `/` |

---

## Architecture Notes

### Polyglot Persistence
- **SQL Server**: Transactional data (reservations, payments, inventory, users)
- **MongoDB**: Rich content (hotel descriptions, room photos, amenities, icons)

### Locking Strategy
- **Pessimistic Lock**: `UPDLOCK + HOLDLOCK` per room per night during booking
- **Optimistic Lock**: `version_no` check for inventory updates

### Security
- JWT Bearer tokens (configurable; default `8h`)
- Middleware in current code: `requireAuth`, `requireSystemUser`
- Guest-cancel restricted to reservation owner only

*Last updated: 2026-04-20 | LuxeReserve v1.0*
