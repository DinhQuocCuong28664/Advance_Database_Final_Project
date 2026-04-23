import { useState, useCallback, useRef } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/FlashContext';

// ── Helpers ──────────────────────────────────────────────────────────
const fmtCurrency = (v, cur = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(v ?? 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { dateStyle: 'short' }) : '—';

const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// ── Inline Rate Editor cell ───────────────────────────────────────────
function RateCell({ rate, currency, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const inputRef = useRef(null);

  function startEdit() {
    setVal(String(parseFloat(rate.final_rate)));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 30);
  }

  async function commit() {
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed <= 0) { setEditing(false); return; }
    if (parsed === parseFloat(rate.final_rate)) { setEditing(false); return; }
    await onSave(rate.room_rate_id, parsed, parseFloat(rate.final_rate));
    setEditing(false);
  }

  const pctChange = rate._pendingNew
    ? ((rate._pendingNew - rate.final_rate) / rate.final_rate) * 100
    : 0;

  if (saving) return (
    <span className="rate-cell rate-cell--saving">saving…</span>
  );

  if (editing) return (
    <span className="rate-cell rate-cell--editing">
      <input
        ref={inputRef}
        type="number"
        min="1"
        step="0.01"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        onBlur={commit}
        className="rate-input"
      />
    </span>
  );

  return (
    <span
      className={`rate-cell ${rate.is_override ? 'rate-cell--override' : ''} ${rate.alert_count > 0 ? 'rate-cell--alert' : ''}`}
      onClick={startEdit}
      title="Click to edit"
    >
      {fmtCurrency(rate.final_rate, currency)}
      {rate.alert_count > 0 && <span className="rate-alert-dot" title="Price Guard triggered">⚠️</span>}
    </span>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────────────
function ConfirmModal({ pending, onConfirm, onCancel, saving }) {
  if (!pending) return null;
  const pct = Math.abs((pending.newRate - pending.oldRate) / pending.oldRate * 100).toFixed(1);
  return (
    <div className="pm-overlay" onClick={onCancel}>
      <div className="pm-dialog pm-dialog--light" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: 8 }}>⚠️</div>
        <h3 className="pm-title" style={{ color: '#92400e', textAlign: 'center' }}>Price Guard Warning</h3>
        <p style={{ color: '#555', margin: '12px 0', textAlign: 'center', lineHeight: 1.5 }}>
          This rate change is <strong>{pct}%</strong> — exceeds the 50% threshold.<br />
          <span style={{ fontSize: '0.85rem', color: '#888' }}>
            {pending.roomTypeName} · {fmtDate(pending.rateDate)}
          </span>
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#fef9c3', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <span style={{ color: '#713f12' }}>Old rate</span>
          <strong>{fmtCurrency(pending.oldRate, pending.currency)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: '#dcfce7', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <span style={{ color: '#14532d' }}>New rate</span>
          <strong>{fmtCurrency(pending.newRate, pending.currency)}</strong>
        </div>
        <div className="pm-actions">
          <button className="ghost-button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" onClick={onConfirm} disabled={saving}
            style={{ background: '#d97706' }}>
            {saving ? 'Saving…' : 'Override anyway'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────
export default function AdminRates({ hotels = [] }) {
  const { setFlash } = useFlash();

  // Filters
  const [hotelId,     setHotelId]     = useState('');
  const [dateFrom,    setDateFrom]    = useState(today());
  const [dateTo,      setDateTo]      = useState(inDays(14));
  const [roomTypeFilter, setRoomTypeFilter] = useState('');

  // Data
  const [roomTypes,   setRoomTypes]   = useState([]);  // [{room_type_id, room_type_name, rates:[...]}]
  const [alerts,      setAlerts]      = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [searched,    setSearched]    = useState(false);

  // Edit state
  const [savingId,   setSavingId]    = useState(null);  // room_rate_id being saved
  const [confirmPending, setConfirmPending] = useState(null);
  const [confirmSaving,  setConfirmSaving]  = useState(false);

  // Load rates
  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (hotelId)        qs.set('hotel_id',     hotelId);
      if (dateFrom)       qs.set('date_from',    dateFrom);
      if (dateTo)         qs.set('date_to',      dateTo);
      if (roomTypeFilter) qs.set('room_type_id', roomTypeFilter);

      const [ratesRes, alertsRes] = await Promise.all([
        apiRequest(`/admin/rates?${qs.toString()}`),
        apiRequest('/admin/rates/alerts').catch(() => ({ data: [] })),
      ]);

      setRoomTypes(ratesRes.room_types || []);
      setAlerts(alertsRes.data || []);
      setSearched(true);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [hotelId, dateFrom, dateTo, roomTypeFilter]);

  // Perform save (after optional confirmation)
  async function doSave(rateId, newRate, roomTypeName, rateDate, currency) {
    setSavingId(rateId);
    try {
      const res = await apiRequest(`/admin/rates/${rateId}`, {
        method: 'PUT',
        body: JSON.stringify({ final_rate: newRate, price_source: 'MANUAL_OVERRIDE', updated_by: 'admin' }),
      });
      const msg = res.price_guard_triggered
        ? `⚠️ Rate updated — Price Guard alert triggered (${res.change_percent?.toFixed(1)}% change)`
        : `✅ Rate updated to ${fmtCurrency(newRate, currency)}`;
      setFlash({ tone: res.price_guard_triggered ? 'warning' : 'success', text: msg });
      await loadRates();
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setSavingId(null);
    }
  }

  // Called by RateCell — check if change > 50% before saving
  async function handleSave(rateId, newRate, oldRate) {
    const pct = Math.abs((newRate - oldRate) / oldRate * 100);
    // Find context for confirm modal
    let found = null;
    for (const rt of roomTypes) {
      const r = rt.rates.find(x => x.room_rate_id === rateId);
      if (r) { found = { rt, r }; break; }
    }

    if (pct > 50 && found) {
      setConfirmPending({
        rateId, newRate, oldRate,
        roomTypeName: found.rt.room_type_name,
        rateDate: found.r.rate_date,
        currency: found.rt.currency_code,
      });
      return;
    }
    // Small change → save directly
    await doSave(rateId, newRate, found?.rt?.room_type_name, found?.r?.rate_date, found?.rt?.currency_code);
  }

  async function handleConfirmOverride() {
    if (!confirmPending) return;
    setConfirmSaving(true);
    await doSave(
      confirmPending.rateId, confirmPending.newRate,
      confirmPending.roomTypeName, confirmPending.rateDate, confirmPending.currency
    );
    setConfirmSaving(false);
    setConfirmPending(null);
  }

  // Derive unique room types for filter dropdown
  const allRoomTypes = roomTypes.length > 0
    ? roomTypes
    : [];

  const currency = roomTypes[0]?.currency_code || 'USD';

  return (
    <section className="page-card page-card-wide" id="admin-rates">
      <div className="admin-section-header" style={{ marginBottom: 24 }}>
        <div>
          <p className="page-eyebrow">Revenue Management</p>
          <h2 className="page-title">Rate Management</h2>
          <p className="page-sub">View and adjust nightly rates by room type and date. Changes &gt;50% trigger Price Guard alerts.</p>
        </div>
        {alerts.length > 0 && (
          <span className="rate-alerts-pill">⚠️ {alerts.length} Price Guard alert{alerts.length > 1 ? 's' : ''}</span>
        )}
      </div>

      {/* ── Alerts Panel ── */}
      {alerts.length > 0 && (
        <div className="rate-alerts-panel">
          <p className="rate-alerts-title">🚨 Price Guard Alerts</p>
          <div className="rate-alerts-list">
            {alerts.slice(0, 5).map(a => (
              <div key={a.log_id} className="rate-alert-row">
                <span className="rate-alert-hotel">{a.hotel_name}</span>
                <span className="rate-alert-type">{a.room_type_name}</span>
                <span className="rate-alert-date">{fmtDate(a.rate_date)}</span>
                <span className="rate-alert-change">
                  {fmtCurrency(a.old_rate, currency)} → {fmtCurrency(a.new_rate, currency)}
                  <em> ({a.change_percent?.toFixed(1)}%)</em>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filter Toolbar ── */}
      <div className="pay-hist-toolbar">
        <select value={hotelId} onChange={e => setHotelId(e.target.value)} className="fd-select">
          <option value="">All hotels</option>
          {hotels.map(h => (
            <option key={h.hotel_id} value={h.hotel_id}>{h.hotel_name}</option>
          ))}
        </select>

        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="fd-input" title="From" />
        <span style={{ color: 'var(--text-soft)', alignSelf: 'center' }}>→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="fd-input" title="To" />

        {allRoomTypes.length > 0 && (
          <select value={roomTypeFilter} onChange={e => setRoomTypeFilter(e.target.value)} className="fd-select">
            <option value="">All room types</option>
            {allRoomTypes.map(rt => (
              <option key={rt.room_type_id} value={rt.room_type_id}>{rt.room_type_name}</option>
            ))}
          </select>
        )}

        <button className="primary-button" onClick={loadRates} disabled={loading} style={{ whiteSpace: 'nowrap' }}>
          {loading ? 'Loading…' : '🔍 Load Rates'}
        </button>
      </div>

      {/* ── States ── */}
      {loading && <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-soft)' }}>Loading rates…</p>}

      {!loading && !searched && (
        <div className="svc-orders-empty">
          <span style={{ fontSize: '2rem' }}>📅</span>
          <p>Select a hotel and date range, then click <strong>Load Rates</strong>.</p>
        </div>
      )}

      {!loading && searched && roomTypes.length === 0 && (
        <div className="svc-orders-empty">
          <span style={{ fontSize: '2rem' }}>📭</span>
          <p>No rate records found for the selected filters.</p>
        </div>
      )}

      {/* ── Rate Grid (one table per room type) ── */}
      {!loading && roomTypes.map(rt => (
        <div key={rt.room_type_id} className="rate-type-block">
          <div className="rate-type-header">
            <h3 className="rate-type-name">🛏 {rt.room_type_name}</h3>
            <span className="rate-type-meta">{rt.hotel_name} · {rt.rates.length} days · {rt.currency_code}</span>
          </div>

          <div className="rate-grid-wrap">
            <table className="rate-grid-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Base Rate</th>
                  <th>Final Rate <em style={{ fontWeight: 400, fontSize: '0.7rem' }}>(click to edit)</em></th>
                  <th>Override?</th>
                  <th>Source</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rt.rates.map(r => (
                  <tr key={r.room_rate_id} className={`rate-grid-row ${r.alert_count > 0 ? 'rate-grid-row--alert' : ''}`}>
                    <td className="rate-date-cell">{fmtDate(r.rate_date)}</td>
                    <td className="rate-base-cell">{fmtCurrency(r.base_rate, rt.currency_code)}</td>
                    <td>
                      <RateCell
                        rate={r}
                        currency={rt.currency_code}
                        onSave={handleSave}
                        saving={savingId === r.room_rate_id}
                      />
                    </td>
                    <td>
                      {r.is_override
                        ? <span className="rate-badge rate-badge--override">Override</span>
                        : <span className="rate-badge rate-badge--auto">Auto</span>}
                    </td>
                    <td className="rate-source-cell">{r.price_source || '—'}</td>
                    <td className="rate-updated-cell">{fmtDate(r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* ── Price Guard Confirm Modal ── */}
      <ConfirmModal
        pending={confirmPending}
        onConfirm={handleConfirmOverride}
        onCancel={() => setConfirmPending(null)}
        saving={confirmSaving}
      />
    </section>
  );
}
