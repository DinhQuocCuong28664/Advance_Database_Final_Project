import { useCallback, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/useFlash';

const STATUS_CONFIG = {
  PENDING:     { color: 'var(--timeline-pending)', bg: 'var(--timeline-pending-bg)', icon: '⏳', label: 'Pending' },
  CONFIRMED:   { color: 'var(--timeline-confirmed)', bg: 'var(--timeline-confirmed-bg)', icon: '✅', label: 'Confirmed' },
  CHECKED_IN:  { color: 'var(--timeline-checkedin)', bg: 'var(--timeline-checkedin-bg)', icon: '🏨', label: 'Checked In' },
  CHECKED_OUT: { color: 'var(--timeline-checkedout)', bg: 'var(--timeline-checkedout-bg)', icon: '👋', label: 'Checked Out' },
  CANCELLED:   { color: 'var(--timeline-cancelled)', bg: 'var(--timeline-cancelled-bg)', icon: '❌', label: 'Cancelled' },
  NO_SHOW:     { color: 'var(--timeline-noshow)', bg: 'var(--timeline-noshow-bg)', icon: '👻', label: 'No Show' },
  TRANSFERRED: { color: 'var(--timeline-transferred)', bg: 'var(--timeline-transferred-bg)', icon: '🔄', label: 'Transferred' },
};

const EVENT_CONFIG = {
  BOOKED:      { label: 'Booked',      icon: '✅', color: 'var(--timeline-booked)', bg: 'var(--timeline-booked-bg)' },
  CANCELLED:   { label: 'Cancelled',   icon: '❌', color: 'var(--timeline-cancelled)', bg: 'var(--timeline-cancelled-bg)' },
  CHECKED_IN:  { label: 'Checked in',  icon: '🏨', color: 'var(--timeline-checkedin)', bg: 'var(--timeline-checkedin-bg)' },
  CHECKED_OUT: { label: 'Checked out', icon: '👋', color: 'var(--timeline-checkedout)', bg: 'var(--timeline-checkedout-bg)' },
};

const getStatusCfg = (status) => STATUS_CONFIG[status] || { color: 'var(--channel-default-color)', bg: 'var(--channel-default-bg)', icon: '•', label: status };
const getEventCfg = (type) => EVENT_CONFIG[type] || { color: 'var(--channel-default-color)', bg: 'var(--channel-default-bg)', icon: '•', label: type };

const fmtDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '';

const fmtDate = (value) =>
  value ? new Date(value).toLocaleDateString('en-GB', { dateStyle: 'short' }) : '';

function TimelineItem({ row, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const fromCfg = getStatusCfg(row.old_status);
  const toCfg = getStatusCfg(row.new_status);

  return (
    <div className={`tl-item ${isLast ? 'tl-item--last' : ''}`}>
      <div className="tl-dot" style={{ background: toCfg.color, boxShadow: `0 0 0 4px ${toCfg.bg}` }}>
        {toCfg.icon}
      </div>
      <div className="tl-card" onClick={() => setExpanded((value) => !value)}>
        <div className="tl-card-head">
          <div className="tl-transition">
            {row.old_status ? (
              <>
                <span className="tl-status-pill" style={{ background: fromCfg.bg, color: fromCfg.color }}>
                  {fromCfg.label}
                </span>
                <span className="tl-arrow">→</span>
              </>
            ) : (
              <span className="tl-status-pill" style={{ background: 'var(--channel-walkin-bg)', color: 'var(--pay-failed-color)' }}>
                Created
              </span>
            )}
            <span className="tl-status-pill tl-status-pill--to" style={{ background: toCfg.bg, color: toCfg.color }}>
              {toCfg.label}
            </span>
          </div>
          <div className="tl-meta">
            <span className="tl-time">{fmtDateTime(row.changed_at)}</span>
            {row.agent_name ? <span className="tl-agent">by {row.agent_name}</span> : null}
          </div>
        </div>

        <div className="tl-card-body">
          <code className="tl-code">{row.reservation_code}</code>
          <span className="tl-guest">{row.guest_name}</span>
          {row.hotel_name ? <span className="tl-hotel"> {row.hotel_name}</span> : null}
          {row.room_number ? <span className="tl-room">Rm {row.room_number}</span> : null}
        </div>

        {row.change_reason ? <p className="tl-reason">"{row.change_reason}"</p> : null}

        {expanded ? (
          <div className="tl-details">
            <div className="tl-detail-row"><span>Reservation ID</span><span>#{row.reservation_id}</span></div>
            <div className="tl-detail-row"><span>Check-in - Check-out</span><span>{fmtDate(row.checkin_date)} - {fmtDate(row.checkout_date)}</span></div>
            <div className="tl-detail-row"><span>Guest email</span><span>{row.guest_email}</span></div>
            {row.agent_name ? <div className="tl-detail-row"><span>Agent</span><span>{row.agent_name} ({row.role_code})</span></div> : null}
          </div>
        ) : null}

        <button className="tl-expand-btn" onClick={(event) => { event.stopPropagation(); setExpanded((value) => !value); }}>
          {expanded ? '^ Less' : 'v More'}
        </button>
      </div>
    </div>
  );
}

function OperationRow({ row }) {
  const cfg = getEventCfg(row.event_type);
  return (
    <article className="inv-list-row">
      <div className="inv-list-left">
        <span className="tl-status-pill" style={{ background: cfg.bg, color: cfg.color }}>
          {cfg.icon} {cfg.label}
        </span>
        <code className="inv-no">{row.reservation_code}</code>
        <strong>{row.guest_name}</strong>
        <span>
          {row.hotel_name}
          {row.room_number ? ` · Room ${row.room_number}` : ''}
        </span>
        <span>{row.event_note || 'No note'}</span>
      </div>
      <div className="inv-list-right">
        <strong>{fmtDateTime(row.event_at)}</strong>
        <span>{fmtDate(row.checkin_date)} - {fmtDate(row.checkout_date)}</span>
        {row.agent_name ? <span>by {row.agent_name}</span> : null}
      </div>
    </article>
  );
}

function SummaryPills({ summary }) {
  const entries = Object.entries(summary || {});
  if (!entries.length) return null;
  return (
    <div className="tl-stats">
      {entries.map(([key, count]) => {
        const cfg = getEventCfg(key);
        return (
          <div key={key} className="tl-stat-pill" style={{ borderColor: `${cfg.color}55`, background: cfg.bg }}>
            <span className="tl-stat-label" style={{ color: cfg.color }}>{cfg.icon} {cfg.label}</span>
            <span className="tl-stat-count" style={{ color: cfg.color }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminTimeline({ hotels = [] }) {
  const { setFlash } = useFlash();

  const [mode, setMode] = useState('operations');
  const [hotelId, setHotelId] = useState('');
  const [eventType, setEventType] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [resvCode, setResvCode] = useState('');

  const [operations, setOperations] = useState([]);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const loadOperations = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (hotelId) qs.set('hotel_id', hotelId);
      if (eventType) qs.set('event_type', eventType);
      if (dateFrom) qs.set('date_from', dateFrom);
      if (dateTo) qs.set('date_to', dateTo);
      if (resvCode.trim()) qs.set('reservation_code', resvCode.trim());
      qs.set('limit', '200');

      const res = await apiRequest(`/admin/operations-log?${qs.toString()}`);
      setOperations(res.data || []);
      setSummary(res.summary?.by_event_type || null);
      setSearched(true);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, eventType, hotelId, resvCode, setFlash]);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (hotelId) qs.set('hotel_id', hotelId);
      if (newStatus) qs.set('new_status', newStatus);
      if (dateFrom) qs.set('date_from', dateFrom);
      if (dateTo) qs.set('date_to', dateTo);
      qs.set('limit', '150');

      const res = await apiRequest(`/admin/history?${qs.toString()}`);
      let rows = res.data || [];
      if (resvCode.trim()) {
        const query = resvCode.trim().toUpperCase();
        rows = rows.filter((row) => row.reservation_code?.toUpperCase().includes(query));
      }
      setHistory(rows);
      setSummary(res.summary?.by_transition || null);
      setSearched(true);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, hotelId, newStatus, resvCode, setFlash]);

  const load = mode === 'operations' ? loadOperations : loadAudit;

  const groupedAudit = useMemo(() => history.reduce((acc, row) => {
    const date = row.changed_at ? new Date(row.changed_at).toDateString() : 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(row);
    return acc;
  }, {}), [history]);

  return (
    <section className="page-card page-card-wide" id="admin-timeline">
      <div className="admin-section-header" style={{ marginBottom: 24 }}>
        <div>
          <p className="page-eyebrow">Hotel history</p>
          <h2 className="page-title">Reservation Operations Log</h2>
          <p className="page-sub">
            Track successful bookings, cancellations, check-ins, and check-outs by hotel.
          </p>
        </div>
      </div>

      <div className="report-tab-bar" style={{ marginBottom: 16 }}>
        <button type="button" className={`report-tab-btn${mode === 'operations' ? ' active' : ''}`} onClick={() => { setMode('operations'); setSearched(false); }}>
          Operations log
        </button>
        <button type="button" className={`report-tab-btn${mode === 'audit' ? ' active' : ''}`} onClick={() => { setMode('audit'); setSearched(false); }}>
          Full audit timeline
        </button>
      </div>

      <div className="pay-hist-toolbar">
        <select value={hotelId} onChange={(event) => setHotelId(event.target.value)} className="fd-select">
          <option value="">All hotels</option>
          {hotels.map((hotel) => (
            <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>
          ))}
        </select>

        {mode === 'operations' ? (
          <select value={eventType} onChange={(event) => setEventType(event.target.value)} className="fd-select">
            <option value="">All operation types</option>
            {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        ) : (
          <select value={newStatus} onChange={(event) => setNewStatus(event.target.value)} className="fd-select">
            <option value="">All transitions</option>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
        )}

        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="fd-input" title="From" />
        <span style={{ color: 'var(--text-soft)', alignSelf: 'center' }}>→</span>
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="fd-input" title="To" />
        <input type="text" value={resvCode} onChange={(event) => setResvCode(event.target.value)} placeholder="Reservation code..." className="fd-input" style={{ minWidth: 160 }} />

        <button className="primary-button" onClick={load} disabled={loading} style={{ whiteSpace: 'nowrap' }}>
          {loading ? 'Loading...' : 'Search'}
        </button>
      </div>

      {searched ? <SummaryPills summary={summary} /> : null}

      {loading ? <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-soft)' }}>Loading history...</p> : null}

      {!loading && !searched ? (
        <div className="svc-orders-empty">
          <span style={{ fontSize: '2.5rem' }}>🕒</span>
          <p>Set filters and click <strong>Search</strong> to view hotel operations history.</p>
        </div>
      ) : null}

      {!loading && searched && mode === 'operations' && operations.length === 0 ? (
        <div className="svc-orders-empty">
          <span style={{ fontSize: '2.5rem' }}>📭</span>
          <p>No reservation operations found for the selected filters.</p>
        </div>
      ) : null}

      {!loading && searched && mode === 'operations' && operations.length > 0 ? (
        <div className="inv-list">
          {operations.map((row) => (
            <OperationRow key={`${row.event_type}-${row.reservation_id}-${row.event_at}`} row={row} />
          ))}
        </div>
      ) : null}

      {!loading && searched && mode === 'audit' && history.length === 0 ? (
        <div className="svc-orders-empty">
          <span style={{ fontSize: '2.5rem' }}>📭</span>
          <p>No status changes found for the selected filters.</p>
        </div>
      ) : null}

      {!loading && mode === 'audit' ? Object.entries(groupedAudit).map(([date, rows]) => (
        <div key={date} className="tl-day-group">
          <div className="tl-day-header">
            <span className="tl-day-label">{date}</span>
            <span className="tl-day-count">{rows.length} event{rows.length > 1 ? 's' : ''}</span>
          </div>
          <div className="tl-spine">
            {rows.map((row, index) => (
              <TimelineItem key={row.history_id} row={row} isLast={index === rows.length - 1} />
            ))}
          </div>
        </div>
      )) : null}
    </section>
  );
}
