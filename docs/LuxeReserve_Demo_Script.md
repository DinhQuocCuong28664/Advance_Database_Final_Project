# Kịch bản Live Demo (Theo Luồng User Flow)

Dưới đây là kịch bản trình diễn được thiết kế theo một luồng liền mạch (End-to-End User Flow). Cách này giúp câu chuyện tự nhiên hơn: Khách hàng tìm phòng ➡️ Đặt phòng (bị tranh giành) ➡️ Thanh toán ➡️ Quản lý xem báo cáo.

---

## 👨‍💻 Bước 1: Khách hàng tìm kiếm phòng (Tôn vinh MongoDB)
*Luồng: Trang chủ ➡️ Danh sách Khách sạn*

**🎤 Lời dẫn:** *"Chào thầy cô, kịch bản bắt đầu khi một khách hàng truy cập vào hệ thống để tìm phòng nghỉ dưỡng. Ngay khi trang web vừa mở lên, danh sách hàng trăm khách sạn kèm theo hình ảnh độ phân giải cao và danh sách tiện ích được tải xuống gần như ngay lập tức."*

**💻 Thao tác:**
1. Mở trang chủ LuxeReserve.
2. Bấm **F12 (Developer Tools)** -> Tab **Network**. Tải lại trang (F5) để show thời gian phản hồi API dưới 50ms.
3. Mở **MongoDB Compass** chiếu lên màn hình.
4. **Giải thích:** *"Bí quyết nằm ở thiết kế **MongoDB Embedding**. Thay vì dùng SQL Server phải JOIN 4-5 bảng (Khách sạn, Hình ảnh, Tiện ích), nhóm em nhúng toàn bộ mảng `images` và `amenities` vào chung một Document. API chỉ cần đúng 1 thao tác đọc ổ cứng là lấy được toàn bộ Catalog!"*

---

## ⚔️ Bước 2: Tranh giành phòng VIP (Tôn vinh SQL Concurrency Control)
*Luồng: Chọn phòng ➡️ Điền thông tin ➡️ Cùng lúc bấm Thanh toán*

**🎤 Lời dẫn:** *"Khách hàng quyết định chọn phòng VIP nhất (Presidential Suite). Nhưng vì là mùa cao điểm, có một vị khách khác ở nơi khác cũng đang nhắm tới căn phòng này cùng ngày."*

**💻 Thao tác:**
1. Mở Cửa sổ 1 (Khách A - Trình duyệt thường): Chọn phòng VIP, điền thông tin, dừng lại ở nút **Thanh toán ngay**.
2. Mở Cửa sổ 2 (Khách B - Ẩn danh): Cùng thao tác chọn đúng phòng đó, ngày đó, dừng lại ở nút **Thanh toán ngay**.
3. **Đếm 1.. 2.. 3..** Bấm nút Thanh toán ở cả 2 màn hình cùng một lúc!
4. Khách A được chuyển hướng mượt mà sang cổng **VNPay**.
5. Khách B bị văng lỗi đỏ: *"Phòng vừa có người đặt. Vui lòng thử lại!"*
6. Mở **SQL Server Management Studio (SSMS)**, chạy câu lệnh:
   ```sql
   SELECT room_id, lock_status, note FROM InventoryLockLog ORDER BY lock_acquired_at DESC;
   ```
7. **Giải thích:** *"Nhờ cơ chế **Pessimistic Locking (UPDLOCK, HOLDLOCK)**, hệ thống lập tức khóa dòng dữ liệu căn phòng khi Khách A bấm nút. Khách B đến sau 1 mili-giây lập tức bị Database chặn lại (Fail-fast). Điều này ngăn chặn 100% thảm họa Double-booking."*

---

## 💳 Bước 3: Thanh toán thành công (Tôn vinh ACID)
*Luồng: VNPay ➡️ Cập nhật trạng thái*

**🎤 Lời dẫn:** *"Khách A tiến hành quét mã QR trên VNPay. Sau khi thanh toán thành công, hệ thống phải đảm bảo tính nhất quán dữ liệu (ACID)."*

**💻 Thao tác:**
1. Màn hình Khách A: Thanh toán xong VNPay, quay về trang web báo "Giao dịch thành công".
2. Mở SQL Server, query bảng `Payment` và bảng `Reservation`.
3. **Giải thích:** *"Tầng Node.js API đã nhận Callback từ VNPay và sử dụng Transaction để đồng loạt chèn hóa đơn vào bảng `Payment` và đổi trạng thái phòng sang `CONFIRMED`. Nếu có bước nào sập mạng, toàn bộ chu trình sẽ tự động Rollback."*

---

## 📈 Bước 4: Giám đốc xem Báo cáo (Tôn vinh Window Functions)
*Luồng: Màn hình Admin ➡️ Bảng xếp hạng doanh thu*

**🎤 Lời dẫn:** *"Sau khi tiền đổ về tài khoản, Giám đốc khách sạn ngay lập tức mở điện thoại lên xem báo cáo doanh thu."*

**💻 Thao tác:**
1. Mở trình duyệt thứ 3 (Đóng vai Admin), đăng nhập vào màn hình **Revenue Analytics**.
2. Chỉ cho giám khảo xem doanh thu của khách sạn vừa nhảy vọt, và thứ hạng (Rank) của khách sạn đó trong chuỗi vừa vươn lên Top 1.
3. Mở SQL Server, chiếu đoạn code của `vw_RevenueByHotel`.
4. **Giải thích:** *"Các hệ thống cũ thường dùng Cronjob để chạy tính toán vào cuối ngày, khiến dữ liệu bị trễ (Delay). Nhóm em dùng **SQL Window Functions (SUM OVER, DENSE_RANK)** để tính lũy kế và xếp hạng ngay trên RAM của Database (On-the-fly). Giám đốc luôn xem được số liệu Real-time 100% mà không sợ quá tải Server."*

---

## 🌍 Bước 5: Mở rộng tệp khách hàng (Tôn vinh Recursive CTE)
*Luồng: Admin ➡️ Quản lý chi nhánh*

**🎤 Lời dẫn:** *"Hệ thống LuxeReserve được thiết kế để mở rộng trên toàn cầu."*

**💻 Thao tác:**
1. Trên màn hình Admin, mở tab Quản lý Chi nhánh (Locations).
2. Show cấu trúc cây: `Châu Á > Việt Nam > Hà Nội > Quận Hoàn Kiếm`.
3. **Giải thích:** *"Thay vì tạo bảng phẳng (Country, City) rất khó mở rộng, nhóm em dùng mô hình Adjacency List. Kết hợp với kỹ thuật đệ quy **Recursive CTE** trên SQL Server, hệ thống có thể trải phẳng cấu trúc cây địa lý có độ sâu vô hạn mà không cần dùng bất kỳ vòng lặp Code nào trên Backend."*

**🎤 Kết thúc:** *"Dạ bài demo End-to-End của nhóm em xin kết thúc tại đây ạ!"*
