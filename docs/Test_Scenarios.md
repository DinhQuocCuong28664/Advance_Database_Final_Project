#  LuxeReserve  Test Scenarios
## Advanced Database Concepts Verification

---

##  Table of Contents
1. [Pessimistic Locking](#1-pessimistic-locking--sp_reserveroom)
2. [Price Integrity Guard Trigger](#2-price-integrity-guard-trigger)
3. [Window Functions  Revenue Analytics](#3-window-functions--revenue-analytics)
4. [Recursive CTE  Location Tree](#4-recursive-cte--location-tree)

---

## 1. Pessimistic Locking  sp_ReserveRoom

###  Concept
Stored Procedure `sp_ReserveRoom` su dung `UPDLOCK + HOLDLOCK` e khoa ban ghi `RoomAvailability` khi at phong, ngan chan race condition khi nhieu nguoi at cung luc.

### Test 1.1   at phong thanh cong
**Muc tieu**: at phong available  status chuyen tu `OPEN`  `BOOKED`

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "hotel_id": 2,
    "guest_id": 2,
    "room_id": 7,
    "room_type_id": 4,
    "rate_plan_id": 4,
    "checkin_date": "2026-04-10",
    "checkout_date": "2026-04-12",
    "adult_count": 2,
    "nightly_rate": 8500,
    "currency_code": "THB",
    "guarantee_type": "CARD",
    "purpose_of_stay": "LEISURE",
    "special_request_text": "High floor with city view"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "reservation_id": <new_id>,
    "reservation_code": "RES-20260405-XXXXXX",
    "status": "CONFIRMED",
    "nights": 2,
    "total": 17000
  }
}
```

**Verify (kiem tra RoomAvailability a chuyen sang BOOKED)**:
```sql
SELECT room_id, stay_date, availability_status, sellable_flag
FROM RoomAvailability
WHERE room_id = 7 AND stay_date BETWEEN '2026-04-10' AND '2026-04-11';
-- Expected: availability_status = 'BOOKED', sellable_flag = 0
```

---

### Test 1.2   at phong bi REJECT (phong a booked)
**Muc tieu**: Cung phong, cung ngay  sp_ReserveRoom tra `result_status = 2 (REJECTED)`

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "hotel_id": 2,
    "guest_id": 4,
    "room_id": 7,
    "room_type_id": 4,
    "rate_plan_id": 4,
    "checkin_date": "2026-04-10",
    "checkout_date": "2026-04-12",
    "adult_count": 1,
    "nightly_rate": 8500,
    "currency_code": "THB"
  }'
```

**Expected Response**:
```json
{
  "success": false,
  "error": "Booking failed: REJECTED: Room not available. Current status: BOOKED",
  "failed_date": "2026-04-10"
}
```
**HTTP Status**: `409 Conflict`

---

### Test 1.3   Kiem tra InventoryLockLog
**Muc tieu**: Verify ca lan thanh cong va that bai eu uoc ghi log

```sql
SELECT reservation_code_attempt, room_id, stay_date,
       lock_status, session_id, note
FROM InventoryLockLog
WHERE room_id = 7
ORDER BY lock_acquired_at DESC;
-- Expected: Co ca record SUCCESS (Test 1.1) va FAILED (Test 1.2)
```

---

## 2. Price Integrity Guard Trigger

###  Concept
Trigger `trg_RoomRate_PriceIntegrityGuard` tu ong phat hien khi `final_rate` thay oi > 50%, log vao `RateChangeLog` voi severity = `CRITICAL`.

### Test 2.1   Thay oi gia nho (< 50%)  KHONG trigger
**Muc tieu**: Tang gia 10%  trigger KHONG fire

au tien, xem rate hien tai:
```bash
curl http://localhost:3000/api/admin/rates/alerts
```

Sau o update rate tang 10%:
```bash
curl -X PUT http://localhost:3000/api/admin/rates/1 \
  -H "Content-Type: application/json" \
  -d '{
    "final_rate": 4950000,
    "price_source": "MANUAL",
    "updated_by": 3
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "room_rate_id": 1,
    "old_rate": 4500000,
    "new_rate": 4950000,
    "change_percent": 10,
    "price_guard_triggered": false,
    "trigger_alert": null
  }
}
```

---

### Test 2.2   Thay oi gia > 50%  TRIGGER FIRE!
**Muc tieu**: Tang gia 200%  trigger tu ong log CRITICAL alert

```bash
curl -X PUT http://localhost:3000/api/admin/rates/1 \
  -H "Content-Type: application/json" \
  -d '{
    "final_rate": 15000000,
    "price_source": "MANUAL",
    "updated_by": 3
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "room_rate_id": 1,
    "old_rate": 4950000,
    "new_rate": 15000000,
    "change_percent": 203.03,
    "price_guard_triggered": true,
    "trigger_alert": {
      "old_rate": 4950000,
      "new_rate": 15000000,
      "change_percent": "203.0303",
      "severity_level": "CRITICAL",
      "review_status": "OPEN",
      "change_reason": "[AUTO] Rate change > 50%  flagged by Price Integrity Guard"
    }
  }
}
```

---

### Test 2.3   Xem tat ca alerts
```bash
curl http://localhost:3000/api/admin/rates/alerts
```

**Expected**: Co it nhat 1 record voi `severity_level = CRITICAL`

---

### Test 2.4   Khoi phuc gia goc
```bash
curl -X PUT http://localhost:3000/api/admin/rates/1 \
  -H "Content-Type: application/json" \
  -d '{
    "final_rate": 4500000,
    "price_source": "MANUAL",
    "updated_by": 3
  }'
```

---

## 3. Window Functions  Revenue Analytics

###  Concept
API `/api/admin/reports/revenue` su dung cac Window Functions:
- `DENSE_RANK() OVER()`  Xep hang doanh thu theo room type trong moi hotel
- `SUM() OVER()`  Tinh doanh thu tich luy (cumulative revenue)
- Revenue share percentage  Phan tram ong gop doanh thu

### Test 3.1  Xem Revenue Report
**Prerequisite**: Can co it nhat 1 reservation a ton tai (sample data co san reservation_id = 1)

```bash
curl http://localhost:3000/api/admin/reports/revenue
```

**Expected Response** (voi sample reservation):
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "hotel_name": "The Ritz-Carlton, Saigon",
      "room_type_name": "Deluxe City View",
      "quarter": 2,
      "year": 2026,
      "booking_count": 1,
      "total_revenue": 14850000,
      "avg_nightly_rate": 4500000,
      "revenue_rank_in_hotel": 1,
      "cumulative_revenue": 14850000,
      "revenue_share_pct": 100.00
    }
  ]
}
```

### Test 3.2  Tao them reservation e thay ranking
**Buoc 1**: at them reservation o room khac (suite)

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "hotel_id": 1,
    "guest_id": 3,
    "room_id": 4,
    "room_type_id": 2,
    "rate_plan_id": 1,
    "checkin_date": "2026-04-10",
    "checkout_date": "2026-04-13",
    "adult_count": 2,
    "nightly_rate": 12000000,
    "currency_code": "VND"
  }'
```

**Buoc 2**: Xem lai revenue report

```bash
curl http://localhost:3000/api/admin/reports/revenue
```

**Expected**: Gio se co **2 rows** cho Ritz-Carlton:
- Suite (36,000,000 VND)  `revenue_rank_in_hotel = 1`
- Deluxe (14,850,000 VND)  `revenue_rank_in_hotel = 2`
- `cumulative_revenue` se tich luy qua tung quarter
- `revenue_share_pct` cho thay ty le ong gop cua moi room type

### Test 3.3  Bao cao Doanh thu theo Brand & Chain
**Muc tieu**: Kiem tra Window Functions voi multi-level PARTITION BY (brand_id, chain_id) va JOIN toan bo hierarchy HotelChain  Brand  Hotel

```bash
curl http://localhost:3000/api/admin/reports/revenue-by-brand
```

**Expected Response**:
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "chain_name": "Marriott International",
      "brand_name": "The Ritz-Carlton",
      "hotel_name": "The Ritz-Carlton, Saigon",
      "year": 2026,
      "quarter": 2,
      "booking_count": 1,
      "total_revenue": 14850000,
      "avg_nightly_rate": 4500000,
      "revenue_rank_in_brand": 1,
      "cumulative_brand_revenue": 14850000,
      "revenue_share_in_chain_pct": 100.00,
      "revenue_share_in_brand_pct": 100.00
    }
  ]
}
```

**Kiem tra iem khac biet voi `/reports/revenue`**:
- Co them `chain_name`, `brand_name` (JOIN `HotelChain`, `Brand`)
- `revenue_rank_in_brand`: xep hang TRONG brand (khac voi `revenue_rank_in_hotel`)
- `revenue_share_in_chain_pct`: % ong gop vao toan chuoi
- `revenue_share_in_brand_pct`: % ong gop vao brand
- Khi co nhieu hotel thuoc cung brand, ranking se thay ro su khac biet

---

## 4. Recursive CTE  Location Tree

###  Concept
API `/api/locations/tree` su dung Common Table Expression e quy e duyet cay phan cap ia ly:
`Region  Country  State/Province  City  District`

### Test 4.1  Full tree tu root
**Muc tieu**: Lay toan bo cay tu top-level regions

```bash
curl "http://localhost:3000/api/locations/tree"
```

**Expected**: 17 locations voi `hierarchy_display` co indent theo depth:
```
Southeast Asia
  Vietnam
  Thailand
  Singapore
    Ho Chi Minh
    Khanh Hoa
    Bangkok Metropolitan
      Ho Chi Minh City
      Nha Trang
      Bangkok
      Singapore City
        District 1
        District 7
        Silom
        Marina Bay
```

### Test 4.2  Sub-tree tu Vietnam
**Muc tieu**: Chi lay nhanh Vietnam va cac con

```bash
curl "http://localhost:3000/api/locations/tree->root=Vietnam"
```

**Expected**: Chi tra ve Vietnam + children:
```json
{
  "success": true,
  "count": 5,
  "data": [
    { "location_name": "Vietnam",           "tree_depth": 0 },
    { "location_name": "Ho Chi Minh",        "tree_depth": 1 },
    { "location_name": "Khanh Hoa",          "tree_depth": 1 },
    { "location_name": "Ho Chi Minh City",   "tree_depth": 2 },
    { "location_name": "Nha Trang",          "tree_depth": 2 },
    { "location_name": "District 1",         "tree_depth": 3 },
    { "location_name": "District 7",         "tree_depth": 3 }
  ]
}
```

### Test 4.3  Sub-tree tu ID
```bash
curl "http://localhost:3000/api/locations/tree->root_id=5"
```

**Expected**: Singapore + Singapore City + Marina Bay

### Test 4.4  Flat list (so sanh)
```bash
curl "http://localhost:3000/api/locations"
```

**Expected**: 17 locations, sap xep theo `level` roi `location_name`, KHONG co `tree_depth` hay `hierarchy_display`

---

##  Quick Test Script (PowerShell)

Chay tat ca tests nhanh:

```powershell
$base = "http://localhost:3000/api"
$headers = @{ "Content-Type" = "application/json" }

Write-Host "`n TEST 1: PESSIMISTIC LOCKING " -ForegroundColor Cyan

# 1.1 Book room 8 (W Bangkok, Wonderful Room)
Write-Host "`n[1.1] Booking room 8..." -ForegroundColor Yellow
$body = '{"hotel_id":2,"guest_id":2,"room_id":8,"room_type_id":4,"rate_plan_id":4,"checkin_date":"2026-04-10","checkout_date":"2026-04-12","adult_count":2,"nightly_rate":8500,"currency_code":"THB"}'
Invoke-RestMethod -Uri "$base/reservations" -Method Post -Headers $headers -Body $body | ConvertTo-Json -Depth 5

# 1.2 Try booking same room, same dates (should FAIL)
Write-Host "`n[1.2] Booking SAME room again (expect FAIL)..." -ForegroundColor Yellow
try {
  $body2 = '{"hotel_id":2,"guest_id":4,"room_id":8,"room_type_id":4,"rate_plan_id":4,"checkin_date":"2026-04-10","checkout_date":"2026-04-12","adult_count":1,"nightly_rate":8500,"currency_code":"THB"}'
  Invoke-RestMethod -Uri "$base/reservations" -Method Post -Headers $headers -Body $body2 | ConvertTo-Json -Depth 5
} catch { Write-Host "   REJECTED (409): $($_.ErrorDetails.Message)" -ForegroundColor Red }

Write-Host "`n TEST 2: PRICE INTEGRITY GUARD " -ForegroundColor Cyan

# 2.1 Small change (no trigger)
Write-Host "`n[2.1] Rate change < 50% (no alert)..." -ForegroundColor Yellow
$rate1 = '{"final_rate":4950000,"price_source":"MANUAL","updated_by":3}'
Invoke-RestMethod -Uri "$base/admin/rates/1" -Method Put -Headers $headers -Body $rate1 | ConvertTo-Json -Depth 5

# 2.2 Big change > 50% (trigger fires!)
Write-Host "`n[2.2] Rate change > 50% (TRIGGER!)..." -ForegroundColor Yellow
$rate2 = '{"final_rate":15000000,"price_source":"MANUAL","updated_by":3}'
Invoke-RestMethod -Uri "$base/admin/rates/1" -Method Put -Headers $headers -Body $rate2 | ConvertTo-Json -Depth 5

# 2.3 View alerts
Write-Host "`n[2.3] View Price Guard Alerts..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$base/admin/rates/alerts" | ConvertTo-Json -Depth 5

# 2.4 Restore rate
$restore = '{"final_rate":4500000,"price_source":"MANUAL","updated_by":3}'
Invoke-RestMethod -Uri "$base/admin/rates/1" -Method Put -Headers $headers -Body $restore | Out-Null

Write-Host "`n TEST 3: WINDOW FUNCTIONS " -ForegroundColor Cyan
Write-Host "`n[3.1] Revenue Analytics Report (per Hotel)..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$base/admin/reports/revenue" | ConvertTo-Json -Depth 5

Write-Host "`n[3.3] Revenue Analytics by Brand & Chain..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$base/admin/reports/revenue-by-brand" | ConvertTo-Json -Depth 5

Write-Host "`n TEST 4: RECURSIVE CTE " -ForegroundColor Cyan

# 4.1 Full tree
Write-Host "`n[4.1] Full location tree..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$base/locations/tree" | ConvertTo-Json -Depth 5

# 4.2 Vietnam subtree
Write-Host "`n[4.2] Vietnam subtree..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$base/locations/tree->root=Vietnam" | ConvertTo-Json -Depth 5

# 4.3 Singapore subtree
Write-Host "`n[4.3] Singapore subtree (root_id=5)..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$base/locations/tree->root_id=5" | ConvertTo-Json -Depth 5

Write-Host "`n" -ForegroundColor Green
Write-Host "   ALL TESTS COMPLETED" -ForegroundColor Green
Write-Host "`n" -ForegroundColor Green
```

---

## 5. Payment Validation  Overpayment Prevention

###  Concept
API `POST /api/payments` kiem tra tong tien a thanh toan truoc khi cho phep tao payment moi, ngan chan:
- Thanh toan vuot qua `grand_total_amount`
- Deposit vuot qua `deposit_amount`
- `FULL_PAYMENT` khong ung so tien con lai

### Test 5.1   Deposit thanh cong
**Muc tieu**: Tao deposit trong gioi han cho phep

```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": 1,
    "payment_type": "DEPOSIT",
    "amount": 4500000,
    "currency_code": "VND"
  }'
```

**Expected**: `201` voi `payment_summary.remaining_balance > 0`

---

### Test 5.2   Deposit vuot muc
**Muc tieu**: Deposit lan 2 bi reject vi tong deposit > `deposit_amount`

```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": 1,
    "payment_type": "DEPOSIT",
    "amount": 4500000,
    "currency_code": "VND"
  }'
```

**Expected**: `400`  `"Deposit would exceed required deposit amount"`

---

### Test 5.3   FULL_PAYMENT sai so tien
**Muc tieu**: Tra thieu khi chon `FULL_PAYMENT`  bi reject

```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": 1,
    "payment_type": "FULL_PAYMENT",
    "amount": 5000000,
    "currency_code": "VND"
  }'
```

**Expected**: `400`  `"FULL_PAYMENT must cover the entire remaining balance"`

---

### Test 5.4   FULL_PAYMENT ung so tien con lai
**Muc tieu**: Tra ung remaining balance  thanh cong

```bash
curl -X POST http://localhost:3000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": 1,
    "payment_type": "FULL_PAYMENT",
    "amount": 10350000,
    "currency_code": "VND"
  }'
```

**Expected**: `201` voi `payment_summary.remaining_balance = 0`

---

## 6. Services & Incidental Charges  Dich Vu Phat Sinh

###  Concept
Khach co the at dich vu phat sinh (spa, an uong, transfer, vat dung ca nhan...) trong thoi gian luu tru. API quan ly toan bo lifecycle: browse  order  confirm  deliver  pay.

### Test 6.1  Xem danh muc dich vu
```bash
curl "http://localhost:3000/api/services->hotel_id=1"
```

**Expected**: Danh sach services cua Ritz-Carlton (SPA, TRANSFER, BUTLER, DINING)

---

### Test 6.2   at dich vu phat sinh
**Muc tieu**: at VIP Spa Treatment cho reservation ang CONFIRMED

```bash
curl -X POST http://localhost:3000/api/services/order \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": 1,
    "service_id": 1,
    "quantity": 2,
    "special_instruction": "Use organic essential oils",
    "scheduled_at": "2026-04-06T14:00:00"
  }'
```

**Expected**: `201` voi `service_status = "REQUESTED"`, `final_amount = 7000000` (3,500,000  2)

---

### Test 6.3  Xem dich vu a at
```bash
curl "http://localhost:3000/api/services/orders->reservation_id=1"
```

**Expected**: Danh sach orders voi `summary.active_amount` tinh tong

---

### Test 6.4   Thanh toan dich vu phat sinh
**Muc tieu**: Thanh toan incidental cho service order

```bash
curl -X POST http://localhost:3000/api/services/orders/1/pay \
  -H "Content-Type: application/json" \
  -d '{ "payment_method": "CREDIT_CARD" }'
```

**Expected**: `201`  Payment `INCIDENTAL_HOLD` created, service status  `DELIVERED`

### Test 6.5   Thanh toan trung
**Muc tieu**: Thanh toan lai service a paid  reject

```bash
curl -X POST http://localhost:3000/api/services/orders/1/pay \
  -H "Content-Type: application/json" \
  -d '{ "payment_method": "CREDIT_CARD" }'
```

**Expected**: `400`  `"Service order #1 has already been paid"`

---

##  Test Summary Checklist

| # | Test | Concept | Expected |
------------------------------------------------------------
| 1.1 | Book available room | Pessimistic Lock |  SUCCESS, status CONFIRMED |
| 1.2 | Book same room again | Pessimistic Lock |  409 REJECTED |
| 1.3 | Check InventoryLockLog | Pessimistic Lock |  Ca SUCCESS + FAILED logs |
| 2.1 | Rate change < 50% | Trigger |  No alert triggered |
| 2.2 | Rate change > 50% | Trigger |  CRITICAL alert logged |
| 2.3 | View alerts list | Trigger |  Alert records visible |
| 3.1 | Revenue report (per hotel) | Window Functions |  DENSE_RANK, cumulative, share% |
| 3.2 | Multi-booking revenue | Window Functions |  Ranking changes |
| 3.3 | Revenue by Brand & Chain | Window Functions |  Multi-level PARTITION BY brand_id, chain_id |
| 4.1 | Full location tree | Recursive CTE |  17 nodes, hierarchy display |
| 4.2 | Vietnam subtree | Recursive CTE |  7 nodes (VN  districts) |
| 4.3 | Singapore subtree | Recursive CTE |  3 nodes |
| 4.4 | Flat list compare | Recursive CTE |  No hierarchy, sorted by level |
| 5.1 | Deposit thanh cong | Payment Validation |  201, remaining > 0 |
| 5.2 | Deposit vuot muc | Payment Validation |  400, deposit exceeded |
| 5.3 | FULL_PAYMENT sai so | Payment Validation |  400, must equal remaining |
| 5.4 | FULL_PAYMENT ung | Payment Validation |  201, remaining = 0 |
| 6.1 | Xem danh muc dich vu | Services |  Service catalog |
| 6.2 | at dich vu phat sinh | Services |  201, REQUESTED |
| 6.3 | Xem orders | Services |  Orders + summary |
| 6.4 | Thanh toan incidental | Services |  201, INCIDENTAL_HOLD |
| 6.5 | Thanh toan trung | Services |  400, already paid |

