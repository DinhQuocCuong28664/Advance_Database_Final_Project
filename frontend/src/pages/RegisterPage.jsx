import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/useFlash';

const countryCodes = [
  { code: '+1', flag: '', iso: 'us' },
  { code: '+44', flag: '', iso: 'gb' },
  { code: '+60', flag: '', iso: 'my' },
  { code: '+61', flag: '', iso: 'au' },
  { code: '+62', flag: '', iso: 'id' },
  { code: '+63', flag: '', iso: 'ph' },
  { code: '+65', flag: '', iso: 'sg' },
  { code: '+66', flag: '', iso: 'th' },
  { code: '+81', flag: '', iso: 'jp' },
  { code: '+82', flag: '', iso: 'kr' },
  { code: '+84', flag: '', iso: 'vn' },
  { code: '+86', flag: '', iso: 'cn' },
];

function CountrySelect({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = countryCodes.find((c) => c.code === value) || countryCodes[0];

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0.95rem 1rem',
          border: '1px solid rgba(15, 34, 38, 0.12)',
          borderRadius: '16px',
          background: 'rgba(255, 252, 248, 0.96)',
          cursor: 'pointer',
          width: '100%',
          boxSizing: 'border-box',
          minHeight: '46px',
        }}
      >
        <img
          src={`https://flagcdn.com/w20/${selected.iso}.png`}
          srcSet={`https://flagcdn.com/w40/${selected.iso}.png 2x`}
          width="20"
          alt={selected.iso.toUpperCase()}
          style={{ display: 'block', borderRadius: '2px' }}
        />
        <span style={{ color: 'var(--text-strong)' }}>{selected.code}</span>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'rgba(255, 252, 248, 0.96)',
            border: '1px solid rgba(15, 34, 38, 0.12)',
            borderRadius: '16px',
            zIndex: 10,
            maxHeight: '220px',
            overflowY: 'auto',
            marginTop: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            padding: '8px 0',
          }}
        >
          {countryCodes.map((c) => (
            <div
              key={c.code}
              onClick={() => {
                onChange(c.code);
                setIsOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                cursor: 'pointer',
                background: value === c.code ? 'rgba(20, 61, 66, 0.08)' : 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(20, 61, 66, 0.04)')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = value === c.code ? 'rgba(20, 61, 66, 0.08)' : 'transparent')
              }
            >
              <img
                src={`https://flagcdn.com/w20/${c.iso}.png`}
                srcSet={`https://flagcdn.com/w40/${c.iso}.png 2x`}
                width="20"
                alt={c.iso.toUpperCase()}
                style={{ display: 'block', borderRadius: '2px' }}
              />
              <span style={{ color: 'var(--text-strong)' }}>{c.code}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const {
    registerGuest,
    verifyGuestEmail,
    resendGuestVerification,
    authBusy,
    authSession,
    isSystemUser,
  } = useAuth();
  const { setFlash } = useFlash();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    login_email: '',
    password: '',
    phone_country_code: '+84',
    phone_number: '',
  });
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');

  if (authSession && !isSystemUser) {
    return <Navigate to="/account" replace />;
  }

  if (authSession && isSystemUser) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const result = await registerGuest(form);
    if (!result.success) {
      setFlash({ tone: 'error', text: result.error });
      return;
    }

    setPendingVerificationEmail(result.login_email);
    setFlash({
      tone: 'success',
      text: result.message || `Account created for ${form.first_name}. Enter the OTP sent to your email.`,
    });
  }

  async function handleVerify(event) {
    event.preventDefault();
    const result = await verifyGuestEmail({
      login_email: pendingVerificationEmail,
      otp_code: otpCode,
    });

    if (!result.success) {
      setFlash({ tone: 'error', text: result.error });
      return;
    }

    setFlash({ tone: 'success', text: `Email verified successfully for ${result.user.full_name}.` });
    navigate('/account', { replace: true });
  }

  async function handleResend() {
    const result = await resendGuestVerification({ login_email: pendingVerificationEmail });
    if (!result.success) {
      setFlash({ tone: 'error', text: result.error });
      return;
    }

    setFlash({ tone: 'success', text: result.message || 'A new verification code has been sent.' });
  }

  return (
    <section className="page-card auth-shell">
      {!pendingVerificationEmail ? (
        <>
          <p className="auth-eyebrow">Guest account</p>
          <h1 className="page-title">Register</h1>
          <p className="auth-copy">
            Create your account first. We will send a one-time verification code to activate it by email.
          </p>
          <form className="auth-form auth-grid" onSubmit={handleSubmit}>
            <label>
              First name
              <input
                type="text"
                value={form.first_name}
                onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))}
                autoFocus
              />
            </label>
            <label>
              Last name
              <input
                type="text"
                value={form.last_name}
                onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))}
              />
            </label>
            <label className="field-span-2">
              Login email
              <input
                type="email"
                value={form.login_email}
                onChange={(event) => setForm((current) => ({ ...current, login_email: event.target.value }))}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              />
            </label>
            <label>
              Country code
              <CountrySelect
                value={form.phone_country_code}
                onChange={(code) => setForm((current) => ({ ...current, phone_country_code: code }))}
              />
            </label>
            <label className="field-span-2">
              Phone number
              <input
                type="text"
                value={form.phone_number}
                onChange={(event) => setForm((current) => ({ ...current, phone_number: event.target.value }))}
              />
            </label>
            <div className="button-row field-span-2">
              <button className="auth-primary-button" type="submit" disabled={authBusy === 'register'}>
                {authBusy === 'register' ? 'Creating account...' : 'Create account'}
              </button>
              <Link className="auth-secondary-button button-link" to="/login">
                Already have an account?
              </Link>
            </div>
          </form>
        </>
      ) : (
        <>
          <p className="auth-eyebrow">Email verification</p>
          <h1 className="page-title">Enter your OTP code</h1>
          <p className="auth-copy">
            We sent a 6-digit code to <strong>{pendingVerificationEmail}</strong>. Enter it below to activate your account.
          </p>
          <form className="auth-form" onSubmit={handleVerify}>
            <label>
              Verification code
              <input
                type="text"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                placeholder="6-digit code"
                maxLength={6}
                autoFocus
              />
            </label>
            <div className="button-row">
              <button className="auth-primary-button" type="submit" disabled={authBusy === 'verify-email'}>
                {authBusy === 'verify-email' ? 'Verifying...' : 'Verify and activate'}
              </button>
              <button
                className="auth-secondary-button"
                type="button"
                onClick={handleResend}
                disabled={authBusy === 'resend-email'}
              >
                {authBusy === 'resend-email' ? 'Sending...' : 'Resend code'}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
