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

---

## 5. Payments 💳

### 5.1 Add New Payment
- **Method**: \`POST\`
- **Endpoint**: \`/payments\`
- **Body** (JSON):
\`\`\`json
{
  "reservation_id": 1,
  "payment_type": "DEPOSIT",
  "payment_method": "CREDIT_CARD",
  "amount": 5000000,
  "currency_code": "VND"
}
\`\`\`

### 5.2 List Payments for a Reservation
- **Method**: \`GET\`
- **Endpoint**: \`/payments\`
- **Query Params**:
  - \`reservation_id\` (number) - Filter by reservation. Example: \`1\`

---

## 6. Admin & Reporting 📊

### 6.1 Update Rate (Price Integrity Guard) ⚠️
Changes a room rate. If changed by > 50%, an automatic Alert is logged.
- **Method**: \`PUT\`
- **Endpoint**: \`/admin/rates/:id\`
- **Path Params**: 
  - \`id\` (number) - Rate ID. Example: \`1\`
- **Body** (JSON):
\`\`\`json
{
  "final_rate": 8000000,
  "price_source": "MANUAL",
  "updated_by": 1
}
\`\`\`

### 6.2 View Price Integrity Alerts
- **Method**: \`GET\`
- **Endpoint**: \`/admin/rates/alerts\`

### 6.3 Revenue Analytics (Window Functions)
Get intelligent financial reporting partitioned by quarter, year, and hotel.
- **Method**: \`GET\`
- **Endpoint**: \`/admin/reports/revenue\`

---

## 7. Locations 🏙️

### 7.1 Location Hierarchy Tree (Recursive CTE)
- **Method**: \`GET\`
- **Endpoint**: \`/locations/tree\`
- **Query Params** (Optional):
  - \`root\` (string) - Name of location root. Example: \`Châu Á\`
  - \`root_id\` (number) - ID of location root. Example: \`1\`
