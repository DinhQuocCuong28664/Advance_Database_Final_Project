import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import ToastContainer from '../components/layout/ToastContainer';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/FlashContext';
import AdminFrontDesk from './admin/AdminFrontDesk';
import '../styles/Admin.css';

export default function CashierPage() {
  const navigate = useNavigate();
  const { authSession, isSystemUser, isCashierUser, isAdminUser, logout } = useAuth();
  const { setFlash } = useFlash();

  const [hotels, setHotels]               = useState([]);
  const [loadingHotels, setLoadingHotels] = useState(true);

  useEffect(() => {
    if (!isSystemUser) return;
    setLoadingHotels(true);
    apiRequest('/hotels')
      .then(p  => setHotels(p.data || []))
      .catch(e => setFlash({ tone: 'error', text: e.message }))
      .finally(() => setLoadingHotels(false));
  }, [isSystemUser, setFlash]);

  // ── Access guards ────────────────────────────────────────────
  if (!isSystemUser) {
    return <Navigate to="/login" replace state={{ nextUrl: '/cashier' }} />;
  }
  // Admin quản trị riêng → không cần vào cashier portal
  if (!isCashierUser && isAdminUser) {
    return <Navigate to="/admin" replace />;
  }

  function handleSignOut() {
    logout();
    setFlash({ tone: 'success', text: 'Signed out.' });
    navigate('/');
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <main className="page-stack">

        {/* ── Top bar ── */}
        <header className="cashier-topbar">
          <div className="cashier-topbar-identity">
            <span className="cashier-topbar-logo">LuxeReserve</span>
            <span className="cashier-topbar-role">Front Desk</span>
          </div>
          <div className="cashier-topbar-user">
            <span className="cashier-topbar-name">
              {authSession?.user?.full_name || authSession?.user?.username || 'Staff'}
            </span>
            <button
              type="button"
              className="ghost-button cashier-signout"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* ── Front-Desk module only ── */}
        {loadingHotels ? (
          <p style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading hotels…
          </p>
        ) : (
          <div style={{ padding: '20px 24px 48px' }}>
            <AdminFrontDesk hotels={hotels} />
          </div>
        )}

      </main>
    
      <ToastContainer />
    </div>
  );
}
