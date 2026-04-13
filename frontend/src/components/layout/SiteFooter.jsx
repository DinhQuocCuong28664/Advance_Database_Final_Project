import { NavLink } from 'react-router-dom';

export default function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-main">
        {/* ── Column 1: About ────────────────────────── */}
        <div className="footer-col footer-about">
          <div className="footer-logo">
            <span className="logo-icon">L</span>
            <div className="logo-text">
              <strong>LuxeReserve</strong>
              <small>Luxury Hospitality Platform</small>
            </div>
          </div>
          <p className="footer-desc">
            LuxeReserve là nền tảng đặt phòng khách sạn cao cấp, 
            mang đến trải nghiệm sang trọng với hệ thống quản lý 
            hiện đại và chương trình khách hàng thân thiết.
          </p>
          <div className="footer-social">
            <a href="#" className="social-link" aria-label="Facebook">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
            </a>
            <a href="#" className="social-link" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none"/></svg>
            </a>
            <a href="#" className="social-link" aria-label="YouTube">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a2.997 2.997 0 00-2.112-2.12C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.386.521A2.997 2.997 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a2.997 2.997 0 002.112 2.12c1.881.521 9.386.521 9.386.521s7.505 0 9.386-.521a2.997 2.997 0 002.112-2.12C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </a>
          </div>
        </div>

        {/* ── Column 2: Quick links ──────────────────── */}
        <div className="footer-col">
          <h4>Liên kết nhanh</h4>
          <ul className="footer-links">
            <li><NavLink to="/">Trang chủ</NavLink></li>
            <li><NavLink to="/booking">Đặt phòng</NavLink></li>
            <li><NavLink to="/reservation">Quản lý đặt phòng</NavLink></li>
            <li><a href="#">Khuyến mãi</a></li>
            <li><a href="#">Chính sách bảo mật</a></li>
            <li><a href="#">Điều khoản sử dụng</a></li>
          </ul>
        </div>

        {/* ── Column 3: Services ─────────────────────── */}
        <div className="footer-col">
          <h4>Dịch vụ</h4>
          <ul className="footer-links">
            <li><a href="#">Đặt phòng khách sạn</a></li>
            <li><a href="#">Chương trình thành viên</a></li>
            <li><a href="#">Dịch vụ Spa & Wellness</a></li>
            <li><a href="#">Nhà hàng & Ẩm thực</a></li>
            <li><a href="#">Tổ chức sự kiện</a></li>
            <li><a href="#">Đón tiễn sân bay</a></li>
          </ul>
        </div>

        {/* ── Column 4: Contact ──────────────────────── */}
        <div className="footer-col">
          <h4>Liên hệ</h4>
          <ul className="footer-contact">
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>Tầng 10, Số 60 Nguyễn Đình Chiểu, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh</span>
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              <span>Hotline: 1900 1234 56 (24/7)</span>
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <span>Email: booking@luxereserve.vn</span>
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
              <span>Website: www.luxereserve.vn</span>
            </li>
          </ul>

          <div className="footer-payment">
            <h4>Hỗ trợ thanh toán</h4>
            <div className="payment-badges">
              <span className="payment-badge">VISA</span>
              <span className="payment-badge">MasterCard</span>
              <span className="payment-badge">JCB</span>
              <span className="payment-badge">MoMo</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ──────────────────────────────── */}
      <div className="footer-bottom">
        <p>&copy; {currentYear} LuxeReserve. All rights reserved.</p>
        <p>Thuộc môn học: Hệ cơ sở dữ liệu nâng cao — HCSDLNC</p>
      </div>
    </footer>
  );
}
