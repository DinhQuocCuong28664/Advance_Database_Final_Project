Ran command: `node tests/test_advanced_cases.js`

Tom tat cuc gon ket qua Test bo 3 phan (4-5-6) moi nhat roi thang vao **"sai cho nao, ung cho nao"** nhu ban yeu cau:

---

###  Phan 4: DISTRIBUTED SYSTEMS (Sai logic Transaction Node.js)
* **ung:** Chan tien lach luat qua Gateway ao (TC_DIST_003 bat HTTP 400 chuan).
* ** SAI CHO NAO (TC_DIST_001): Loi sap Transaction Mismatch**
  * Khi luong at phong bi ut gay do phong khong ton tai, Engine SQL Server a tu ong ngat va Rollback du lieu o duoi ay.
  * Viec sai nam o code Backend Node.js (cu the la `reservations.js`). Trong khoi `catch`, dev lai viet them mot lenh `await transaction.rollback();` nua. Do SQL a huy giao dich mat roi, Node choc vao khoang khong nen gay ra no loi rac: *"HTTP 500: Mismatching number of BEGIN and COMMIT statements"*. Quan tri luong Exception that bai.

---

###  Phan 5: SECURITY & EDGE CASES (Sai sot chet nguoi nhat)
* **ung:** a chan ung Hack tien am `rate = -5000` (TC_EDGE_001); Chan xuat sac SQL Injection xoa Table (TC_SEC_001); Chong lap thanh toan kep 2 lan cuc gat (TC_EDGE_004).
* ** SAI CHO NAO:** Khau Validation cua BE bi hong lo cho o 2 iem chi mang:
  * **1. Nghich ly Co May Thoi Gian (TC_EDGE_002):** Backend *KHONG CO CODE KHOA* so sanh ngay Check-Out phai lon hon Check-In. Khi toi test at Check-out lui ve qua khu, he thong than nhien bao "AT PHONG THANH CONG" va luu vao Data so em la **`-4 nights`**, hoa on xuat ra la **`Am 4000 VND`** (-4000). Rat nguy hiem vi tien bi xuat nguoc!
  * **2. Vo Toang Phan Quyen (TC_SEC_002):** API Xem du lieu Bao cao doanh thu toi mat (`/api/admin/reports/revenue`) o file `admin.js` ang mo cua vo ieu kien. Request ay vao khong he co Token hay Check Middleware cua Admin ma he thong van nha Data (HTTP 200).
  * **3. Cang tai vong lap Boundary (TC_BND_001):** Khi ep test at 180 em lien tiep, vong lap FOR ngam ay qua kha nang chiu tai SQL gay Timeout/Crash tra thang Server Error 500 thay vi tu choi nhe nhang o Controller.

---

###  Phan 6: PERFORMANCE METRICS (Khong Sai - Tuyet Voi)
Phan nay Backend a uoc kien truc CQRS va xu ly SQL Data xuat sac:
* **Khong co loi nao o Phan 6 (Pass 100%)**
* **MongoDB Luot Song:** Toi ay 100 truy van song song cung luc lay Catalog Khach San, Mongo nhai gon le ton co `1087ms` (trung binh ~10ms/Request). 
* **Luc Keo SQL Toc o Quy:** Bao cao Ranking Doanh thu tinh toan bang Window Functions sieu nang nhung SQL dap xong chi trong... von ven **`6ms`**. He thong Engine cuc ki hoan mi!

***

**Tom cai vay lai:** Database va Kien truc chia tai CQRS lam rat tot, nhung **phan code Node.js (Controller/Routes) ang viet au**. Can va gap loi Check Data Ngay Gio am tien va kep Token bao mat cho Route Bao Cao. Ban can toi can thiep va ngay khong->