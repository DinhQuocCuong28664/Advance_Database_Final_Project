import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/FlashContext';
import { useAuth } from '../../context/AuthContext';

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoney(value, currency = 'VND') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatStatus(status) {
  return String(status || '').replace(/_/g, ' ').toLowerCase();
}

function getReservationStateMeta(status) {
  const normalized = String(status || '').toUpperCase();

  switch (normalized) {
    case 'CONFIRMED':
      return { label: 'Ready for arrival', note: 'Guest has not checked in yet.' };
    case 'CHECKED_IN':
      return { label: 'Checked in', note: 'Guest is currently in house.' };
    case 'CHECKED_OUT':
      return { label: 'Stay completed', note: 'Guest has already checked out.' };
    case 'CANCELLED':
      return { label: 'Cancelled', note: 'This reservation is closed.' };
    case 'NO_SHOW':
      return { label: 'No show', note: 'Guest did not arrive for the stay.' };
    default:
      return { label: formatStatus(status), note: 'Review the reservation before taking action.' };
  }
}

function ReservationMiniCard({ reservation, actionLabel, actionTone = 'primary', onAction, secondaryAction }) {
  const stateMeta = getReservationStateMeta(reservation.reservation_status);

  return (
    <article className="fd-card">
      <div className="fd-card-head">
        <div>
          <p className="fd-card-code">{reservation.reservation_code}</p>
          <h3>{reservation.guest_name}</h3>
          <p>
            {reservation.hotel_name} • Room {reservation.room_number || 'TBD'} •{' '}
            {reservation.room_type_name || 'Room'}
          </p>
        </div>
        <div className="fd-status-stack">
          <span className={`inventory-status-pill ${String(reservation.reservation_status || '').toLowerCase()}`}>
            {stateMeta.label}
          </span>
          <span className="fd-status-note">{stateMeta.note}</span>
        </div>
      </div>
      <div className="fd-card-meta">
        <span>
          Check-in: <strong>{formatDate(reservation.checkin_date)}</strong>
        </span>
        <span>
          Check-out: <strong>{formatDate(reservation.checkout_date)}</strong>
        </span>
        <span>
          Total: <strong>{formatMoney(reservation.grand_total_amount, reservation.currency_code || 'VND')}</strong>
        </span>
      </div>
      <div className="fd-card-actions">
        {actionLabel ? (
          <button
            type="button"
            className={actionTone === 'ghost' ? 'ghost-button' : 'primary-button'}
            onClick={() => onAction?.(reservation)}
          >
            {actionLabel}
          </button>
        ) : null}
        {secondaryAction ? (
          <button type="button" className="ghost-button" onClick={() => secondaryAction.onClick(reservation)}>
            {secondaryAction.label}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function AdminFrontDesk({ hotels }) {
  const { setFlash } = useFlash();
  const { authSession } = useAuth();

  const [hotelId, setHotelId] = useState(() => (hotels[0] ? String(hotels[0].hotel_id) : ''));
  const [deskDate, setDeskDate] = useState(todayString());
  const [loadingDesk, setLoadingDesk] = useState(false);
  const [arrivals, setArrivals] = useState([]);
  const [departures, setDepartures] = useState([]);
  const [lookupCode, setLookupCode] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [actionBusy, setActionBusy] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferOptions, setTransferOptions] = useState([]);
  const [transferDraft, setTransferDraft] = useState({
    reservation_id: '',
    new_room_id: '',
    reason: '',
  });

  const selectedHotel = useMemo(
    () => hotels.find((hotel) => String(hotel.hotel_id) === String(hotelId)) || null,
    [hotels, hotelId],
  );

  const lookupStateMeta = useMemo(
    () => (lookupResult ? getReservationStateMeta(lookupResult.reservation_status) : null),
    [lookupResult],
  );

  useEffect(() => {
    if (!hotelId && hotels[0]) {
      setHotelId(String(hotels[0].hotel_id));
    }
  }, [hotels, hotelId]);

  const agentId = authSession?.user?.user_id || authSession?.user?.id || authSession?.user?.sub || null;

  async function loadDesk() {
    if (!hotelId) {
      setFlash({ tone: 'error', text: 'Select a hotel first.' });
      return;
    }

    setLoadingDesk(true);
    try {
      const [arrivalPayload, departurePayload] = await Promise.all([
        apiRequest(`/reservations?hotel_id=${hotelId}&status=CONFIRMED&checkin_date=${deskDate}&limit=100`),
        apiRequest(`/reservations?hotel_id=${hotelId}&status=CHECKED_IN&checkout_date=${deskDate}&limit=100`),
      ]);

      setArrivals(arrivalPayload.data || []);
      setDepartures(departurePayload.data || []);
      setFlash({
        tone: 'success',
        text: `Loaded front desk board for ${selectedHotel?.hotel_name || 'the selected hotel'}.`,
      });
    } catch (error) {
      setArrivals([]);
      setDepartures([]);
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setLoadingDesk(false);
    }
  }

  async function handleLookup(event) {
    event?.preventDefault?.();

    if (!lookupCode.trim()) {
      setFlash({ tone: 'error', text: 'Enter a reservation code.' });
      return;
    }

    setLookupBusy(true);
    try {
      const payload = await apiRequest(`/reservations/${encodeURIComponent(lookupCode.trim())}`);
      setLookupResult(payload.data || payload.reservation || payload);
      setTransferOptions([]);
      setTransferDraft({ reservation_id: '', new_room_id: '', reason: '' });
    } catch (error) {
      setLookupResult(null);
      setTransferOptions([]);
      setTransferDraft({ reservation_id: '', new_room_id: '', reason: '' });
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setLookupBusy(false);
    }
  }

  async function runReservationAction(reservation, action) {
    const busyKey = `${action}-${reservation.reservation_id}`;
    setActionBusy(busyKey);

    try {
      let path = '';
      let body = {};

      if (action === 'checkin') {
        path = `/reservations/${reservation.reservation_id}/checkin`;
        body = { agent_id: agentId };
      } else if (action === 'checkout') {
        path = `/reservations/${reservation.reservation_id}/checkout`;
        body = { agent_id: agentId };
      } else if (action === 'hotel-cancel') {
        const reason = window.prompt('Reason for hotel cancellation:', 'Operational issue');
        if (!reason) {
          setActionBusy('');
          return;
        }
        path = `/reservations/${reservation.reservation_id}/hotel-cancel`;
        body = { agent_id: agentId, reason };
      }

      await apiRequest(path, { method: 'POST', body: JSON.stringify(body) });

      setFlash({
        tone: 'success',
        text:
          action === 'checkin'
            ? `${reservation.reservation_code} checked in.`
            : action === 'checkout'
              ? `${reservation.reservation_code} checked out.`
              : `${reservation.reservation_code} cancelled by hotel.`,
      });

      if (lookupResult?.reservation_id === reservation.reservation_id) {
        await handleLookup({ preventDefault() {} });
      }

      await loadDesk();
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setActionBusy('');
    }
  }

  async function loadTransferOptions(reservation) {
    setTransferBusy(true);
    try {
      const payload = await apiRequest(
        `/rooms/availability?hotel_id=${reservation.hotel_id}&checkin=${reservation.checkin_date.slice(0, 10)}&checkout=${reservation.checkout_date.slice(0, 10)}`,
      );

      const availableRooms = (payload.data || []).filter(
        (room) => String(room.room_id) !== String(reservation.room_id),
      );

      setTransferOptions(availableRooms);
      setTransferDraft({
        reservation_id: reservation.reservation_id,
        new_room_id: availableRooms[0] ? String(availableRooms[0].room_id) : '',
        reason: 'Guest request',
      });

      if (!availableRooms.length) {
        setFlash({
          tone: 'error',
          text: 'No alternate sellable rooms were returned for this stay range.',
        });
      }
    } catch (error) {
      setTransferOptions([]);
      setTransferDraft({ reservation_id: '', new_room_id: '', reason: '' });
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setTransferBusy(false);
    }
  }

  async function submitTransfer() {
    if (!transferDraft.reservation_id || !transferDraft.new_room_id || !transferDraft.reason.trim()) {
      setFlash({ tone: 'error', text: 'Choose a new room and provide a transfer reason.' });
      return;
    }

    setTransferBusy(true);
    try {
      await apiRequest(`/reservations/${transferDraft.reservation_id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          new_room_id: Number(transferDraft.new_room_id),
          reason: transferDraft.reason.trim(),
          agent_id: agentId,
        }),
      });

      setFlash({ tone: 'success', text: 'Room transfer completed.' });

      if (lookupResult) {
        await handleLookup({ preventDefault() {} });
      }

      setTransferOptions([]);
      setTransferDraft({ reservation_id: '', new_room_id: '', reason: '' });
      await loadDesk();
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setTransferBusy(false);
    }
  }

  return (
    <section className="page-card page-card-wide" id="admin-front-desk">
      <div className="admin-section-head">
        <div>
          <p className="page-eyebrow">Front desk</p>
          <h2>Arrivals, departures, and reservation actions</h2>
        </div>
        <span className="admin-status-pill">V1 live</span>
      </div>

      <form className="inventory-toolbar" onSubmit={(event) => { event.preventDefault(); loadDesk(); }}>
        <label>
          Hotel
          <select value={hotelId} onChange={(event) => setHotelId(event.target.value)}>
            <option value="">Select hotel</option>
            {hotels.map((hotel) => (
              <option key={hotel.hotel_id} value={hotel.hotel_id}>
                {hotel.hotel_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Operating date
          <input type="date" value={deskDate} onChange={(event) => setDeskDate(event.target.value)} />
        </label>
        <div className="fd-toolbar-note">
          <strong>{selectedHotel?.hotel_name || 'Choose hotel'}</strong>
          <span>Use this board for arrivals, departures, and exception handling.</span>
        </div>
        <button className="primary-button" type="submit" disabled={loadingDesk}>
          {loadingDesk ? 'Loading desk...' : 'Load front desk'}
        </button>
      </form>

      <div className="fd-grid">
        <section className="fd-column">
          <div className="fd-column-head">
            <h3>Today arrivals</h3>
            <span className="admin-status-pill">{arrivals.length}</span>
          </div>
          {arrivals.length ? (
            arrivals.map((reservation) => (
              <ReservationMiniCard
                key={reservation.reservation_id}
                reservation={reservation}
                actionLabel={actionBusy === `checkin-${reservation.reservation_id}` ? 'Checking in...' : 'Check in'}
                onAction={(row) => runReservationAction(row, 'checkin')}
                secondaryAction={{ label: 'Load transfer', onClick: loadTransferOptions }}
              />
            ))
          ) : (
            <p className="admin-empty">No confirmed arrivals for this hotel and date.</p>
          )}
        </section>

        <section className="fd-column">
          <div className="fd-column-head">
            <h3>Today departures</h3>
            <span className="admin-status-pill">{departures.length}</span>
          </div>
          {departures.length ? (
            departures.map((reservation) => (
              <ReservationMiniCard
                key={reservation.reservation_id}
                reservation={reservation}
                actionLabel={actionBusy === `checkout-${reservation.reservation_id}` ? 'Checking out...' : 'Check out'}
                onAction={(row) => runReservationAction(row, 'checkout')}
                secondaryAction={{ label: 'Hotel cancel', onClick: (row) => runReservationAction(row, 'hotel-cancel') }}
              />
            ))
          ) : (
            <p className="admin-empty">No checked-in departures for this hotel and date.</p>
          )}
        </section>
      </div>

      <section className="fd-lookup-shell">
        <div className="fd-column-head">
          <h3>Reservation lookup</h3>
          <span className="admin-status-pill">By code</span>
        </div>

        <form className="fd-lookup-form" onSubmit={handleLookup}>
          <input
            type="text"
            placeholder="Reservation code"
            value={lookupCode}
            onChange={(event) => setLookupCode(event.target.value)}
          />
          <button type="submit" className="primary-button" disabled={lookupBusy}>
            {lookupBusy ? 'Loading...' : 'Load reservation'}
          </button>
        </form>

        {lookupResult ? (
          <div className="fd-lookup-result">
            <div className="fd-lookup-card">
              <div className="fd-card-head">
                <div>
                  <p className="fd-card-code">{lookupResult.reservation_code}</p>
                  <h3>{lookupResult.guest_name}</h3>
                  <p>
                    {lookupResult.hotel_name} • {formatDate(lookupResult.checkin_date)} →{' '}
                    {formatDate(lookupResult.checkout_date)}
                  </p>
                </div>
                <div className="fd-status-stack">
                  <span className={`inventory-status-pill ${String(lookupResult.reservation_status || '').toLowerCase()}`}>
                    {lookupStateMeta?.label || formatStatus(lookupResult.reservation_status)}
                  </span>
                  <span className="fd-status-note">{lookupStateMeta?.note}</span>
                </div>
              </div>

              <div className="fd-detail-grid">
                <div>
                  <strong>Balance due</strong>
                  <span>{formatMoney(lookupResult.balance_due, lookupResult.currency_code || 'VND')}</span>
                </div>
                <div>
                  <strong>Total paid</strong>
                  <span>{formatMoney(lookupResult.total_paid, lookupResult.currency_code || 'VND')}</span>
                </div>
                <div>
                  <strong>Room subtotal</strong>
                  <span>{formatMoney(lookupResult.room_subtotal, lookupResult.currency_code || 'VND')}</span>
                </div>
                <div>
                  <strong>Service subtotal</strong>
                  <span>{formatMoney(lookupResult.service_subtotal, lookupResult.currency_code || 'VND')}</span>
                </div>
              </div>

              <div className="fd-action-row">
                {lookupResult.reservation_status === 'CONFIRMED' ? (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={actionBusy === `checkin-${lookupResult.reservation_id}`}
                    onClick={() => runReservationAction(lookupResult, 'checkin')}
                  >
                    {actionBusy === `checkin-${lookupResult.reservation_id}` ? 'Checking in...' : 'Check in'}
                  </button>
                ) : null}

                {lookupResult.reservation_status === 'CHECKED_IN' ? (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={actionBusy === `checkout-${lookupResult.reservation_id}`}
                    onClick={() => runReservationAction(lookupResult, 'checkout')}
                  >
                    {actionBusy === `checkout-${lookupResult.reservation_id}` ? 'Checking out...' : 'Check out'}
                  </button>
                ) : null}

                <button
                  type="button"
                  className="ghost-button"
                  disabled={
                    ['CANCELLED', 'CHECKED_OUT', 'NO_SHOW'].includes(lookupResult.reservation_status) ||
                    actionBusy === `hotel-cancel-${lookupResult.reservation_id}`
                  }
                  onClick={() => runReservationAction(lookupResult, 'hotel-cancel')}
                >
                  {actionBusy === `hotel-cancel-${lookupResult.reservation_id}` ? 'Cancelling...' : 'Hotel cancel'}
                </button>

                <button
                  type="button"
                  className="ghost-button"
                  disabled={!['CONFIRMED', 'CHECKED_IN'].includes(lookupResult.reservation_status) || transferBusy}
                  onClick={() => loadTransferOptions(lookupResult)}
                >
                  {transferBusy ? 'Loading rooms...' : 'Transfer room'}
                </button>
              </div>
            </div>

            {transferDraft.reservation_id === lookupResult.reservation_id ? (
              <div className="fd-transfer-box">
                <div className="fd-column-head">
                  <h3>Room transfer</h3>
                  <span className="admin-status-pill">{transferOptions.length} options</span>
                </div>
                <div className="fd-transfer-grid">
                  <label>
                    New room
                    <select
                      value={transferDraft.new_room_id}
                      onChange={(event) => setTransferDraft((current) => ({ ...current, new_room_id: event.target.value }))}
                    >
                      <option value="">Select room</option>
                      {transferOptions.map((room) => (
                        <option key={room.room_id} value={room.room_id}>
                          Room {room.room_number} • {room.room_type_name} •{' '}
                          {formatMoney(room.min_nightly_rate, selectedHotel?.currency_code || 'VND')}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Reason
                    <input
                      type="text"
                      value={transferDraft.reason}
                      onChange={(event) => setTransferDraft((current) => ({ ...current, reason: event.target.value }))}
                      placeholder="Reason for transfer"
                    />
                  </label>
                  <button type="button" className="primary-button" disabled={transferBusy} onClick={submitTransfer}>
                    {transferBusy ? 'Saving transfer...' : 'Confirm transfer'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </section>
  );
}
