import { useState, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/useFlash';

//  Status config 
const STATUS_CONFIG = {
  PENDING:     { color: '#d97706', bg: '#fef3c7', icon: '⏳', label: 'Pending' },
  CONFIRMED:   { color: '#1a7a8a', bg: '#e0f2fe', icon: '✅', label: 'Confirmed' },
  CHECKED_IN:  { color: '#0e7a53', bg: '#dcfce7', icon: '🏨', label: 'Checked In' },
  CHECKED_OUT: { color: '#5a4fcf', bg: '#ede9fe', icon: '👋', label: 'Checked Out' },
  CANCELLED:   { color: '#dc2626', bg: '#fee2e2', icon: '❌', label: 'Cancelled' },
  NO_SHOW:     { color: '#6b7280', bg: '#f3f4f6', icon: '👻', label: 'No Show' },
  TRANSFERRED: { color: '#0f2830', bg: '#e8f0f2', icon: '🔄', label: 'Transferred' },
};

// Transition arrow color: based on new_status
const getStatusCfg = (s) => STATUS_CONFIG[s] || { color: '#888', bg: '#f5f5f5', icon: '•', label: s };

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { dateStyle: 'short' }) : '';

//  Timeline item 
function TimelineItem({ row, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const fromCfg = getStatusCfg(row.old_status);
  const toCfg   = getStatusCfg(row.new_status);

  return (
    <div className={`tl-item ${isLast ? 'tl-item--last' : ''}`}>
      {/* Spine dot */}
      <div className="tl-dot" style={{ background: toCfg.color, boxShadow: `0 0 0 4px ${toCfg.bg}` }}>
        {toCfg.icon}
      </div>
      {/* Card */}
      <div className="tl-card" onClick={() => setExpanded(e => !e)}>
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
              <span className="tl-status-pill" style={{ background: '#f1f5f9', color: '#64748b' }}>
                Created
              </span>
            )}
            <span className="tl-status-pill tl-status-pill--to" style={{ background: toCfg.bg, color: toCfg.color }}>
              {toCfg.label}
            </span>
          </div>
          <div className="tl-meta">
            <span className="tl-time">{fmtDateTime(row.changed_at)}</span>
            {row.agent_name && <span className="tl-agent">by {row.agent_name}</span>}
          </div>
        </div>

        <div className="tl-card-body">
          <code className="tl-code">{row.reservation_code}</code>
          <span className="tl-guest">{row.guest_name}</span>
          {row.hotel_name && <span className="tl-hotel"> {row.hotel_name}</span>}
          {row.room_number && <span className="tl-room">Rm {row.room_number}</span>}
        </div>

        {row.change_reason && (
          <p className="tl-reason">"{row.change_reason}"</p>
        )}

        {expanded && (
          <div className="tl-details">
            <div className="tl-detail-row">
              <span>Reservation ID</span><span>#{row.reservation_id}</span>
            </div>
            <div className="tl-detail-row">
              <span>Check-in - Check-out</span>
              <span>{fmtDate(row.checkin_date)} - {fmtDate(row.checkout_date)}</span>
            </div>
            <div className="tl-detail-row">
              <span>Guest email</span><span>{row.guest_email}</span>
            </div>
            {row.agent_name && (
              <div className="tl-detail-row">
                <span>Agent</span><span>{row.agent_name} ({row.role_code})</span>
              </div>
            )}
          </div>
        )}

        <button className="tl-expand-btn" onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}>
          {expanded ? '^ Less' : 'v More'}
        </button>
      </div>
    </div>
  );
}

//  Transition Summary Stats 
function TransitionStats({ summary }) {
  if (!summary?.by_transition) return null;
  const entries = Object.entries(summary.by_transition).sort((a, b) => b[1] - a[1]);
  return (
    <div className="tl-stats">
      {entries.map(([key, count]) => {
        const [, to] = key.split(' -> ');
        const cfg = getStatusCfg(to);
        return (
          <div key={key} className="tl-stat-pill" style={{ borderColor: cfg.color + '55', background: cfg.bg }}>
            <span className="tl-stat-label" style={{ color: cfg.color }}>{key}</span>
            <span className="tl-stat-count" style={{ color: cfg.color }}>{count}</span>
          </div>
        );
      })}
    </div>
  );
}

//  Main Component 
export default function AdminTimeline({ hotels = [] }) {
  const { setFlash } = useFlash();

  // Filters
  const [hotelId,   setHotelId]   = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');
  const [resvCode,  setResvCode]  = useState('');

  // Data
  const [history,   setHistory]   = useState([]);
  const [summary,   setSummary]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [searched,  setSearched]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (hotelId)   qs.set('hotel_id',  hotelId);
      if (newStatus) qs.set('new_status', newStatus);
      if (dateFrom)  qs.set('date_from',  dateFrom);
      if (dateTo)    qs.set('date_to',    dateTo);
      qs.set('limit', '150');

      const res = await apiRequest(`/admin/history?${qs.toString()}`);

      let rows = res.data || [];
      // Client-side filter by reservation code if entered
      if (resvCode.trim()) {
        const q = resvCode.trim().toUpperCase();
        rows = rows.filter(r => r.reservation_code?.toUpperCase().includes(q));
      }

      setHistory(rows);
      setSummary(res.summary || null);
      setSearched(true);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [hotelId, newStatus, dateFrom, dateTo, resvCode, setFlash]);

  // Group by date for section headers
  const grouped = history.reduce((acc, row) => {
    const date = row.changed_at ? new Date(row.changed_at).toDateString() : 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(row);
    return acc;
  }, {});

  return (
    <section className="page-card page-card-wide" id="admin-timeline">
      <div className="admin-section-header" style={{ marginBottom: 24 }}>
        <div>
          <p className="page-eyebrow">Audit</p>
          <h2 className="page-title">Reservation Status Timeline</h2>
          <p className="page-sub">
            Full audit trail of all status transitions  PENDING  CONFIRMED  CHECKED_IN  CHECKED_OUT.
            {' '}<strong>{history.length || ''}</strong>
          </p>
        </div>
      </div>

      {/*  Filters  */}
      <div className="pay-hist-toolbar">
        <select value={hotelId} onChange={e => setHotelId(e.target.value)} className="fd-select">
          <option value="">All hotels</option>
          {hotels.map(h => (
            <option key={h.hotel_id} value={h.hotel_id}>{h.hotel_name}</option>
          ))}
        </select>

        <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="fd-select">
          <option value="">All transitions</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}> {v.label}</option>
          ))}
        </select>

        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="fd-input" title="From" />
        <span style={{ color: 'var(--text-soft)', alignSelf: 'center' }}></span>
        <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   className="fd-input" title="To" />

        <input
          type="text" value={resvCode}
          onChange={e => setResvCode(e.target.value)}
          placeholder="Reservation code..."
          className="fd-input" style={{ minWidth: 160 }}
        />

        <button className="primary-button" onClick={load} disabled={loading} style={{ whiteSpace: 'nowrap' }}>
          {loading ? 'Loading...' : ' Search'}
        </button>
      </div>

      {/*  Transition stats  */}
      {searched && summary && <TransitionStats summary={summary} />}

      {/*  States  */}
      {loading && <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-soft)' }}>Loading history...</p>}
      {!loading && !searched && (
        <div className="svc-orders-empty">
          <span style={{ fontSize: '2.5rem' }}></span>
          <p>Set filters and click <strong>Search</strong> to view the audit timeline.</p>
        </div>
      )}
      {!loading && searched && history.length === 0 && (
        <div className="svc-orders-empty">
          <span style={{ fontSize: '2.5rem' }}></span>
          <p>No status changes found for the selected filters.</p>
        </div>
      )}

      {/*  Timeline  */}
      {!loading && Object.entries(grouped).map(([date, rows]) => (
        <div key={date} className="tl-day-group">
          <div className="tl-day-header">
            <span className="tl-day-label">{date}</span>
            <span className="tl-day-count">{rows.length} event{rows.length > 1 ? 's' : ''}</span>
          </div>
          <div className="tl-spine">
            {rows.map((row, i) => (
              <TimelineItem key={row.history_id} row={row} isLast={i === rows.length - 1} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
