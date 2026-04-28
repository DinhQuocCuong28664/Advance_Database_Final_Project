# AI Agent Instructions

Day la file danh rieng e ghi chu cac quy tac, huong dan, va tieu chuan code cua du an. 
Khi ban co nhung quy inh cu the (vi du: luon dung thu vien nao, cau truc thu muc ra sao, cach viet ten bien, ...), ban co the ghi vao ay.

Moi khi can, ban chi viec nhac minh: *"Hay oc file .agent/AGENT.md e tuan thu quy tac"* nhe!

## 1. Stack & Technologies
- Frontend: React (Vite)
- Backend: Node.js / Express
- Database: SQL Server / MongoDB
- Language: English

## 2. Coding Standards
- Khi sua oi frontend co the xem giao dien trong thu muc hotel
- Khi thuc hien xong cac thay oi thi hay ghi vao file NOTE.md nhung file thay oi lien quan kem so dong

## 3. UI/UX Design System (Color Palette)
Cot loi tham my cua du an huong en su Sang trong, ang cap va hien ai danh cho Khach San (Premium Hospitality). Tat ca cac module moi can tuan thu bang mau CSS hien hanh:

- **Tong nen (Warm Beige):** `--bg: #f4ede3` va `--bg-deep: #e7dccf`. (Danh cho nen chinh, cam giac am ap).
- **Tong thuong hieu (Deep Teal):** `--panel-strong: #143d42`. (Xanh co vit quyen luc danh cho Nut bam Primary, Panel toi mau cung cap).
- **Tong iem xuyet (Bronze / Accents):** `--accent: #b5793f`. (Chi dung cho cac Badge, vien mong hoac chu nho can thu hut anh nhin - Eyebrow).
- **Tong Text:** 
  - `--text-strong: #17282b` (Text hien thi noi dung chinh tren nen sang thay vi mau en hoan toan).
  - `--text-soft: #607172` (Phu e, Placeholder, text nho).
  - `--text-on-dark: #f7f1e7` (Trang nga am e at len tren cac be mat toi).
  
**Luu y thiet ke chung:** Su dung cac uong vien goc mem mai (`border-radius`), o bong so-co-la mo/chieu sau (`box-shadow`), su dung gradient chuyen mau ket hop nen cham luoi. Tranh cac giao dien phang, thieu chieu sau. Khong tu y them cac tone mau loe loet nhu o nguyen thuy hay xanh la cay nguyen thuy neu khong phai la alert.
