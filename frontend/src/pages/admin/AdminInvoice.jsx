import { useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/FlashContext';
import '../../styles/AdminInvoice.css';

const STATUS_STYLE = {
  DRAFT:     { bg: '#f3f4f6', color: '#374151' },
  ISSUED:    { bg: '#dbeafe', color: '#1e40af' },
  PAID:      { bg: '#dcfce7', color: '#14532d' },
  CANCELLED: { bg: '#fee2e2', color: '#7f1d1d' },
};

function fmt(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}
function money(val, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(val || 0));
}

export default function AdminInvoice({ hotels }) {
  const { setFlash } = useFlash();

  const [hotelId,      setHotelId]      = useState(hotels[0]?.hotel_id || '');
  const [resvCode,     setResvCode]     = useState('');
  const [lookupResult, setLookupResult] = useState(null); // reservation to generate invoice for
  const [lookupBusy,   setLookupBusy]   = useState(false);

  const [invoices,     setInvoices]     = useState([]);
  const [listBusy,     setListBusy]     = useState(false);

  const [detail,       setDetail]       = useState(null); // invoice detail modal
  const [detailBusy,   setDetailBusy]   = useState(false);

  const [genBusy,      setGenBusy]      = useState(false);
  const [issueBusy,    setIssueBusy]    = useState(null); // invoice_id

  //  Load invoices by hotel (via all reservations) 
  async function loadInvoices() {
    if (!hotelId) { setFlash({ tone: 'error', text: 'Select a hotel.' }); return; }
    setListBusy(true);
    try {
      const payload = await apiRequest('/invoices');
      // Filter by hotel  backend returns all, we filter client-side by hotel_name match
      // Or better: look up reservations for hotel then filter
      const hotelObj = hotels.find(h => String(h.hotel_id) === String(hotelId));
      const all = payload.data || [];
      setInvoices(hotelObj ? all.filter(i => i.hotel_name === hotelObj.hotel_name) : all);
    } catch (e) { setFlash({ tone: 'error', text: e.message }); }
    finally     { setListBusy(false); }
  }

  //  Lookup reservation by code 
  async function handleLookup(e) {
    e.preventDefault();
    if (!resvCode.trim()) return;
    setLookupBusy(true);
    setLookupResult(null);
    try {
      const payload = await apiRequest(`/reservations/${encodeURIComponent(resvCode.trim())}`);
      setLookupResult(payload.data || payload.reservation || payload);
    } catch (e) { setFlash({ tone: 'error', text: e.message }); }
    finally     { setLookupBusy(false); }
  }

  //  Generate invoice 
  async function handleGenerate() {
    if (!lookupResult) return;
    setGenBusy(true);
    try {
      const payload = await apiRequest('/invoices', {
        method: 'POST',
        body: JSON.stringify({ reservation_id: lookupResult.reservation_id }),
      });
      setFlash({ tone: 'success', text: `Invoice ${payload.data.invoice_no} created (DRAFT).` });
      setLookupResult(null);
      setResvCode('');
      await loadInvoices();
    } catch (e) { setFlash({ tone: 'error', text: e.message }); }
    finally     { setGenBusy(false); }
  }

  //  Issue invoice 
  async function handleIssue(invoiceId) {
    setIssueBusy(invoiceId);
    try {
      await apiRequest(`/invoices/${invoiceId}/issue`, { method: 'POST' });
      setFlash({ tone: 'success', text: `Invoice #${invoiceId} issued.` });
      await loadInvoices();
      if (detail?.invoice_id === invoiceId) {
        const p = await apiRequest(`/invoices/${invoiceId}`);
        setDetail(p.data);
      }
    } catch (e) { setFlash({ tone: 'error', text: e.message }); }
    finally     { setIssueBusy(null); }
  }

  //  View detail 
  async function handleViewDetail(invoiceId) {
    setDetailBusy(true);
    try {
      const p = await apiRequest(`/invoices/${invoiceId}`);
      setDetail(p.data);
    } catch (e) { setFlash({ tone: 'error', text: e.message }); }
    finally     { setDetailBusy(false); }
  }

  return (
    <section className="page-card page-card-wide" id="admin-invoice">

      {/*  Invoice Detail Modal  */}
      {detail && (
        <div className="pm-overlay" onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="pm-dialog pm-dialog--light inv-dialog">
            <div className="pm-header">
              <div>
                <p className="pm-eyebrow">Invoice  {detail.invoice_no}</p>
                <h2 className="pm-title">{detail.hotel_name}</h2>
                <p className="pm-guest">{detail.guest_name}  {detail.guest_email}</p>
              </div>
              <button type="button" className="pm-close" onClick={() => setDetail(null)}></button>
            </div>

            <div className="inv-detail-body">
              {/* Meta row */}
              <div className="inv-meta-row">
                <div><span>Reservation</span><strong>{detail.reservation_code}</strong></div>
                <div><span>Check-in</span><strong>{detail.checkin_date?.slice(0,10)}</strong></div>
                <div><span>Check-out</span><strong>{detail.checkout_date?.slice(0,10)}</strong></div>
                <div><span>Nights</span><strong>{detail.nights}</strong></div>
                <div>
                  <span>Status</span>
                  <span className="maint-status-pill" style={STATUS_STYLE[detail.status]}>
                    {detail.status}
                  </span>
                </div>
                {detail.issued_at && <div><span>Issued</span><strong>{fmt(detail.issued_at)}</strong></div>}
              </div>

              {/* Room line items */}
              {detail.line_items?.rooms?.length > 0 && (
                <div className="inv-section">
                  <p className="inv-section-title"> Room charges</p>
                  <table className="inv-table">
                    <thead><tr><th>Room</th><th>Type</th><th>Period</th><th>Rate/night</th><th>Amount</th></tr></thead>
                    <tbody>
                      {detail.line_items.rooms.map((r, i) => (
                        <tr key={i}>
                          <td>Room {r.room_number}</td>
                          <td>{r.room_type_name}</td>
                          <td>{r.stay_start_date?.slice(0,10)}  {r.stay_end_date?.slice(0,10)}</td>
                          <td>{money(r.nightly_rate_snapshot, detail.currency_code)}</td>
                          <td><strong>{money(r.final_amount, detail.currency_code)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Services */}
              {detail.line_items?.services?.length > 0 && (
                <div className="inv-section">
                  <p className="inv-section-title"> In-house services</p>
                  <table className="inv-table">
                    <thead><tr><th>Service</th><th>Category</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
                    <tbody>
                      {detail.line_items.services.map((s, i) => (
                        <tr key={i}>
                          <td>{s.service_name}</td>
                          <td>{s.service_category.replace(/_/g,' ')}</td>
                          <td>{s.quantity}</td>
                          <td>{money(s.unit_price, detail.currency_code)}</td>
                          <td><strong>{money(s.final_amount, detail.currency_code)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Payments */}
              {detail.payments?.length > 0 && (
                <div className="inv-section">
                  <p className="inv-section-title"> Payments received</p>
                  <table className="inv-table">
                    <thead><tr><th>Reference</th><th>Type</th><th>Method</th><th>Date</th><th>Amount</th></tr></thead>
                    <tbody>
                      {detail.payments.map((p, i) => (
                        <tr key={i}>
                          <td><code>{p.payment_reference}</code></td>
                          <td>{p.payment_type}</td>
                          <td>{p.payment_method}</td>
                          <td>{fmt(p.paid_at)}</td>
                          <td><strong>{money(p.amount, detail.currency_code)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals */}
              <div className="inv-totals">
                <div><span>Subtotal</span><strong>{money(detail.subtotal_amount, detail.currency_code)}</strong></div>
                <div><span>Tax</span><strong>{money(detail.tax_amount, detail.currency_code)}</strong></div>
                <div className="inv-total-grand"><span>Total</span><strong>{money(detail.total_amount, detail.currency_code)}</strong></div>
              </div>

              {detail.status === 'DRAFT' && (
                <div style={{ marginTop: 20, textAlign:'right' }}>
                  <button type="button" className="primary-button"
                    disabled={issueBusy === detail.invoice_id}
                    onClick={() => handleIssue(detail.invoice_id)}>
                    {issueBusy === detail.invoice_id ? 'Issuing...' : ' Issue invoice'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/*  Header  */}
      <div className="admin-section-head">
        <div>
          <p className="page-eyebrow">Invoices</p>
          <h2>Generate &amp; manage guest invoices</h2>
        </div>
      </div>

      {/*  Generate Invoice from Reservation  */}
      <div className="inv-lookup-card">
        <p className="page-eyebrow" style={{ marginBottom: 8 }}>Generate invoice from reservation</p>
        <form className="inv-lookup-row" onSubmit={handleLookup}>
          <input
            type="text"
            placeholder="Reservation code  e.g. RES-20260421-XXXXX"
            value={resvCode}
            onChange={e => setResvCode(e.target.value)}
            className="inv-lookup-input"
          />
          <button type="submit" className="primary-button" disabled={lookupBusy}>
            {lookupBusy ? 'Looking up...' : 'Look up'}
          </button>
        </form>

        {lookupResult && (
          <div className="inv-preview-card">
            <div className="inv-preview-info">
              <strong>{lookupResult.guest_name}</strong>
              <span>{lookupResult.hotel_name}</span>
              <span>{lookupResult.checkin_date?.slice(0,10)}  {lookupResult.checkout_date?.slice(0,10)}  {lookupResult.nights} nights</span>
              <span className={`maint-status-pill`} style={STATUS_STYLE[lookupResult.reservation_status] || {}}>
                {lookupResult.reservation_status}
              </span>
            </div>
            <div className="inv-preview-total">
              <span>Grand total</span>
              <strong>{money(lookupResult.grand_total_amount, lookupResult.currency_code)}</strong>
            </div>
            <button type="button" className="primary-button" disabled={genBusy} onClick={handleGenerate}>
              {genBusy ? 'Generating...' : ' Generate FINAL invoice'}
            </button>
          </div>
        )}
      </div>

      {/*  Invoice List  */}
      <div className="inv-list-toolbar">
        <label>
          Hotel
          <select value={hotelId} onChange={e => { setHotelId(e.target.value); setInvoices([]); }}>
            <option value="">Select hotel</option>
            {hotels.map(h => <option key={h.hotel_id} value={h.hotel_id}>{h.hotel_name}</option>)}
          </select>
        </label>
        <button type="button" className="primary-button" onClick={loadInvoices} disabled={!hotelId || listBusy}>
          {listBusy ? 'Loading...' : ' Load invoices'}
        </button>
      </div>

      {detailBusy && <p className="fd-loading">Loading invoice detail...</p>}

      {!listBusy && invoices.length === 0 && (
        <div className="svc-orders-empty">
          <span></span><p>No invoices yet.</p>
          <small>Select a hotel and click "Load invoices", or generate one from a reservation above.</small>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="inv-list">
          {invoices.map(inv => {
            const st = STATUS_STYLE[inv.status] || {};
            return (
              <article key={inv.invoice_id} className="inv-list-row">
                <div className="inv-list-left">
                  <code className="inv-no">{inv.invoice_no}</code>
                  <strong>{inv.guest_name}</strong>
                  <span>{inv.hotel_name}  {inv.reservation_code}</span>
                  <span style={{ fontSize:'0.78rem', color:'var(--text-soft)' }}>{fmt(inv.created_at)}</span>
                </div>
                <div className="inv-list-right">
                  <strong>{money(inv.total_amount, inv.currency_code)}</strong>
                  <span className="maint-status-pill" style={st}>{inv.status}</span>
                  <div style={{ display:'flex', gap:8 }}>
                    <button type="button" className="ghost-button" onClick={() => handleViewDetail(inv.invoice_id)}>
                      View
                    </button>
                    {inv.status === 'DRAFT' && (
                      <button type="button" className="primary-button"
                        disabled={issueBusy === inv.invoice_id}
                        onClick={() => handleIssue(inv.invoice_id)}>
                        {issueBusy === inv.invoice_id ? '...' : 'Issue'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
