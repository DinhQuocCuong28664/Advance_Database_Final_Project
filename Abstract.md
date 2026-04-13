# LuxeReserve Abstract

## 1. Tổng quan

LuxeReserve là một hệ thống quản lý đặt phòng khách sạn cao cấp theo hướng **Advanced Database / Hybrid Backend**, được xây dựng để chứng minh cách kết hợp:

- **SQL Server** cho dữ liệu giao dịch và toàn bộ business logic quan trọng
- **MongoDB** cho rich content linh hoạt như mô tả khách sạn, gallery ảnh, room features, amenity metadata
- **Node.js Express API** làm lớp tích hợp giữa hai nguồn dữ liệu

Trọng tâm của project không phải frontend, mà là cách thiết kế và vận hành một hệ thống booking có tính toàn vẹn dữ liệu cao, có kiểm soát cạnh tranh, có báo cáo phân tích, và có thể mở rộng theo nhiều domain vận hành khách sạn.

## 2. Hệ thống hiện đang làm được gì

### Booking lifecycle

- Tạo reservation theo khoảng ngày lưu trú
- Kiểm tra room availability theo khách sạn và ngày
- Check-in / check-out
- Guest cancel và hotel cancel
- Room transfer cho reservation đang hoạt động

### Financial flow

- Thu deposit
- Thu full payment
- Theo dõi tổng tiền, đã thanh toán, công nợ còn lại
- Sinh invoice từ view tài chính
- Issue invoice từ `DRAFT` sang `ISSUED`

### Hotel operations

- Quản lý service order phát sinh trong thời gian lưu trú
- Quản lý housekeeping task
- Quản lý maintenance ticket
- Đồng bộ trạng thái room theo quy trình vận hành

### Customer and catalog

- Danh sách guest và guest profile
- Danh sách hotel
- Hotel detail dạng hybrid: dữ liệu vận hành từ SQL + rich content từ MongoDB
- Location hierarchy theo cây vùng/quốc gia/thành phố/quận

### Admin and analytics

- Quản lý giá phòng
- Cảnh báo thay đổi giá bất thường
- Revenue report theo hotel
- Revenue report theo chain > brand > hotel
- Optimistic locking cho inventory update

## 3. Điểm mạnh về Advanced Database

Project này thể hiện khá rõ các kỹ thuật CSDL nâng cao:

1. **Pessimistic locking**
   - Booking engine khóa inventory theo ngày để tránh double booking.
   - Concurrent booking đã được kiểm tra end-to-end: 2 request cùng lúc cho cùng phòng cho ra kết quả đúng là `1 success + 1 reject`.

2. **Optimistic locking**
   - `RoomAvailability.version_no` dùng để phát hiện conflict khi cập nhật trạng thái inventory.

3. **Multi-step transaction**
   - Các flow như booking, payment, check-in, check-out, cancellation, housekeeping, maintenance đều đi qua nhiều bảng trong một transaction.

4. **Computed financial source of truth**
   - View `vw_ReservationTotal` tổng hợp dữ liệu từ reservation room, service, payment để làm nguồn tài chính chuẩn.

5. **Trigger-based auditing**
   - Trigger phát hiện thay đổi giá vượt ngưỡng.
   - Trigger audit cancellation.

6. **Window functions**
   - Revenue ranking
   - Cumulative revenue
   - Revenue share theo nhiều cấp độ

7. **Recursive CTE**
   - Dùng cho cây `Location` nhiều tầng.

8. **Computed column**
   - `Guest.full_name` được thiết kế theo kiểu computed/persisted.

9. **Polyglot persistence**
   - SQL Server giữ dữ liệu chuẩn hóa và transaction-heavy.
   - MongoDB giữ dữ liệu mô tả linh hoạt, phù hợp read-heavy và nested documents.

## 4. Trạng thái hiện tại

- Backend API đã có thể chạy độc lập.
- MongoDB và SQL Server đã được tích hợp.
- Các flow quan trọng đã xác nhận chạy được:
  - Booking
  - Deposit payment
  - Full payment
  - Check-in
  - Check-out
  - Concurrent booking protection
- Hiện tại **chưa có frontend chính thức**.

## 5. Cách đọc folder `docs` cho đúng

Sau khi đọc lại các file trong `docs` và đối chiếu với code hiện tại, cách dùng hợp lý hơn là:

### Nhóm 1: Tài liệu thiết kế gốc, nên đọc trước

1. [docs/GlobalLuxuryHotelReservationEngine_REMAKE_Summary.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\GlobalLuxuryHotelReservationEngine_REMAKE_Summary.md)
   - Đây là file mô tả tư duy thiết kế tổng thể, các fix lớn, hybrid architecture, table groups và định hướng hệ thống.

2. [docs/LuxeReserve_ERD.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\LuxeReserve_ERD.md)
   - Dùng để hiểu domain model, quan hệ bảng và cách tách hệ thống thành các cụm nghiệp vụ.

3. [docs/LuxeReserve_SequenceDiagrams.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\LuxeReserve_SequenceDiagrams.md)
   - Dùng để hiểu intent của các core flow, nhất là booking, payment, operations, trigger, concurrency.

4. [docs/LuxeReserve_T2_Scripts.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\LuxeReserve_T2_Scripts.md)
   - Hữu ích nếu muốn hiểu sâu theo góc nhìn môn học: trigger, procedure, MongoDB document design, recursive CTE, window functions.

### Nhóm 2: Tài liệu mô tả chức năng hiện hành, đọc sau nhóm 1

5. [docs/System_Features_DataSource.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\System_Features_DataSource.md)
   - File này tốt để nhìn hệ thống theo chức năng và nguồn dữ liệu.
   - Nên dùng nó để map từng tính năng sang SQL, MongoDB hoặc Hybrid.

6. [docs/Test_Scenarios.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\Test_Scenarios.md)
   - Nên dùng cho mục đích demo, testcase, và bảo vệ đồ án.
   - Nhưng file này có một vài giả định cũ hơn code hiện tại, nên khi chạy thật vẫn cần đối chiếu API/code.

### Nhóm 3: Tài liệu tham khảo, không nên coi là nguồn đúng tuyệt đối

7. [docs/API_Documentation.md](C:\Users\cbzer\Downloads\HCSDLNC\docs\API_Documentation.md)
   - Nên dùng như tài liệu tham khảo endpoint.
   - Không nên xem đây là nguồn đúng nhất, vì file này có dấu hiệu chưa sync hoàn toàn với code mới.

### Các điểm tôi thấy có khả năng đã cũ so với code hiện tại

- `API_Documentation.md` chưa phản ánh hết response mới của `GET /api/rooms/availability`, hiện tại API đã trả thêm `availability_records` để phục vụ optimistic locking.
- `API_Documentation.md` cũng chưa theo sát toàn bộ validation mới ở payment và reservation flow.
- `LuxeReserve_SequenceDiagrams.md` đang mô tả một số endpoint/flow ở mức design intent, không hoàn toàn khớp 1-1 với route thực tế hiện tại.
- `Test_Scenarios.md` vẫn giả định mạnh vào `sp_ReserveRoom` và `InventoryLockLog` như implementation path chính, trong khi code hiện tại đã được chỉnh thêm ở lớp API.

### Kết luận ngắn

Nếu muốn hiểu đúng tinh thần project của anh, nên đọc theo thứ tự:

1. `REMAKE_Summary`
2. `ERD`
3. `SequenceDiagrams`
4. `T2_Scripts`
5. `System_Features_DataSource`
6. `Test_Scenarios`
7. `API_Documentation` để tham khảo endpoint, nhưng luôn đối chiếu lại với code

## 6. Kế hoạch frontend đề xuất

Vì đây là project về **Advanced Database**, frontend nên được làm theo hướng **demo được kỹ thuật DB**, không chỉ là giao diện đẹp.

### Phase 1: FE foundation

- Chọn stack FE: **React + Vite** hoặc **Next.js** nếu muốn routing rõ ràng hơn
- Tạo API client chung cho toàn bộ backend
- Tạo layout dùng chung: sidebar, topbar, breadcrumb, notification
- Chuẩn hóa model response từ API (`success`, `data`, `error`)
- Tạo environment config cho base URL API

### Phase 2: Customer / booking demo

- Trang danh sách hotel
- Trang hotel detail
- Trang search availability theo `hotel_id`, `checkin`, `checkout`
- Form tạo reservation
- Trang reservation detail theo `reservation_code`
- Hiển thị payment summary: `grand_total`, `total_paid`, `balance_due`

### Phase 3: Reservation operations

- Nút check-in / check-out
- Nút guest cancel / hotel cancel
- Form room transfer
- Timeline trạng thái reservation
- Hiển thị room assignment và status history

### Phase 4: Payments and invoices

- Form thu deposit
- Form thu phần còn lại
- Danh sách payment theo reservation
- Tạo invoice
- Xem invoice detail
- Issue invoice

### Phase 5: Hotel operations dashboard

- Màn hình service catalog và service order
- Màn hình housekeeping board theo trạng thái
- Màn hình maintenance tickets
- Màn hình location tree

### Phase 6: Admin / advanced database showcase

- Màn hình update room rate
- Màn hình price integrity alerts
- Màn hình revenue report
- Màn hình revenue-by-brand report
- Màn hình optimistic locking demo cho availability update

## 7. Ưu tiên FE để demo đồ án

Nếu thời gian ít, nên làm MVP theo đúng thứ tự này:

1. Hotel list + hotel detail
2. Availability search
3. Create reservation
4. Deposit + full payment
5. Reservation detail
6. Check-in / check-out
7. Revenue report
8. Price alert

Bộ này là đủ để thể hiện:

- Hybrid SQL + MongoDB
- Transaction flow
- Financial aggregation
- Pessimistic locking
- Reporting bằng window functions

## 8. Kết luận

Hiện tại LuxeReserve đã là một backend khá đầy đủ cho một đồ án Advanced Database: có booking engine, payment flow, hotel operations, reporting, hybrid persistence, concurrency control, và audit logic. Phần còn thiếu lớn nhất là frontend để đóng gói các flow này thành một sản phẩm dễ demo, dễ bảo vệ, và dễ thuyết trình hơn.
