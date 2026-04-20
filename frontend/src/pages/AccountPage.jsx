import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Account.css';

const ACCOUNT_MENU = [
  'Account overview',
  'Bookings and trips',
  'Loyalty program',
  'Rewards and wallet',
  'Saved preferences',
  'Support',
];

const ACCOUNT_ACTIONS = [
  {
    title: 'Start a new booking',
    description: 'Search destinations and create a new reservation.',
    action: 'Search hotels',
    to: '/search?destination=&checkin=&checkout=&guests=1',
  },
  {
    title: 'Find a reservation',
    description: 'Open reservation lookup and check an existing confirmation.',
    action: 'Open reservation',
    to: '/reservation',
  },
  {
    title: 'Manage profile',
    description: 'Review guest identity, contact details, and linked accounts.',
    action: 'View profile',
    to: '/account',
  },
];

const ACCOUNT_FEATURES = [
  {
    title: 'Bookings and trips',
    description: 'Upcoming stays, past stays, confirmations, and trip details will live here.',
    status: 'Next phase',
  },
  {
    title: 'Rewards and wallet',
    description: 'Credits, vouchers, and member-only perks will be attached here later.',
    status: 'Planned',
  },
  {
    title: 'Saved preferences',
    description: 'Room preferences, contact defaults, and stay preferences will be managed here.',
    status: 'Planned',
  },
  {
    title: 'Support center',
    description: 'Need help with a reservation or account? This will become the guest support entry point.',
    status: 'Planned',
  },
];

export default function AccountPage() {
  const navigate = useNavigate();
  const { authSession, isGuestUser, guestAccounts } = useAuth();

  if (!authSession) {
    return <Navigate to="/login" replace state={{ nextUrl: '/account' }} />;
  }

  if (!isGuestUser) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <main className="page-stack">
      <section className="guest-account-shell">
        <aside className="guest-sidebar">
          <div className="guest-sidebar-profile">
            <div className="guest-avatar">
              {authSession.user.full_name?.slice(0, 1) || 'G'}
            </div>
            <div className="guest-sidebar-copy">
              <p className="page-eyebrow">Guest account</p>
              <h2>{authSession.user.full_name}</h2>
              <span>{authSession.user.email}</span>
            </div>
          </div>

          <nav className="guest-sidebar-menu">
            {ACCOUNT_MENU.map((item) => (
              <button key={item} type="button" className="guest-sidebar-link">
                {item}
              </button>
            ))}
          </nav>

          <div className="guest-sidebar-actions">
            <button className="primary-button" type="button" onClick={() => navigate('/search?destination=&checkin=&checkout=&guests=1')}>
              Search hotels
            </button>
          </div>
        </aside>

        <div className="guest-account-main">
          <section className="guest-account-hero">
            <div className="guest-account-hero-copy">
              <p className="page-eyebrow">Account overview</p>
              <h1 className="page-title">Your travel workspace is taking shape.</h1>
              <p className="page-text">
                This area will become the main guest hub for bookings, rewards, and reservation management.
                For now it shows the identity and loyalty foundation already available from the backend.
              </p>
            </div>
            <div className="guest-account-stats">
              <article className="guest-stat-card">
                <span>Guest code</span>
                <strong>{authSession.user.guest_code || 'Pending sync'}</strong>
              </article>
              <article className="guest-stat-card">
                <span>Loyalty accounts</span>
                <strong>{guestAccounts.length}</strong>
              </article>
              <article className="guest-stat-card">
                <span>Portal status</span>
                <strong>Guest mode</strong>
              </article>
            </div>
          </section>

          <section className="guest-account-grid">
            <section className="page-card guest-account-card">
              <div className="guest-card-head">
                <div>
                  <p className="page-eyebrow">Quick actions</p>
                  <h2>What you can do now</h2>
                </div>
              </div>
              <div className="guest-action-list">
                {ACCOUNT_ACTIONS.map((item) => (
                  <article key={item.title} className="guest-action-card">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                    <button className="ghost-button" type="button" onClick={() => navigate(item.to)}>
                      {item.action}
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <section className="page-card guest-account-card">
              <div className="guest-card-head">
                <div>
                  <p className="page-eyebrow">Profile</p>
                  <h2>Account details</h2>
                </div>
              </div>
              <div className="guest-profile-grid">
                <div>
                  <strong>Full name</strong>
                  <span>{authSession.user.full_name}</span>
                </div>
                <div>
                  <strong>Email</strong>
                  <span>{authSession.user.email}</span>
                </div>
                <div>
                  <strong>Guest code</strong>
                  <span>{authSession.user.guest_code || 'Pending sync'}</span>
                </div>
                <div>
                  <strong>Account type</strong>
                  <span>{authSession.user.user_type}</span>
                </div>
              </div>
            </section>

            <section className="page-card guest-account-card guest-account-card-wide">
              <div className="guest-card-head">
                <div>
                  <p className="page-eyebrow">Loyalty</p>
                  <h2>Member benefits and linked accounts</h2>
                </div>
              </div>
              <div className="guest-loyalty-grid-expanded">
                {guestAccounts.length ? guestAccounts.map((account) => (
                  <article key={account.loyalty_account_id} className="guest-loyalty-card">
                    <strong>{account.chain_name}</strong>
                    <span>{account.tier_code}</span>
                    <p>{Number(account.points_balance || 0).toLocaleString('en-US')} points</p>
                  </article>
                )) : (
                  <article className="guest-loyalty-card">
                    <strong>No linked loyalty account yet</strong>
                    <span>Member offers and tier benefits will appear here when available.</span>
                  </article>
                )}
              </div>
            </section>

            <section className="page-card guest-account-card guest-account-card-wide">
              <div className="guest-card-head">
                <div>
                  <p className="page-eyebrow">Workspace map</p>
                  <h2>Next account modules</h2>
                </div>
              </div>
              <div className="guest-feature-grid">
                {ACCOUNT_FEATURES.map((item) => (
                  <article key={item.title} className="guest-feature-card">
                    <div className="guest-feature-top">
                      <h3>{item.title}</h3>
                      <span className="admin-status-pill">{item.status}</span>
                    </div>
                    <p>{item.description}</p>
                  </article>
                ))}
              </div>
            </section>
          </section>
        </div>
      </section>
    </main>
  );
}
