import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/FlashContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authBusy, authSession, isSystemUser } = useAuth();
  const { setFlash } = useFlash();
  const [form, setForm] = useState({ login: '', password: '' });

  if (authSession && !isSystemUser) {
    return <Navigate to="/" replace />;
  }

  if (authSession && isSystemUser) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const result = await login(form);
    if (!result.success) {
      setFlash({ tone: 'error', text: result.error });
      return;
    }

    setFlash({ tone: 'success', text: `Signed in successfully as ${result.user.full_name}.` });

    if (result.user.user_type === 'SYSTEM_USER') {
      navigate('/admin', { replace: true });
      return;
    }

    const nextUrl = location.state?.nextUrl;
    navigate(nextUrl || '/', { replace: true });
  }

  return (
    <section className="page-card auth-shell">
      <p className="auth-eyebrow">Shared login</p>
      <h1 className="page-title">Sign in</h1>
      <p className="auth-copy">
        Use one form for both guest and admin. The app will redirect automatically after login.
      </p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Account
          <input
            type="text"
            placeholder="Email, guest code, or admin username"
            value={form.login}
            onChange={(event) => setForm((current) => ({ ...current, login: event.target.value }))}
            autoFocus
          />
        </label>
        <label>
          Password
          <input
            type="password"
            placeholder="Enter password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
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
