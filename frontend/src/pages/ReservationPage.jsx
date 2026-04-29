import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Account.css';
import { apiRequest } from '../lib/api';

const STATUS_META = {
  CONFIRMED:    { label: 'Confirmed',    color: 'var(--status-confirmed)',   bg: 'var(--status-confirmed-bg)'  },
  CHECKED_IN:   { label: 'Checked in',  color: 'var(--status-checkedin)',   bg: 'var(--status-checkedin-bg)' },
  CHECKED_OUT:  { label: 'Checked out', color: 'var(--status-checkedout)',  bg: 'var(--status-checkedout-bg)'},
  CANCELLED:    { label: 'Cancelled',   color: 'var(--status-cancelled)',   bg: 'var(--status-cancelled-bg)' },
  NO_SHOW:      { label: 'No-show',     color: 'var(--status-noshow)',      bg: 'var(--status-noshow-bg)'    },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: 'var(--text-soft)', bg: 'var(--bg-deep)' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: '999px',
      fontSize: '0.8rem',
      fontWeight: 600,
      color: m.color,
      background: m.bg,
      letterSpacing: '0.04em',
    }}>
      {m.label}
    </span>
  );
}

function ReservationCard({ r, onCancel }) {
  const nights = r.nights || 1;
  // backend view uses 'grand_total'; table uses 'grand_total_amount'  handle both
  const rawTotal = r.grand_total_amount ?? r.grand_total ?? 0;
  const total = Number(rawTotal).toLocaleString('en-US');
  const checkin = new Date(r.checkin_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const checkout = new Date(r.checkout_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const canCancel = r.reservation_status === 'CONFIRMED';

  return (
    <article className="resv-card">
      <div className="resv-card-top">
        <div>
          <p className="resv-card-code">{r.reservation_code}</p>
          <h3 className="resv-card-hotel">{r.hotel_name}</h3>
          {r.room_type_name && (
            <p className="resv-card-room">
              {r.room_type_name}{r.room_number ? `  Room ${r.room_number}` : ''}
            </p>
          )}
        </div>
        <StatusBadge status={r.reservation_status} />
      </div>

      <div className="resv-card-dates">
        <div className="resv-date-block">
          <span>CHECK-IN</span>
          <strong>{checkin}</strong>
        </div>
        <div className="resv-date-sep">{nights} night{nights > 1 ? 's' : ''}</div>
        <div className="resv-date-block">
          <span>CHECK-OUT</span>
          <strong>{checkout}</strong>
        </div>
        <div className="resv-date-block">
          <span>TOTAL</span>
          <strong>{total} {r.currency_code || 'VND'}</strong>
        </div>
      </div>

      {canCancel && (
        <div className="resv-card-actions">
          <button
            className="ghost-button"
            type="button"
            style={{ color: 'var(--status-cancelled)', borderColor: 'var(--status-cancelled-bg)' }}
            onClick={() => onCancel(r)}
          >
            Cancel reservation
          </button>
        </div>
      )}
    </article>
  );
}

export default function ReservationPage() {
  const navigate = useNavigate();
  const { authSession, isGuestUser } = useAuth();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Lookup by code (for guests not logged in)
  const [lookupCode, setLookupCode] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  // Auto-load reservations if logged in
  useEffect(() => {
    if (!authSession || !isGuestUser) return;
    const guestCode = authSession.user?.guest_code;
    if (!guestCode) return;

    setLoading(true);
    apiRequest(`/reservations/by-guest/${guestCode}`)
      .then((r) => setReservations(r.data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authSession, isGuestUser]);

  async function handleLookup(e) {
    e.preventDefault();
    if (!lookupCode.trim()) return;
    setLookupBusy(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const r = await apiRequest(`/reservations/${lookupCode.trim().toUpperCase()}`);
      setLookupResult(r.data || r);
    } catch {
      setLookupError('Reservation not found. Check your code and try again.');
    } finally {
      setLookupBusy(false);
    }
  }

  async function handleCancel(reservation) {
    if (!window.confirm(`Cancel reservation ${reservation.reservation_code}? This cannot be undone.`)) return;
    try {
      await apiRequest(`/reservations/${reservation.reservation_id}/guest-cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Guest self-cancelled via portal' }),
      });
      // Refresh list
      setReservations((prev) =>
        prev.map((r) =>
          r.reservation_id === reservation.reservation_id
            ? { ...r, reservation_status: 'CANCELLED' }
            : r
        )
      );
    } catch (err) {
      alert('Cancellation failed: ' + err.message);
    }
  }

  const loggedIn = authSession && isGuestUser;

  return (
    <div className="resv-page">
      {/*  Header  */}
      <div className="resv-header">
        <div>
          <p className="page-eyebrow">LuxeReserve</p>
          <h1 className="resv-title">Your reservations</h1>
          <p style={{ color: 'var(--text-soft)', marginTop: 6 }}>
            {loggedIn
              ? 'All bookings linked to your account appear below.'
              : 'Sign in to see your bookings, or look up a reservation by code.'}
          </p>
        </div>
      </div>

      {/*  Lookup box (always visible)  */}
      <section className="page-card resv-lookup-card">
        <p className="page-eyebrow">Lookup</p>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Find by reservation code</h2>
        <form className="resv-lookup-form" onSubmit={handleLookup}>
          <input
            className="resv-lookup-input"
            placeholder="e.g. RES-20260418-2KU7Q9"
            value={lookupCode}
            onChange={(e) => setLookupCode(e.target.value)}
            required
          />
          <button className="primary-button" type="submit" disabled={lookupBusy}>
            {lookupBusy ? 'Searching...' : 'Look up'}
          </button>
        </form>
        {lookupError && <p style={{ color: 'var(--error)', marginTop: 8 }}>{lookupError}</p>}
        {lookupResult && (
          <div className="resv-lookup-result">
            {/* No cancel button for anonymous lookup  must be logged in */}
            <ReservationCard r={lookupResult} onCancel={null} />
            {!loggedIn && lookupResult.reservation_status === 'CONFIRMED' && (
              <p style={{ marginTop: 8, fontSize: '0.88rem', color: 'var(--text-soft)' }}>
                Want to cancel this reservation?{' '}
                <button
                  type="button"
                  className="shell-link"
                  style={{ fontWeight: 600 }}
                  onClick={() => navigate('/login')}
                >
                  Sign in
                </button>{' '}to manage your booking.
              </p>
            )}
          </div>
        )}
      </section>

      {/*  My Bookings (logged-in only)  */}
      {loggedIn && (
        <section className="resv-list-section">
          <h2 className="resv-section-title">My bookings</h2>
          {loading && <p style={{ color: 'var(--text-soft)' }}>Loading your reservations...</p>}
          {error && <p style={{ color: 'var(--error)' }}>{error}</p>}
          {!loading && !error && reservations.length === 0 && (
            <div className="resv-empty">
              <p>No reservations found on your account yet.</p>
              <button className="primary-button" type="button" onClick={() => navigate('/search?destination=&checkin=&checkout=&guests=1')}>
                Browse hotels
              </button>
            </div>
          )}
          <div className="resv-list">
            {reservations.map((r) => (
              <ReservationCard
                key={r.reservation_id}
                r={r}
                onCancel={handleCancel}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
