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
