import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFlash } from '../../context/useFlash';

export default function SiteHeader() {
  const navigate = useNavigate();
  const { authSession, guestAccounts, isSystemUser, isAdminUser, isManagerUser, logout } = useAuth();
  const { setFlash } = useFlash();

  function handleLogout() {
    logout();
    setFlash({ tone: 'success', text: 'Signed out.' });
    navigate('/');
  }

  return (
    <header className="shell-header">
      <div className="shell-brand">
        <NavLink to="/" className="shell-logo">
          LuxeReserve
        </NavLink>
        <span className="shell-brand-note">UI rebuild foundation</span>
      </div>

      <div className="shell-actions">
        {authSession ? (
          <>
            <span className="shell-badge">
              {authSession.user.full_name}
              {guestAccounts.length ? ` - ${guestAccounts.map((account) => account.tier_code).join(', ')}` : ''}
            </span>
            {isSystemUser ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => navigate(isAdminUser || isManagerUser ? '/admin' : '/cashier')}
              >
                {isAdminUser ? 'Admin portal' : isManagerUser ? 'Manager portal' : 'Front Desk portal'}
              </button>
            ) : (
              <>
                <button type="button" className="shell-link" onClick={() => navigate('/reservation')}>
                  My reservation
                </button>
                <button type="button" className="ghost-button" onClick={() => navigate('/account')}>
                  My account
                </button>
              </>
            )}
            <button type="button" className="ghost-button" onClick={handleLogout}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <button type="button" className="shell-link" onClick={() => navigate('/reservation')}>
              My reservation
            </button>
            <button type="button" className="ghost-button" onClick={() => navigate('/login')}>
              Sign in
            </button>
            <button type="button" className="primary-button" onClick={() => navigate('/register')}>
              Register
            </button>
          </>
        )}
      </div>
    </header>
  );
}
