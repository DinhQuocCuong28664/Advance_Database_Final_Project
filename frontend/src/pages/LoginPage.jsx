import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/FlashContext';

export default function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login, logout, authBusy, authSession, isSystemUser, isAdminUser, isCashierUser } = useAuth();
  const { setFlash } = useFlash();
  const [form, setForm] = useState({ login: '', password: '' });

  // ── Already signed in as GUEST → go home ────────────────────
  if (authSession && !isSystemUser) {
    return <Navigate to="/" replace />;
  }

  // ── Already signed in as SYSTEM USER → show switch screen ───
  // (prevents old admin session from blocking cashier login)
  if (authSession && isSystemUser) {
    const portalPath  = isAdminUser ? '/admin' : '/cashier';
    const portalLabel = isAdminUser ? 'Admin portal' : 'Front Desk portal';

    return (
      <section className="page-card auth-shell">
        <p className="auth-eyebrow">Already signed in</p>
        <h1 className="page-title">{authSession.user?.full_name}</h1>
        <p className="auth-copy">
          Signed in as <strong>{authSession.user?.username}</strong>.
          Continue to your portal or sign out to switch accounts.
        </p>
        <div className="button-row" style={{ flexDirection: 'column', gap: '10px' }}>
          <button
            className="auth-primary-button"
            type="button"
            onClick={() => navigate(portalPath)}
          >
            Go to {portalLabel}
          </button>
          <button
            className="auth-secondary-button button-link"
            type="button"
            onClick={() => {
              logout();
              setFlash({ tone: 'success', text: 'Signed out. Please sign in again.' });
            }}
          >
            Sign out and switch account
          </button>
        </div>
      </section>
    );
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit(event) {
    event.preventDefault();
    const result = await login(form);

    if (!result.success) {
      setFlash({ tone: 'error', text: result.error });
      return;
    }

    setFlash({ tone: 'success', text: `Signed in as ${result.user.full_name}.` });

    // System users → portal by role
    if (result.user.user_type === 'SYSTEM_USER') {
      const roles = result.user.roles || [];
      if (roles.includes('ADMIN')) {
        navigate('/admin', { replace: true });
      } else if (roles.includes('CASHIER') || roles.includes('FRONT_DESK')) {
        navigate('/cashier', { replace: true });
      } else {
        navigate('/admin', { replace: true });
      }
      return;
    }

    // Guests → intended page or home
    const nextUrl = location.state?.nextUrl;
    navigate(nextUrl || '/', { replace: true });
  }

  // ── Login form ───────────────────────────────────────────────
  return (
    <section className="page-card auth-shell">
      <p className="auth-eyebrow">Shared login</p>
      <h1 className="page-title">Sign in</h1>
      <p className="auth-copy">
        Use one form for both guest and staff. The app redirects automatically after login.
      </p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Account
          <input
            type="text"
            placeholder="Email, guest code, or staff username"
            value={form.login}
            onChange={(e) => setForm((c) => ({ ...c, login: e.target.value }))}
            autoFocus
          />
        </label>
        <label>
          Password
          <input
            type="password"
            placeholder="Enter password"
            value={form.password}
            onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
          />
        </label>
        <div className="button-row">
          <button className="auth-primary-button" type="submit" disabled={authBusy === 'login'}>
            {authBusy === 'login' ? 'Signing in...' : 'Sign in'}
          </button>
          <Link className="auth-secondary-button button-link" to="/register">
            Create account
          </Link>
        </div>
      </form>
    </section>
  );
}
