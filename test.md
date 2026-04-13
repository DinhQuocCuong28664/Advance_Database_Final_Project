Ran command: `node tests/test_advanced_cases.js`

Tóm tắt cực gọn kết quả Test bộ 3 phần (4-5-6) mới nhất rọi thẳng vào **"sai chỗ nào, đúng chỗ nào"** như bạn yêu cầu:

---

### 🟣 Phần 4: DISTRIBUTED SYSTEMS (Sai logic Transaction Node.js)
* **Đúng:** Chặn tiền lách luật qua Gateway ảo (TC_DIST_003 bắt HTTP 400 chuẩn).
* **❌ SAI CHỖ NÀO (TC_DIST_001): Lỗi sập Transaction Mismatch**
  * Khi luồng đặt phòng bị đứt gãy do phòng không tồn tại, Engine SQL Server đã tự động ngắt và Rollback dữ liệu ở dưới đáy.
  * Việc sai nằm ở code Backend Node.js (cụ thể là `reservations.js`). Trong khối `catch`, dev lại viết thêm một lệnh `await transaction.rollback();` nữa. Do SQL đã huỷ giao dịch mất rồi, Node chọc vào khoảng không nên gây ra nổ lỗi rác: *"HTTP 500: Mismatching number of BEGIN and COMMIT statements"*. Quản trị luồng Exception thất bại.

---

### 🔴 Phần 5: SECURITY & EDGE CASES (Sai sót chêt người nhất)
* **Đúng:** Đã chặn đứng Hack tiền âm `rate = -5000` (TC_EDGE_001); Chặn xuất sắc SQL Injection xoá Table (TC_SEC_001); Chống lặp thanh toán kép 2 lần cực gắt (TC_EDGE_004).
* **❌ SAI CHỖ NÀO:** Khâu Validation của BE bị hổng lỗ chỗ ở 2 điểm chí mạng:
  * **1. Nghịch lý Cỗ Máy Thời Gian (TC_EDGE_002):** Backend *KHÔNG CÓ CODE KHÓA* so sánh ngày Check-Out phải lớn hơn Check-In. Khi tôi test đặt Check-out lùi về quá khứ, hệ thống thản nhiên báo "ĐẶT PHÒNG THÀNH CÔNG" và lưu vào Data số đêm là **`-4 nights`**, hóa đơn xuất ra là **`Âm 4000 VND`** (-4000). Rất nguy hiểm vì tiền bị xuất ngược!
  * **2. Vỡ Toang Phân Quyền (TC_SEC_002):** API Xem dữ liệu Báo cáo doanh thu tối mật (`/api/admin/reports/revenue`) ở file `admin.js` đang mở cửa vô điều kiện. Request đẩy vào không hề có Token hay Check Middleware của Admin mà hệ thống vẫn nhả Data (HTTP 200).
  * **3. Căng tải vòng lặp Boundary (TC_BND_001):** Khi ép test đặt 180 đêm liên tiếp, vòng lặp FOR ngầm đẩy quá khả năng chịu tải SQL gây Timeout/Crash trả thẳng Server Error 500 thay vì từ chối nhẹ nhàng ở Controller.

---

### 🔵 Phần 6: PERFORMANCE METRICS (Không Sai - Tuyệt Vời)
Phần này Backend đã được kiến trúc CQRS và xử lý SQL Data xuất sắc:
* **Không có lỗi nào ở Phần 6 (Pass 100%)**
* **MongoDB Lướt Sóng:** Tội đẩy 100 truy vấn song song cùng lúc lấy Catalog Khách Sạn, Mongo nhai gọn lẹ tốn có `1087ms` (trung bình ~10ms/Request). 
* **Lực Kéo SQL Tốc Độ Quỷ:** Báo cáo Ranking Doanh thu tính toán bằng Window Functions siêu nặng nhưng SQL dập xong chỉ trong... vỏn vẹn **`6ms`**. Hệ thống Engine cực kì hoàn mĩ!

***

**Tóm cái váy lại:** Database và Kiến trúc chia tải CQRS làm rất tốt, nhưng **phần code Node.js (Controller/Routes) đang viết ẩu**. Cần vá gấp lỗi Check Data Ngày Giờ âm tiền và kẹp Token bảo mật cho Route Báo Cáo. Bạn cần tôi can thiệp vá ngay không?