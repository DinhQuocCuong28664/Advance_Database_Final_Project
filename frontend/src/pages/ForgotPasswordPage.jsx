import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/FlashContext';

export default function ForgotPasswordPage() {
  const { forgotGuestPassword, authBusy, authSession, isSystemUser } = useAuth();
  const { setFlash } = useFlash();
  const [loginEmail, setLoginEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');

  if (authSession && !isSystemUser) {
    return <Navigate to="/account" replace />;
  }
  if (authSession && isSystemUser) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const result = await forgotGuestPassword({ login_email: loginEmail });
    if (!result.success) {
      setFlash({ tone: 'error', text: result.error });
      return;
    }

    setSubmittedEmail(loginEmail);
    setFlash({ tone: 'success', text: result.message });
  }

  return (
    <section className="page-card auth-shell">
      <p className="auth-eyebrow">Guest password</p>
      <h1 className="page-title">Forgot password</h1>
      <p className="auth-copy">
        Enter your guest login email. If the account exists, we will send a one-time reset code.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Login email
          <input
            type="email"
            value={loginEmail}
            onChange={(event) => setLoginEmail(event.target.value)}
            autoFocus
          />
        </label>
        <div className="button-row">
          <button className="auth-primary-button" type="submit" disabled={authBusy === 'forgot-password'}>
            {authBusy === 'forgot-password' ? 'Sending...' : 'Send reset code'}
          </button>
          <Link className="auth-secondary-button button-link" to="/login">
            Back to sign in
          </Link>
        </div>
      </form>

      {submittedEmail ? (
        <p className="auth-copy" style={{ marginTop: 12 }}>
          Continue at <Link to={`/reset-password?login_email=${encodeURIComponent(submittedEmail)}`}>reset password</Link>.
        </p>
      ) : null}
    </section>
  );
}
