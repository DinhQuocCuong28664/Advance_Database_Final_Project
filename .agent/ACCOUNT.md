# Demo Accounts & Roles

File này lưu trữ thông tin về các tài khoản kiểm thử (demo accounts) và các vai trò (roles) hiện có trong hệ thống LuxeReserve để tiện cho việc test và phát triển:

## 1. System Users (Quản trị viên)
Dùng để truy cập vào hệ thống Admin Portal (`/admin`), quản lý số lượng phòng trống, mức giá, cài đặt chung,...
- **Username:** `admin`
- **Password:** `admin`
*(Hoặc các tài khoản tương đương có quyền truy cập system).*

## 2. Guest Accounts (Khách hàng)
Dùng để truy cập hệ thống Customer Portal (`/`), đăng nhập để thực hiện việc đặt phòng, xem lịch sử chuyến đi, quản lý điểm thưởng loyalty,...
- **Username:** `user`
- **Password:** `user`
- **Username:** `dqc`
- **Password:** `dqc`

## 3. Account States (Trạng thái tài khoản)
Trong dự án này, tài khoản hỗ trợ các trạng thái sau để test các luồng bị chặn:
- **`ACTIVE`**: Bình thường, cho phép đăng nhập và sử dụng toàn bộ chức năng.
- **`LOCKED`**: Bị khoá tạm thời (thường do nhập sai mk nhiều lần), không cho đăng nhập.
- **`DISABLED`**: Đã bị vô hiệu hoá hoàn toàn bởi admin.
- *(Khuyến nghị: Quá trình tạo mới account Guest sẽ phải qua bước `PENDING` chờ mã OTP gửi về qua email).*

---
> Mọi thay đổi về phân quyền hoặc test account mới, hãy cập nhật vào đây để cả team cùng nắm bắt.
