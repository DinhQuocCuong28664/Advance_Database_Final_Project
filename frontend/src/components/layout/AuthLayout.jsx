import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ToastContainer from './ToastContainer';

export default function AuthLayout() {
  const { isSystemUser } = useAuth();

  if (isSystemUser) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="auth-page-shell">
      <header className="auth-page-header">
        <Link to="/" className="auth-page-logo">
          LuxeReserve
        </Link>
      </header>

      <main className="auth-page-main">
        <Outlet />
      </main>

      <ToastContainer />
    </div>
  );
}
