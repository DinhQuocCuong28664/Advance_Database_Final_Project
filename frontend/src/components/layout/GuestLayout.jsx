import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SiteHeader from './SiteHeader';
import SiteFooter from './SiteFooter';
import ToastContainer from './ToastContainer';

export default function GuestLayout() {
  const { isSystemUser } = useAuth();

  if (isSystemUser) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page-stack">
        <Outlet />
      </main>
      <SiteFooter />
      <ToastContainer />
    </div>
  );
}
