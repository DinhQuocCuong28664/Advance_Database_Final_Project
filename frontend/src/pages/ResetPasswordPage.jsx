import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/FlashContext';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetGuestPassword, authBusy, authSession, isSystemUser } = useAuth();
  const { setFlash } = useFlash();
  const [form, setForm] = useState({
    login_email: searchParams.get('login_email') || '',
    otp_code: '',
    new_password: '',
    confirm_password: '',
  });

  if (authSession && !isSystemUser) {
    return <Navigate to="/account" replace />;
  }
  if (authSession && isSystemUser) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.new_password !== form.confirm_password) {
      setFlash({ tone: 'error', text: 'Password confirmation does not match.' });
      return;
    }

    const result = await resetGuestPassword({
      login_email: form.login_email,
      otp_code: form.otp_code,
      new_password: form.new_password,
    });

    if (!result.success) {
      setFlash({ tone: 'error', text: result.error });
      return;
    }

    setFlash({ tone: 'success', text: result.message });
    navigate('/login', { replace: true });
  }

  return (
    <section className="page-card auth-shell">
      <p className="auth-eyebrow">Guest password</p>
      <h1 className="page-title">Reset password</h1>
      <p className="auth-copy">
        Enter the reset code we sent to your email, then choose a new password.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Login email
          <input
            type="email"
            value={form.login_email}
            onChange={(event) => setForm((current) => ({ ...current, login_email: event.target.value }))}
            autoFocus
          />
        </label>
        <label>
          Reset code
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={form.otp_code}
            onChange={(event) => setForm((current) => ({ ...current, otp_code: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={form.new_password}
            onChange={(event) => setForm((current) => ({ ...current, new_password: event.target.value }))}
          />
        </label>
        <label>
          Confirm password
          <input
            type="password"
            value={form.confirm_password}
            onChange={(event) => setForm((current) => ({ ...current, confirm_password: event.target.value }))}
          />
        </label>
        <div className="button-row">
          <button className="auth-primary-button" type="submit" disabled={authBusy === 'reset-password'}>
            {authBusy === 'reset-password' ? 'Resetting...' : 'Reset password'}
          </button>
          <Link className="auth-secondary-button button-link" to="/forgot-password">
            Send code again
          </Link>
        </div>
      </form>
    </section>
  );
}
