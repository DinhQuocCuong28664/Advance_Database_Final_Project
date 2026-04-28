import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdditionalGuests from './AdditionalGuests';
import { apiRequest } from '../../lib/api';
import { useFlash } from '../../context/useFlash';
import { useAuth } from '../../context/AuthContext';

//  Payment methods available at check-in 
const PAYMENT_METHODS = [
  {
    key: 'CASH',
    label: 'Cash',
    sublabel: 'Physical currency',
    icon: '💵',
    note: 'Collect payment at the desk. Physical receipt required.',
  },
  {
    key: 'BANK_TRANSFER',
    label: 'Bank Transfer',
    sublabel: 'VNPay / Online Transfer',
    icon: '🏦',
    note: 'Guest scans QR or transfers via VNPay. Verify before confirming.',
  },
  {
    key: 'CREDIT_CARD',
    label: 'Credit / Debit Card',
    sublabel: 'Visa  Mastercard  JCB',
    icon: '💳',
    note: 'Swipe or tap card on the POS terminal. Confirm after approval.',
  },
];

Object.assign(PAYMENT_METHODS[0], { icon: '💵' });
Object.assign(PAYMENT_METHODS[1], { icon: '🏦' });
Object.assign(PAYMENT_METHODS[2], { icon: '💳' });

//  Payment modal 
function PaymentModal({ reservation, onConfirm, onCancel, busy }) {
  const [selected, setSelected] = useState('CASH');
  const overlayRef = useRef(null);
  const method     = PAYMENT_METHODS.find(m => m.key === selected);

  // Close on overlay click
  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onCancel();
  }

  function formatMoney(value, currency = 'VND') {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(Number(value || 0));
  }

  return (
    <div className="pm-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="pm-dialog" role="dialog" aria-modal="true">

        <div className="pm-header">
          <div>
            <p className="pm-eyebrow">Check-in  Select payment method</p>
            <h2 className="pm-title">{reservation.reservation_code}</h2>
            <p className="pm-guest">{reservation.guest_name}  {reservation.hotel_name}</p>
          </div>
          <button type="button" className="pm-close" onClick={onCancel}></button>
        </div>

        <div className="pm-amount-row">
          <span>Balance due</span>
          <strong className="pm-amount">
            {formatMoney(reservation.balance_due ?? reservation.grand_total_amount, reservation.currency_code || 'VND')}
          </strong>
        </div>

        <div className="pm-methods">
          {PAYMENT_METHODS.map(m => (
            <button
              key={m.key}
              type="button"
              className={`pm-method-btn${selected === m.key ? ' pm-method-btn--active' : ''}`}
              onClick={() => setSelected(m.key)}
            >
              <span className="pm-method-icon">{m.icon}</span>
              <span className="pm-method-body">
                <span className="pm-method-label">{m.label}</span>
                <span className="pm-method-sub">{m.sublabel}</span>
              </span>
              {selected === m.key && <span className="pm-method-check"></span>}
            </button>
          ))}
        </div>

        {method && (
          <p className="pm-method-note">{method.note}</p>
        )}

        <div className="pm-actions">
          <button type="button" className="ghost-button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button pm-confirm-btn"
            onClick={() => onConfirm(selected)}
            disabled={busy}
          >
            {busy ? 'Processing...' : `Confirm  ${method?.label}`}
          </button>
        </div>

      </div>
    </div>
  );
}

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return '';
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
            {reservation.hotel_name}  Room {reservation.room_number || 'TBD'} {' '}
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

  // Payment modal state
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentBusy,   setPaymentBusy]   = useState(false);

  // Service orders tab state
  const [activeTab,      setActiveTab]      = useState('frontdesk'); // 'frontdesk' | 'orders'
  const [svcOrders,      setSvcOrders]      = useState([]);
  const [svcOrdersLoading, setSvcOrdersLoading] = useState(false);
  const [svcStatusBusy,  setSvcStatusBusy]  = useState(null); // order id being updated
  const [svcFilter,      setSvcFilter]      = useState('');   // '' | 'REQUESTED' | 'CONFIRMED'
  const [chargeModal,    setChargeModal]    = useState(null); // order being charged
  const [chargeMethod,   setChargeMethod]   = useState('CASH');
  const [chargingId,     setChargingId]     = useState(null);

  // Order Service (staff ordering for guest from lookup)
  const [orderSvcModal,   setOrderSvcModal]   = useState(false);
  const [hotelServices,   setHotelServices]   = useState([]);
  const [selectedSvc,     setSelectedSvc]     = useState(null);
  const [svcQty,          setSvcQty]          = useState(1);
  const [svcNote,         setSvcNote]         = useState('');
  const [svcSchedule,     setSvcSchedule]     = useState('');
  const [orderingBusy,    setOrderingBusy]    = useState(false);

  // Export Invoice
  const [invoiceModal,    setInvoiceModal]    = useState(null);  // null | invoice data
  const [invoiceBusy,     setInvoiceBusy]     = useState(false);

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

  const loadDesk = useCallback(async ({ silent = false } = {}) => {
    if (!hotelId) {
      if (!silent) setFlash({ tone: 'error', text: 'Select a hotel first.' });
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
      if (!silent) {
        setFlash({
          tone: 'success',
          text: `Loaded front desk board for ${selectedHotel?.hotel_name || 'the selected hotel'}.`,
        });
      }
    } catch (error) {
      setArrivals([]);
      setDepartures([]);
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setLoadingDesk(false);
    }
  }, [deskDate, hotelId, selectedHotel?.hotel_name, setFlash]);

  const loadServiceOrders = useCallback(async (filterStatus) => {
    if (!hotelId) {
      setSvcOrders([]);
      setFlash({ tone: 'error', text: 'Select a hotel first.' });
      return;
    }
    setSvcOrdersLoading(true);
    try {
      const qs = filterStatus ? `&status=${filterStatus}` : '';
      const payload = await apiRequest(`/services/orders?hotel_id=${hotelId}${qs}`);
      setSvcOrders(payload.data || []);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setSvcOrdersLoading(false);
    }
  }, [hotelId, setFlash]);

  useEffect(() => {
    if (!hotelId) return;
    if (activeTab === 'frontdesk') {
      loadDesk({ silent: true });
    }
    if (activeTab === 'orders') {
      loadServiceOrders(svcFilter);
    }
  }, [activeTab, deskDate, hotelId, loadDesk, loadServiceOrders, svcFilter]);

  async function updateOrderStatus(orderId, newStatus) {
    setSvcStatusBusy(orderId);
    try {
      await apiRequest(`/services/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      setFlash({ tone: 'success', text: `Order #${orderId} marked as ${newStatus.toLowerCase()}.` });
      await loadServiceOrders(svcFilter);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setSvcStatusBusy(null);
    }
  }

  async function chargeOrder(order, method) {
    setChargingId(order.reservation_service_id);
    try {
      await apiRequest(`/services/orders/${order.reservation_service_id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ payment_method: method }),
      });
      const fmt = new Intl.NumberFormat('en-US', {
        style: 'currency', currency: order.currency_code || 'USD',
      }).format(order.final_amount);
      setFlash({ tone: 'success', text: `Payment captured: ${fmt} for "${order.service_name}"` });
      setChargeModal(null);
      await loadServiceOrders(svcFilter);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setChargingId(null);
    }
  }

  async function openOrderService(reservation) {
    setSelectedSvc(null); setSvcQty(1); setSvcNote(''); setSvcSchedule('');
    setOrderSvcModal(true);
    if (!reservation.hotel_id) return;
    try {
      const payload = await apiRequest(`/services?hotel_id=${reservation.hotel_id}`);
      setHotelServices(payload.data || []);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    }
  }

  async function submitStaffOrder() {
    if (!selectedSvc || !lookupResult) return;
    setOrderingBusy(true);
    try {
      await apiRequest('/services/order', {
        method: 'POST',
        body: JSON.stringify({
          reservation_id:      lookupResult.reservation_id,
          service_id:          selectedSvc.service_id,
          quantity:            Number(svcQty),
          special_instruction: svcNote || null,
          scheduled_at:        svcSchedule || null,
        }),
      });
      setFlash({ tone: 'success', text: `Service ordered: ${selectedSvc.service_name}` });
      setOrderSvcModal(false);
      setSelectedSvc(null);
      await loadServiceOrders(svcFilter);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setOrderingBusy(false);
    }
  }

  function printInvoice(inv) {
    const fmt = (val, cur = 'VND') =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(Number(val || 0));
    const fmtDate = v => v ? new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

    const roomRows = (inv.line_items?.rooms || []).map(r => `
      <tr>
        <td>${r.room_number || '-'}</td>
        <td>${r.room_type_name || ''}</td>
        <td>${fmtDate(r.stay_start_date)} &rarr; ${fmtDate(r.stay_end_date)}</td>
        <td>${fmt(r.nightly_rate_snapshot, inv.currency_code)}</td>
        <td>${fmt(r.final_amount, inv.currency_code)}</td>
      </tr>`).join('');

    const svcRows = (inv.line_items?.services || []).map(s => `
      <tr>
        <td>${s.service_name || ''}</td>
        <td>${(s.service_category || '').replace(/_/g,' ')}</td>
        <td>${s.quantity}</td>
        <td>${fmt(s.unit_price, inv.currency_code)}</td>
        <td>${fmt(s.final_amount, inv.currency_code)}</td>
      </tr>`).join('');

    const payRows = (inv.payments || []).map(p => `
      <tr>
        <td><code>${p.payment_reference || ''}</code></td>
        <td>${(p.payment_method || '').replace(/_/g,' ')}</td>
        <td>${fmt(p.amount, inv.currency_code)}</td>
        <td>${fmtDate(p.paid_at)}</td>
      </tr>`).join('');

    const statusColor = { DRAFT:'#92400e', ISSUED:'#065f46', PAID:'#1e40af', CANCELLED:'#991b1b' }[inv.status] || '#333';
    const statusBg   = { DRAFT:'#fef3c7', ISSUED:'#d1fae5', PAID:'#dbeafe', CANCELLED:'#fee2e2' }[inv.status] || '#f3f4f6';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${inv.invoice_no || ''}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Georgia', serif; font-size: 13px; color: #111; background: #fff; padding: 48px 56px; }
    .head { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 2px solid #111; padding-bottom: 24px; margin-bottom: 28px; }
    .hotel-name { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .hotel-addr { color: #666; font-size: 12px; }
    .inv-label  { font-size: 28px; font-weight: 900; letter-spacing: 4px; text-align: right; margin-bottom: 4px; }
    .inv-no     { font-family: monospace; font-size: 12px; color: #555; text-align: right; margin-bottom: 8px; }
    .status-pill { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 10px;
                   font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
                   background: ${statusBg}; color: ${statusColor}; }
    .meta { display: grid; grid-template-columns: repeat(3,1fr); gap: 24px; margin-bottom: 28px; }
    .meta-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
                  color: #888; margin-bottom: 5px; font-family: sans-serif; }
    .meta-val   { font-size: 12px; color: #222; margin-bottom: 2px; }
    .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px;
                     color: #777; margin: 22px 0 8px; font-family: sans-serif; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    th { text-align: left; border-bottom: 1px solid #ddd; padding: 5px 8px;
         font-family: sans-serif; font-size: 10px; text-transform: uppercase;
         letter-spacing: 0.4px; color: #777; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; font-size: 12px; color: #222; }
    code { font-size: 11px; color: #555; }
    .totals { margin-left: auto; width: 240px; border-top: 1px solid #ddd;
              padding-top: 12px; margin-top: 20px; }
    .totals-row { display: flex; justify-content: space-between;
                  font-size: 12px; padding: 3px 0; color: #555; font-family: sans-serif; }
    .totals-grand { border-top: 2px solid #111; margin-top: 8px; padding-top: 8px;
                    font-weight: 700; font-size: 15px; color: #111; }
    .footer { margin-top: 44px; font-size: 11px; color: #999; text-align: center;
              border-top: 1px solid #eee; padding-top: 18px; font-family: sans-serif; }
    @media print {
      body { padding: 24px 32px; }
      @page { margin: 12mm 16mm; }
    }
  </style>
</head>
<body>
  <div class="head">
    <div>
      <p class="hotel-name">${inv.hotel_name || ''}</p>
      <p class="hotel-addr">${inv.hotel_address || ''}</p>
    </div>
    <div>
      <p class="inv-label">INVOICE</p>
      <p class="inv-no">${inv.invoice_no || ''}</p>
      <div style="text-align:right"><span class="status-pill">${inv.status || ''}</span></div>
    </div>
  </div>

  <div class="meta">
    <div>
      <p class="meta-label">Bill To</p>
      <p class="meta-val">${inv.billing_name || inv.guest_name || ''}</p>
      ${inv.guest_email ? `<p class="meta-val">${inv.guest_email}</p>` : ''}
      ${inv.billing_tax_no ? `<p class="meta-val">Tax No: ${inv.billing_tax_no}</p>` : ''}
    </div>
    <div>
      <p class="meta-label">Reservation</p>
      <p class="meta-val">${inv.reservation_code || ''}</p>
      <p class="meta-val">Check-in: ${fmtDate(inv.checkin_date)}</p>
      <p class="meta-val">Check-out: ${fmtDate(inv.checkout_date)}</p>
    </div>
    <div>
      <p class="meta-label">Issued</p>
      <p class="meta-val">${inv.issued_at ? fmtDate(inv.issued_at) : 'Draft'}</p>
      <p class="meta-val">${inv.invoice_type || ''}</p>
    </div>
  </div>

  ${roomRows ? `
  <p class="section-title">Accommodation</p>
  <table>
    <thead><tr><th>Room</th><th>Type</th><th>Period</th><th>Rate/Night</th><th>Amount</th></tr></thead>
    <tbody>${roomRows}</tbody>
  </table>` : ''}

  ${svcRows ? `
  <p class="section-title">Services</p>
  <table>
    <thead><tr><th>Service</th><th>Category</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>
    <tbody>${svcRows}</tbody>
  </table>` : ''}

  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>${fmt(inv.subtotal_amount, inv.currency_code)}</span></div>
    <div class="totals-row"><span>Tax</span><span>${fmt(inv.tax_amount, inv.currency_code)}</span></div>
    <div class="totals-row"><span>Service Charge</span><span>${fmt(inv.service_charge_amount, inv.currency_code)}</span></div>
    <div class="totals-row totals-grand"><span>Total</span><span>${fmt(inv.total_amount, inv.currency_code)}</span></div>
  </div>

  ${payRows ? `
  <p class="section-title">Payment Records</p>
  <table>
    <thead><tr><th>Reference</th><th>Method</th><th>Amount</th><th>Date</th></tr></thead>
    <tbody>${payRows}</tbody>
  </table>` : ''}

  <p class="footer">Thank you for staying with us. This document serves as your official invoice.</p>
</body>
</html>`;

    const popup = window.open('', '_blank', 'width=860,height=960,scrollbars=yes');
    if (!popup) { alert('Allow popups for this site to print invoices.'); return; }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    // Small delay to let the browser render before print dialog
    setTimeout(() => { popup.print(); }, 400);
  }

  async function generateInvoice(reservation) {
    setInvoiceBusy(true);
    try {
      // Try to get existing invoice first
      const listPayload = await apiRequest(`/invoices?reservation_id=${reservation.reservation_id}`);
      let inv = (listPayload.data || [])[0];
      if (!inv) {
        // Create new draft invoice
        const created = await apiRequest('/invoices', {
          method: 'POST',
          body: JSON.stringify({ reservation_id: reservation.reservation_id }),
        });
        inv = created.data;
      }
      // Fetch full detail
      const detail = await apiRequest(`/invoices/${inv.invoice_id}`);
      setInvoiceModal(detail.data);
    } catch (err) {
      setFlash({ tone: 'error', text: err.message });
    } finally {
      setInvoiceBusy(false);
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

  // Open payment modal before check-in
  function initiateCheckin(reservation) {
    setPaymentTarget(reservation);
  }

  // Called when cashier confirms payment method in modal
  async function confirmCheckin(paymentMethod) {
    if (!paymentTarget) return;
    setPaymentBusy(true);
    try {
      await apiRequest(`/reservations/${paymentTarget.reservation_id}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ agent_id: agentId, payment_method: paymentMethod }),
      });
      setFlash({ tone: 'success', text: `${paymentTarget.reservation_code} checked in  ${paymentMethod}.` });
      setPaymentTarget(null);
      if (lookupResult?.reservation_id === paymentTarget.reservation_id) {
        await handleLookup({ preventDefault() {} });
      }
      await loadDesk();
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setPaymentBusy(false);
    }
  }

  async function runReservationAction(reservation, action) {
    const busyKey = `${action}-${reservation.reservation_id}`;
    setActionBusy(busyKey);

    try {
      let path = '';
      let body = {};

      if (action === 'checkin') {
        // Should not reach here  check-in goes through initiateCheckin()
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
    <>
    <section className="page-card page-card-wide" id="admin-front-desk">
      {/*  Payment modal  */}
      {paymentTarget && (
        <PaymentModal
          reservation={paymentTarget}
          busy={paymentBusy}
          onConfirm={confirmCheckin}
          onCancel={() => setPaymentTarget(null)}
        />
      )}
      <div className="admin-section-head">
        <div>
          <p className="page-eyebrow">Front desk</p>
          <h2>Arrivals, departures &amp; service requests</h2>
        </div>
        <span className="admin-status-pill">V1 live</span>
      </div>

      {/*  Tab switcher  */}
      <div className="fd-tab-bar">
        <button
          type="button"
          className={`fd-tab-btn${activeTab === 'frontdesk' ? ' active' : ''}`}
          onClick={() => setActiveTab('frontdesk')}
        >
           Arrivals &amp; Departures
        </button>
        <button
          type="button"
          className={`fd-tab-btn${activeTab === 'orders' ? ' active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
           Service Orders
          {svcOrders.filter(o => o.service_status === 'REQUESTED').length > 0 && (
            <span className="fd-tab-badge">
              {svcOrders.filter(o => o.service_status === 'REQUESTED').length}
            </span>
          )}
        </button>
      </div>

      {/*  TAB: Front Desk (arrivals & departures)  */}
      {activeTab === 'frontdesk' && (
        <>
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
                actionLabel="Check in"
                onAction={(row) => initiateCheckin(row)}
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
                    {lookupResult.hotel_name}  {formatDate(lookupResult.checkin_date)} {' '}
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
                    onClick={() => initiateCheckin(lookupResult)}
                  >
                    Check in
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

                {lookupResult.reservation_status === 'CHECKED_IN' && (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => openOrderService(lookupResult)}
                  >
                    Order Service
                  </button>
                )}

                <button
                  type="button"
                  className="ghost-button"
                  disabled={invoiceBusy}
                  onClick={() => generateInvoice(lookupResult)}
                >
                  {invoiceBusy ? 'Loading...' : 'Export Invoice'}
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
                          Room {room.room_number}  {room.room_type_name} {' '}
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
      </> )}
      {/*  TAB: Service Orders  */}
      {activeTab === 'orders' && (
        <div className="svc-orders-panel">
          <div className="svc-orders-toolbar">
            <div className="svc-orders-toolbar-left">
              <label>
                Hotel
                <select value={hotelId} onChange={e => { setHotelId(e.target.value); setSvcOrders([]); }}
                  style={{ marginLeft: 8 }}>
                  <option value="">Select hotel</option>
                  {hotels.map(h => (
                    <option key={h.hotel_id} value={h.hotel_id}>{h.hotel_name}</option>
                  ))}
                </select>
              </label>
              <label>
                Filter status
                <select value={svcFilter}
                  onChange={e => setSvcFilter(e.target.value)}
                  style={{ marginLeft: 8 }}>
                  <option value="">All</option>
                  <option value="REQUESTED">Requested</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={() => loadServiceOrders(svcFilter)}
              disabled={!hotelId || svcOrdersLoading}
            >
              {svcOrdersLoading ? 'Loading...' : ' Refresh'}
            </button>
          </div>

          {svcOrdersLoading && <p className="fd-loading">Loading service orders...</p>}

          {!svcOrdersLoading && svcOrders.length === 0 && (
            <div className="svc-orders-empty">
              <span>🛎️</span>
              <p>No service orders found.</p>
              <small>Service orders refresh automatically when hotel or status changes.</small>
            </div>
          )}

          {svcOrders.length > 0 && (
            <div className="svc-orders-list">
              {svcOrders.map(order => {
                const isBusy = svcStatusBusy === order.reservation_service_id;
                const statusClass = order.service_status.toLowerCase();
                return (
                  <article key={order.reservation_service_id} className={`svc-order-card svc-order-card--${statusClass}`}>
                    <div className="svc-order-card-top">
                      <div className="svc-order-card-info">
                        <span className={`svc-order-status-pill svc-order-status-pill--${statusClass}`}>
                          {order.service_status}
                        </span>
                        <strong>{order.service_name}</strong>
                        <span className="svc-order-category">{order.service_category.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="svc-order-card-meta">
                        <span>#{order.reservation_service_id}</span>
                        <strong>
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency_code || 'USD' })
                            .format(order.final_amount)}
                        </strong>
                      </div>
                    </div>

                    <div className="svc-order-card-mid">
                      <span> {order.guest_name}</span>
                      <span> Room {order.room_number || ''}</span>
                      <span> {order.reservation_code}</span>
                      {order.scheduled_at && (
                        <span> {new Date(order.scheduled_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      )}
                      {order.special_instruction && (
                        <span> {order.special_instruction}</span>
                      )}
                      <span style={{ color: 'var(--text-soft)', fontSize: '0.78rem' }}>
                        Ordered {new Date(order.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>

                    <div className="svc-order-card-actions">
                      {order.service_status === 'REQUESTED' && (
                        <>
                          <button
                            type="button"
                            className="primary-button"
                            disabled={isBusy}
                            onClick={() => updateOrderStatus(order.reservation_service_id, 'CONFIRMED')}
                          >
                            {isBusy ? '...' : ' Confirm Receipt'}
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={isBusy}
                            onClick={() => updateOrderStatus(order.reservation_service_id, 'CANCELLED')}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {order.service_status === 'CONFIRMED' && (
                        <button
                          type="button"
                          className="primary-button"
                          disabled={isBusy}
                          onClick={() => updateOrderStatus(order.reservation_service_id, 'DELIVERED')}
                        >
                          {isBusy ? '...' : ' Mark Delivered'}
                        </button>
                      )}
                      {order.service_status === 'CONFIRMED' && !order.is_paid && (
                        <button
                          type="button"
                          className="svc-charge-btn"
                          disabled={isBusy || chargingId === order.reservation_service_id}
                          onClick={() => { setChargeModal(order); setChargeMethod('CASH'); }}
                        >
                           Charge guest
                        </button>
                      )}
                      {order.service_status === 'DELIVERED' && !order.is_paid && (
                        <>
                          <span className="svc-order-done-label"> Delivered</span>
                          <button
                            type="button"
                            className="svc-charge-btn"
                            disabled={chargingId === order.reservation_service_id}
                            onClick={() => { setChargeModal(order); setChargeMethod('CASH'); }}
                          >
                             Charge guest
                          </button>
                        </>
                      )}
                      {order.is_paid && (
                        <>
                          {order.service_status === 'DELIVERED' && (
                            <span className="svc-order-done-label"> Delivered</span>
                          )}
                          <span className="svc-paid-badge">
                             Paid  {order.paid_method?.replace(/_/g,' ')}
                          </span>
                        </>
                      )}
                      {order.service_status === 'CANCELLED' && (
                        <span className="svc-order-done-label"> Cancelled</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

    </section>

    {/* Order Service Modal */}
    {orderSvcModal && lookupResult && (
      <div className="pm-overlay" onClick={() => setOrderSvcModal(false)}>
        <div className="pm-dialog pm-dialog--light" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
          <div className="pm-header">
            <div>
              <p className="pm-eyebrow">Order service for guest</p>
              <h2 className="pm-title">{lookupResult.guest_name}</h2>
              <p className="pm-guest">{lookupResult.reservation_code} &mdash; {lookupResult.hotel_name}</p>
            </div>
            <button type="button" className="pm-close" onClick={() => setOrderSvcModal(false)} />
          </div>

          {hotelServices.length === 0 ? (
            <p style={{ padding: '24px 0', color: 'var(--text-soft)', textAlign: 'center' }}>No services configured for this hotel.</p>
          ) : (
            <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {hotelServices.map(svc => (
                <button
                  key={svc.service_id}
                  type="button"
                  className={`pm-method-btn${selectedSvc?.service_id === svc.service_id ? ' pm-method-btn--active' : ''}`}
                  onClick={() => setSelectedSvc(svc)}
                >
                  <span className="pm-method-body">
                    <span className="pm-method-label">{svc.service_name}</span>
                    <span className="pm-method-sub">{svc.service_category?.replace(/_/g,' ')} &mdash; {formatMoney(svc.base_price, svc.currency_code || 'VND')}</span>
                  </span>
                  {selectedSvc?.service_id === svc.service_id && <span className="pm-method-check" />}
                </button>
              ))}
            </div>
          )}

          {selectedSvc && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <label>
                Quantity
                <input type="number" min="1" max="20" value={svcQty}
                  onChange={e => setSvcQty(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }} />
              </label>
              <label>
                Schedule (optional)
                <input type="datetime-local" value={svcSchedule}
                  onChange={e => setSvcSchedule(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }} />
              </label>
              <label style={{ gridColumn: '1/-1' }}>
                Note
                <input type="text" value={svcNote} placeholder="Special instruction..."
                  onChange={e => setSvcNote(e.target.value)}
                  style={{ width: '100%', marginTop: 4 }} />
              </label>
            </div>
          )}

          <div className="pm-actions">
            <button type="button" className="ghost-button" onClick={() => setOrderSvcModal(false)}>Cancel</button>
            <button
              type="button"
              className="primary-button"
              disabled={!selectedSvc || orderingBusy}
              onClick={submitStaffOrder}
            >
              {orderingBusy ? 'Ordering...' : 'Confirm Order'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Export Invoice Modal */}
    {invoiceModal && (
      <div className="pm-overlay" onClick={() => setInvoiceModal(null)}>
        <div className="invoice-print-dialog" onClick={e => e.stopPropagation()}>
          <div className="invoice-print-toolbar no-print">
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Invoice Preview</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="ghost-button" onClick={() => setInvoiceModal(null)}>Close</button>
              <button type="button" className="primary-button" onClick={() => printInvoice(invoiceModal)}>Print / Save PDF</button>
            </div>
          </div>

          <div className="invoice-print-body">
            <div className="invoice-print-head">
              <div>
                <h1 className="invoice-hotel-name">{invoiceModal.hotel_name}</h1>
                <p className="invoice-hotel-addr">{invoiceModal.hotel_address || ''}</p>
              </div>
              <div className="invoice-badge-col">
                <p className="invoice-label">INVOICE</p>
                <p className="invoice-no">{invoiceModal.invoice_no}</p>
                <span className={`invoice-status-pill invoice-status-pill--${(invoiceModal.status||'').toLowerCase()}`}>
                  {invoiceModal.status}
                </span>
              </div>
            </div>

            <div className="invoice-print-meta">
              <div>
                <p className="invoice-meta-label">Bill To</p>
                <p className="invoice-meta-val">{invoiceModal.billing_name || invoiceModal.guest_name}</p>
                {invoiceModal.guest_email && <p className="invoice-meta-val">{invoiceModal.guest_email}</p>}
                {invoiceModal.billing_tax_no && <p className="invoice-meta-val">Tax No: {invoiceModal.billing_tax_no}</p>}
              </div>
              <div>
                <p className="invoice-meta-label">Reservation</p>
                <p className="invoice-meta-val">{invoiceModal.reservation_code}</p>
                <p className="invoice-meta-val">Check-in: {formatDate(invoiceModal.checkin_date)}</p>
                <p className="invoice-meta-val">Check-out: {formatDate(invoiceModal.checkout_date)}</p>
              </div>
              <div>
                <p className="invoice-meta-label">Issued</p>
                <p className="invoice-meta-val">{invoiceModal.issued_at ? formatDate(invoiceModal.issued_at) : 'Draft'}</p>
                <p className="invoice-meta-val">{invoiceModal.invoice_type}</p>
              </div>
            </div>

            {/* Room line items */}
            {(invoiceModal.line_items?.rooms || []).length > 0 && (
              <>
                <p className="invoice-section-title">Accommodation</p>
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th>Room</th><th>Type</th><th>Period</th><th>Rate/Night</th><th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceModal.line_items.rooms.map((r, i) => (
                      <tr key={i}>
                        <td>{r.room_number || '-'}</td>
                        <td>{r.room_type_name}</td>
                        <td>{formatDate(r.stay_start_date)} &rarr; {formatDate(r.stay_end_date)}</td>
                        <td>{formatMoney(r.nightly_rate_snapshot, invoiceModal.currency_code)}</td>
                        <td>{formatMoney(r.final_amount, invoiceModal.currency_code)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Service line items */}
            {(invoiceModal.line_items?.services || []).length > 0 && (
              <>
                <p className="invoice-section-title">Services</p>
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th>Service</th><th>Category</th><th>Qty</th><th>Unit Price</th><th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceModal.line_items.services.map((s, i) => (
                      <tr key={i}>
                        <td>{s.service_name}</td>
                        <td>{s.service_category?.replace(/_/g,' ')}</td>
                        <td>{s.quantity}</td>
                        <td>{formatMoney(s.unit_price, invoiceModal.currency_code)}</td>
                        <td>{formatMoney(s.final_amount, invoiceModal.currency_code)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Totals */}
            <div className="invoice-totals">
              <div><span>Subtotal</span><span>{formatMoney(invoiceModal.subtotal_amount, invoiceModal.currency_code)}</span></div>
              <div><span>Tax</span><span>{formatMoney(invoiceModal.tax_amount, invoiceModal.currency_code)}</span></div>
              <div><span>Service Charge</span><span>{formatMoney(invoiceModal.service_charge_amount, invoiceModal.currency_code)}</span></div>
              <div className="invoice-totals-grand"><span>Total</span><span>{formatMoney(invoiceModal.total_amount, invoiceModal.currency_code)}</span></div>
            </div>

            {/* Payments */}
            {(invoiceModal.payments || []).length > 0 && (
              <>
                <p className="invoice-section-title">Payment Records</p>
                <table className="invoice-table">
                  <thead><tr><th>Reference</th><th>Method</th><th>Amount</th><th>Date</th></tr></thead>
                  <tbody>
                    {invoiceModal.payments.map((p, i) => (
                      <tr key={i}>
                        <td><code>{p.payment_reference}</code></td>
                        <td>{p.payment_method?.replace(/_/g,' ')}</td>
                        <td>{formatMoney(p.amount, invoiceModal.currency_code)}</td>
                        <td>{p.paid_at ? formatDate(p.paid_at) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <p className="invoice-footer">Thank you for staying with us. This document serves as your official invoice.</p>
          </div>
        </div>
      </div>
    )}

    {/*  Charge Guest Modal  */}
    {chargeModal && (
      <div className="pm-overlay" onClick={() => setChargeModal(null)}>
        <div className="pm-dialog pm-dialog--light" onClick={e => e.stopPropagation()}>
          <h3 className="pm-title">Charge guest</h3>
          <p className="pm-subtitle">
            <strong>{chargeModal.service_name}</strong> {' '}
            {new Intl.NumberFormat('en-US', {
              style: 'currency', currency: chargeModal.currency_code || 'USD',
            }).format(chargeModal.final_amount)}
          </p>
          <p className="pm-subtitle" style={{ color: 'var(--text-soft)', fontSize: '0.82rem' }}>
            Guest: {chargeModal.guest_name}  Room {chargeModal.room_number || ''}
          </p>

          <p style={{ fontWeight: 700, marginBottom: 10, marginTop: 14 }}>Payment method</p>
          <div className="pm-methods">
            {[['CASH',' Cash'],['CREDIT_CARD',' Credit / Debit'],['BANK_TRANSFER',' Bank Transfer']].map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`pm-method-btn${chargeMethod === val ? ' pm-method-btn--active' : ''}`}
                onClick={() => setChargeMethod(val)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="pm-actions">
            <button type="button" className="ghost-button" onClick={() => setChargeModal(null)}>Cancel</button>
            <button
              type="button"
              className="primary-button"
              disabled={chargingId === chargeModal.reservation_service_id}
              onClick={() => chargeOrder(chargeModal, chargeMethod)}
            >
              {chargingId === chargeModal.reservation_service_id ? 'Processing...' : 'Confirm charge'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
