import { Routes, Route, Navigate } from 'react-router-dom';
import GuestLayout from './components/layout/GuestLayout';
import AuthLayout from './components/layout/AuthLayout';
import DashboardPage from './pages/DashboardPage';
import SearchPage from './pages/SearchPage';
import HotelPage from './pages/HotelPage';
import BookingPage from './pages/BookingPage';
import ReservationPage from './pages/ReservationPage';
import VnpayReturnPage from './pages/VnpayReturnPage';
import AdminPage from './pages/AdminPage';
import CashierPage from './pages/CashierPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AccountPage from './pages/AccountPage';
import ComingSoonPage from './pages/ComingSoonPage';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route element={<GuestLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="hotel/:id" element={<HotelPage />} />
        <Route path="booking/:hotelId/:roomId" element={<BookingPage />} />
        <Route path="booking" element={<BookingPage />} />
        <Route path="booking/vnpay-return" element={<VnpayReturnPage />} />
        <Route path="account" element={<AccountPage />} />
        <Route path="reservation" element={<ReservationPage />} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route path="admin" element={<AdminPage />} />
      <Route path="cashier" element={<CashierPage />} />
      <Route path="coming-soon" element={<ComingSoonPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
