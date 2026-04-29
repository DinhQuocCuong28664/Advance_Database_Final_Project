import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/useFlash';
import '../styles/Account.css';

//  Category icon map 
const CATEGORY_ICONS = {
  SPA: 'đŸ’†',
  AIRPORT_TRANSFER: 'âœˆï¸',
  DINING: 'đŸ½ï¸',
  BUTLER: 'đŸ›ï¸',
  YACHT: 'đŸ›¥ï¸',
  TOUR: 'đŸ§­',
  BABYSITTING: 'đŸ‘¶',
  EVENT: 'đŸ‰',
  WELLNESS: 'đŸ§˜',
  OTHER: 'âœ¨',
};

//  Issue categories guests can report 
const ISSUE_CATEGORIES = [
  { key: 'PLUMBING',   label: 'Plumbing',           icon: 'đŸ¿', example: 'Tap/pipe/shower issue' },
  { key: 'ELECTRICAL', label: 'Electrical',         icon: 'đŸ’¡', example: 'Light, socket, or power' },
  { key: 'HVAC',       label: 'Air conditioning',   icon: 'â„ï¸', example: 'AC not cooling / too cold' },
  { key: 'APPLIANCE',  label: 'Appliance',          icon: 'đŸ“º', example: 'TV, fridge, kettle' },
  { key: 'FURNITURE',  label: 'Furniture / fixtures', icon: 'đŸª‘', example: 'Bed, chair, wardrobe' },
  { key: 'CLEANING',   label: 'Housekeeping',       icon: 'đŸ§¹', example: 'Extra towels, cleaning' },
  { key: 'OTHER',      label: 'Other',              icon: 'â ï¸', example: 'Anything else' },
];

const EMPTY_ISSUE = { issue_category: 'PLUMBING', issue_description: '' };

Object.assign(CATEGORY_ICONS, {
  SPA: 'đŸ’†',
  AIRPORT_TRANSFER: 'âœˆï¸',
  DINING: 'đŸ½ï¸',
  BUTLER: 'đŸ›ï¸',
  YACHT: 'đŸ›¥ï¸',
  TOUR: 'đŸ§­',
  BABYSITTING: 'đŸ‘¶',
  EVENT: 'đŸ‰',
  WELLNESS: 'đŸ§˜',
  OTHER: 'âœ¨',
});

Object.assign(ISSUE_CATEGORIES.find((item) => item.key === 'PLUMBING'), { icon: 'đŸ¿' });
Object.assign(ISSUE_CATEGORIES.find((item) => item.key === 'ELECTRICAL'), { icon: 'đŸ’¡' });
Object.assign(ISSUE_CATEGORIES.find((item) => item.key === 'HVAC'), { icon: 'â„ï¸' });
Object.assign(ISSUE_CATEGORIES.find((item) => item.key === 'APPLIANCE'), { icon: 'đŸ“º' });
Object.assign(ISSUE_CATEGORIES.find((item) => item.key === 'FURNITURE'), { icon: 'đŸª‘' });
Object.assign(ISSUE_CATEGORIES.find((item) => item.key === 'CLEANING'), { icon: 'đŸ§¹' });
Object.assign(ISSUE_CATEGORIES.find((item) => item.key === 'OTHER'), { icon: 'â ï¸' });

function normalizeIssueTicket(ticket) {
  const category = ISSUE_CATEGORIES.find((item) => item.key === ticket.issue_category);
  return {
    id: ticket.maintenance_ticket_id,
    category: category?.label || String(ticket.issue_category || '').replace(/_/g, ' '),
    icon: category?.icon || 'â ï¸',
    desc: ticket.issue_description,
    status: ticket.status,
    at: ticket.reported_at
      ? new Date(ticket.reported_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '',
  };
}

const STATUS_COLORS = {
  REQUESTED: { bg: 'var(--svc-requested-bg)',  color: 'var(--svc-requested)' },
  CONFIRMED: { bg: 'var(--svc-confirmed-bg)',  color: 'var(--svc-confirmed)' },
  DELIVERED: { bg: 'var(--svc-delivered-bg)',   color: 'var(--svc-delivered)' },
  CANCELLED: { bg: 'var(--svc-cancelled-bg)',   color: 'var(--svc-cancelled)' },
};

function formatMoney(value, currency = 'VND') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value || 0));
}
function formatDateTime(val) {
  if (!val) return '';
  return new Date(val).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}
function formatDateOnly(val) {
  if (!val) return '';
  return new Date(val).toLocaleDateString('en-GB', { dateStyle: 'medium' });
}
function formatRewardValue(reward) {
  const promoType = String(reward?.promotion_type || '').toUpperCase();
  if (['PERCENT_OFF', 'PERCENTAGE'].includes(promoType)) {
    return `${Number(reward.discount_value || 0)}% off`;
  }
  return formatMoney(reward?.discount_value || 0, reward?.currency_code || 'USD');
}

function normalizeReviewText(value) {
  return String(value || '').trim();
}

const ACCOUNT_MENU = [
  'Overview',
  'Bookings & Reviews',
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

//  In-house Services Section 
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

  // Report Issue state
  const [showIssueForm,  setShowIssueForm]  = useState(false);
  const [issueForm,      setIssueForm]      = useState(EMPTY_ISSUE);
  const [issueBusy,      setIssueBusy]      = useState(false);
  const [reportedIssues, setReportedIssues] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const resvPayload = await apiRequest(`/reservations?guest_id=${guestId}&status=CHECKED_IN&limit=5`);
        const checkedIn   = (resvPayload.data || []).find(r => r.reservation_status === 'CHECKED_IN');
        if (!checkedIn) { setLoading(false); return; }
        setActiveReservation(checkedIn);

        const [svcPayload, ordersPayload, issuesPayload] = await Promise.all([
          apiRequest(`/services?hotel_id=${checkedIn.hotel_id}`),
          apiRequest(`/services/orders?reservation_id=${checkedIn.reservation_id}`),
          checkedIn.room_id
            ? apiRequest(`/maintenance?hotel_id=${checkedIn.hotel_id}&room_id=${checkedIn.room_id}`)
            : Promise.resolve({ data: [] }),
        ]);
        const svcData = svcPayload.data || [];
        setServices(svcData);
        // Use hotel's native currency from service catalog
        if (svcData.length > 0 && svcData[0].currency_code) {
          setHotelCurrency(svcData[0].currency_code);
        }
        setOrders(ordersPayload.data || []);
        setOrderSummary(ordersPayload.summary || null);
        setReportedIssues((issuesPayload.data || []).map(normalizeIssueTicket));
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

  async function handleReportIssue(e) {
    e.preventDefault();
    if (!issueForm.issue_description.trim()) {
      setFlash({ tone: 'error', text: 'Please describe the issue.' }); return;
    }
    setIssueBusy(true);
    try {
      const payload = await apiRequest('/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          hotel_id:          activeReservation.hotel_id,
          room_id:           activeReservation.room_id || null,
          issue_category:    issueForm.issue_category,
          issue_description: issueForm.issue_description,
          severity_level:    'MEDIUM',
        }),
      });
      setReportedIssues(prev => [normalizeIssueTicket(payload.data || {
        issue_category: issueForm.issue_category,
        issue_description: issueForm.issue_description,
        status: 'OPEN',
        reported_at: new Date().toISOString(),
      }), ...prev]);
      setFlash({ tone: 'success', text: 'Issue reported  our team will attend to it shortly.' });
      setIssueForm(EMPTY_ISSUE);
      setShowIssueForm(false);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setIssueBusy(false);
    }
  }

  if (loading) return <p className="guest-svc-empty">Loading stay information...</p>;

  if (!activeReservation) {
    return (
      <div className="guest-svc-empty-box">
        <span>đŸ¨</span>
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
          <p>Room {activeReservation.room_number || ''}  {activeReservation.reservation_code}</p>
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
                {CATEGORY_ICONS[category] || ''} {category.replace(/_/g, ' ')}
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
              <input type="text" placeholder="e.g. allergies, preferences, time constraints..."
                value={instruction} onChange={e => setInstruction(e.target.value)} />
            </label>
          </div>
          <div className="guest-svc-order-footer">
            <span>Estimated total: <strong>{formatMoney(selectedService.base_price * quantity, selectedService.currency_code || hotelCurrency)}</strong></span>
            <button type="submit" className="primary-button" disabled={ordering}>
              {ordering ? 'Sending...' : 'Send request'}
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
                    <span>{o.service_category.replace(/_/g, ' ')}  Qty: {o.quantity}</span>
                    {o.special_instruction && <span> {o.special_instruction}</span>}
                    {o.scheduled_at && <span> {formatDateTime(o.scheduled_at)}</span>}
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

      {/*  Report Room Issue  */}
      <div className="guest-issue-card">
        <div className="guest-issue-header">
          <div>
            <h3> Report a room issue</h3>
            <p>Something not working in your room? Let us know and we'll fix it right away.</p>
          </div>
          <button
            type="button"
            className={showIssueForm ? 'ghost-button' : 'primary-button'}
            onClick={() => setShowIssueForm(v => !v)}
          >
            {showIssueForm ? 'Cancel' : 'Report issue'}
          </button>
        </div>

        {showIssueForm && (
          <form className="guest-issue-form" onSubmit={handleReportIssue}>
            <div className="guest-issue-categories">
              {ISSUE_CATEGORIES.map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  className={`guest-issue-cat-btn${issueForm.issue_category === cat.key ? ' active' : ''}`}
                  onClick={() => setIssueForm(f => ({ ...f, issue_category: cat.key }))}
                  title={cat.example}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
            <label className="guest-issue-label">
              Describe the issue
              <textarea
                rows="3"
                className="guest-issue-textarea"
                value={issueForm.issue_description}
                onChange={e => setIssueForm(f => ({ ...f, issue_description: e.target.value }))}
                placeholder={`${ISSUE_CATEGORIES.find(c => c.key === issueForm.issue_category)?.example || ''}... Please describe what is wrong.`}
                required
              />
            </label>
            <div className="guest-issue-form-footer">
              <span className="guest-issue-room-tag">
                Room {activeReservation.room_number} - {activeReservation.hotel_name}
              </span>
              <button type="submit" className="primary-button" disabled={issueBusy}>
                {issueBusy ? 'Sending...' : 'Submit report'}
              </button>
            </div>
          </form>
        )}

        {reportedIssues.length > 0 && (
          <div className="guest-issue-history">
            <p className="guest-issue-history-title">Submitted room issues</p>
            {reportedIssues.map((issue, i) => (
              <div key={issue.id || i} className="guest-issue-history-row">
                <span>{issue.icon}</span>
                <div>
                  <strong>{issue.category}</strong>
                  <p>{issue.desc}</p>
                  {issue.status && <small>{issue.status}</small>}
                </div>
                <span className="guest-issue-time">{issue.at}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function LoyaltyRewardsPanel({ guestId, onProfileRefresh }) {
  const { setFlash } = useFlash();
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [redeemingId, setRedeemingId] = useState(null);

  async function loadLoyaltyData() {
    setLoading(true);
    try {
      const [rewardPayload, redemptionPayload] = await Promise.all([
        apiRequest(`/guests/${guestId}/loyalty-rewards`),
        apiRequest(`/guests/${guestId}/loyalty-redemptions`),
      ]);
      setRewards(rewardPayload.data || []);
      setRedemptions(redemptionPayload.data || []);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchLoyaltyData() {
      if (!guestId) return;
      setLoading(true);
      try {
        const [rewardPayload, redemptionPayload] = await Promise.all([
          apiRequest(`/guests/${guestId}/loyalty-rewards`),
          apiRequest(`/guests/${guestId}/loyalty-redemptions`),
        ]);
        if (!cancelled) {
          setRewards(rewardPayload.data || []);
          setRedemptions(redemptionPayload.data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setFlash({ tone: 'error', text: err.message });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchLoyaltyData();
    return () => {
      cancelled = true;
    };
  }, [guestId, setFlash]);

  async function handleRedeem(reward) {
    setRedeemingId(reward.promotion_id);
    try {
      const payload = await apiRequest(`/guests/${guestId}/loyalty-rewards/${reward.promotion_id}/redeem`, {
        method: 'POST',
      });
      setFlash({
        tone: 'success',
        text: `Reward redeemed. Voucher code: ${payload.data?.issued_promo_code}`,
      });
      await loadLoyaltyData();
      onProfileRefresh?.();
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setRedeemingId(null);
    }
  }

  if (loading) {
    return <p className="guest-svc-empty">Loading loyalty rewards...</p>;
  }

  return (
    <div className="acct-loyalty-shell">
      <section className="acct-loyalty-section">
        <div className="guest-card-head" style={{ marginBottom: 16 }}>
          <div>
            <p className="page-eyebrow">Rewards exchange</p>
            <h3>Redeem points for private promotions</h3>
          </div>
        </div>
        {rewards.length === 0 ? (
          <div className="svc-orders-empty">
            <span>đŸ</span>
            <p>No loyalty rewards are configured yet.</p>
            <small>Ask the hotel team to publish member-only reward promotions with a points cost.</small>
          </div>
        ) : (
          <div className="acct-loyalty-reward-grid">
            {rewards.map((reward) => {
              const disabled = !reward.can_redeem || reward.active_voucher_count > 0;
              return (
                <article key={`${reward.loyalty_account_id}-${reward.promotion_id}`} className="acct-reward-card">
                  <div className="acct-reward-top">
                    <div>
                      <p className="acct-reward-points">{Number(reward.redeemable_points_cost || 0).toLocaleString('en-US')} pts</p>
                      <h4>{reward.promotion_name}</h4>
                    </div>
                    <span className="acct-reward-badge">{formatRewardValue(reward)}</span>
                  </div>
                  <div className="acct-reward-meta">
                    <span>{reward.chain_name}</span>
                    {reward.scope_hotel_name ? <span>{reward.scope_hotel_name}</span> : null}
                    {reward.voucher_valid_days ? <span>Valid {reward.voucher_valid_days} days after redeem</span> : null}
                    {reward.min_nights ? <span>Min {reward.min_nights} nights</span> : null}
                  </div>
                  <div className="acct-reward-footer">
                    <div className="acct-reward-balance">
                      <span>Current balance</span>
                      <strong>{Number(reward.points_balance || 0).toLocaleString('en-US')}</strong>
                    </div>
                    <button
                      type="button"
                      className={disabled ? 'ghost-button' : 'primary-button'}
                      disabled={disabled || redeemingId === reward.promotion_id}
                      onClick={() => handleRedeem(reward)}
                    >
                      {redeemingId === reward.promotion_id
                        ? 'Redeeming...'
                        : reward.active_voucher_count > 0
                          ? 'Voucher already issued'
                          : reward.can_redeem
                            ? 'Redeem reward'
                            : 'Not enough points'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="acct-loyalty-section">
        <div className="guest-card-head" style={{ marginBottom: 16 }}>
          <div>
            <p className="page-eyebrow">Issued vouchers</p>
            <h3>Your redemption history</h3>
          </div>
        </div>
        {redemptions.length === 0 ? (
          <div className="svc-orders-empty">
            <span>đŸ«</span>
            <p>No vouchers issued yet.</p>
            <small>Redeemed vouchers will appear here and can be applied during booking.</small>
          </div>
        ) : (
          <div className="acct-redemption-list">
            {redemptions.map((item) => (
              <article key={item.loyalty_redemption_id} className="acct-redemption-row">
                <div className="acct-redemption-main">
                  <strong>{item.promotion_name}</strong>
                  <span>Voucher code: <code>{item.issued_promo_code}</code></span>
                  <span>{formatRewardValue(item)} - {Number(item.points_spent || 0).toLocaleString('en-US')} pts</span>
                  <span>Issued {formatDateOnly(item.issued_at)} - Expires {formatDateOnly(item.expires_at)}</span>
                  {item.reservation_code ? <span>Used on reservation {item.reservation_code}</span> : null}
                </div>
                <div className="acct-redemption-right">
                  <span className={`acct-redemption-status acct-redemption-status--${String(item.status || '').toLowerCase()}`}>
                    {item.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BookingReviewsPanel({ guestId }) {
  const { setFlash } = useFlash();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [openReservationId, setOpenReservationId] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);
  const [draft, setDraft] = useState({
    rating_score: 5,
    review_title: '',
    review_text: '',
  });

  async function loadBookingData() {
    setLoading(true);
    try {
      const [reservationPayload, reviewPayload] = await Promise.all([
        apiRequest(`/reservations?guest_id=${guestId}&limit=30`),
        apiRequest(`/guests/${guestId}/reviews`),
      ]);
      setReservations(reservationPayload.data || []);
      setReviews(reviewPayload.data || []);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!guestId) return;
    loadBookingData();
  }, [guestId]); // eslint-disable-line react-hooks/exhaustive-deps

  const reviewsByReservation = reviews.reduce((acc, review) => {
    acc[review.reservation_id] = review;
    return acc;
  }, {});

  function openReviewForm(reservation) {
    setOpenReservationId(reservation.reservation_id);
    setDraft({
      rating_score: 5,
      review_title: reservation.hotel_name ? `Stay at ${reservation.hotel_name}` : '',
      review_text: '',
    });
  }

  async function submitReview(event, reservation) {
    event.preventDefault();
    const reviewText = normalizeReviewText(draft.review_text);
    if (!reviewText) {
      setFlash({ tone: 'error', text: 'Please write a short review before publishing.' });
      return;
    }

    setSubmittingId(reservation.reservation_id);
    try {
      await apiRequest(`/hotels/${reservation.hotel_id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          reservation_id: reservation.reservation_id,
          rating_score: Number(draft.rating_score),
          review_title: normalizeReviewText(draft.review_title),
          review_text: reviewText,
        }),
      });
      setFlash({ tone: 'success', text: 'Review submitted and published on the hotel page.' });
      setOpenReservationId(null);
      setDraft({ rating_score: 5, review_title: '', review_text: '' });
      await loadBookingData();
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setSubmittingId(null);
    }
  }

  if (loading) {
    return <p className="guest-svc-empty">Loading your reservations...</p>;
  }

  if (reservations.length === 0) {
    return (
      <div className="svc-orders-empty" style={{ padding: '36px 0' }}>
        <span>đŸ“­</span>
        <p>No reservations found for this account yet.</p>
      </div>
    );
  }

  return (
    <div className="acct-booking-list">
      {reservations.map((reservation) => {
        const existingReview = reviewsByReservation[reservation.reservation_id];
        const canReview = reservation.reservation_status === 'CHECKED_OUT' && !existingReview;
        const isOpen = openReservationId === reservation.reservation_id;

        return (
          <article key={reservation.reservation_id} className="acct-booking-card">
            <div className="acct-booking-top">
              <div>
                <p className="acct-booking-code">{reservation.reservation_code}</p>
                <h3>{reservation.hotel_name}</h3>
                <p className="acct-booking-meta">
                  {reservation.room_type_name || 'Room'}{reservation.room_number ? ` - Room ${reservation.room_number}` : ''}
                </p>
              </div>
              <span className={`acct-booking-status acct-booking-status--${String(reservation.reservation_status || '').toLowerCase()}`}>
                {reservation.reservation_status}
              </span>
            </div>

            <div className="acct-booking-dates">
              <div><span>Check-in</span><strong>{formatDateOnly(reservation.checkin_date)}</strong></div>
              <div><span>Check-out</span><strong>{formatDateOnly(reservation.checkout_date)}</strong></div>
              <div><span>Total</span><strong>{formatMoney(reservation.grand_total_amount, reservation.currency_code || 'USD')}</strong></div>
            </div>

            {existingReview ? (
              <div className="acct-review-posted">
                <div>
                  <strong>{existingReview.review_title || 'Your published review'}</strong>
                  <p>{existingReview.review_text}</p>
                </div>
                <span>{existingReview.rating_score}/5</span>
              </div>
            ) : null}

            <div className="acct-booking-actions">
              <button className="ghost-button" type="button" onClick={() => navigate('/reservation')}>
                Reservation lookup
              </button>
              {canReview ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => openReviewForm(reservation)}
                >
                  Write review
                </button>
              ) : (
                <span className="acct-review-state">
                  {existingReview
                    ? 'Review published'
                    : reservation.reservation_status === 'CHECKED_OUT'
                      ? 'Review already handled'
                      : 'Feedback opens after check-out'}
                </span>
              )}
            </div>

            {isOpen ? (
              <form className="acct-review-form" onSubmit={(event) => submitReview(event, reservation)}>
                <div className="acct-review-form-grid">
                  <label>
                    Rating
                    <select
                      value={draft.rating_score}
                      onChange={(event) => setDraft((current) => ({ ...current, rating_score: event.target.value }))}
                    >
                      {[5, 4, 3, 2, 1].map((score) => (
                        <option key={score} value={score}>{score}/5</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Title
                    <input
                      type="text"
                      value={draft.review_title}
                      onChange={(event) => setDraft((current) => ({ ...current, review_title: event.target.value }))}
                      placeholder="Short headline for your stay"
                    />
                  </label>
                  <label className="acct-review-form-wide">
                    Review
                    <textarea
                      rows="4"
                      value={draft.review_text}
                      onChange={(event) => setDraft((current) => ({ ...current, review_text: event.target.value }))}
                      placeholder="Share what other guests should know about this property."
                    />
                  </label>
                </div>
                <div className="acct-review-actions">
                  <button type="button" className="ghost-button" onClick={() => setOpenReservationId(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-button" disabled={submittingId === reservation.reservation_id}>
                    {submittingId === reservation.reservation_id ? 'Publishing...' : 'Publish review'}
                  </button>
                </div>
              </form>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function PasswordSettingsCard() {
  const { changePassword, authBusy } = useAuth();
  const { setFlash } = useFlash();
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  async function handleSubmit(event) {
    event.preventDefault();

    if (form.new_password !== form.confirm_password) {
      setFlash({ tone: 'error', text: 'Password confirmation does not match.' });
      return;
    }

    const result = await changePassword({
      current_password: form.current_password,
      new_password: form.new_password,
    });

    if (!result.success) {
      setFlash({ tone: 'error', text: result.error });
      return;
    }

    setForm({
      current_password: '',
      new_password: '',
      confirm_password: '',
    });
    setFlash({ tone: 'success', text: result.message || 'Password updated successfully.' });
  }

  return (
    <div className="acct-profile-section" style={{ marginTop: 24 }}>
      <p className="acct-section-label">Password</p>
      <form className="acct-password-form" onSubmit={handleSubmit}>
        <label>
          Current password
          <input
            type="password"
            value={form.current_password}
            onChange={(event) => setForm((current) => ({ ...current, current_password: event.target.value }))}
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={form.new_password}
            onChange={(event) => setForm((current) => ({ ...current, new_password: event.target.value }))}
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={form.confirm_password}
            onChange={(event) => setForm((current) => ({ ...current, confirm_password: event.target.value }))}
          />
        </label>
        <div className="acct-password-actions">
          <button className="primary-button" type="submit" disabled={authBusy === 'change-password'}>
            {authBusy === 'change-password' ? 'Updating...' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  );
}

//  Main AccountPage 
export default function AccountPage() {
  const navigate = useNavigate();
  const { authSession, isGuestUser } = useAuth();
  const [activeTab, setActiveTab] = useState('Overview');

  // Guest full profile (loyalty + preferences)
  const [guestProfile, setGuestProfile] = useState(null);
  const [stays,        setStays]        = useState([]);
  const staysLoadedRef = useRef(false);

  // Profile edit state
  const [profileEdit, setProfileEdit] = useState(null);  // null = not editing
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState(null); // { type:'ok'|'err', text }

  const guestId = authSession?.user?.guest_id;

  async function loadGuestProfile() {
    if (!guestId) return;
    try {
      const payload = await apiRequest(`/guests/${guestId}`);
      setGuestProfile(payload.data);
    } catch {
      // Keep the page usable even if the profile refresh fails.
    }
  }

  function startEditProfile() {
    setProfileEdit({
      first_name:         guestProfile?.first_name        || '',
      last_name:          guestProfile?.last_name         || '',
      phone_country_code: guestProfile?.phone_country_code || '',
      phone_number:       guestProfile?.phone_number       || '',
    });
    setProfileMsg(null);
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    if (!profileEdit) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const payload = await apiRequest(`/guests/${guestId}`, {
        method: 'PUT',
        body: JSON.stringify({
          first_name:         profileEdit.first_name.trim(),
          last_name:          profileEdit.last_name.trim(),
          phone_country_code: profileEdit.phone_country_code.trim() || null,
          phone_number:       profileEdit.phone_number.trim()       || null,
        }),
      });
      setGuestProfile((prev) => ({ ...prev, ...payload.data }));
      setProfileEdit(null);
      setProfileMsg({ type: 'ok', text: 'Profile updated successfully.' });
    } catch (err) {
      setProfileMsg({ type: 'err', text: err.message || 'Failed to save profile.' });
    } finally {
      setProfileSaving(false);
    }
  }

  // Load full profile once
  useEffect(() => {
    let cancelled = false;

    async function fetchGuestProfile() {
      if (!guestId) return;
      try {
        const payload = await apiRequest(`/guests/${guestId}`);
        if (!cancelled) {
          setGuestProfile(payload.data);
        }
      } catch {
        // Keep the page usable even if the initial profile load fails.
      }
    }

    fetchGuestProfile();
    return () => {
      cancelled = true;
    };
  }, [guestId]);

  // Load stays lazily when Overview tab is opened
  useEffect(() => {
    if (activeTab !== 'Overview' || staysLoadedRef.current || !guestId) return;
    staysLoadedRef.current = true;
    apiRequest(`/guests/${guestId}/stays`)
      .then(p => setStays(p.data || []))
      .catch(() => {});
  }, [activeTab, guestId]);

  const loyaltyAccounts = guestProfile?.loyalty_accounts || [];
  const preferences     = guestProfile?.preferences      || [];

  //  Auth guards (after hooks per Rules of Hooks) 
  if (!authSession) {
    return <Navigate to="/login" replace state={{ nextUrl: '/account' }} />;
  }
  if (!isGuestUser) {
    return <Navigate to="/admin" replace />;
  }

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

          {/*  TAB: Overview  */}
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
                    <strong>{authSession.user.guest_code || ''}</strong>
                  </article>
                  <article className="guest-stat-card">
                    <span>Loyalty tier</span>
                    <strong>{loyaltyAccounts[0]?.tier_code || 'None'}</strong>
                  </article>
                  <article className="guest-stat-card">
                    <span>Points balance</span>
                    <strong>{loyaltyAccounts[0] ? Number(loyaltyAccounts[0].points_balance).toLocaleString('en-US') : ''}</strong>
                  </article>
                </div>
              </section>

              {/* Recent stays */}
              {stays.length > 0 && (
                <section className="page-card" style={{ marginBottom: 20 }}>
                  <div className="guest-card-head" style={{ marginBottom: 16 }}>
                    <div>
                      <p className="page-eyebrow">Stay history</p>
                      <h2>Recent visits</h2>
                    </div>
                  </div>
                  <div className="acct-stays-list">
                    {stays.slice(0, 5).map(s => (
                      <div key={s.stay_id} className="acct-stay-row">
                        <div className="acct-stay-icon">
                          {s.stay_status === 'IN_HOUSE' ? 'đŸ¨' : 'đŸ§³'}
                        </div>
                        <div className="acct-stay-info">
                          <strong>{s.hotel_name}</strong>
                          <span>{s.room_type_name}  Room {s.room_number}</span>
                          <span>{s.checkin_date?.slice(0,10)}  {s.checkout_date?.slice(0,10)}  {s.nights} nights</span>
                        </div>
                        <div className="acct-stay-right">
                          <span className={`acct-stay-status${s.stay_status === 'IN_HOUSE' ? ' in-house' : ''}`}>
                            {s.stay_status.replace(/_/g,' ')}
                          </span>
                          <strong>{new Intl.NumberFormat('en-US',{style:'currency',currency:s.currency_code||'USD'}).format(Number(s.grand_total_amount||0))}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

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
                    <div><strong>Guest code</strong><span>{authSession.user.guest_code || ''}</span></div>
                    <div><strong>Account type</strong><span>{authSession.user.user_type}</span></div>
                  </div>
                </section>
              </section>
            </>
          )}

          {/*  TAB: In-house Services  */}
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

          {/* -- TAB: Loyalty -- */}
          {activeTab === 'Loyalty' && (
            <section className="page-card">
              <div className="guest-card-head" style={{ marginBottom: 20 }}>
                <div>
                  <p className="page-eyebrow">Loyalty</p>
                  <h2>Member benefits &amp; points</h2>
                </div>
              </div>
              {loyaltyAccounts.length === 0 && (
                <div className="svc-orders-empty" style={{ padding: '40px 0' }}>
                  <span>đŸ’</span>
                  <p>No loyalty account linked yet.</p>
                  <small>Your points and tier benefits will appear here once enrolled.</small>
                </div>
              )}
              {loyaltyAccounts.map(acc => {
                const tierColor = {
                  BLACK:    { bg: 'var(--tier-black-bg)', color: 'var(--tier-black-color)' },
                  PLATINUM: { bg: 'var(--tier-platinum-bg)', color: 'var(--tier-platinum-color)' },
                  GOLD:     { bg: 'var(--tier-gold-bg)', color: 'var(--tier-gold-color)' },
                  SILVER:   { bg: 'var(--tier-silver-bg)', color: 'var(--tier-silver-color)' },
                }[acc.tier_code] || { bg: 'var(--tier-default-bg)', color: 'var(--tier-default-color)' };
                return (
                  <div key={acc.loyalty_account_id} className="acct-loyalty-card">
                    <div className="acct-loyalty-tier" style={{ background: tierColor.bg, color: tierColor.color }}>
                      <span className="acct-loyalty-tier-label"> {acc.tier_code}</span>
                      <span className="acct-loyalty-chain">{acc.chain_name}</span>
                    </div>
                    <div className="acct-loyalty-body">
                      <div className="acct-loyalty-stats">
                        <div><span>Points balance</span><strong>{Number(acc.points_balance).toLocaleString('en-US')}</strong></div>
                        <div><span>Lifetime points</span><strong>{Number(acc.lifetime_points).toLocaleString('en-US')}</strong></div>
                        <div><span>Membership no.</span><strong>{acc.membership_no}</strong></div>
                        <div><span>Since</span><strong>{acc.enrollment_date?.slice(0,10) || ''}</strong></div>
                        <div><span>Status</span><strong>{acc.status}</strong></div>
                        {acc.expiry_date && <div><span>Expires</span><strong>{acc.expiry_date.slice(0,10)}</strong></div>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {loyaltyAccounts.length > 0 && (
                <LoyaltyRewardsPanel guestId={guestId} onProfileRefresh={loadGuestProfile} />
              )}
            </section>
          )}


          {/*  TAB: Profile  */}
          {activeTab === 'Profile' && (
            <section className="page-card">
              <div className="guest-card-head" style={{ marginBottom: 20 }}>
                <div>
                  <p className="page-eyebrow">Profile</p>
                  <h2>Personal information &amp; preferences</h2>
                </div>
              </div>

              {/* Personal info */}
              <div className="acct-profile-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p className="acct-section-label" style={{ marginBottom: 0 }}>Personal details</p>
                  {!profileEdit && (
                    <button className="btn-outline" style={{ fontSize: '0.82rem', padding: '4px 14px' }} onClick={startEditProfile}>
                      Edit
                    </button>
                  )}
                </div>

                {/* Read-only identity fields */}
                <div className="acct-profile-grid" style={{ marginBottom: 16 }}>
                  <div><span>Email</span><strong>{authSession.user.email}</strong></div>
                  <div><span>Guest code</span><strong>{authSession.user.guest_code || ''}</strong></div>
                  <div><span>Nationality</span><strong>{guestProfile?.nationality_country_code || ''}</strong></div>
                  <div><span>VIP status</span><strong>{guestProfile?.vip_flag ? 'VIP' : 'Standard'}</strong></div>
                </div>

                {/* Editable fields */}
                {profileEdit ? (
                  <form onSubmit={handleProfileSave} style={{ display: 'grid', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-soft)' }}>First name</span>
                        <input
                          className="form-input"
                          value={profileEdit.first_name}
                          onChange={(e) => setProfileEdit((s) => ({ ...s, first_name: e.target.value }))}
                          required
                          maxLength={100}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-soft)' }}>Last name</span>
                        <input
                          className="form-input"
                          value={profileEdit.last_name}
                          onChange={(e) => setProfileEdit((s) => ({ ...s, last_name: e.target.value }))}
                          required
                          maxLength={100}
                        />
                      </label>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-soft)' }}>Country code</span>
                        <input
                          className="form-input"
                          placeholder="+84"
                          value={profileEdit.phone_country_code}
                          onChange={(e) => setProfileEdit((s) => ({ ...s, phone_country_code: e.target.value }))}
                          maxLength={10}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-soft)' }}>Phone number</span>
                        <input
                          className="form-input"
                          placeholder="0912 345 678"
                          value={profileEdit.phone_number}
                          onChange={(e) => setProfileEdit((s) => ({ ...s, phone_number: e.target.value }))}
                          maxLength={30}
                        />
                      </label>
                    </div>
                    {profileMsg && (
                      <p style={{ fontSize: '0.85rem', color: profileMsg.type === 'ok' ? 'var(--success)' : 'var(--error)', margin: 0 }}>
                        {profileMsg.text}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn-primary" type="submit" disabled={profileSaving} style={{ fontSize: '0.88rem' }}>
                        {profileSaving ? 'Saving...' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        className="btn-outline"
                        style={{ fontSize: '0.88rem' }}
                        onClick={() => { setProfileEdit(null); setProfileMsg(null); }}
                        disabled={profileSaving}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="acct-profile-grid">
                    <div><span>Full name</span><strong>{guestProfile?.full_name || authSession.user.full_name}</strong></div>
                    <div><span>Phone</span><strong>{guestProfile ? `${guestProfile.phone_country_code || ''}${guestProfile.phone_number || ''}`.trim() || 'â€”' : 'â€”'}</strong></div>
                    {profileMsg?.type === 'ok' && (
                      <div style={{ gridColumn: '1/-1' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--success)', margin: 0 }}>{profileMsg.text}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Preferences */}
              <div className="acct-profile-section" style={{ marginTop: 24 }}>
                <p className="acct-section-label">Stay preferences</p>
                {preferences.length === 0 && (
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-soft)', padding: '12px 0' }}>
                    No preferences on file. Hotel staff will record your preferences during your stay.
                  </p>
                )}
                {preferences.length > 0 && (
                  <div className="acct-pref-list">
                    {preferences.map(p => (
                      <div key={p.preference_id} className="acct-pref-row">
                        <span className="acct-pref-type">{p.preference_type.replace(/_/g,' ')}</span>
                        <span className="acct-pref-value">{p.preference_value}</span>
                        {p.note && <span className="acct-pref-note"> {p.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <PasswordSettingsCard />
            </section>
          )}

          {/*  TAB: Bookings & Reviews  */}
          {activeTab === 'Bookings & Reviews' && (
            <section className="page-card">
              <div className="guest-card-head" style={{ marginBottom: 20 }}>
                <div>
                  <p className="page-eyebrow">Bookings & Reviews</p>
                  <h2>Your reservations and hotel feedback</h2>
                  <p className="page-text" style={{ marginTop: 6 }}>
                    After check-out, use Write review to publish feedback on the hotel page.
                  </p>
                </div>
              </div>
              <BookingReviewsPanel guestId={guestId} />
            </section>
          )}

        </div>
      </section>
    </main>
  );
}


