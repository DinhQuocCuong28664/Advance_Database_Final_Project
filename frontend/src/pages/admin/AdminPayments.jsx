import { useState, useCallback } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/useFlash';

//  Helpers 
const fmtCurrency = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount ?? 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '';

const TYPE_LABELS = {
  FULL_PAYMENT:    { label: 'Full Payment',   color: '#0e7a53' },
  DEPOSIT:         { label: 'Deposit',         color: '#1a7a8a' },
  PREPAYMENT:      { label: 'Prepayment',      color: '#5a4fcf' },
  INCIDENTAL_HOLD: { label: 'Incidental',      color: '#d97706' },
  REFUND:          { label: 'Refund',           color: '#dc2626' },
};
const METHOD_LABELS = {
  CASH:          '💵 Cash',
  CREDIT_CARD:   '💳 Card',
  BANK_TRANSFER: '🏦 Bank',
  VNPAY:         '🌐 VNPay',
};
const STATUS_COLORS = {
  CAPTURED:   { bg: '#dcfce7', color: '#14532d' },
  AUTHORIZED: { bg: '#fef9c3', color: '#713f12' },
  REFUNDED:   { bg: '#fee2e2', color: '#991b1b' },
  FAILED:     { bg: '#f3f4f6', color: '#6b7280' },
};

//  Component 
export default function AdminPayments({ hotels = [] }) {
  const { setFlash } = useFlash();

  // Filters
  const [hotelId,    setHotelId]    = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [methFilter, setMethFilter] = useState('');
  const [statFilter, setStatFilter] = useState('');

  // Data
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (hotelId)    qs.set('hotel_id',       hotelId);
      if (dateFrom)   qs.set('date_from',       dateFrom);
      if (dateTo)     qs.set('date_to',         dateTo);
      if (typeFilter) qs.set('payment_type',    typeFilter);
      if (methFilter) qs.set('payment_method',  methFilter);
      if (statFilter) qs.set('payment_status',  statFilter);
      qs.set('limit', '300');

      const p = await apiRequest(`/payments?${qs.toString()}`);
      setPayments(p.data || []);
      setSearched(true);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [hotelId, dateFrom, dateTo, typeFilter, methFilter, statFilter, setFlash]);

  // Summary stats derived from data
  const totalCaptured = payments
    .filter(p => p.payment_status === 'CAPTURED' && p.payment_type !== 'REFUND')
    .reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  const countByType = payments.reduce((acc, p) => {
    acc[p.payment_type] = (acc[p.payment_type] || 0) + 1;
    return acc;
  }, {});

  const primaryCurrency = payments[0]?.currency_code || 'USD';

  return (
    <section className="page-card page-card-wide" id="admin-payments">
      <div className="admin-section-header" style={{ marginBottom: 24 }}>
        <div>
          <p className="page-eyebrow">Finance</p>
          <h2 className="page-title">Payment History</h2>
          <p className="page-sub">Search and review all captured payments across the system.</p>
        </div>
      </div>

      {/*  Filters toolbar  */}
      <div className="pay-hist-toolbar">
        <select value={hotelId} onChange={e => setHotelId(e.target.value)} className="fd-select">
          <option value="">All hotels</option>
          {hotels.map(h => (
            <option key={h.hotel_id} value={h.hotel_id}>{h.hotel_name}</option>
          ))}
        </select>

        <input
          type="date" value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          className="fd-input" title="From date"
        />
        <span style={{ color: 'var(--text-soft)', alignSelf: 'center' }}></span>
        <input
          type="date" value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          className="fd-input" title="To date"
        />

        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="fd-select">
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select value={methFilter} onChange={e => setMethFilter(e.target.value)} className="fd-select">
          <option value="">All methods</option>
          {Object.entries(METHOD_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select value={statFilter} onChange={e => setStatFilter(e.target.value)} className="fd-select">
          <option value="">All statuses</option>
          <option value="CAPTURED">Captured</option>
          <option value="AUTHORIZED">Authorized</option>
          <option value="REFUNDED">Refunded</option>
          <option value="FAILED">Failed</option>
        </select>

        <button
          className="primary-button"
          onClick={load}
          disabled={loading}
          style={{ whiteSpace: 'nowrap' }}
        >
          {loading ? 'Loading...' : ' Search'}
        </button>
      </div>

      {/*  Summary KPI cards  */}
      {searched && payments.length > 0 && (
        <div className="pay-hist-kpis">
          <div className="pay-hist-kpi pay-hist-kpi--main">
            <span className="pay-hist-kpi-label">Total Captured</span>
            <span className="pay-hist-kpi-value">
              {fmtCurrency(totalCaptured, primaryCurrency)}
            </span>
          </div>
          <div className="pay-hist-kpi">
            <span className="pay-hist-kpi-label">Transactions</span>
            <span className="pay-hist-kpi-value">{payments.length}</span>
          </div>
          {Object.entries(countByType).map(([type, count]) => {
            const t = TYPE_LABELS[type] || { label: type, color: '#888' };
            return (
              <div key={type} className="pay-hist-kpi">
                <span className="pay-hist-kpi-label" style={{ color: t.color }}>{t.label}</span>
                <span className="pay-hist-kpi-value">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/*  Empty / loading states  */}
      {loading && <p className="fd-loading" style={{ padding: '40px 0', textAlign: 'center' }}>Loading payments...</p>}
      {!loading && searched && payments.length === 0 && (
        <div className="svc-orders-empty">
          <span style={{ fontSize: '2rem' }}>💳</span>
          <p>No payments found for the selected filters.</p>
        </div>
      )}
      {!loading && !searched && (
        <div className="svc-orders-empty">
          <span style={{ fontSize: '2rem' }}>🔎</span>
          <p>Set filters and click <strong>Search</strong> to view payment history.</p>
        </div>
      )}

      {/*  Payment table  */}
      {!loading && payments.length > 0 && (
        <div className="pay-hist-table-wrap">
          <table className="pay-hist-table">
            <thead>
              <tr>
                <th>#ID</th>
                <th>Date</th>
                <th>Guest</th>
                <th>Hotel</th>
                <th>Reservation</th>
                <th>Type</th>
                <th>Method</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => {
                const typeInfo   = TYPE_LABELS[p.payment_type]   || { label: p.payment_type,   color: '#888' };
                const statusInfo = STATUS_COLORS[p.payment_status] || { bg: '#f3f4f6', color: '#555' };
                return (
                  <tr key={p.payment_id} className="pay-hist-row">
                    <td className="pay-hist-id">#{p.payment_id}</td>
                    <td className="pay-hist-date">{fmtDate(p.paid_at)}</td>
                    <td>
                      <div className="pay-hist-guest">
                        <span>{p.guest_name}</span>
                        <span className="pay-hist-meta">{p.guest_email}</span>
                      </div>
                    </td>
                    <td className="pay-hist-hotel">
                      {p.hotel_name || <span style={{ color: 'var(--text-soft)' }}></span>}
                    </td>
                    <td>
                      <code className="pay-hist-code">{p.reservation_code}</code>
                    </td>
                    <td>
                      <span className="pay-hist-type-badge" style={{ color: typeInfo.color, background: typeInfo.color + '18' }}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="pay-hist-method">
                      {METHOD_LABELS[p.payment_method] || p.payment_method}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtCurrency(p.amount, p.currency_code)}
                    </td>
                    <td>
                      <span className="pay-hist-status" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                        {p.payment_status}
                      </span>
                    </td>
                    <td>
                      <span className="pay-hist-ref" title={p.payment_reference}>
                        {p.payment_reference?.length > 22
                          ? p.payment_reference.slice(0, 22) + '...'
                          : p.payment_reference}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
