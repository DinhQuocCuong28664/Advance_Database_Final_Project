import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react';
import './App.css';
import { API_BASE_URL, apiRequest } from './lib/api';

const NAV_ITEMS = [
  ['dashboard', 'Command Deck'],
  ['booking', 'Booking Studio'],
  ['reservation', 'Reservation Ops'],
  ['operations', 'Admin & Ops'],
];

const FEATURE_LIST = [
  'Hybrid SQL + MongoDB hotel catalog',
  'Pessimistic locking for reservation creation',
  'Optimistic locking for admin availability updates',
  'Operational flows for payment, check-in, checkout, housekeeping, maintenance',
];

const nextDate = (days) => {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
};

const money = (value, currency = 'VND') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(Number(value || 0));

const when = (value) =>
  value
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value))
    : 'N/A';

const textValue = (value, fallback = 'N/A') => {
  if (value == null) return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map((item) => textValue(item, '')).filter(Boolean).join(', ') || fallback;
  if (typeof value === 'object') {
    if (typeof value.short === 'string' && value.short.trim()) return value.short;
    if (typeof value.long === 'string' && value.long.trim()) return value.long;
    if (Array.isArray(value.highlights) && value.highlights.length) {
      return value.highlights.map((item) => textValue(item, '')).filter(Boolean).join(' · ');
    }
  }
  return fallback;
};

function App() {
  const bootedRef = useRef(false);
  const [tab, setTab] = useState('dashboard');
  const [flash, setFlash] = useState(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState('');
  const [apiInfo, setApiInfo] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [guests, setGuests] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [hotelDetails, setHotelDetails] = useState({});

  const [bookingSearch, setBookingSearch] = useState({ hotelId: '', checkin: nextDate(1), checkout: nextDate(3) });
  const [bookingRooms, setBookingRooms] = useState([]);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [bookingDraft, setBookingDraft] = useState({
    guestId: '',
    adultCount: 2,
    childCount: 0,
    guaranteeType: 'DEPOSIT',
    purposeOfStay: 'LEISURE',
    specialRequestText: '',
  });
  const [bookingResult, setBookingResult] = useState(null);

  const [reservationCode, setReservationCode] = useState('');
  const [reservationBusy, setReservationBusy] = useState(false);
  const [reservationActionBusy, setReservationActionBusy] = useState('');
  const [reservationData, setReservationData] = useState(null);
  const [reservationPayments, setReservationPayments] = useState([]);
  const [paymentDraft, setPaymentDraft] = useState({
    payment_type: 'DEPOSIT',
    payment_method: 'CREDIT_CARD',
    amount: '',
  });

  const [opsSearch, setOpsSearch] = useState({ hotelId: '', checkin: nextDate(0), checkout: nextDate(2) });
  const [opsBusy, setOpsBusy] = useState(false);
  const [opsRecordBusy, setOpsRecordBusy] = useState(null);
  const [opsRooms, setOpsRooms] = useState([]);
  const [feedsBusy, setFeedsBusy] = useState(false);
  const [housekeeping, setHousekeeping] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [revenue, setRevenue] = useState([]);

  const selectedHotel = hotels.find((hotel) => String(hotel.hotel_id) === bookingSearch.hotelId) || null;
  const selectedRoom = bookingRooms.find((room) => room.room_id === selectedRoomId) || null;

  const boot = useEffectEvent(async () => {
    setBootLoading(true);
    setBootError('');
    try {
      const [apiPayload, hotelPayload, guestPayload, alertPayload] = await Promise.all([
        apiRequest(''),
        apiRequest('/hotels'),
        apiRequest('/guests'),
        apiRequest('/admin/rates/alerts'),
      ]);
      startTransition(() => {
        setApiInfo(apiPayload);
        setHotels(hotelPayload.data || []);
        setGuests(guestPayload.data || []);
        setAlerts(alertPayload.data || []);
      });
    } catch (error) {
      setBootError(error.message);
    } finally {
      setBootLoading(false);
    }
  });

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    boot();
  }, []);

  useEffect(() => {
    if (!hotels.length) return;
    const firstHotelId = String(hotels[0].hotel_id);
    setBookingSearch((current) => (current.hotelId ? current : { ...current, hotelId: firstHotelId }));
    setOpsSearch((current) => (current.hotelId ? current : { ...current, hotelId: firstHotelId }));
  }, [hotels]);

  useEffect(() => {
    if (!guests.length) return;
    const firstGuestId = String(guests[0].guest_id);
    setBookingDraft((current) => (current.guestId ? current : { ...current, guestId: firstGuestId }));
  }, [guests]);

  async function ensureHotelDetail(hotelId) {
    const key = String(hotelId);
    if (hotelDetails[key]) return hotelDetails[key];
    const payload = await apiRequest(`/hotels/${hotelId}`);
    setHotelDetails((current) => ({ ...current, [key]: payload.data }));
    return payload.data;
  }

  async function loadReservation(code, silent = false) {
    const target = code.trim();
    if (!target) return;
    if (!silent) setReservationBusy(true);
    const reservationPayload = await apiRequest(`/reservations/${encodeURIComponent(target)}`);
    const paymentsPayload = await apiRequest(`/payments?reservation_id=${reservationPayload.data.reservation_id}`);
    setReservationCode(target);
    setReservationData(reservationPayload.data);
    setReservationPayments(paymentsPayload.data || []);
    if (paymentDraft.payment_type === 'FULL_PAYMENT') {
      setPaymentDraft((current) => ({ ...current, amount: String(Number(reservationPayload.data.balance_due || 0)) }));
    }
    if (!silent) setReservationBusy(false);
  }

  async function handleAvailabilitySearch(event) {
    event.preventDefault();
    setBookingBusy(true);
    setBookingResult(null);
    try {
      await ensureHotelDetail(bookingSearch.hotelId);
      const query = new URLSearchParams({
        hotel_id: bookingSearch.hotelId,
        checkin: bookingSearch.checkin,
        checkout: bookingSearch.checkout,
      });
      const payload = await apiRequest(`/rooms/availability?${query.toString()}`);
      startTransition(() => {
        setBookingRooms(payload.data || []);
        setSelectedRoomId(payload.data?.[0]?.room_id || null);
      });
      setFlash({ tone: 'success', text: `Loaded ${payload.count || 0} room(s).` });
    } catch (error) {
      setBookingRooms([]);
      setSelectedRoomId(null);
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setBookingBusy(false);
    }
  }

  async function handleReservationCreate(event) {
    event.preventDefault();
    if (!selectedRoom) {
      setFlash({ tone: 'error', text: 'Select a room before creating the reservation.' });
      return;
    }
    setBookingBusy(true);
    try {
      const hotelDetail = await ensureHotelDetail(bookingSearch.hotelId);
      const roomType = hotelDetail?.room_types?.find((item) => item.room_type_code === selectedRoom.room_type_code);
      const payload = await apiRequest('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          hotel_id: Number(bookingSearch.hotelId),
          guest_id: Number(bookingDraft.guestId),
          room_id: selectedRoom.room_id,
          room_type_id: roomType?.room_type_id,
          checkin_date: bookingSearch.checkin,
          checkout_date: bookingSearch.checkout,
          adult_count: Number(bookingDraft.adultCount),
          child_count: Number(bookingDraft.childCount),
          nightly_rate: Number(selectedRoom.min_nightly_rate || 0),
          currency_code: selectedHotel?.currency_code || 'VND',
          guarantee_type: bookingDraft.guaranteeType,
          purpose_of_stay: bookingDraft.purposeOfStay,
          special_request_text: bookingDraft.specialRequestText,
        }),
      });
      setBookingResult(payload.data);
      setFlash({ tone: 'success', text: `Created ${payload.data.reservation_code}.` });
      await loadReservation(payload.data.reservation_code, true);
      startTransition(() => setTab('reservation'));
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setBookingBusy(false);
    }
  }

  async function handleReservationLookup(event) {
    event.preventDefault();
    try {
      await loadReservation(reservationCode);
      setFlash({ tone: 'success', text: 'Reservation loaded.' });
    } catch (error) {
      setReservationData(null);
      setReservationPayments([]);
      setReservationBusy(false);
      setFlash({ tone: 'error', text: error.message });
    }
  }

  async function runReservationAction(action) {
    if (!reservationData) return;
    const routes = {
      checkin: `/reservations/${reservationData.reservation_id}/checkin`,
      checkout: `/reservations/${reservationData.reservation_id}/checkout`,
      guestCancel: `/reservations/${reservationData.reservation_id}/guest-cancel`,
      hotelCancel: `/reservations/${reservationData.reservation_id}/hotel-cancel`,
    };
    const bodies = {
      checkin: { agent_id: 1 },
      checkout: { agent_id: 1 },
      guestCancel: { reason: 'Cancelled from LuxeReserve frontend' },
      hotelCancel: { reason: 'Operational cancellation from LuxeReserve frontend', agent_id: 1 },
    };
    setReservationActionBusy(action);
    try {
      const payload = await apiRequest(routes[action], {
        method: 'POST',
        body: JSON.stringify(bodies[action]),
      });
      setFlash({ tone: 'success', text: payload.message || 'Reservation updated.' });
      await loadReservation(reservationData.reservation_code, true);
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setReservationActionBusy('');
    }
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    if (!reservationData) {
      setFlash({ tone: 'error', text: 'Load a reservation first.' });
      return;
    }
    setReservationActionBusy('payment');
    try {
      const payload = await apiRequest('/payments', {
        method: 'POST',
        body: JSON.stringify({
          reservation_id: reservationData.reservation_id,
          payment_type: paymentDraft.payment_type,
          payment_method: paymentDraft.payment_method,
          amount: Number(paymentDraft.amount),
          currency_code: reservationData.currency_code || 'VND',
        }),
      });
      setFlash({
        tone: 'success',
        text: `Payment captured. Remaining ${money(payload.payment_summary.remaining_balance, reservationData.currency_code)}`,
      });
      await loadReservation(reservationData.reservation_code, true);
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setReservationActionBusy('');
    }
  }

  async function handleOpsSearch(event) {
    event?.preventDefault();
    setOpsBusy(true);
    try {
      const query = new URLSearchParams({
        hotel_id: opsSearch.hotelId,
        checkin: opsSearch.checkin,
        checkout: opsSearch.checkout,
      });
      const payload = await apiRequest(`/rooms/availability?${query.toString()}`);
      setOpsRooms(payload.data || []);
      setFlash({ tone: 'success', text: 'Inventory grid refreshed.' });
    } catch (error) {
      setOpsRooms([]);
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setOpsBusy(false);
    }
  }

  async function handleOpsFeeds() {
    setFeedsBusy(true);
    try {
      const hotelId = opsSearch.hotelId;
      const [housekeepingPayload, maintenancePayload, revenuePayload] = await Promise.all([
        apiRequest(`/housekeeping?hotel_id=${hotelId}`),
        apiRequest(`/maintenance?hotel_id=${hotelId}`),
        apiRequest('/admin/reports/revenue'),
      ]);
      setHousekeeping(housekeepingPayload.data || []);
      setMaintenance(maintenancePayload.data || []);
      setRevenue(revenuePayload.data || []);
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setFeedsBusy(false);
    }
  }

  async function updateAvailability(record, availabilityStatus) {
    setOpsRecordBusy(record.availability_id);
    try {
      await apiRequest(`/admin/availability/${record.availability_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          availability_status: availabilityStatus,
          expected_version: record.version_no,
          inventory_note: `Updated from frontend to ${availabilityStatus}`,
        }),
      });
      setFlash({ tone: 'success', text: `availability_id ${record.availability_id} -> ${availabilityStatus}` });
      await handleOpsSearch();
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setOpsRecordBusy(null);
    }
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <header className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow">Luxury hospitality operations cockpit</p>
          <h1>LuxeReserve Frontend MVP</h1>
          <p className="lede">
            Search live inventory, create bookings, drive reservation lifecycle, collect payments,
            and expose the advanced database workflows behind the backend.
          </p>
          <div className="hero-meta">
            <span>API base: {API_BASE_URL}</span>
            <span>Backend default: http://localhost:3000/api</span>
          </div>
        </div>
        <aside className="hero-panel">
          <MetricCard label="Hotels" value={hotels.length} accent="gold" />
          <MetricCard label="Guests" value={guests.length} accent="teal" />
          <MetricCard label="Rate Alerts" value={alerts.length} accent="copper" />
          <MetricCard label="Engines" value={apiInfo?.engines ? Object.keys(apiInfo.engines).length : 0} accent="ink" />
        </aside>
      </header>

      <nav className="view-tabs">
        {NAV_ITEMS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={value === tab ? 'tab-button active' : 'tab-button'}
            onClick={() => startTransition(() => setTab(value))}
          >
            {label}
          </button>
        ))}
      </nav>

      {flash ? <div className={`message-strip ${flash.tone}`}>{flash.text}</div> : null}
      {bootError ? <div className="message-strip error">{bootError}</div> : null}

      <main className="content-grid">
        {tab === 'dashboard' && (
          <>
            <section className="panel panel-span-2">
              <p className="section-kicker">Project posture</p>
              <h2>Advanced DB features surfaced in the UI</h2>
              <div className="feature-grid">
                {FEATURE_LIST.map((item, index) => (
                  <article key={item} className="feature-card">
                    <span className="feature-index">0{index + 1}</span>
                    <p>{item}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <p className="section-kicker">Runtime overview</p>
              <h2>API profile</h2>
              {bootLoading ? (
                <p className="muted-copy">Loading backend profile…</p>
              ) : (
                <dl className="definition-list">
                  <div><dt>Name</dt><dd>{apiInfo?.name || 'Unavailable'}</dd></div>
                  <div><dt>Version</dt><dd>{apiInfo?.version || 'Unavailable'}</dd></div>
                  <div><dt>SQL</dt><dd>{apiInfo?.engines?.sql || 'Unavailable'}</dd></div>
                  <div><dt>Mongo</dt><dd>{apiInfo?.engines?.nosql || 'Unavailable'}</dd></div>
                </dl>
              )}
            </section>

            <section className="panel panel-span-2">
              <p className="section-kicker">Hotels</p>
              <h2>Live property catalog</h2>
              <div className="hotel-grid">
                {hotels.slice(0, 6).map((hotel) => (
                  <article key={hotel.hotel_id} className="hotel-card">
                    <div className="hotel-card-top">
                      <span>{hotel.chain_name}</span>
                      <span>{hotel.city_name}</span>
                    </div>
                    <h3>{hotel.hotel_name}</h3>
                    <p>{textValue(hotel.description, 'Mongo-rich content available when catalog entries are present.')}</p>
                    <div className="hotel-card-meta">
                      <span>{hotel.brand_name}</span>
                      <span>{hotel.total_rooms} rooms</span>
                      <span>{hotel.currency_code}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel">
              <p className="section-kicker">Trigger watch</p>
              <h2>Latest rate alerts</h2>
              <div className="compact-list">
                {alerts.slice(0, 5).map((alert) => (
                  <div key={alert.log_id || `${alert.room_rate_id}-${alert.triggered_at}`} className="compact-item">
                    <strong>{alert.hotel_name}</strong>
                    <span>{alert.room_type_name}</span>
                    <span>{when(alert.triggered_at)}</span>
                  </div>
                ))}
                {!alerts.length && <p className="muted-copy">No rate alerts returned.</p>}
              </div>
            </section>
          </>
        )}

        {tab === 'booking' && (
          <>
            <section className="panel">
              <p className="section-kicker">Step 1</p>
              <h2>Search inventory</h2>
              <form className="form-grid" onSubmit={handleAvailabilitySearch}>
                <label>
                  Hotel
                  <select value={bookingSearch.hotelId} onChange={(event) => setBookingSearch((current) => ({ ...current, hotelId: event.target.value }))}>
                    {hotels.map((hotel) => (
                      <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Check-in
                  <input type="date" value={bookingSearch.checkin} onChange={(event) => setBookingSearch((current) => ({ ...current, checkin: event.target.value }))} />
                </label>
                <label>
                  Check-out
                  <input type="date" value={bookingSearch.checkout} onChange={(event) => setBookingSearch((current) => ({ ...current, checkout: event.target.value }))} />
                </label>
                <button className="primary-button" type="submit" disabled={bookingBusy}>{bookingBusy ? 'Searching…' : 'Load Available Rooms'}</button>
              </form>

              <div className="room-stack">
                {bookingRooms.map((room) => (
                  <button
                    key={room.room_id}
                    type="button"
                    className={room.room_id === selectedRoomId ? 'room-card active' : 'room-card'}
                    onClick={() => setSelectedRoomId(room.room_id)}
                  >
                    <div className="room-card-head">
                      <strong>Room {room.room_number}</strong>
                      <span>{money(room.min_nightly_rate, selectedHotel?.currency_code)}</span>
                    </div>
                    <p>{room.room_type_name}</p>
                    <div className="room-card-meta">
                      <span>{room.category}</span>
                      <span>{room.view_type}</span>
                      <span>{room.max_adults} adults</span>
                    </div>
                  </button>
                ))}
                {!bookingRooms.length && <p className="muted-copy">Search to populate the inventory grid.</p>}
              </div>
            </section>

            <section className="panel">
              <p className="section-kicker">Step 2</p>
              <h2>Create reservation</h2>
              {selectedRoom ? (
                <div className="selected-room-banner">
                  <span>Selected room</span>
                  <strong>{selectedRoom.room_type_name}</strong>
                  <small>Room {selectedRoom.room_number} · {selectedRoom.view_type} · {money(selectedRoom.min_nightly_rate, selectedHotel?.currency_code)}</small>
                </div>
              ) : <p className="muted-copy">Choose a room card from the left.</p>}

              <form className="form-grid" onSubmit={handleReservationCreate}>
                <label>
                  Guest
                  <select value={bookingDraft.guestId} onChange={(event) => setBookingDraft((current) => ({ ...current, guestId: event.target.value }))}>
                    {guests.map((guest) => (
                      <option key={guest.guest_id} value={guest.guest_id}>{guest.full_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Adults
                  <input type="number" min="1" value={bookingDraft.adultCount} onChange={(event) => setBookingDraft((current) => ({ ...current, adultCount: event.target.value }))} />
                </label>
                <label>
                  Children
                  <input type="number" min="0" value={bookingDraft.childCount} onChange={(event) => setBookingDraft((current) => ({ ...current, childCount: event.target.value }))} />
                </label>
                <label>
                  Guarantee
                  <select value={bookingDraft.guaranteeType} onChange={(event) => setBookingDraft((current) => ({ ...current, guaranteeType: event.target.value }))}>
                    <option value="DEPOSIT">DEPOSIT</option>
                    <option value="CARD">CARD</option>
                  </select>
                </label>
                <label>
                  Purpose
                  <select value={bookingDraft.purposeOfStay} onChange={(event) => setBookingDraft((current) => ({ ...current, purposeOfStay: event.target.value }))}>
                    <option value="LEISURE">LEISURE</option>
                    <option value="BUSINESS">BUSINESS</option>
                  </select>
                </label>
                <label className="full-span">
                  Special request
                  <textarea rows="4" value={bookingDraft.specialRequestText} onChange={(event) => setBookingDraft((current) => ({ ...current, specialRequestText: event.target.value }))} />
                </label>
                <button className="primary-button" type="submit" disabled={bookingBusy || !selectedRoom}>{bookingBusy ? 'Processing…' : 'Create Reservation'}</button>
              </form>

              {bookingResult && (
                <div className="result-card success-card">
                  <h3>{bookingResult.reservation_code}</h3>
                  <p>{bookingResult.nights} night(s) · total {money(bookingResult.total, selectedHotel?.currency_code)}</p>
                  <p>Deposit: {bookingResult.deposit_required ? money(bookingResult.deposit_amount, selectedHotel?.currency_code) : 'No deposit required'}</p>
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'reservation' && (
          <>
            <section className="panel">
              <p className="section-kicker">Lookup</p>
              <h2>Reservation lifecycle</h2>
              <form className="lookup-row" onSubmit={handleReservationLookup}>
                <input type="text" placeholder="RES-20260413-ABC123" value={reservationCode} onChange={(event) => setReservationCode(event.target.value)} />
                <button className="primary-button" type="submit" disabled={reservationBusy}>{reservationBusy ? 'Loading…' : 'Load Reservation'}</button>
              </form>

              {reservationData ? (
                <div className="reservation-profile">
                  <div><span>Status</span><strong>{reservationData.reservation_status}</strong></div>
                  <div><span>Guest</span><strong>{reservationData.guest_name}</strong></div>
                  <div><span>Stay</span><strong>{when(reservationData.checkin_date)} - {when(reservationData.checkout_date)}</strong></div>
                  <div><span>Balance due</span><strong>{money(reservationData.balance_due, reservationData.currency_code)}</strong></div>
                </div>
              ) : <p className="muted-copy">Load a confirmation code to unlock payment and lifecycle actions.</p>}

              <div className="action-row">
                <button className="ghost-button" type="button" disabled={!reservationData || reservationActionBusy} onClick={() => runReservationAction('checkin')}>{reservationActionBusy === 'checkin' ? 'Working…' : 'Check In'}</button>
                <button className="ghost-button" type="button" disabled={!reservationData || reservationActionBusy} onClick={() => runReservationAction('checkout')}>{reservationActionBusy === 'checkout' ? 'Working…' : 'Check Out'}</button>
                <button className="ghost-button warning" type="button" disabled={!reservationData || reservationActionBusy} onClick={() => runReservationAction('guestCancel')}>{reservationActionBusy === 'guestCancel' ? 'Working…' : 'Guest Cancel'}</button>
                <button className="ghost-button warning" type="button" disabled={!reservationData || reservationActionBusy} onClick={() => runReservationAction('hotelCancel')}>{reservationActionBusy === 'hotelCancel' ? 'Working…' : 'Hotel Cancel'}</button>
              </div>
            </section>

            <section className="panel">
              <p className="section-kicker">Payments</p>
              <h2>Capture and review</h2>
              <form className="form-grid" onSubmit={handlePaymentSubmit}>
                <label>
                  Payment type
                  <select
                    value={paymentDraft.payment_type}
                    onChange={(event) => setPaymentDraft((current) => ({
                      ...current,
                      payment_type: event.target.value,
                      amount: event.target.value === 'FULL_PAYMENT' && reservationData ? String(Number(reservationData.balance_due || 0)) : current.amount,
                    }))}
                  >
                    <option value="DEPOSIT">DEPOSIT</option>
                    <option value="PREPAYMENT">PREPAYMENT</option>
                    <option value="FULL_PAYMENT">FULL_PAYMENT</option>
                  </select>
                </label>
                <label>
                  Method
                  <select value={paymentDraft.payment_method} onChange={(event) => setPaymentDraft((current) => ({ ...current, payment_method: event.target.value }))}>
                    <option value="CREDIT_CARD">CREDIT_CARD</option>
                    <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                    <option value="WALLET">WALLET</option>
                    <option value="CASH">CASH</option>
                  </select>
                </label>
                <label>
                  Amount
                  <input type="number" min="0" step="0.01" value={paymentDraft.amount} onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))} />
                </label>
                <button className="primary-button" type="submit" disabled={!reservationData || reservationActionBusy}>{reservationActionBusy === 'payment' ? 'Capturing…' : 'Capture Payment'}</button>
              </form>

              <div className="payments-list">
                {reservationPayments.map((payment) => (
                  <div key={payment.payment_id || payment.payment_reference} className="payment-row">
                    <div>
                      <strong>{payment.payment_type}</strong>
                      <p>{payment.payment_method}</p>
                    </div>
                    <div>
                      <strong>{money(payment.amount, payment.currency_code || reservationData?.currency_code)}</strong>
                      <p>{payment.payment_status}</p>
                    </div>
                  </div>
                ))}
                {!reservationPayments.length && <p className="muted-copy">No payments loaded yet.</p>}
              </div>
            </section>
          </>
        )}

        {tab === 'operations' && (
          <>
            <section className="panel panel-span-2">
              <p className="section-kicker">Admin inventory</p>
              <h2>Optimistic locking control surface</h2>
              <form className="form-grid" onSubmit={handleOpsSearch}>
                <label>
                  Hotel
                  <select value={opsSearch.hotelId} onChange={(event) => setOpsSearch((current) => ({ ...current, hotelId: event.target.value }))}>
                    {hotels.map((hotel) => (
                      <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Date from
                  <input type="date" value={opsSearch.checkin} onChange={(event) => setOpsSearch((current) => ({ ...current, checkin: event.target.value }))} />
                </label>
                <label>
                  Date to
                  <input type="date" value={opsSearch.checkout} onChange={(event) => setOpsSearch((current) => ({ ...current, checkout: event.target.value }))} />
                </label>
                <button className="primary-button" type="submit" disabled={opsBusy}>{opsBusy ? 'Refreshing…' : 'Load Inventory Records'}</button>
              </form>

              <div className="inventory-grid">
                {opsRooms.flatMap((room) => (room.availability_records || []).map((record) => (
                  <article key={record.availability_id} className="inventory-card">
                    <div className="inventory-card-head">
                      <strong>Room {room.room_number} · {room.room_type_name}</strong>
                      <span>v{record.version_no}</span>
                    </div>
                    <p>{when(record.stay_date)}</p>
                    <div className="status-pill-row">
                      <span className={`status-pill ${record.availability_status.toLowerCase()}`}>{record.availability_status}</span>
                      <small>id {record.availability_id}</small>
                    </div>
                    <div className="action-row">
                      <button className="ghost-button" type="button" disabled={opsRecordBusy === record.availability_id} onClick={() => updateAvailability(record, 'OPEN')}>Open</button>
                      <button className="ghost-button warning" type="button" disabled={opsRecordBusy === record.availability_id} onClick={() => updateAvailability(record, 'BLOCKED')}>Block</button>
                    </div>
                  </article>
                )))}
                {!opsRooms.length && <p className="muted-copy">Search inventory to expose availability records and version numbers.</p>}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header-inline">
                <div>
                  <p className="section-kicker">Ops feeds</p>
                  <h2>Housekeeping and maintenance</h2>
                </div>
                <button className="ghost-button" type="button" onClick={handleOpsFeeds} disabled={feedsBusy}>{feedsBusy ? 'Loading…' : 'Refresh Feeds'}</button>
              </div>
              <div className="ops-columns">
                <div>
                  <h3>Housekeeping</h3>
                  <div className="compact-list">
                    {housekeeping.slice(0, 6).map((task) => (
                      <div key={task.hk_task_id} className="compact-item">
                        <strong>Room {task.room_number}</strong>
                        <span>{task.task_type}</span>
                        <span>{task.task_status}</span>
                      </div>
                    ))}
                    {!housekeeping.length && <p className="muted-copy">No housekeeping feed loaded.</p>}
                  </div>
                </div>
                <div>
                  <h3>Maintenance</h3>
                  <div className="compact-list">
                    {maintenance.slice(0, 6).map((ticket) => (
                      <div key={ticket.maintenance_ticket_id} className="compact-item">
                        <strong>{ticket.issue_category}</strong>
                        <span>{ticket.room_number ? `Room ${ticket.room_number}` : 'Hotel-level ticket'}</span>
                        <span>{ticket.status}</span>
                      </div>
                    ))}
                    {!maintenance.length && <p className="muted-copy">No maintenance feed loaded.</p>}
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <p className="section-kicker">Reports</p>
              <h2>Revenue snapshot</h2>
              <div className="compact-list">
                {revenue.slice(0, 6).map((row, index) => (
                  <div key={`${row.hotel_name}-${row.year}-${row.quarter}-${index}`} className="compact-item">
                    <strong>{row.hotel_name}</strong>
                    <span>Q{row.quarter} {row.year}</span>
                    <span>{money(row.total_revenue, 'VND')}</span>
                  </div>
                ))}
                {!revenue.length && <p className="muted-copy">Refresh feeds to load report rows.</p>}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <article className={`metric-card ${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default App;
