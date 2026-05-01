import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/useFlash';
import ToastContainer from '../components/layout/ToastContainer';

const ROLE_INFO = {
  HK_MANAGER: {
    title: 'Housekeeping Management',
    subtitle: 'Housekeeping Manager Portal',
    description:
      'This module is under development. Housekeeping managers will be able to assign cleaning tasks, track room readiness, manage staff schedules, and monitor housekeeping KPIs in real time.',
    icon: '',
    features: [
      'Room cleaning task assignment & tracking',
      'Staff scheduling & workload balancing',
      'Real-time room status dashboard',
      'Quality inspection checklists',
      'Inventory management for cleaning supplies',
    ],
  },
  FRONT_DESK: {
    title: 'Front Desk Operations',
    subtitle: 'Front Desk Agent Portal',
    description:
      'This dedicated front desk module is under development. For now, front desk agents can use the Cashier portal for check-in/check-out operations.',
    icon: '',
    features: [
      'Streamlined check-in & check-out workflow',
      'Guest request management',
      'Room assignment & key card management',
      'Guest messaging & notifications',
      'Daily shift reports',
    ],
  },
  CASHIER: {
    title: 'Cashier Operations',
    subtitle: 'Cashier Portal',
    description:
      'This dedicated cashier module is under development. For now, cashiers can use the Cashier portal for payment operations.',
    icon: '',
    features: [
      'Payment processing & reconciliation',
      'Invoice generation & printing',
      'Refund & deposit management',
      'Daily cash report',
      'Multi-currency support',
    ],
  },
};

export default function ComingSoonPage() {
  const navigate = useNavigate();
  const { authSession, logout } = useAuth();
  const { setFlash } = useFlash();

  const roles = authSession?.user?.roles || [];
  const primaryRole = roles[0] || 'STAFF';
  const info = ROLE_INFO[primaryRole] || {
    title: 'Module Under Development',
    subtitle: 'New Features Coming Soon',
    description: 'This feature is currently being built and will be available in an upcoming release.',
    icon: '',
    features: ['Enhanced user experience', 'Improved performance', 'New tools & integrations'],
  };

  function handleSignOut() {
    logout();
    setFlash({ tone: 'success', text: 'Signed out.' });
    navigate('/');
  }

  function handleGoToCashier() {
    navigate('/cashier');
  }

  function handleGoToAdmin() {
    navigate('/admin');
  }

  const canAccessCashier = roles.some((r) => r === 'CASHIER' || r === 'FRONT_DESK');
  const canAccessAdmin = roles.some((r) => r === 'ADMIN' || r === 'MANAGER');

  return (
    <div className="app-shell">
      <main className="page-stack">
        {/* Top bar */}
        <header className="cashier-topbar">
          <div className="cashier-topbar-identity">
            <span className="cashier-topbar-logo">LuxeReserve</span>
            <span className="cashier-topbar-role">{info.subtitle}</span>
          </div>
          <div className="cashier-topbar-user">
            <span className="cashier-topbar-name">
              {authSession?.user?.full_name || authSession?.user?.username || 'Staff'}
            </span>
            <button type="button" className="ghost-button cashier-signout" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        {/* Coming Soon Content */}
        <div style={{ maxWidth: '720px', margin: '48px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px', lineHeight: 1 }}>
            🚧
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
            {info.title}
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6 }}>
            {info.description}
          </p>

          {/* Features preview */}
          <div
            style={{
              background: 'var(--surface-card)',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '32px',
              textAlign: 'left',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 600,
                marginBottom: '16px',
                color: 'var(--text-primary)',
              }}
            >
              Planned features
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {info.features.map((feature, i) => (
                <li
                  key={i}
                  style={{
                    padding: '8px 0',
                    borderBottom: i < info.features.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '14px',
                  }}
                >
                  <span style={{ color: 'var(--accent)' }}>✦</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Navigation buttons */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {canAccessCashier && (
              <button
                type="button"
                className="primary-button"
                onClick={handleGoToCashier}
                style={{ minWidth: '180px' }}
              >
                Go to Front Desk
              </button>
            )}
            {canAccessAdmin && (
              <button
                type="button"
                className="secondary-button"
                onClick={handleGoToAdmin}
                style={{ minWidth: '180px' }}
              >
                Go to Admin Panel
              </button>
            )}
            <button
              type="button"
              className="ghost-button"
              onClick={() => navigate('/')}
              style={{ minWidth: '180px' }}
            >
              Back to Home
            </button>
          </div>
        </div>

        <ToastContainer />
      </main>
    </div>
  );
}
