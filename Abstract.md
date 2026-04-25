# LuxeReserve Abstract

## 1. Tong quan

LuxeReserve la mot he thong quan ly at phong khach san cao cap theo huong **Advanced Database / Hybrid Backend**, uoc xay dung e chung minh cach ket hop:

- **SQL Server** cho du lieu giao dich va toan bo business logic quan trong
- **MongoDB** cho rich content linh hoat nhu mo ta khach san, gallery anh, room features, amenity metadata
- **Node.js Express API** lam lop tich hop giua hai nguon du lieu

Trong tam cua project khong phai frontend, ma la cach thiet ke va van hanh mot he thong booking co tinh toan ven du lieu cao, co kiem soat canh tranh, co bao cao phan tich, va co the mo rong theo nhieu domain van hanh khach san.

## 2. He thong hien ang lam uoc gi

### Booking lifecycle

- Tao reservation theo khoang ngay luu tru
- Kiem tra room availability theo khach san va ngay
- Check-in / check-out
- Guest cancel va hotel cancel
- Room transfer cho reservation ang hoat ong

### Financial flow

- Thu deposit
- Thu full payment
- Theo doi tong tien, a thanh toan, cong no con lai
- Sinh invoice tu view tai chinh
- Issue invoice tu `DRAFT` sang `ISSUED`

### Hotel operations

- Quan ly service order phat sinh trong thoi gian luu tru
- Quan ly housekeeping task
- Quan ly maintenance ticket
- ong bo trang thai room theo quy trinh van hanh

### Customer and catalog

- Danh sach guest va guest profile
- Danh sach hotel
- Hotel detail dang hybrid: du lieu van hanh tu SQL + rich content tu MongoDB
- Location hierarchy theo cay vung/quoc gia/thanh pho/quan

### Admin and analytics

- Quan ly gia phong
- Canh bao thay oi gia bat thuong
- Revenue report theo hotel
- Revenue report theo chain > brand > hotel
- Optimistic locking cho inventory update

## 3. iem manh ve Advanced Database

Project nay the hien kha ro cac ky thuat CSDL nang cao:

1. **Pessimistic locking**
   - Booking engine khoa inventory theo ngay e tranh double booking.
   - Concurrent booking a uoc kiem tra end-to-end: 2 request cung luc cho cung phong cho ra ket qua ung la `1 success + 1 reject`.

2. **Optimistic locking**
   - `RoomAvailability.version_no` dung e phat hien conflict khi cap nhat trang thai inventory.

3. **Multi-step transaction**
   - Cac flow nhu booking, payment, check-in, check-out, cancellation, housekeeping, maintenance eu i qua nhieu bang trong mot transaction.

4. **Computed financial source of truth**
   - View `vw_ReservationTotal` tong hop du lieu tu reservation room, service, payment e lam nguon tai chinh chuan.

5. **Trigger-based auditing**
   - Trigger phat hien thay oi gia vuot nguong.
   - Trigger audit cancellation.

6. **Window functions**
   - Revenue ranking
   - Cumulative revenue
   - Revenue share theo nhieu cap o

7. **Recursive CTE**
   - Dung cho cay `Location` nhieu tang.

8. **Computed column**
   - `Guest.full_name` uoc thiet ke theo kieu computed/persisted.

9. **Polyglot persistence**
   - SQL Server giu du lieu chuan hoa va transaction-heavy.
   - MongoDB giu du lieu mo ta linh hoat, phu hop read-heavy va nested documents.

## 4. Trang thai hien tai

- Backend API a co the chay oc lap.
- MongoDB va SQL Server a uoc tich hop.
- Cac flow quan trong a xac nhan chay uoc:
  - Booking
  - Deposit payment
  - Full payment
  - Check-in
  - Check-out
  - Concurrent booking protection
- Hien tai **chua co frontend chinh thuc**.

## 5. Cach oc folder `docs` cho ung

Sau khi oc lai cac file trong `docs` va oi chieu voi code hien tai, cach dung hop ly hon la:

### Nhom 1: Tai lieu thiet ke goc, nen oc truoc

1. [docs/GlobalLuxuryHotelReservationEngine_REMAKE_Summary.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\GlobalLuxuryHotelReservationEngine_REMAKE_Summary.md)
   - ay la file mo ta tu duy thiet ke tong the, cac fix lon, hybrid architecture, table groups va inh huong he thong.

2. [docs/LuxeReserve_ERD.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\LuxeReserve_ERD.md)
   - Dung e hieu domain model, quan he bang va cach tach he thong thanh cac cum nghiep vu.

3. [docs/LuxeReserve_SequenceDiagrams.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\LuxeReserve_SequenceDiagrams.md)
   - Dung e hieu intent cua cac core flow, nhat la booking, payment, operations, trigger, concurrency.

4. [docs/LuxeReserve_T2_Scripts.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\LuxeReserve_T2_Scripts.md)
   - Huu ich neu muon hieu sau theo goc nhin mon hoc: trigger, procedure, MongoDB document design, recursive CTE, window functions.

### Nhom 2: Tai lieu mo ta chuc nang hien hanh, oc sau nhom 1

5. [docs/System_Features_DataSource.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\System_Features_DataSource.md)
   - File nay tot e nhin he thong theo chuc nang va nguon du lieu.
   - Nen dung no e map tung tinh nang sang SQL, MongoDB hoac Hybrid.

6. [docs/Test_Scenarios.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\Test_Scenarios.md)
   - Nen dung cho muc ich demo, testcase, va bao ve o an.
   - Nhung file nay co mot vai gia inh cu hon code hien tai, nen khi chay that van can oi chieu API/code.

### Nhom 3: Tai lieu tham khao, khong nen coi la nguon ung tuyet oi

7. [docs/API_Documentation.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\API_Documentation.md)
   - Nen dung nhu tai lieu tham khao endpoint.
   - Khong nen xem ay la nguon ung nhat, vi file nay co dau hieu chua sync hoan toan voi code moi.

### Cac iem toi thay co kha nang a cu so voi code hien tai

- `API_Documentation.md` chua phan anh het response moi cua `GET /api/rooms/availability`, hien tai API a tra them `availability_records` e phuc vu optimistic locking.
- `API_Documentation.md` cung chua theo sat toan bo validation moi o payment va reservation flow.
- `LuxeReserve_SequenceDiagrams.md` ang mo ta mot so endpoint/flow o muc design intent, khong hoan toan khop 1-1 voi route thuc te hien tai.
- `Test_Scenarios.md` van gia inh manh vao `sp_ReserveRoom` va `InventoryLockLog` nhu implementation path chinh, trong khi code hien tai a uoc chinh them o lop API.

### Ket luan ngan

Neu muon hieu ung tinh than project cua anh, nen oc theo thu tu:

1. `REMAKE_Summary`
2. `ERD`
3. `SequenceDiagrams`
4. `T2_Scripts`
5. `System_Features_DataSource`
6. `Test_Scenarios`
7. `API_Documentation` e tham khao endpoint, nhung luon oi chieu lai voi code

## 6. Ke hoach frontend e xuat

Vi ay la project ve **Advanced Database**, frontend nen uoc lam theo huong **demo uoc ky thuat DB**, khong chi la giao dien ep.

### Phase 1: FE foundation

- Chon stack FE: **React + Vite** hoac **Next.js** neu muon routing ro rang hon
- Tao API client chung cho toan bo backend
- Tao layout dung chung: sidebar, topbar, breadcrumb, notification
- Chuan hoa model response tu API (`success`, `data`, `error`)
- Tao environment config cho base URL API

### Phase 2: Customer / booking demo

- Trang danh sach hotel
- Trang hotel detail
- Trang search availability theo `hotel_id`, `checkin`, `checkout`
- Form tao reservation
- Trang reservation detail theo `reservation_code`
- Hien thi payment summary: `grand_total`, `total_paid`, `balance_due`

### Phase 3: Reservation operations

- Nut check-in / check-out
- Nut guest cancel / hotel cancel
- Form room transfer
- Timeline trang thai reservation
- Hien thi room assignment va status history

### Phase 4: Payments and invoices

- Form thu deposit
- Form thu phan con lai
- Danh sach payment theo reservation
- Tao invoice
- Xem invoice detail
- Issue invoice

### Phase 5: Hotel operations dashboard

- Man hinh service catalog va service order
- Man hinh housekeeping board theo trang thai
- Man hinh maintenance tickets
- Man hinh location tree

### Phase 6: Admin / advanced database showcase

- Man hinh update room rate
- Man hinh price integrity alerts
- Man hinh revenue report
- Man hinh revenue-by-brand report
- Man hinh optimistic locking demo cho availability update

## 7. Uu tien FE e demo o an

Neu thoi gian it, nen lam MVP theo ung thu tu nay:

1. Hotel list + hotel detail
2. Availability search
3. Create reservation
4. Deposit + full payment
5. Reservation detail
6. Check-in / check-out
7. Revenue report
8. Price alert

Bo nay la u e the hien:

- Hybrid SQL + MongoDB
- Transaction flow
- Financial aggregation
- Pessimistic locking
- Reporting bang window functions

## 8. Ket luan

Hien tai LuxeReserve a la mot backend kha ay u cho mot o an Advanced Database: co booking engine, payment flow, hotel operations, reporting, hybrid persistence, concurrency control, va audit logic. Phan con thieu lon nhat la frontend e ong goi cac flow nay thanh mot san pham de demo, de bao ve, va de thuyet trinh hon.
