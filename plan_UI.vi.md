# Ke Hoach Lam Lai UI Dua Tren Cau Truc Booking.com

## 1. Ly Do Reset UI

Frontend hien tai khong nen uoc xem la nen tang cho cac buoc tiep theo.

Ly do:

- Frontend uoc lam qua som, truoc khi luong booking public cot loi uoc chot.
- Nhieu man hinh ang giong cong cu thao tac hon la hanh trinh san pham danh cho nguoi dung that.
- Guest flow, loyalty flow, reservation self-service va admin operations a bi tron vao nhau qua som.
- Quyet inh ve layout va navigation uoc lam truoc khi page architecture uoc khoa ung.
- Luot lam frontend tiep theo can bat au tu business flow truoc, khong phai tu component tree hien tai.

Tai lieu nay la source of truth moi e lam lai frontend tu au.

Frontend cu khong con la baseline.

## 2. Pham Vi San Pham Cho Nen Tang Chi Tap Trung Vao Khach San

San pham uoc lam lai la mot website at phong cho chuoi khach san, khong phai travel super-app.

Trong pham vi:

- tim kiem destination noi chuoi co khach san
- so sanh cac khach san trong chuoi
- mo trang chi tiet khach san truoc khi booking
- hoan tat booking duoi dang anonymous hoac guest loyalty a ang nhap
- tra cuu reservation va self-service cho guest
- cac phan co ban cua guest account
- admin portal rieng cho van hanh

Ngoai pham vi:

- flights
- flight + hotel
- car rental
- attractions
- airport taxi
- review ecosystem kieu marketplace quy mo lon
- danh sach property ben thu ba quy mo lon
- smart filters sau ma backend chua ho tro that
- wallet, oi thuong, hoac voucher marketplace trong v1

## 3. Cac Pattern Tham Chieu Tu Booking.com

Cac anh chup Booking.com trong folder [hotel](C:\Users\cbzer\Downloads\HCSDLNC\hotel) chi uoc dung lam tham chieu ve cau truc.

Nhung gi nen ap dung:

- homepage co search bar lon nam above the fold
- destination-first search
- search results la mot trang rieng
- sidebar filters ben trai o trang search results
- hang sort nam phia tren hotel cards
- khai niem list/grid results
- co trang hotel detail truoc khi booking
- trang booking kieu checkout voi summary sidebar ben phai hoac ben trai
- account area tach khoi public browsing

Nhung gi khong nen ap dung:

- branding, he mau, hoac clone toan bo giao dien Booking.com
- cac tab flights, taxis, attractions, rental cars
- o phuc tap kieu marketplace dua manh vao review
- cac filter can du lieu ma backend hien khong co

inh huong visual:

- dung Booking.com lam chuan ve information hierarchy va page order
- giu LuxeReserve la identity cua san pham
- visual polish ung sau workflow correctness trong luot rebuild nay

## 4. Kien Truc Trang

Luot rebuild nen dung route map sau:

- `/`
  - public homepage
- `/search`
  - trang search results theo destination
- `/hotel/:id`
  - trang chi tiet khach san
- `/booking/:hotelId`
  - iem vao luong booking cho khach san a chon
- `/booking/:hotelId/:roomId`
  - luong booking cho room option a chon
- `/reservation`
  - guest reservation lookup va self-service
- `/login`
  - guest login
- `/register`
  - guest registration
- `/account`
  - trang tong quan tai khoan guest
- `/admin/login`
  - admin login
- `/admin/*`
  - admin operational portal

Cac route nay se thay the mo hinh trang bi tron lan truoc o.

## 5. Cac Hanh Trinh Nguoi Dung Cot Loi

### 5.1 Hanh Trinh Anonymous Guest

Luong:

1. Mo homepage
2. Nhap destination, ngay o va so guest tai hero search bar
3. Chuyen sang `/search`
4. So sanh cac khach san trong chuoi tai destination o
5. Mo `/hotel/:id`
6. Xem noi dung khach san, amenities, room options va promotions
7. Chon phong va chuyen sang booking
8. Nhap guest details thu cong
9. Xac nhan booking va payment details
10. i toi reservation confirmation va sau o dung `/reservation` e tra cuu

Quy tac:

- anonymous user phai co the booking ma khong can tao tai khoan
- anonymous user khong uoc thay cac gia inh chi danh cho account trong form booking
- hotel comparison phai dien ra truoc room selection

### 5.2 Hanh Trinh Loyalty Guest

Luong:

1. Guest ang nhap qua `/login`
2. Search va browse giong anonymous flow
3. Form booking uoc prefill tu guest profile
4. Member context uoc hien thi trong qua trinh booking
5. Co the hien thi member-only promotions neu ap dung
6. Reservation se uoc xem lai o `/account` va `/reservation`

Quy tac:

- loyalty la phan tang cuong cho booking, khong phai mot mo hinh booking rieng
- pham vi loyalty v1 chi gom profile + status + offers
- khong co oi iem hay wallet trong v1

### 5.3 Guest Reservation Self-Service

`/reservation` chi nen la trang danh cho guest.

uoc phep:

- tra cuu bang reservation code
- reservation summary
- payment summary
- guest-facing payment actions neu uoc bat
- guest cancellation neu backend rule cho phep
- timeline/trang thai chi oc

Khong uoc phep:

- check-in
- check-out
- issue invoice
- service operations
- housekeeping hoac maintenance actions
- cac workflow van hanh phia khach san

### 5.4 Hanh Trinh Admin

Admin phai la mot khu san pham rieng.

Luong:

1. ang nhap qua `/admin/login`
2. Vao admin portal
3. Truy cap cac cong cu front desk, inventory va operations
4. Quan ly lifecycle reservation va cac hoat ong van hanh phia khach san

Admin so huu:

- reservation operations
- check-in
- check-out
- hotel cancellation
- inventory management
- issue invoice
- housekeeping va maintenance views
- operational feeds va reporting

Public guest pages tuyet oi khong uoc lo admin actions.

## 6. Hanh Vi Cu The Theo Tung Trang

### 6.1 Homepage `/`

Cac section cua homepage:

- header co brand va auth entry points
- hero banner voi search bar chinh
- curated hot destinations
- featured hotels hoac promotions
- trust/value section
- footer

Cac field cua hero search bar:

- destination
- check-in / check-out
- guests
- search button

Homepage khong uoc chua:

- booking steps
- room cards
- admin workflow shortcuts
- cac operational widget lon

### 6.2 Search Results `/search`

Muc tieu:

- so sanh cac khach san trong destination a chon truoc khi vao trang hotel detail

Layout:

- top persistent search row
- top sort row
- optional map placeholder area
- left filter sidebar
- right result list hoac grid

Result cards nen hien thi:

- ten khach san
- location summary
- star rating
- brand
- chain
- gia khoi iem neu co
- mot vai highlights hoac amenity cues
- CTA e mo hotel detail

Search results phai so sanh hotel truoc, khong phai cac room variant rieng le.

Cac filter uoc phep trong v1:

- budget per night
- district / area
- brand
- hotel type
- star rating

Cac filter e sau:

- smart filters bang ngon ngu tu nhien
- review-score filters neu chua co du lieu that
- landmark distance filters
- accessibility filters
- pet-friendly filters
- breakfast-specific filters neu backend chua co du lieu that
- cac cum checkbox day ac kieu Booking.com marketplace

### 6.3 Hotel Detail `/hotel/:id`

Trang nay bat buoc phai ton tai truoc buoc booking.

Cac section:

- image gallery
- hotel title va location summary
- address va map summary
- overview / description
- amenities
- room options
- active promotions
- primary reserve CTA

Room options la cau noi tu buoc xem khach san sang buoc booking.

Hanh vi cua reserve CTA:

- chon phong se mo `/booking/:hotelId/:roomId`
- neu chua chon phong, trang hotel can dan nguoi dung chon phong truoc

### 6.4 Booking `/booking/:hotelId` hoac `/booking/:hotelId/:roomId`

Trang nay phai hoat ong nhu mot checkout flow, khong phai search.

Cac buoc booking:

1. selected hotel va room summary
2. guest details
3. payment / confirmation

Layout:

- main form area
- summary sidebar

Summary sidebar nen gom:

- hotel
- stay dates
- guest count
- selected room
- pricing summary
- guarantee/payment summary

Quy tac:

- anonymous guest nhap thong tin thu cong
- guest a ang nhap uoc autofill va co loyalty context
- trang booking khong uoc chua admin hay service operations
- hotel comparison va room discovery phai hoan thanh truoc khi vao trang nay

### 6.5 Account `/account`

ay la guest account area co ban.

Cac section:

- profile basics
- account identity
- upcoming stays
- reservation history
- loyalty summary neu co

Khong lam trong v1:

- wallet
- reward redemption
- voucher center
- preference center qua phuc tap

### 6.6 Admin `/admin/*`

Admin van phai tach hoan toan khoi guest/public journey.

Cac nhom trang admin:

- front desk
- inventory
- operations
- reports

Khu vuc nay khong uoc chia se workflow assumptions voi public pages.

## 7. Cac Giai oan Rebuild

Viec rebuild phai dien ra theo ung thu tu sau:

### Phase 1: Architecture And Routing

- finalize page map
- tao global shell
- tach public routes, account routes va admin routes
- inh nghia auth entry points

### Phase 2: Homepage

- build header va footer
- build hero banner va destination search
- build hot destination cards
- build featured properties/promotions section
- build trust/value section

### Phase 3: Search Results

- build `/search`
- implement destination-driven hotel comparison
- chi implement allowed filters
- them sort row
- them result list/grid mode neu can
- them optional map placeholder block

### Phase 4: Hotel Detail

- build `/hotel/:id`
- them gallery, overview, amenities, room options va promotions
- noi reserve CTA sang booking flow

### Phase 5: Booking Flow

- build checkout-style booking page
- ho tro anonymous booking
- ho tro loyalty autofill cho guest a ang nhap
- build summary sidebar
- chot confirmation state

### Phase 6: Reservation Self-Service

- build guest lookup page
- them summary, timeline, payment summary va guest actions
- giu admin actions ra ngoai

### Phase 7: Account

- build guest account shell
- them profile summary, upcoming stays, history va loyalty snapshot

### Phase 8: Admin

- build admin login rieng
- rebuild admin portal oc lap voi public flow

### Phase 9: Polish

- refine responsive behavior
- improve visual system
- improve consistency va accessibility

Khong uoc bat au visual polish nang cao truoc khi Phase 1 en Phase 6 ung cau truc.

## 8. Mapping Voi Backend

Frontend moi nen dung backend hien tai lam nen tang trien khai.

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

Quy tac quan trong:

- filters, widgets va comparisons chi uoc dua tren cac field that su co trong backend response
- UI khong uoc tu bia ra cac marketplace-style features ma backend khong ho tro ung ban chat

## 9. Chien Luoc Tan Dung Endpoint

Backend hien co nhieu endpoint hon rat nhieu so voi nhung gi UI luot au can dung. Luot rebuild nay khong nen co dung het toan bo endpoint cung luc. Thay vao o, moi nhom endpoint phai uoc phan loai ro e frontend tan dung backend mot cach co chu ich.

### 9.1 Endpoint Public V1

Cac endpoint sau nen uoc noi vao luot rebuild public au tien:

- hotels
  - `/api/hotels`
  - `/api/hotels/:id`
- promotions
  - `/api/promotions`
- search va inventory
  - `/api/rooms/availability`
  - `/api/locations`
  - `/api/locations/tree`
- auth
  - `/api/auth/login`
  - `/api/auth/guest/register`
  - `/api/auth/guest/login`
  - `/api/auth/me`
- booking va reservation
  - `/api/reservations`
  - `/api/reservations/:code`
- guest-facing payment
  - `/api/payments`
  - `/api/payments->reservation_id=`
- guest-facing cancellation
  - `/api/reservations/:id/guest-cancel`

### 9.2 Endpoint Cho Guest Account / Loyalty

Cac endpoint nay thuoc ve account area va trai nghiem cua guest a ang nhap:

- `/api/auth/me`
- `/api/promotions->guest_id=`
- `/api/reservations/:code`
- `/api/payments->reservation_id=`

Chung nen phuc vu:

- profile context
- loyalty display
- member offers
- reservation history hoac upcoming stays khi account UI uoc lam

### 9.3 Endpoint Cho Admin Portal

Cac endpoint nay phai uoc xem la first-class cho admin rebuild, ke ca khi public v1 chua dung:

- admin pricing va revenue
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

### 9.4 Endpoint a Co Nhung Chua Uu Tien O Luot UI au

Cac endpoint nay ton tai va can uoc ghi nhan trong roadmap, nhung khong nen lam lech huong luot rebuild au tien:

- `/api/guests`
- `/api/guests/:id`
- `POST /api/guests`

Chung huu ich cho admin/data workflows, nhung public UI moi khong nen phu thuoc vao guest list tong e hoat ong.

### 9.5 Quy Tac Ve Coverage Cua Endpoint

UI plan khong nen huong toi viec dung toan bo endpoint cua backend trong release au tien.

Thay vao o:

- moi nhom endpoint phai uoc ghi nhan
- moi nhom endpoint phai uoc gan vao mot product surface ro rang
- thu gi chua dung o v1 phai uoc defer co chu ich, khong uoc bo quen mot cach im lang
- o rong cua backend se inh hinh roadmap dai han, chu khong lam qua tai luot rebuild au tien

## 10. Cac Tinh Nang e Sau / Khong Thuoc V1

Cac phan sau phai uoc hoan ro rang:

- flights
- flight + hotel
- taxi
- attractions
- car rental
- wallet va oi thuong
- smart filters nang cao
- review ecosystem quy mo lon
- landmark va neighborhood intelligence quy mo lon
- public invoice workflow
- public service operations
- admin tools ben trong guest pages

## 11. Tieu Chi Hoan Thanh

`plan_UI.vi.md` uoc xem la hoan chinh neu mot nguoi implement moi co the tra loi tat ca cac cau sau ma khong can oan:

- cac pattern nao tu Booking.com uoc dung lai co chu ich
- cac tinh nang nao cua Booking.com bi loai bo
- homepage phai chua nhung gi
- trang `/search` chiu trach nhiem cho phan nao
- vi sao hotel detail bat buoc phai ton tai truoc booking
- anonymous booking hoat ong the nao
- loyalty booking khac gi so voi anonymous
- cai gi thuoc ve `/reservation`
- cai gi thuoc ve `/account`
- cai gi chi thuoc ve `/admin`
- nhung filter nao hop le trong v1
- nhung nhom endpoint nao thuoc public v1, loyalty/account, admin, hoac deferred use
- nhung tinh nang nao bi e sau

## 12. Cac Rule Mac inh Khi Build

- workflow correctness quan trong hon visual polish
- hotel comparison phai dien ra truoc booking
- room choice dien ra o hotel detail, khong phai homepage
- booking la checkout-style, khong phai search-style
- admin tach hoan toan khoi guest product flow
- o phuc tap cua frontend bi gioi han boi backend truth
