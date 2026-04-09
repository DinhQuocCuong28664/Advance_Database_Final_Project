# 🧪 LuxeReserve — Test Scenarios
## Advanced Database Concepts Verification

---

## 📋 Table of Contents
1. [Pessimistic Locking](#1-pessimistic-locking--sp_reserveroom)
2. [Price Integrity Guard Trigger](#2-price-integrity-guard-trigger)
3. [Window Functions — Revenue Analytics](#3-window-functions--revenue-analytics)
4. [Recursive CTE — Location Tree](#4-recursive-cte--location-tree)

---

## 1. Pessimistic Locking — sp_ReserveRoom

### 📖 Concept
Stored Procedure `sp_ReserveRoom` sử dụng `UPDLOCK + HOLDLOCK` để khóa bản ghi `RoomAvailability` khi đặt phòng, ngăn chặn race condition khi nhiều người đặt cùng lúc.

### Test 1.1 ✅ — Đặt phòng thành công
**Mục tiêu**: Đặt phòng available → status chuyển từ `OPEN` → `BOOKED`

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

**Verify (kiểm tra RoomAvailability đã chuyển sang BOOKED)**:
```sql
SELECT room_id, stay_date, availability_status, sellable_flag
FROM RoomAvailability
WHERE room_id = 7 AND stay_date BETWEEN '2026-04-10' AND '2026-04-11';
-- Expected: availability_status = 'BOOKED', sellable_flag = 0
```

---

### Test 1.2 ❌ — Đặt phòng bị REJECT (phòng đã booked)
**Mục tiêu**: Cùng phòng, cùng ngày → sp_ReserveRoom trả `result_status = 2 (REJECTED)`

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

### Test 1.3 📋 — Kiểm tra InventoryLockLog
**Mục tiêu**: Verify cả lần thành công và thất bại đều được ghi log

```sql
SELECT reservation_code_attempt, room_id, stay_date,
       lock_status, session_id, note
FROM InventoryLockLog
WHERE room_id = 7
ORDER BY lock_acquired_at DESC;
-- Expected: Có cả record SUCCESS (Test 1.1) và FAILED (Test 1.2)
```

---

## 2. Price Integrity Guard Trigger

### 📖 Concept
Trigger `trg_RoomRate_PriceIntegrityGuard` tự động phát hiện khi `final_rate` thay đổi > 50%, log vào `RateChangeLog` với severity = `CRITICAL`.

### Test 2.1 ✅ — Thay đổi giá nhỏ (< 50%) → KHÔNG trigger
**Mục tiêu**: Tăng giá 10% → trigger KHÔNG fire

Đầu tiên, xem rate hiện tại:
```bash
curl http://localhost:3000/api/admin/rates/alerts
```

Sau đó update rate tăng 10%:
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

### Test 2.2 🚨 — Thay đổi giá > 50% → TRIGGER FIRE!
**Mục tiêu**: Tăng giá 200% → trigger tự động log CRITICAL alert

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
      "change_reason": "[AUTO] Rate change > 50% — flagged by Price Integrity Guard"
    }
  }
}
```

---

### Test 2.3 📋 — Xem tất cả alerts
```bash
curl http://localhost:3000/api/admin/rates/alerts
```

**Expected**: Có ít nhất 1 record với `severity_level = CRITICAL`

---

### Test 2.4 🔄 — Khôi phục giá gốc
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

## 3. Window Functions — Revenue Analytics

### 📖 Concept
API `/api/admin/reports/revenue` sử dụng các Window Functions:
- `DENSE_RANK() OVER()` — Xếp hạng doanh thu theo room type trong mỗi hotel
- `SUM() OVER()` — Tính doanh thu tích lũy (cumulative revenue)
- Revenue share percentage — Phần trăm đóng góp doanh thu

### Test 3.1 — Xem Revenue Report
**Prerequisite**: Cần có ít nhất 1 reservation đã tồn tại (sample data có sẵn reservation_id = 1)

```bash
curl http://localhost:3000/api/admin/reports/revenue
```

**Expected Response** (với sample reservation):
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

### Test 3.2 — Tạo thêm reservation để thấy ranking
**Bước 1**: Đặt thêm reservation ở room khác (suite)

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

**Bước 2**: Xem lại revenue report

```bash
curl http://localhost:3000/api/admin/reports/revenue
```

**Expected**: Giờ sẽ có **2 rows** cho Ritz-Carlton:
- Suite (36,000,000 VND) → `revenue_rank_in_hotel = 1`
- Deluxe (14,850,000 VND) → `revenue_rank_in_hotel = 2`
- `cumulative_revenue` sẽ tích lũy qua từng quarter
- `revenue_share_pct` cho thấy tỷ lệ đóng góp của mỗi room type

### Test 3.3 — Báo cáo Doanh thu theo Brand & Chain
**Mục tiêu**: Kiểm tra Window Functions với multi-level PARTITION BY (brand_id, chain_id) và JOIN toàn bộ hierarchy HotelChain → Brand → Hotel

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

**Kiểm tra điểm khác biệt với `/reports/revenue`**:
- Có thêm `chain_name`, `brand_name` (JOIN `HotelChain`, `Brand`)
- `revenue_rank_in_brand`: xếp hạng TRONG brand (khác với `revenue_rank_in_hotel`)
- `revenue_share_in_chain_pct`: % đóng góp vào toàn chuỗi
- `revenue_share_in_brand_pct`: % đóng góp vào brand
- Khi có nhiều hotel thuộc cùng brand, ranking sẽ thấy rõ sự khác biệt

---

## 4. Recursive CTE — Location Tree

### 📖 Concept
API `/api/locations/tree` sử dụng Common Table Expression đệ quy để duyệt cây phân cấp địa lý:
`Region → Country → State/Province → City → District`

### Test 4.1 — Full tree từ root
**Mục tiêu**: Lấy toàn bộ cây từ top-level regions

```bash
curl "http://localhost:3000/api/locations/tree"
```

**Expected**: 17 locations với `hierarchy_display` có indent theo depth:
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

### Test 4.2 — Sub-tree từ Vietnam
**Mục tiêu**: Chỉ lấy nhánh Vietnam và các con

```bash
curl "http://localhost:3000/api/locations/tree?root=Vietnam"
```

**Expected**: Chỉ trả về Vietnam + children:
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

### Test 4.3 — Sub-tree từ ID
```bash
curl "http://localhost:3000/api/locations/tree?root_id=5"
```

**Expected**: Singapore + Singapore City + Marina Bay

### Test 4.4 — Flat list (so sánh)
```bash
curl "http://localhost:3000/api/locations"
```

**Expected**: 17 locations, sắp xếp theo `level` rồi `location_name`, KHÔNG có `tree_depth` hay `hierarchy_display`

---

## 🚀 Quick Test Script (PowerShell)

Chạy tất cả tests nhanh:

```powershell
$base = "http://localhost:3000/api"
$headers = @{ "Content-Type" = "application/json" }

Write-Host "`n═══ TEST 1: PESSIMISTIC LOCKING ═══" -ForegroundColor Cyan

# 1.1 Book room 8 (W Bangkok, Wonderful Room)
Write-Host "`n[1.1] Booking room 8..." -ForegroundColor Yellow
$body = '{"hotel_id":2,"guest_id":2,"room_id":8,"room_type_id":4,"rate_plan_id":4,"checkin_date":"2026-04-10","checkout_date":"2026-04-12","adult_count":2,"nightly_rate":8500,"currency_code":"THB"}'
Invoke-RestMethod -Uri "$base/reservations" -Method Post -Headers $headers -Body $body | ConvertTo-Json -Depth 5

# 1.2 Try booking same room, same dates (should FAIL)
Write-Host "`n[1.2] Booking SAME room again (expect FAIL)..." -ForegroundColor Yellow
try {
  $body2 = '{"hotel_id":2,"guest_id":4,"room_id":8,"room_type_id":4,"rate_plan_id":4,"checkin_date":"2026-04-10","checkout_date":"2026-04-12","adult_count":1,"nightly_rate":8500,"currency_code":"THB"}'
  Invoke-RestMethod -Uri "$base/reservations" -Method Post -Headers $headers -Body $body2 | ConvertTo-Json -Depth 5
} catch { Write-Host "  → REJECTED (409): $($_.ErrorDetails.Message)" -ForegroundColor Red }

Write-Host "`n═══ TEST 2: PRICE INTEGRITY GUARD ═══" -ForegroundColor Cyan

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

Write-Host "`n═══ TEST 3: WINDOW FUNCTIONS ═══" -ForegroundColor Cyan
Write-Host "`n[3.1] Revenue Analytics Report (per Hotel)..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$base/admin/reports/revenue" | ConvertTo-Json -Depth 5

Write-Host "`n[3.3] Revenue Analytics by Brand & Chain..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$base/admin/reports/revenue-by-brand" | ConvertTo-Json -Depth 5

Write-Host "`n═══ TEST 4: RECURSIVE CTE ═══" -ForegroundColor Cyan

# 4.1 Full tree
Write-Host "`n[4.1] Full location tree..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$base/locations/tree" | ConvertTo-Json -Depth 5

# 4.2 Vietnam subtree
Write-Host "`n[4.2] Vietnam subtree..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$base/locations/tree?root=Vietnam" | ConvertTo-Json -Depth 5

# 4.3 Singapore subtree
Write-Host "`n[4.3] Singapore subtree (root_id=5)..." -ForegroundColor Yellow
Invoke-RestMethod -Uri "$base/locations/tree?root_id=5" | ConvertTo-Json -Depth 5

Write-Host "`n════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ ALL TESTS COMPLETED" -ForegroundColor Green
Write-Host "════════════════════════════════`n" -ForegroundColor Green
```

---

## 5. Payment Validation — Overpayment Prevention

### 📖 Concept
API `POST /api/payments` kiểm tra tổng tiền đã thanh toán trước khi cho phép tạo payment mới, ngăn chặn:
- Thanh toán vượt quá `grand_total_amount`
- Deposit vượt quá `deposit_amount`
- `FULL_PAYMENT` không đúng số tiền còn lại

### Test 5.1 ✅ — Deposit thành công
**Mục tiêu**: Tạo deposit trong giới hạn cho phép

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

**Expected**: `201` với `payment_summary.remaining_balance > 0`

---

### Test 5.2 ❌ — Deposit vượt mức
**Mục tiêu**: Deposit lần 2 bị reject vì tổng deposit > `deposit_amount`

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

**Expected**: `400` — `"Deposit would exceed required deposit amount"`

---

### Test 5.3 ❌ — FULL_PAYMENT sai số tiền
**Mục tiêu**: Trả thiếu khi chọn `FULL_PAYMENT` → bị reject

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

**Expected**: `400` — `"FULL_PAYMENT must cover the entire remaining balance"`

---

### Test 5.4 ✅ — FULL_PAYMENT đúng số tiền còn lại
**Mục tiêu**: Trả đúng remaining balance → thành công

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

**Expected**: `201` với `payment_summary.remaining_balance = 0`

---

## 6. Services & Incidental Charges — Dịch Vụ Phát Sinh

### 📖 Concept
Khách có thể đặt dịch vụ phát sinh (spa, ăn uống, transfer, vật dụng cá nhân...) trong thời gian lưu trú. API quản lý toàn bộ lifecycle: browse → order → confirm → deliver → pay.

### Test 6.1 — Xem danh mục dịch vụ
```bash
curl "http://localhost:3000/api/services?hotel_id=1"
```

**Expected**: Danh sách services của Ritz-Carlton (SPA, TRANSFER, BUTLER, DINING)

---

### Test 6.2 ✅ — Đặt dịch vụ phát sinh
**Mục tiêu**: Đặt VIP Spa Treatment cho reservation đang CONFIRMED

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

**Expected**: `201` với `service_status = "REQUESTED"`, `final_amount = 7000000` (3,500,000 × 2)

---

### Test 6.3 — Xem dịch vụ đã đặt
```bash
curl "http://localhost:3000/api/services/orders?reservation_id=1"
```

**Expected**: Danh sách orders với `summary.active_amount` tính tổng

---

### Test 6.4 ✅ — Thanh toán dịch vụ phát sinh
**Mục tiêu**: Thanh toán incidental cho service order

```bash
curl -X POST http://localhost:3000/api/services/orders/1/pay \
  -H "Content-Type: application/json" \
  -d '{ "payment_method": "CREDIT_CARD" }'
```

**Expected**: `201` — Payment `INCIDENTAL_HOLD` created, service status → `DELIVERED`

### Test 6.5 ❌ — Thanh toán trùng
**Mục tiêu**: Thanh toán lại service đã paid → reject

```bash
curl -X POST http://localhost:3000/api/services/orders/1/pay \
  -H "Content-Type: application/json" \
  -d '{ "payment_method": "CREDIT_CARD" }'
```

**Expected**: `400` — `"Service order #1 has already been paid"`

---

## 📊 Test Summary Checklist

| # | Test | Concept | Expected |
|---|------|---------|----------|
| 1.1 | Book available room | Pessimistic Lock | ✅ SUCCESS, status CONFIRMED |
| 1.2 | Book same room again | Pessimistic Lock | ❌ 409 REJECTED |
| 1.3 | Check InventoryLockLog | Pessimistic Lock | 📋 Cả SUCCESS + FAILED logs |
| 2.1 | Rate change < 50% | Trigger | ✅ No alert triggered |
| 2.2 | Rate change > 50% | Trigger | 🚨 CRITICAL alert logged |
| 2.3 | View alerts list | Trigger | 📋 Alert records visible |
| 3.1 | Revenue report (per hotel) | Window Functions | 📊 DENSE_RANK, cumulative, share% |
| 3.2 | Multi-booking revenue | Window Functions | 📊 Ranking changes |
| 3.3 | Revenue by Brand & Chain | Window Functions | 📊 Multi-level PARTITION BY brand_id, chain_id |
| 4.1 | Full location tree | Recursive CTE | 🌳 17 nodes, hierarchy display |
| 4.2 | Vietnam subtree | Recursive CTE | 🌳 7 nodes (VN → districts) |
| 4.3 | Singapore subtree | Recursive CTE | 🌳 3 nodes |
| 4.4 | Flat list compare | Recursive CTE | 📋 No hierarchy, sorted by level |
| 5.1 | Deposit thành công | Payment Validation | ✅ 201, remaining > 0 |
| 5.2 | Deposit vượt mức | Payment Validation | ❌ 400, deposit exceeded |
| 5.3 | FULL_PAYMENT sai số | Payment Validation | ❌ 400, must equal remaining |
| 5.4 | FULL_PAYMENT đúng | Payment Validation | ✅ 201, remaining = 0 |
| 6.1 | Xem danh mục dịch vụ | Services | 📋 Service catalog |
| 6.2 | Đặt dịch vụ phát sinh | Services | ✅ 201, REQUESTED |
| 6.3 | Xem orders | Services | 📋 Orders + summary |
| 6.4 | Thanh toán incidental | Services | ✅ 201, INCIDENTAL_HOLD |
| 6.5 | Thanh toán trùng | Services | ❌ 400, already paid |

