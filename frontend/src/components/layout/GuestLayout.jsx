import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFlash } from '../../context/FlashContext';
import { useAppData } from '../../context/AppDataContext';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';

export default function GuestLayout() {
  const { isSystemUser } = useAuth();
  const { flash } = useFlash();
  const { bootError } = useAppData();

  // Redirect system users to admin portal
  if (isSystemUser) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <SiteHeader />

      {flash ? <div className={`message-strip ${flash.tone}`}>{flash.text}</div> : null}
      {bootError ? <div className="message-strip error">{bootError}</div> : null}

      <main className="content-grid">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  );
}
