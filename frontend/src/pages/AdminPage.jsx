import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/FlashContext';
import { useAppData } from '../context/AppDataContext';
import { useReservation } from '../hooks/useReservation';
import { useAdmin } from '../hooks/useAdmin';
import MetricCard from '../components/ui/MetricCard';
import { ADMIN_NAV_ITEMS } from '../constants';
import { API_BASE_URL } from '../lib/api';
import { money, when } from '../utils/formatters';

export default function AdminPage() {
  const navigate = useNavigate();
  const { isSystemUser, logout, alerts } = useAuth();
  const { flash, setFlash } = useFlash();
  const { hotels } = useAppData();

  const {
    reservationCode, setReservationCode,
    reservationBusy, reservationActionBusy,
    reservationData,
    invoiceDetail, invoiceBusy,
    handleReservationLookup,
    runReservationAction,
    handleInvoiceIssue,
  } = useReservation();

  const {
    adminTab, setAdminTab,
    opsSearch, setOpsSearch,
    opsBusy, opsRecordBusy, opsRooms,
    feedsBusy,
    housekeeping, maintenance, revenue,
    handleOpsSearch, handleOpsFeeds,
    updateAvailability,
  } = useAdmin();

  // Guard: only system users can access admin
  if (!isSystemUser) {
    return <Navigate to="/" replace />;
  }

  function handleLogout() {
    logout();
    setFlash({ tone: 'success', text: 'Signed out.' });
    navigate('/');
  }

  return (
    <div className="app-shell admin-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      {/* ── Admin Hero ──────────────────────────────── */}
      <header className="hero-band admin-hero">
        <div className="hero-copy">
          <p className="eyebrow">Admin Portal</p>
          <h1>LuxeReserve Management Console</h1>
          <p className="lede">
            Separate management workspace for front desk, inventory locking, operations feeds, and revenue reporting.
          </p>
          <div className="hero-meta">
            <span>API base: {API_BASE_URL}</span>
            <span>Backend default: http://localhost:3000/api</span>
          </div>
        </div>
        <aside className="hero-panel">
          <MetricCard label="Alerts" value={alerts.length} accent="copper" />
          <MetricCard label="Housekeeping" value={housekeeping.length} accent="teal" />
          <MetricCard label="Maintenance" value={maintenance.length} accent="gold" />
          <button className="ghost-button admin-signout" type="button" onClick={handleLogout}>Sign Out</button>
        </aside>
      </header>

      {/* ── Admin Navigation ────────────────────────── */}
      <nav className="view-tabs">
        {ADMIN_NAV_ITEMS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={value === adminTab ? 'tab-button active' : 'tab-button'}
            onClick={() => setAdminTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {flash ? <div className={`message-strip ${flash.tone}`}>{flash.text}</div> : null}

      <main className="content-grid">
        {/* ── Front Desk Tab ──────────────────────── */}
        {adminTab === 'desk' ? (
          <>
            <section className="panel panel-span-2">
              <p className="section-kicker">Front desk</p>
              <h2>Reservation control</h2>
              <form className="lookup-row" onSubmit={handleReservationLookup}>
                <input
                  type="text"
                  placeholder="RES-20260413-ABC123"
                  value={reservationCode}
                  onChange={(event) => setReservationCode(event.target.value)}
                />
                <button className="primary-button" type="submit" disabled={reservationBusy}>
                  {reservationBusy ? 'Loading...' : 'Load Reservation'}
                </button>
              </form>
              {reservationData ? (
                <>
                  <div className="reservation-profile">
                    <div><span>Status</span><strong>{reservationData.reservation_status}</strong></div>
                    <div><span>Guest</span><strong>{reservationData.guest_name}</strong></div>
                    <div><span>Stay</span><strong>{when(reservationData.checkin_date)} - {when(reservationData.checkout_date)}</strong></div>
                    <div><span>Balance due</span><strong>{money(reservationData.balance_due, reservationData.currency_code)}</strong></div>
                  </div>
                  <div className="action-row">
                    <button className="ghost-button" type="button" disabled={reservationActionBusy} onClick={() => runReservationAction('checkin')}>
                      {reservationActionBusy === 'checkin' ? 'Working...' : 'Check In'}
                    </button>
                    <button className="ghost-button" type="button" disabled={reservationActionBusy} onClick={() => runReservationAction('checkout')}>
                      {reservationActionBusy === 'checkout' ? 'Working...' : 'Check Out'}
                    </button>
                    <button className="ghost-button warning" type="button" disabled={reservationActionBusy} onClick={() => runReservationAction('hotelCancel')}>
                      {reservationActionBusy === 'hotelCancel' ? 'Working...' : 'Hotel Cancel'}
                    </button>
                  </div>
                </>
              ) : <p className="muted-copy">Load a reservation code to manage the stay lifecycle.</p>}
            </section>

            <section className="panel">
              <p className="section-kicker">Invoice</p>
              <h2>Issuance</h2>
              {invoiceDetail ? (
                <div className="compact-list">
                  <div className="compact-item">
                    <strong>{invoiceDetail.invoice_no}</strong>
                    <span>{invoiceDetail.status}</span>
                    <span>{money(invoiceDetail.total_amount, invoiceDetail.currency_code)}</span>
                  </div>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={invoiceDetail.status !== 'DRAFT' || invoiceBusy === 'issue'}
                    onClick={handleInvoiceIssue}
                  >
                    {invoiceBusy === 'issue' ? 'Issuing...' : 'Issue Invoice'}
                  </button>
                </div>
              ) : <p className="muted-copy">Invoice data appears here after a reservation lookup loads an invoice.</p>}
            </section>

            <section className="panel">
              <p className="section-kicker">Rate alerts</p>
              <h2>Latest trigger logs</h2>
              <div className="compact-list">
                {alerts.slice(0, 6).map((alert) => (
                  <div key={alert.log_id || `${alert.room_rate_id}-${alert.triggered_at}`} className="compact-item">
                    <strong>{alert.hotel_name}</strong>
                    <span>{alert.room_type_name}</span>
                    <span>{when(alert.triggered_at)}</span>
                  </div>
                ))}
                {!alerts.length ? <p className="muted-copy">No rate alerts returned.</p> : null}
              </div>
            </section>
          </>
        ) : null}

        {/* ── Inventory Tab ──────────────────────── */}
        {adminTab === 'inventory' ? (
          <section className="panel panel-span-3">
            <p className="section-kicker">Inventory</p>
            <h2>Optimistic locking control surface</h2>
            <form className="form-grid" onSubmit={handleOpsSearch}>
              <label>
                Hotel
                <select value={opsSearch.hotelId} onChange={(event) => setOpsSearch((current) => ({ ...current, hotelId: event.target.value }))}>
                  {hotels.map((hotel) => <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>)}
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
              <button className="primary-button" type="submit" disabled={opsBusy}>
                {opsBusy ? 'Refreshing...' : 'Load Inventory Records'}
              </button>
            </form>
            <div className="inventory-grid">
              {opsRooms.flatMap((room) =>
                (room.availability_records || []).map((record) => (
                  <article key={record.availability_id} className="inventory-card">
                    <div className="inventory-card-head">
                      <strong>Room {room.room_number} | {room.room_type_name}</strong>
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
                ))
              )}
              {!opsRooms.length ? <p className="muted-copy">Search inventory to expose availability records and version numbers.</p> : null}
            </div>
          </section>
        ) : null}

        {/* ── Operations Tab ─────────────────────── */}
        {adminTab === 'operations' ? (
          <section className="panel panel-span-3">
            <div className="panel-header-inline">
              <div>
                <p className="section-kicker">Operations</p>
                <h2>Housekeeping and maintenance</h2>
              </div>
              <button className="ghost-button" type="button" onClick={handleOpsFeeds} disabled={feedsBusy}>
                {feedsBusy ? 'Loading...' : 'Refresh Feeds'}
              </button>
            </div>
            <div className="ops-columns">
              <div>
                <h3>Housekeeping</h3>
                <div className="compact-list">
                  {housekeeping.slice(0, 12).map((task) => (
                    <div key={task.hk_task_id} className="compact-item">
                      <strong>Room {task.room_number}</strong>
                      <span>{task.task_type}</span>
                      <span>{task.task_status}</span>
                    </div>
                  ))}
                  {!housekeeping.length ? <p className="muted-copy">No housekeeping feed loaded.</p> : null}
                </div>
              </div>
              <div>
                <h3>Maintenance</h3>
                <div className="compact-list">
                  {maintenance.slice(0, 12).map((ticket) => (
                    <div key={ticket.maintenance_ticket_id} className="compact-item">
                      <strong>{ticket.issue_category}</strong>
                      <span>{ticket.room_number ? `Room ${ticket.room_number}` : 'Hotel-level ticket'}</span>
                      <span>{ticket.status}</span>
                    </div>
                  ))}
                  {!maintenance.length ? <p className="muted-copy">No maintenance feed loaded.</p> : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Reports Tab ────────────────────────── */}
        {adminTab === 'reports' ? (
          <section className="panel panel-span-3">
            <p className="section-kicker">Reports</p>
            <h2>Revenue snapshot</h2>
            <div className="compact-list">
              {revenue.slice(0, 12).map((row, index) => (
                <div key={`${row.hotel_name}-${row.year}-${row.quarter}-${index}`} className="compact-item">
                  <strong>{row.hotel_name}</strong>
                  <span>Q{row.quarter} {row.year}</span>
                  <span>{money(row.total_revenue, 'VND')}</span>
                </div>
              ))}
              {!revenue.length ? <p className="muted-copy">Open Ops Feeds or Reports after refreshing data.</p> : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
