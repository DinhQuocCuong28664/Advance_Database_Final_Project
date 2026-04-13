import { Routes, Route, Navigate } from 'react-router-dom';
import GuestLayout from './components/layout/GuestLayout';
import DashboardPage from './pages/DashboardPage';
import BookingPage from './pages/BookingPage';
import ReservationPage from './pages/ReservationPage';
import AdminPage from './pages/AdminPage';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route element={<GuestLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="booking" element={<BookingPage />} />
        <Route path="reservation" element={<ReservationPage />} />
      </Route>
      <Route path="admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
