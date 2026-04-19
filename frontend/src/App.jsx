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
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AccountPage from './pages/AccountPage';
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
      </Route>
      <Route path="admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
