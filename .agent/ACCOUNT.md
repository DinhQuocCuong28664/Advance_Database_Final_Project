# Demo Accounts & Roles

File nay luu tru thong tin ve cac tai khoan kiem thu (demo accounts) va cac vai tro (roles) hien co trong he thong LuxeReserve e tien cho viec test va phat trien:

## 1. System Users (Quan tri vien)
Dung e truy cap vao he thong Admin Portal (`/admin`), quan ly so luong phong trong, muc gia, cai at chung,...
- **Username:** `admin`
- **Password:** `admin`
*(Hoac cac tai khoan tuong uong co quyen truy cap system).*

## 2. Guest Accounts (Khach hang)
Dung e truy cap he thong Customer Portal (`/`), ang nhap e thuc hien viec at phong, xem lich su chuyen i, quan ly iem thuong loyalty,...
- **Username:** `user`
- **Password:** `user`
- **Username:** `dqc`
- **Password:** `dqc`

## 3. Account States (Trang thai tai khoan)
Trong du an nay, tai khoan ho tro cac trang thai sau e test cac luong bi chan:
- **`ACTIVE`**: Binh thuong, cho phep ang nhap va su dung toan bo chuc nang.
- **`LOCKED`**: Bi khoa tam thoi (thuong do nhap sai mk nhieu lan), khong cho ang nhap.
- **`DISABLED`**: a bi vo hieu hoa hoan toan boi admin.
- *(Khuyen nghi: Qua trinh tao moi account Guest se phai qua buoc `PENDING` cho ma OTP gui ve qua email).*

---
> Moi thay oi ve phan quyen hoac test account moi, hay cap nhat vao ay e ca team cung nam bat.
