import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFlash } from '../../context/FlashContext';
import { NAV_ITEMS } from '../../constants';

export default function SiteHeader() {
  const navigate = useNavigate();
  const { authSession, authBusy, guestAccounts, login, registerGuest, logout } = useAuth();
  const { setFlash } = useFlash();

  const [authPanel, setAuthPanel] = useState(null); // 'login' | 'register' | null
  const [authLogin, setAuthLogin] = useState({ login: '', password: '' });
  const [guestRegister, setGuestRegister] = useState({
    first_name: '', last_name: '', login_email: '', password: '',
    phone_country_code: '+84', phone_number: '',
  });

  async function handleLogin(event) {
    event.preventDefault();
    const result = await login(authLogin);
    if (result.success) {
      setFlash({ tone: 'success', text: `Đăng nhập thành công — ${result.user.full_name}` });
      setAuthPanel(null);
      if (result.user.user_type === 'SYSTEM_USER') navigate('/admin');
      else navigate('/booking');
    } else {
      setFlash({ tone: 'error', text: result.error });
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    const result = await registerGuest(guestRegister);
    if (result.success) {
      setFlash({ tone: 'success', text: `Tạo tài khoản thành công — ${result.user.full_name}` });
      setAuthPanel(null);
      navigate('/booking');
    } else {
      setFlash({ tone: 'error', text: result.error });
    }
  }

  function handleLogout() {
    logout();
    setFlash({ tone: 'success', text: 'Đã đăng xuất.' });
    setAuthPanel(null);
    navigate('/');
  }

  return (
    <header className="site-header">
      {/* ── Top bar ─────────────────────────────────── */}
      <div className="header-top-bar">
        <div className="header-top-left">
          <span className="header-contact-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            Hotline: 1900 1234 56
          </span>
          <span className="header-contact-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            booking@luxereserve.vn
          </span>
          <span className="header-contact-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Hỗ trợ 24/7
          </span>
        </div>
        <div className="header-top-right">
          {authSession ? (
            <>
              <span className="header-user-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {authSession.user.full_name}
                {guestAccounts.length ? <small> — {guestAccounts.map((a) => a.tier_code).join(', ')}</small> : null}
              </span>
              <button type="button" className="header-top-link" onClick={handleLogout}>Đăng xuất</button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`header-top-link ${authPanel === 'login' ? 'active' : ''}`}
                onClick={() => setAuthPanel(authPanel === 'login' ? null : 'login')}
              >
                Đăng nhập
              </button>
              <span className="header-divider">|</span>
              <button
                type="button"
                className={`header-top-link ${authPanel === 'register' ? 'active' : ''}`}
                onClick={() => setAuthPanel(authPanel === 'register' ? null : 'register')}
              >
                Đăng ký
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Main navigation ─────────────────────────── */}
      <div className="header-main">
        <NavLink to="/" className="header-logo">
          <span className="logo-icon">L</span>
          <div className="logo-text">
            <strong>LuxeReserve</strong>
            <small>Luxury Hospitality Platform</small>
          </div>
        </NavLink>

        <nav className="header-nav">
          {NAV_ITEMS.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => isActive ? 'header-nav-link active' : 'header-nav-link'}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          <span className="header-contact-item phone-highlight">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            1900 1234 56
          </span>
        </div>
      </div>

      {/* ── Auth Dropdown Panel ─────────────────────── */}
      {authPanel === 'login' && !authSession ? (
        <div className="header-auth-dropdown">
          <form className="auth-dropdown-form" onSubmit={handleLogin}>
            <h3>Đăng nhập</h3>
            <p className="muted-copy">Một khung đăng nhập duy nhất — hệ thống tự nhận diện guest hay admin.</p>
            <div className="auth-dropdown-fields">
              <label>
                Tài khoản
                <input
                  type="text"
                  placeholder="Email, mã guest, hoặc username admin"
                  value={authLogin.login}
                  onChange={(e) => setAuthLogin((c) => ({ ...c, login: e.target.value }))}
                  autoFocus
                />
              </label>
              <label>
                Mật khẩu
                <input
                  type="password"
                  placeholder="Nhập mật khẩu"
                  value={authLogin.password}
                  onChange={(e) => setAuthLogin((c) => ({ ...c, password: e.target.value }))}
                />
              </label>
            </div>
            <div className="auth-dropdown-actions">
              <button className="primary-button" type="submit" disabled={authBusy === 'login'}>
                {authBusy === 'login' ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
              <button className="ghost-button" type="button" onClick={() => setAuthPanel(null)}>Đóng</button>
            </div>
          </form>
        </div>
      ) : null}

      {authPanel === 'register' && !authSession ? (
        <div className="header-auth-dropdown">
          <form className="auth-dropdown-form" onSubmit={handleRegister}>
            <h3>Đăng ký tài khoản guest</h3>
            <p className="muted-copy">Tạo profile mới để đặt phòng và nhận ưu đãi thành viên.</p>
            <div className="auth-dropdown-fields register-fields">
              <label>
                First name
                <input type="text" value={guestRegister.first_name} onChange={(e) => setGuestRegister((c) => ({ ...c, first_name: e.target.value }))} autoFocus />
              </label>
              <label>
                Last name
                <input type="text" value={guestRegister.last_name} onChange={(e) => setGuestRegister((c) => ({ ...c, last_name: e.target.value }))} />
              </label>
              <label>
                Email đăng nhập
                <input type="email" value={guestRegister.login_email} onChange={(e) => setGuestRegister((c) => ({ ...c, login_email: e.target.value }))} />
              </label>
              <label>
                Mật khẩu
                <input type="password" value={guestRegister.password} onChange={(e) => setGuestRegister((c) => ({ ...c, password: e.target.value }))} />
              </label>
              <label>
                Mã vùng
                <input type="text" value={guestRegister.phone_country_code} onChange={(e) => setGuestRegister((c) => ({ ...c, phone_country_code: e.target.value }))} />
              </label>
              <label>
                Số điện thoại
                <input type="text" value={guestRegister.phone_number} onChange={(e) => setGuestRegister((c) => ({ ...c, phone_number: e.target.value }))} />
              </label>
            </div>
            <div className="auth-dropdown-actions">
              <button className="primary-button" type="submit" disabled={authBusy === 'register'}>
                {authBusy === 'register' ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
              <button className="ghost-button" type="button" onClick={() => setAuthPanel(null)}>Đóng</button>
            </div>
          </form>
        </div>
      ) : null}
    </header>
  );
}
