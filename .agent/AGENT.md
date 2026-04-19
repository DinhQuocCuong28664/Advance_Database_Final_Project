# AI Agent Instructions

Đây là file dành riêng để ghi chú các quy tắc, hướng dẫn, và tiêu chuẩn code của dự án. 
Khi bạn có những quy định cụ thể (ví dụ: luôn dùng thư viện nào, cấu trúc thư mục ra sao, cách viết tên biến, ...), bạn có thể ghi vào đây.

Mỗi khi cần, bạn chỉ việc nhắc mình: *"Hãy đọc file .agent/AGENT.md để tuân thủ quy tắc"* nhé!

## 1. Stack & Technologies
- Frontend: React (Vite)
- Backend: Node.js / Express
- Database: SQL Server / MongoDB

## 2. Coding Standards
- Khi sửa đổi frontend có thể xem giao diện trong thư mục hotel
- Khi thực hiện xong các thay đổi thì hãy ghi vào file NOTE.md những file thay đổi liên quan kèm số dòng

## 3. UI/UX Design System (Color Palette)
Cốt lõi thẩm mỹ của dự án hướng đến sự Sang trọng, Đẳng cấp và hiện đại dành cho Khách Sạn (Premium Hospitality). Tất cả các module mới cần tuân thủ bảng màu CSS hiện hành:

- **Tông nền (Warm Beige):** `--bg: #f4ede3` và `--bg-deep: #e7dccf`. (Dành cho nền chính, cảm giác ấm áp).
- **Tông thương hiệu (Deep Teal):** `--panel-strong: #143d42`. (Xanh cổ vịt quyền lực dành cho Nút bấm Primary, Panel tối màu cứng cáp).
- **Tông điểm xuyết (Bronze / Accents):** `--accent: #b5793f`. (Chỉ dùng cho các Badge, viền mỏng hoặc chữ nhỏ cần thu hút ánh nhìn - Eyebrow).
- **Tông Text:** 
  - `--text-strong: #17282b` (Text hiển thị nội dung chính trên nền sáng thay vì màu đen hoàn toàn).
  - `--text-soft: #607172` (Phụ đề, Placeholder, text nhỏ).
  - `--text-on-dark: #f7f1e7` (Trắng ngà ấm để đặt lên trên các bề mặt tối).
  
**Lưu ý thiết kế chung:** Sử dụng các đường viền góc mềm mại (`border-radius`), đổ bóng sô-cô-la mờ/chiều sâu (`box-shadow`), sử dụng gradient chuyển màu kết hợp nền chấm lưới. Tránh các giao diện phẳng, thiếu chiều sâu. Không tự ý thêm các tone màu lòe loẹt như đỏ nguyên thuỷ hay xanh lá cây nguyên thuỷ nếu không phải là alert.
