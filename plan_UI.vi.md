# Kế Hoạch Làm Lại UI Dựa Trên Cấu Trúc Booking.com

## 1. Lý Do Reset UI

Frontend hiện tại không nên được xem là nền tảng cho các bước tiếp theo.

Lý do:

- Frontend được làm quá sớm, trước khi luồng booking public cốt lõi được chốt.
- Nhiều màn hình đang giống công cụ thao tác hơn là hành trình sản phẩm dành cho người dùng thật.
- Guest flow, loyalty flow, reservation self-service và admin operations đã bị trộn vào nhau quá sớm.
- Quyết định về layout và navigation được làm trước khi page architecture được khóa đúng.
- Lượt làm frontend tiếp theo cần bắt đầu từ business flow trước, không phải từ component tree hiện tại.

Tài liệu này là source of truth mới để làm lại frontend từ đầu.

Frontend cũ không còn là baseline.

## 2. Phạm Vi Sản Phẩm Cho Nền Tảng Chỉ Tập Trung Vào Khách Sạn

Sản phẩm được làm lại là một website đặt phòng cho chuỗi khách sạn, không phải travel super-app.

Trong phạm vi:

- tìm kiếm destination nơi chuỗi có khách sạn
- so sánh các khách sạn trong chuỗi
- mở trang chi tiết khách sạn trước khi booking
- hoàn tất booking dưới dạng anonymous hoặc guest loyalty đã đăng nhập
- tra cứu reservation và self-service cho guest
- các phần cơ bản của guest account
- admin portal riêng cho vận hành

Ngoài phạm vi:

- flights
- flight + hotel
- car rental
- attractions
- airport taxi
- review ecosystem kiểu marketplace quy mô lớn
- danh sách property bên thứ ba quy mô lớn
- smart filters sâu mà backend chưa hỗ trợ thật
- wallet, đổi thưởng, hoặc voucher marketplace trong v1

## 3. Các Pattern Tham Chiếu Từ Booking.com

Các ảnh chụp Booking.com trong folder [hotel](C:\Users\cbzer\Downloads\HCSDLNC\hotel) chỉ được dùng làm tham chiếu về cấu trúc.

Những gì nên áp dụng:

- homepage có search bar lớn nằm above the fold
- destination-first search
- search results là một trang riêng
- sidebar filters bên trái ở trang search results
- hàng sort nằm phía trên hotel cards
- khái niệm list/grid results
- có trang hotel detail trước khi booking
- trang booking kiểu checkout với summary sidebar bên phải hoặc bên trái
- account area tách khỏi public browsing

Những gì không nên áp dụng:

- branding, hệ màu, hoặc clone toàn bộ giao diện Booking.com
- các tab flights, taxis, attractions, rental cars
- độ phức tạp kiểu marketplace dựa mạnh vào review
- các filter cần dữ liệu mà backend hiện không có

Định hướng visual:

- dùng Booking.com làm chuẩn về information hierarchy và page order
- giữ LuxeReserve là identity của sản phẩm
- visual polish đứng sau workflow correctness trong lượt rebuild này

## 4. Kiến Trúc Trang

Lượt rebuild nên dùng route map sau:

- `/`
  - public homepage
- `/search`
  - trang search results theo destination
- `/hotel/:id`
  - trang chi tiết khách sạn
- `/booking/:hotelId`
  - điểm vào luồng booking cho khách sạn đã chọn
- `/booking/:hotelId/:roomId`
  - luồng booking cho room option đã chọn
- `/reservation`
  - guest reservation lookup và self-service
- `/login`
  - guest login
- `/register`
  - guest registration
- `/account`
  - trang tổng quan tài khoản guest
- `/admin/login`
  - admin login
- `/admin/*`
  - admin operational portal

Các route này sẽ thay thế mô hình trang bị trộn lẫn trước đó.

## 5. Các Hành Trình Người Dùng Cốt Lõi

### 5.1 Hành Trình Anonymous Guest

Luồng:

1. Mở homepage
2. Nhập destination, ngày ở và số guest tại hero search bar
3. Chuyển sang `/search`
4. So sánh các khách sạn trong chuỗi tại destination đó
5. Mở `/hotel/:id`
6. Xem nội dung khách sạn, amenities, room options và promotions
7. Chọn phòng và chuyển sang booking
8. Nhập guest details thủ công
9. Xác nhận booking và payment details
10. Đi tới reservation confirmation và sau đó dùng `/reservation` để tra cứu

Quy tắc:

- anonymous user phải có thể booking mà không cần tạo tài khoản
- anonymous user không được thấy các giả định chỉ dành cho account trong form booking
- hotel comparison phải diễn ra trước room selection

### 5.2 Hành Trình Loyalty Guest

Luồng:

1. Guest đăng nhập qua `/login`
2. Search và browse giống anonymous flow
3. Form booking được prefill từ guest profile
4. Member context được hiển thị trong quá trình booking
5. Có thể hiển thị member-only promotions nếu áp dụng
6. Reservation sẽ được xem lại ở `/account` và `/reservation`

Quy tắc:

- loyalty là phần tăng cường cho booking, không phải một mô hình booking riêng
- phạm vi loyalty v1 chỉ gồm profile + status + offers
- không có đổi điểm hay wallet trong v1

### 5.3 Guest Reservation Self-Service

`/reservation` chỉ nên là trang dành cho guest.

Được phép:

- tra cứu bằng reservation code
- reservation summary
- payment summary
- guest-facing payment actions nếu được bật
- guest cancellation nếu backend rule cho phép
- timeline/trạng thái chỉ đọc

Không được phép:

- check-in
- check-out
- issue invoice
- service operations
- housekeeping hoặc maintenance actions
- các workflow vận hành phía khách sạn

### 5.4 Hành Trình Admin

Admin phải là một khu sản phẩm riêng.

Luồng:

1. Đăng nhập qua `/admin/login`
2. Vào admin portal
3. Truy cập các công cụ front desk, inventory và operations
4. Quản lý lifecycle reservation và các hoạt động vận hành phía khách sạn

Admin sở hữu:

- reservation operations
- check-in
- check-out
- hotel cancellation
- inventory management
- issue invoice
- housekeeping và maintenance views
- operational feeds và reporting

Public guest pages tuyệt đối không được lộ admin actions.

## 6. Hành Vi Cụ Thể Theo Từng Trang

### 6.1 Homepage `/`

Các section của homepage:

- header có brand và auth entry points
- hero banner với search bar chính
- curated hot destinations
- featured hotels hoặc promotions
- trust/value section
- footer

Các field của hero search bar:

- destination
- check-in / check-out
- guests
- search button

Homepage không được chứa:

- booking steps
- room cards
- admin workflow shortcuts
- các operational widget lớn

### 6.2 Search Results `/search`

Mục tiêu:

- so sánh các khách sạn trong destination đã chọn trước khi vào trang hotel detail

Layout:

- top persistent search row
- top sort row
- optional map placeholder area
- left filter sidebar
- right result list hoặc grid

Result cards nên hiển thị:

- tên khách sạn
- location summary
- star rating
- brand
- chain
- giá khởi điểm nếu có
- một vài highlights hoặc amenity cues
- CTA để mở hotel detail

Search results phải so sánh hotel trước, không phải các room variant riêng lẻ.

Các filter được phép trong v1:

- budget per night
- district / area
- brand
- hotel type
- star rating

Các filter để sau:

- smart filters bằng ngôn ngữ tự nhiên
- review-score filters nếu chưa có dữ liệu thật
- landmark distance filters
- accessibility filters
- pet-friendly filters
- breakfast-specific filters nếu backend chưa có dữ liệu thật
- các cụm checkbox dày đặc kiểu Booking.com marketplace

### 6.3 Hotel Detail `/hotel/:id`

Trang này bắt buộc phải tồn tại trước bước booking.

Các section:

- image gallery
- hotel title và location summary
- address và map summary
- overview / description
- amenities
- room options
- active promotions
- primary reserve CTA

Room options là cầu nối từ bước xem khách sạn sang bước booking.

Hành vi của reserve CTA:

- chọn phòng sẽ mở `/booking/:hotelId/:roomId`
- nếu chưa chọn phòng, trang hotel cần dẫn người dùng chọn phòng trước

### 6.4 Booking `/booking/:hotelId` hoặc `/booking/:hotelId/:roomId`

Trang này phải hoạt động như một checkout flow, không phải search.

Các bước booking:

1. selected hotel và room summary
2. guest details
3. payment / confirmation

Layout:

- main form area
- summary sidebar

Summary sidebar nên gồm:

- hotel
- stay dates
- guest count
- selected room
- pricing summary
- guarantee/payment summary

Quy tắc:

- anonymous guest nhập thông tin thủ công
- guest đã đăng nhập được autofill và có loyalty context
- trang booking không được chứa admin hay service operations
- hotel comparison và room discovery phải hoàn thành trước khi vào trang này

### 6.5 Account `/account`

Đây là guest account area cơ bản.

Các section:

- profile basics
- account identity
- upcoming stays
- reservation history
- loyalty summary nếu có

Không làm trong v1:

- wallet
- reward redemption
- voucher center
- preference center quá phức tạp

### 6.6 Admin `/admin/*`

Admin vẫn phải tách hoàn toàn khỏi guest/public journey.

Các nhóm trang admin:

- front desk
- inventory
- operations
- reports

Khu vực này không được chia sẻ workflow assumptions với public pages.

## 7. Các Giai Đoạn Rebuild

Việc rebuild phải diễn ra theo đúng thứ tự sau:

### Phase 1: Architecture And Routing

- finalize page map
- tạo global shell
- tách public routes, account routes và admin routes
- định nghĩa auth entry points

### Phase 2: Homepage

- build header và footer
- build hero banner và destination search
- build hot destination cards
- build featured properties/promotions section
- build trust/value section

### Phase 3: Search Results

- build `/search`
- implement destination-driven hotel comparison
- chỉ implement allowed filters
- thêm sort row
- thêm result list/grid mode nếu cần
- thêm optional map placeholder block

### Phase 4: Hotel Detail

- build `/hotel/:id`
- thêm gallery, overview, amenities, room options và promotions
- nối reserve CTA sang booking flow

### Phase 5: Booking Flow

- build checkout-style booking page
- hỗ trợ anonymous booking
- hỗ trợ loyalty autofill cho guest đã đăng nhập
- build summary sidebar
- chốt confirmation state

### Phase 6: Reservation Self-Service

- build guest lookup page
- thêm summary, timeline, payment summary và guest actions
- giữ admin actions ra ngoài

### Phase 7: Account

- build guest account shell
- thêm profile summary, upcoming stays, history và loyalty snapshot

### Phase 8: Admin

- build admin login riêng
- rebuild admin portal độc lập với public flow

### Phase 9: Polish

- refine responsive behavior
- improve visual system
- improve consistency và accessibility

Không được bắt đầu visual polish nâng cao trước khi Phase 1 đến Phase 6 đúng cấu trúc.

## 8. Mapping Với Backend

Frontend mới nên dùng backend hiện tại làm nền tảng triển khai.

### Homepage / Search / Hotel Detail

- `GET /api/hotels`
- `GET /api/hotels/:id`
- `GET /api/promotions`
- `GET /api/rooms/availability`

### Guest Auth / Account

- `POST /api/auth/login`
- `POST /api/auth/guest/login`
- `POST /api/auth/guest/register`
- `GET /api/auth/me`

### Booking / Reservation

- `POST /api/reservations`
- `GET /api/reservations/:code`
- `POST /api/payments`

### Admin

- `/api/admin/*`

Quy tắc quan trọng:

- filters, widgets và comparisons chỉ được dựa trên các field thật sự có trong backend response
- UI không được tự bịa ra các marketplace-style features mà backend không hỗ trợ đúng bản chất

## 9. Chiến Lược Tận Dụng Endpoint

Backend hiện có nhiều endpoint hơn rất nhiều so với những gì UI lượt đầu cần dùng. Lượt rebuild này không nên cố “dùng hết” toàn bộ endpoint cùng lúc. Thay vào đó, mọi nhóm endpoint phải được phân loại rõ để frontend tận dụng backend một cách có chủ đích.

### 9.1 Endpoint Public V1

Các endpoint sau nên được nối vào lượt rebuild public đầu tiên:

- hotels
  - `/api/hotels`
  - `/api/hotels/:id`
- promotions
  - `/api/promotions`
- search và inventory
  - `/api/rooms/availability`
  - `/api/locations`
  - `/api/locations/tree`
- auth
  - `/api/auth/login`
  - `/api/auth/guest/register`
  - `/api/auth/guest/login`
  - `/api/auth/me`
- booking và reservation
  - `/api/reservations`
  - `/api/reservations/:code`
- guest-facing payment
  - `/api/payments`
  - `/api/payments?reservation_id=`
- guest-facing cancellation
  - `/api/reservations/:id/guest-cancel`

### 9.2 Endpoint Cho Guest Account / Loyalty

Các endpoint này thuộc về account area và trải nghiệm của guest đã đăng nhập:

- `/api/auth/me`
- `/api/promotions?guest_id=`
- `/api/reservations/:code`
- `/api/payments?reservation_id=`

Chúng nên phục vụ:

- profile context
- loyalty display
- member offers
- reservation history hoặc upcoming stays khi account UI được làm

### 9.3 Endpoint Cho Admin Portal

Các endpoint này phải được xem là first-class cho admin rebuild, kể cả khi public v1 chưa dùng:

- admin pricing và revenue
  - `/api/admin/rates/:id`
  - `/api/admin/rates/alerts`
  - `/api/admin/reports/revenue`
  - `/api/admin/reports/revenue-by-brand`
  - `/api/admin/availability/:id`
- reservation operations
  - `/api/reservations/:id/checkin`
  - `/api/reservations/:id/checkout`
  - `/api/reservations/:id/hotel-cancel`
  - `/api/reservations/:id/transfer`
- services
  - `/api/services`
  - `/api/services/order`
  - `/api/services/orders`
  - `/api/services/orders/:id/status`
  - `/api/services/orders/:id/pay`
- housekeeping
  - `/api/housekeeping`
  - `/api/housekeeping/:id/assign`
  - `/api/housekeeping/:id/status`
- maintenance
  - `/api/maintenance`
  - `/api/maintenance/:id`
- invoices
  - `/api/invoices`
  - `/api/invoices/:id`
  - `/api/invoices/:id/issue`

### 9.4 Endpoint Đã Có Nhưng Chưa Ưu Tiên Ở Lượt UI Đầu

Các endpoint này tồn tại và cần được ghi nhận trong roadmap, nhưng không nên làm lệch hướng lượt rebuild đầu tiên:

- `/api/guests`
- `/api/guests/:id`
- `POST /api/guests`

Chúng hữu ích cho admin/data workflows, nhưng public UI mới không nên phụ thuộc vào guest list tổng để hoạt động.

### 9.5 Quy Tắc Về Coverage Của Endpoint

UI plan không nên hướng tới việc dùng toàn bộ endpoint của backend trong release đầu tiên.

Thay vào đó:

- mọi nhóm endpoint phải được ghi nhận
- mỗi nhóm endpoint phải được gán vào một product surface rõ ràng
- thứ gì chưa dùng ở v1 phải được defer có chủ đích, không được bỏ quên một cách im lặng
- độ rộng của backend sẽ định hình roadmap dài hạn, chứ không làm quá tải lượt rebuild đầu tiên

## 10. Các Tính Năng Để Sau / Không Thuộc V1

Các phần sau phải được hoãn rõ ràng:

- flights
- flight + hotel
- taxi
- attractions
- car rental
- wallet và đổi thưởng
- smart filters nâng cao
- review ecosystem quy mô lớn
- landmark và neighborhood intelligence quy mô lớn
- public invoice workflow
- public service operations
- admin tools bên trong guest pages

## 11. Tiêu Chí Hoàn Thành

`plan_UI.vi.md` được xem là hoàn chỉnh nếu một người implement mới có thể trả lời tất cả các câu sau mà không cần đoán:

- các pattern nào từ Booking.com được dùng lại có chủ đích
- các tính năng nào của Booking.com bị loại bỏ
- homepage phải chứa những gì
- trang `/search` chịu trách nhiệm cho phần nào
- vì sao hotel detail bắt buộc phải tồn tại trước booking
- anonymous booking hoạt động thế nào
- loyalty booking khác gì so với anonymous
- cái gì thuộc về `/reservation`
- cái gì thuộc về `/account`
- cái gì chỉ thuộc về `/admin`
- những filter nào hợp lệ trong v1
- những nhóm endpoint nào thuộc public v1, loyalty/account, admin, hoặc deferred use
- những tính năng nào bị để sau

## 12. Các Rule Mặc Định Khi Build

- workflow correctness quan trọng hơn visual polish
- hotel comparison phải diễn ra trước booking
- room choice diễn ra ở hotel detail, không phải homepage
- booking là checkout-style, không phải search-style
- admin tách hoàn toàn khỏi guest product flow
- độ phức tạp của frontend bị giới hạn bởi backend truth
