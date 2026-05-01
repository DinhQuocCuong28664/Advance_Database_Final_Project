<<<<<<< Updated upstream
# 🚀 Báo Cáo Tiến Độ & Kế Hoạch LuxeReserve
*Cập nhật lần cuối: 29/04/2026*

File này tổng hợp toàn bộ những công việc chúng ta đã hoàn thành từ lúc bạn kéo (pull) code mới về, cùng với danh sách các hạng mục cần làm tiếp theo để hoàn thiện đồ án.

---

## ✅ Những Gì Đã Làm Được (Completed Achievements)
Dưới đây là các tính năng và lỗi đã được giải quyết triệt để:

### 1. Luồng Thanh Toán VNPay (VNPAY Payment Flow)
- **Cấu hình URL:** Sửa lỗi cấu hình `VNPAY_RETURN_URL` và `VNPAY_IPN_URL` trong file `.env` trỏ đúng về Backend API thay vì Frontend.
- **Lỗi Chữ Ký (HMAC Signature):** Sửa lỗi mã hóa chữ ký trong `vnpay.js` bằng cách lọc bỏ các tham số rác (tracking params) do trình duyệt tự động thêm vào, giúp giao dịch không bị báo lỗi "Chữ ký không hợp lệ".
- **Cơ sở dữ liệu:** Sửa lỗi ánh xạ cột sai trong SQL (`vnpay.js`) khi ghi nhận giao dịch vào bảng `Payment`. Đã dọn dẹp (unlock) thành công các phòng bị kẹt do lỗi thanh toán trước đó.

### 2. Logic Nghiệp Vụ Cốt Lõi (Core Business Logic)
- **Tự động Gộp Hồ Sơ (Account Claiming):** Đã nâng cấp luồng Đăng ký tài khoản (`auth.js`). Khách hàng đặt phòng vãng lai (Guest Checkout) sau khi tạo tài khoản bằng chính email đó sẽ tự động được liên kết và xem lại được toàn bộ các đơn hàng cũ.
- **Xác thực Email Thực Tế (Real SMTP):** Xác nhận hệ thống gửi Email (OTP, Booking Confirmation) đã hoạt động hoàn hảo 100% qua cấu hình App Password của Gmail.
- **Cập nhật Tìm kiếm:** Sửa lỗi không cho phép tìm kiếm lại khi thay đổi "số lượng khách" trên trang `SearchPage.jsx`.

### 3. Giao diện Người Dùng (Frontend UI/UX)
- **Thư viện Ảnh Phòng (Image Carousel):** Tích hợp thành công thư viện ảnh phòng đa góc độ cho trang Chi tiết khách sạn. Các ảnh có thể tự động cuộn (auto-scroll 3.5s) hoặc vuốt ngang mượt mà. Đã fix lỗi "chết link" ảnh cho hạng phòng Deluxe.

---

## 🔴 Cần Xử Lý Sớm (Immediate / Core Needs)
Những tính năng này ảnh hưởng trực tiếp đến nghiệp vụ cốt lõi, nên ưu tiên hoàn thành:

- [ ] **Cơ chế Tự Động Nhả Phòng (Auto-unlock Rooms):**
  - *Vấn đề:* Khách đang thanh toán VNPay mà tắt ngang trình duyệt, phòng sẽ bị kẹt vĩnh viễn ở trạng thái `LOCKED`.
  - *Giải pháp:* Viết một Background Job (Node.js setInterval hoặc node-cron) quét các đơn hàng `LOCKED` quá 15 phút để đổi lại thành `OPEN` và giải phóng phòng.
- [ ] **Luồng Check-in & Check-out tại quầy:**
  - *Vấn đề:* Lễ Tân cần giao diện rõ ràng để bấm Check-in (buộc phải gán số phòng vật lý cho khách) và Check-out (tính tổng tiền phòng + dịch vụ phát sinh).

---

## 🟡 Nâng Cấp Thêm (Optional / Enhancements)
Những tính năng mang tính chất "điểm cộng", làm đồ án xịn hơn nhưng nếu thiếu thời gian thì có thể bỏ qua:

- [ ] **Lưu Ảnh Phòng Vào Database:**
  - Thay vì gán cứng link ảnh Unsplash trên Frontend như hiện tại, hãy thêm cột `image_url` vào bảng `RoomType` trong SQL Server để quản lý bài bản hơn.
- [ ] **Xuất/In Hóa Đơn (Invoice Printing):**
  - Làm nút "In hóa đơn" (In ra PDF hoặc Print Window) khi khách Check-out, liệt kê chi tiết tiền phòng, thuế, và các phí dịch vụ phát sinh.
- [ ] **Giao diện Khách Hàng Thân Thiết (Loyalty UI):**
  - Backend đã có điểm thưởng, cần hiển thị trực quan số điểm tích lũy trên trang `AccountPage.jsx` và làm nút "Đổi Voucher".
- [ ] **Tính năng Quản Lý Buồng Phòng (Housekeeping UI):**
  - Database đã có sẵn bảng `HousekeepingTask`. Làm thêm 1 trang nhỏ cho nhân viên buồng phòng đánh dấu "Đã dọn dẹp" để Lễ tân tự tin giao chìa khóa cho khách.
=======
# 🚀 Danh Sách Việc Cần Làm (To-Do List) - RBAC Audit
*Ngày: 01/05/2026*

Hệ thống Core đã hoàn thiện, tuy nhiên sau đợt kiểm tra Chuyên sâu về Bảo mật Phân quyền (RBAC Security Audit), chúng ta cần vá lại lỗ hổng phân quyền (Privilege Escalation) ở cả 2 mặt Backend và Frontend để hệ thống đạt chuẩn nghiệp vụ Khách sạn thực tế.

---

## 🛑 Các Lỗi Phân Quyền Cần Khắc Phục (High Priority)

### 1. Vá Lỗ Hổng API Backend (Backend RBAC)
Hiện tại rất nhiều API đang dùng chung chìa khóa `requireSystemUser` (Mở cửa cho TOÀN BỘ nhân viên). Cần thắt chặt lại bằng `requireSystemRole([...])`:
- [ ] **Quản lý Đặt phòng (`reservations.js`):** 
  - API Check-in, Chuyển phòng, Hủy phòng, Khai báo khách: Chỉ cấp cho `['FRONT_DESK', 'MANAGER', 'ADMIN']`.
  - API Check-out: Cấp cho `['FRONT_DESK', 'CASHIER', 'MANAGER', 'ADMIN']`.
- [ ] **Quản lý Dịch vụ (`services.js`):** 
  - API Đổi trạng thái món / Thu tiền: Chỉ cấp cho `['FRONT_DESK', 'CASHIER', 'MANAGER', 'ADMIN']`.
- [ ] **Quản lý Buồng phòng (`housekeeping.js`):** 
  - API Giao việc / Cập nhật phòng (POST, PUT): Chỉ cấp cho `['HK_MANAGER', 'MANAGER', 'ADMIN']`.

### 2. Sửa Lỗi Giao Diện Frontend (Frontend RBAC & Routing)
Kiến trúc Route hiện tại đang ép quyền quá cứng nhắc, dẫn đến việc Trưởng Buồng phòng và Lễ tân bị văng khỏi hệ thống quản trị nội bộ.
- [ ] **Sửa luồng Đăng nhập (`AdminPage.jsx` & `CashierPage.jsx`):**
  - Hủy bỏ việc đá (redirect) `FRONT_DESK` và `HK_MANAGER` ra khỏi `/admin`. 
  - Gom chung tất cả Nhân viên (System User) về một không gian làm việc thống nhất tại `/admin`.
- [ ] **Hiển thị Tab (Modules) Động theo Chức danh (Role):**
  - **Lễ tân (`FRONT_DESK`):** Chỉ hiện Tab *Front Desk, Inventory, Housekeeping (chỉ xem), Invoices*.
  - **Thu ngân (`CASHIER`):** Chỉ hiện Tab *Invoices, Payments, Front Desk*.
  - **Trưởng Buồng phòng (`HK_MANAGER`):** Chỉ hiện Tab *Housekeeping, Maintenance*.
  - **Quản lý (`MANAGER`):** Hiện các Tab nghiệp vụ + *Rates, Reports*.
  - **Admin (`ADMIN`):** Nhìn thấy toàn bộ hệ thống (Bao gồm tab Accounts).

---

## 🌟 Tối ưu Code (Refactoring)
- [ ] **Đồng bộ Context:** Cập nhật lại `AuthContext.jsx` để xuất ra các cờ (flags) chuẩn xác hơn như `isFrontDeskUser`, `isHkManagerUser` giúp AdminPage dễ dàng render đúng Tab cho đúng người.

> **Lời nhắn:** Đây là bước tinh chỉnh cuối cùng và "đắt giá" nhất. Hoàn thiện xong bước RBAC này, đồ án của bạn sẽ trở thành một hệ thống Phần mềm Quản lý (PMS) thực thụ không thể bị bắt bẻ!
>>>>>>> Stashed changes
