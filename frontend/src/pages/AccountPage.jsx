import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/FlashContext';
import '../styles/Account.css';

// ── Category icon map ────────────────────────────────────────
const CATEGORY_ICONS = {
  SPA: '🧖',
  AIRPORT_TRANSFER: '🚗',
  DINING: '🍽️',
  BUTLER: '🎩',
  YACHT: '⛵',
  TOUR: '🗺️',
  BABYSITTING: '👶',
  EVENT: '🎉',
  WELLNESS: '💆',
  OTHER: '✨',
};

const STATUS_COLORS = {
  REQUESTED: { bg: 'rgba(240,160,30,0.13)',  color: '#7a5500' },
  CONFIRMED: { bg: 'rgba(72,160,120,0.13)',  color: '#1a5c3a' },
  DELIVERED: { bg: 'rgba(45,93,166,0.13)',   color: '#1a3d80' },
  CANCELLED: { bg: 'rgba(200,80,60,0.13)',   color: '#8b2012' },
};

function formatMoney(value, currency = 'VND') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value || 0));
}
function formatDateTime(val) {
  if (!val) return '—';
  return new Date(val).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

const ACCOUNT_MENU = [
  'Overview',
  'Bookings',
  'In-house Services',
  'Loyalty',
  'Profile',
];

const ACCOUNT_ACTIONS = [
  {
    title: 'Search hotels',
    description: 'Find your next destination and create a new reservation.',
    action: 'Search now',
    to: '/search?destination=&checkin=&checkout=&guests=1',
  },
  {
    title: 'Reservation lookup',
    description: 'Find an existing reservation by confirmation code.',
    action: 'Look up',
    to: '/reservation',
  },
];

// ── In-house Services Section ────────────────────────────────
function GuestServices({ guestId }) {
  const { setFlash } = useFlash();

  const [activeReservation, setActiveReservation] = useState(null);
  const [services,     setServices]     = useState([]);
  const [orders,       setOrders]       = useState([]);
  const [orderSummary, setOrderSummary] = useState(null);
  const [hotelCurrency, setHotelCurrency] = useState('USD');
  const [loading,      setLoading]      = useState(true);
  const [ordering,     setOrdering]     = useState(false);

  const [selectedService, setSelectedService] = useState(null);
  const [quantity,        setQuantity]        = useState(1);
  const [instruction,     setInstruction]     = useState('');
  const [scheduledAt,     setScheduledAt]     = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const resvPayload = await apiRequest(`/reservations?guest_id=${guestId}&status=CHECKED_IN&limit=5`);
        const checkedIn   = (resvPayload.data || []).find(r => r.reservation_status === 'CHECKED_IN');
        if (!checkedIn) { setLoading(false); return; }
        setActiveReservation(checkedIn);

        const [svcPayload, ordersPayload] = await Promise.all([
          apiRequest(`/services?hotel_id=${checkedIn.hotel_id}`),
          apiRequest(`/services/orders?reservation_id=${checkedIn.reservation_id}`),
        ]);
        const svcData = svcPayload.data || [];
        setServices(svcData);
        // Use hotel's native currency from service catalog
        if (svcData.length > 0 && svcData[0].currency_code) {
          setHotelCurrency(svcData[0].currency_code);
        }
        setOrders(ordersPayload.data || []);
        setOrderSummary(ordersPayload.summary || null);
      } catch (e) {
        setFlash({ tone: 'error', text: e.message });
      } finally {
        setLoading(false);
      }
    }
    if (guestId) load();
  }, [guestId, setFlash]);

  async function handleOrder(e) {
    e.preventDefault();
    if (!selectedService) return;
    setOrdering(true);
    try {
      await apiRequest('/services/order', {
        method: 'POST',
        body: JSON.stringify({
          reservation_id: activeReservation.reservation_id,
          service_id:     selectedService.service_id,
          quantity:        Number(quantity),
          special_instruction: instruction || null,
          scheduled_at:   scheduledAt || null,
        }),
      });
      setFlash({ tone: 'success', text: `Request sent: ${selectedService.service_name}` });
      setSelectedService(null);
      setQuantity(1);
      setInstruction('');
      setScheduledAt('');
      const ordersPayload = await apiRequest(`/services/orders?reservation_id=${activeReservation.reservation_id}`);
      setOrders(ordersPayload.data || []);
      setOrderSummary(ordersPayload.summary || null);
    } catch (e) {
      setFlash({ tone: 'error', text: e.message });
    } finally {
      setOrdering(false);
    }
  }

  if (loading) return <p className="guest-svc-empty">Loading stay information…</p>;

  if (!activeReservation) {
    return (
      <div className="guest-svc-empty-box">
        <span>🏨</span>
        <p>You are not currently checked in.</p>
        <small>In-house services are only available during an active stay.</small>
      </div>
    );
  }

  const grouped = services.reduce((acc, svc) => {
    if (!acc[svc.service_category]) acc[svc.service_category] = [];
    acc[svc.service_category].push(svc);
    return acc;
  }, {});

  return (
    <div className="guest-svc-shell">

      {/* Stay banner */}
      <div className="guest-svc-stay-banner">
        <div>
          <p className="page-eyebrow">Current stay</p>
          <h3>{activeReservation.hotel_name}</h3>
          <p>Room {activeReservation.room_number || '—'} · {activeReservation.reservation_code}</p>
        </div>
        {orderSummary && (
          <div className="guest-svc-stay-stats">
            <div><span>Active requests</span><strong>{orderSummary.active_orders}</strong></div>
            <div><span>Total charges</span><strong>{formatMoney(orderSummary.active_amount, hotelCurrency)}</strong></div>
          </div>
        )}
      </div>

      {/* Service catalog */}
      {services.length === 0 ? (
        <p className="guest-svc-empty">No services available for this property.</p>
      ) : (
        <div className="guest-svc-catalog">
          <h3 className="guest-svc-section-title">Available Services</h3>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="guest-svc-category">
              <p className="guest-svc-category-label">
                {CATEGORY_ICONS[category] || '✨'} {category.replace(/_/g, ' ')}
              </p>
              <div className="guest-svc-grid">
                {items.map(svc => (
                  <button
                    key={svc.service_id}
                    type="button"
                    className={`guest-svc-card${selectedService?.service_id === svc.service_id ? ' guest-svc-card--selected' : ''}`}
                    onClick={() => { setSelectedService(svc); setQuantity(1); setInstruction(''); }}
                  >
                    <span className="guest-svc-name">{svc.service_name}</span>
                    <span className="guest-svc-price">
                      {formatMoney(svc.base_price, svc.currency_code || 'USD')}
                      <small> / {svc.pricing_model.replace(/_/g, ' ').toLowerCase()}</small>
                    </span>
                    {svc.description_short && (
                      <span className="guest-svc-desc">{svc.description_short}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order form */}
      {selectedService && (
        <form className="guest-svc-order-form" onSubmit={handleOrder}>
          <div className="guest-svc-order-header">
            <div>
              <p className="page-eyebrow">Request service</p>
              <h3>{selectedService.service_name}</h3>
              <p>{formatMoney(selectedService.base_price, selectedService.currency_code || hotelCurrency)} per use</p>
            </div>
            <button type="button" className="ghost-button" onClick={() => setSelectedService(null)}>
              Cancel
            </button>
          </div>
          <div className="guest-svc-order-fields">
            <label>
              Quantity
              <input type="number" min="1" max="20" value={quantity}
                onChange={e => setQuantity(e.target.value)} />
            </label>
            <label>
              Preferred time
              <input type="datetime-local" value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)} />
            </label>
            <label className="guest-svc-wide">
              Special instructions
              <input type="text" placeholder="e.g. allergies, preferences, time constraints…"
                value={instruction} onChange={e => setInstruction(e.target.value)} />
            </label>
          </div>
          <div className="guest-svc-order-footer">
            <span>Estimated total: <strong>{formatMoney(selectedService.base_price * quantity, selectedService.currency_code || hotelCurrency)}</strong></span>
            <button type="submit" className="primary-button" disabled={ordering}>
              {ordering ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </form>
      )}

      {/* Order history */}
      {orders.length > 0 && (
        <div className="guest-svc-orders">
          <h3 className="guest-svc-section-title">Your Requests</h3>
          <div className="guest-svc-order-list">
            {orders.map(o => {
              const style = STATUS_COLORS[o.service_status] || {};
              return (
                <div key={o.reservation_service_id} className="guest-svc-order-row">
                  <div className="guest-svc-order-info">
                    <strong>{o.service_name}</strong>
                    <span>{o.service_category.replace(/_/g, ' ')} · Qty: {o.quantity}</span>
                    {o.special_instruction && <span>📝 {o.special_instruction}</span>}
                    {o.scheduled_at && <span>🕐 {formatDateTime(o.scheduled_at)}</span>}
                  </div>
                  <div className="guest-svc-order-right">
                    <strong>{formatMoney(o.final_amount, hotelCurrency)}</strong>
                    <span className="guest-svc-status-pill"
                      style={{ background: style.bg, color: style.color }}>
                      {o.service_status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Main AccountPage ─────────────────────────────────────────
export default function AccountPage() {
  const navigate = useNavigate();
  const { authSession, isGuestUser, guestAccounts } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');

  if (!authSession) {
    return <Navigate to="/login" replace state={{ nextUrl: '/account' }} />;
  }
  if (!isGuestUser) {
    return <Navigate to="/admin" replace />;
  }

  const guestId = authSession.user?.guest_id;

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
              <button key={item} type="button"
                className={`guest-sidebar-link${activeTab === item ? ' active' : ''}`}
                onClick={() => setActiveTab(item)}>
                {item}
              </button>
            ))}
          </nav>

          <div className="guest-sidebar-actions">
            <button className="primary-button" type="button"
              onClick={() => navigate('/search?destination=&checkin=&checkout=&guests=1')}>
              Search hotels
            </button>
          </div>
        </aside>

        <div className="guest-account-main">

          {/* ── TAB: Overview ── */}
          {activeTab === 'Overview' && (
            <>
              <section className="guest-account-hero">
                <div className="guest-account-hero-copy">
                  <p className="page-eyebrow">Welcome back</p>
                  <h1 className="page-title">{authSession.user.full_name}</h1>
                  <p className="page-text">
                    Manage your reservations, request in-stay services, and view your loyalty account from here.
                  </p>
                </div>
                <div className="guest-account-stats">
                  <article className="guest-stat-card">
                    <span>Guest code</span>
                    <strong>{authSession.user.guest_code || '—'}</strong>
                  </article>
                  <article className="guest-stat-card">
                    <span>Loyalty tier</span>
                    <strong>{guestAccounts.length ? guestAccounts[0].tier_code : 'None'}</strong>
                  </article>
                  <article className="guest-stat-card">
                    <span>Account type</span>
                    <strong>Guest</strong>
                  </article>
                </div>
              </section>

              <section className="guest-account-grid">
                <section className="page-card guest-account-card">
                  <div className="guest-card-head">
                    <div>
                      <p className="page-eyebrow">Quick actions</p>
                      <h2>What you can do</h2>
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
                    <article className="guest-action-card">
                      <div>
                        <strong>In-house services</strong>
                        <p>Order hotel services during your current stay.</p>
                      </div>
                      <button className="ghost-button" type="button"
                        onClick={() => setActiveTab('In-house Services')}>
                        View services
                      </button>
                    </article>
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
                    <div><strong>Full name</strong><span>{authSession.user.full_name}</span></div>
                    <div><strong>Email</strong><span>{authSession.user.email}</span></div>
                    <div><strong>Guest code</strong><span>{authSession.user.guest_code || '—'}</span></div>
                    <div><strong>Account type</strong><span>{authSession.user.user_type}</span></div>
                  </div>
                </section>
              </section>
            </>
          )}

          {/* ── TAB: In-house Services ── */}
          {activeTab === 'In-house Services' && (
            <section className="page-card">
              <div className="guest-card-head" style={{ marginBottom: 20 }}>
                <div>
                  <p className="page-eyebrow">In-house services</p>
                  <h2>Services during your stay</h2>
                  <p className="page-text" style={{ marginTop: 6 }}>
                    Only services available at your current hotel are shown. Requests go directly to hotel staff.
                  </p>
                </div>
              </div>
              <GuestServices guestId={guestId} />
            </section>
          )}

          {/* ── TAB: Loyalty ── */}
          {activeTab === 'Loyalty' && (
            <section className="page-card">
              <div className="guest-card-head" style={{ marginBottom: 20 }}>
                <div>
                  <p className="page-eyebrow">Loyalty</p>
                  <h2>Member benefits & points</h2>
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
                    <strong>No loyalty account linked</strong>
                    <span>Member offers and tier benefits will appear here when available.</span>
                  </article>
                )}
              </div>
            </section>
          )}

          {/* ── TAB: Profile ── */}
          {activeTab === 'Profile' && (
            <section className="page-card">
              <div className="guest-card-head" style={{ marginBottom: 20 }}>
                <div>
                  <p className="page-eyebrow">Profile</p>
                  <h2>Personal information</h2>
                </div>
              </div>
              <div className="guest-profile-grid">
                <div><strong>Full name</strong><span>{authSession.user.full_name}</span></div>
                <div><strong>Email</strong><span>{authSession.user.email}</span></div>
                <div><strong>Guest code</strong><span>{authSession.user.guest_code || '—'}</span></div>
                <div><strong>Account type</strong><span>{authSession.user.user_type}</span></div>
              </div>
            </section>
          )}

          {/* ── TAB: Bookings ── */}
          {activeTab === 'Bookings' && (
            <section className="page-card">
              <div className="guest-card-head" style={{ marginBottom: 20 }}>
                <div>
                  <p className="page-eyebrow">Bookings</p>
                  <h2>Your reservations</h2>
                  <p className="page-text" style={{ marginTop: 6 }}>
                    Use the reservation lookup page to view and manage your bookings.
                  </p>
                </div>
              </div>
              <button className="primary-button" onClick={() => navigate('/reservation')}>
                Go to reservation lookup
              </button>
            </section>
          )}

        </div>
      </section>
    </main>
  );
}
