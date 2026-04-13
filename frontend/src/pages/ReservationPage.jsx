import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useReservation } from '../hooks/useReservation';
import { money, when } from '../utils/formatters';

export default function ReservationPage() {
  const [searchParams] = useSearchParams();

  const {
    reservationCode, setReservationCode,
    reservationBusy, reservationActionBusy,
    reservationData, reservationPayments,
    paymentDraft, setPaymentDraft,
    serviceCatalog, serviceOrders, serviceBusy, serviceDraft, setServiceDraft,
    invoiceList, invoiceDetail, invoiceBusy, invoiceDraft, setInvoiceDraft,
    loadReservation,
    handleReservationLookup,
    runReservationAction,
    handlePaymentSubmit,
    handleServiceOrder, handleServicePay,
    handleInvoiceCreate, handleInvoiceSelect, handleInvoiceIssue,
  } = useReservation();

  // Auto-load reservation from URL param (e.g. after booking redirect)
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam && codeParam !== reservationCode) {
      setReservationCode(codeParam);
      loadReservation(codeParam).catch(() => {});
    }
  }, [searchParams]);

  return (
    <>
      {/* ── Reservation Lookup ──────────────────────── */}
      <section className="panel">
        <p className="section-kicker">Lookup</p>
        <h2>Reservation lifecycle</h2>
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
            <div className="stats-grid">
              <article className="compact-item"><strong>Grand total</strong><span>{money(reservationData.grand_total, reservationData.currency_code)}</span></article>
              <article className="compact-item"><strong>Paid</strong><span>{money(reservationData.total_paid, reservationData.currency_code)}</span></article>
              <article className="compact-item"><strong>Deposit target</strong><span>{money(reservationData.deposit_amount, reservationData.currency_code)}</span></article>
            </div>
          </>
        ) : <p className="muted-copy">Load a confirmation code to unlock payment and lifecycle actions.</p>}
        <div className="action-row">
          <button className="ghost-button warning" type="button" disabled={!reservationData || reservationActionBusy} onClick={() => runReservationAction('guestCancel')}>
            {reservationActionBusy === 'guestCancel' ? 'Working...' : 'Guest Cancel'}
          </button>
          <span className="muted-copy">Front desk actions are available in the separate admin portal.</span>
        </div>
      </section>

      {/* ── Payments ────────────────────────────────── */}
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
                amount: event.target.value === 'FULL_PAYMENT' && reservationData
                  ? String(Number(reservationData.balance_due || 0))
                  : current.amount,
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
          <button className="primary-button" type="submit" disabled={!reservationData || reservationActionBusy}>
            {reservationActionBusy === 'payment' ? 'Capturing...' : 'Capture Payment'}
          </button>
        </form>
        <div className="payments-list">
          {reservationPayments.map((payment) => (
            <div key={payment.payment_id || payment.payment_reference} className="payment-row">
              <div><strong>{payment.payment_type}</strong><p>{payment.payment_method}</p></div>
              <div><strong>{money(payment.amount, payment.currency_code || reservationData?.currency_code)}</strong><p>{payment.payment_status}</p></div>
            </div>
          ))}
          {!reservationPayments.length ? <p className="muted-copy">No payments loaded yet.</p> : null}
        </div>
      </section>

      {/* ── Services ────────────────────────────────── */}
      <section className="panel panel-span-2">
        <p className="section-kicker">Services</p>
        <h2>Ancillary order workspace</h2>
        <form className="form-grid" onSubmit={handleServiceOrder}>
          <label>
            Service
            <select value={serviceDraft.serviceId} onChange={(event) => setServiceDraft((current) => ({ ...current, serviceId: event.target.value }))}>
              {serviceCatalog.map((service) => (
                <option key={service.service_id} value={service.service_id}>
                  {service.service_name} - {money(service.base_price, service.currency_code || reservationData?.currency_code)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Quantity
            <input type="number" min="1" value={serviceDraft.quantity} onChange={(event) => setServiceDraft((current) => ({ ...current, quantity: event.target.value }))} />
          </label>
          <label>
            Scheduled at
            <input type="datetime-local" value={serviceDraft.scheduledAt} onChange={(event) => setServiceDraft((current) => ({ ...current, scheduledAt: event.target.value }))} />
          </label>
          <label>
            Pay with
            <select value={serviceDraft.paymentMethod} onChange={(event) => setServiceDraft((current) => ({ ...current, paymentMethod: event.target.value }))}>
              <option value="CREDIT_CARD">CREDIT_CARD</option>
              <option value="BANK_TRANSFER">BANK_TRANSFER</option>
              <option value="WALLET">WALLET</option>
              <option value="CASH">CASH</option>
            </select>
          </label>
          <label className="full-span">
            Special instruction
            <textarea rows="3" value={serviceDraft.specialInstruction} onChange={(event) => setServiceDraft((current) => ({ ...current, specialInstruction: event.target.value }))} />
          </label>
          <button className="primary-button" type="submit" disabled={!reservationData || !serviceDraft.serviceId || serviceBusy === 'order'}>
            {serviceBusy === 'order' ? 'Submitting...' : 'Order Service'}
          </button>
        </form>
        <div className="service-grid">
          {serviceOrders.map((order) => (
            <article key={order.reservation_service_id} className="result-card">
              <strong>{order.service_name}</strong>
              <span>{order.service_category}</span>
              <p>{order.quantity} unit(s) | {money(order.final_amount, reservationData?.currency_code)}</p>
              <p>Status: {order.service_status}</p>
              <button
                className="ghost-button"
                type="button"
                disabled={serviceBusy === `pay-${order.reservation_service_id}` || order.service_status === 'CANCELLED'}
                onClick={() => handleServicePay(order.reservation_service_id)}
              >
                {serviceBusy === `pay-${order.reservation_service_id}` ? 'Processing...' : 'Capture Service Payment'}
              </button>
            </article>
          ))}
          {!serviceOrders.length ? <p className="muted-copy">No service orders on this reservation yet.</p> : null}
        </div>
      </section>

      {/* ── Invoice Generate ────────────────────────── */}
      <section className="panel">
        <p className="section-kicker">Invoice</p>
        <h2>Generate</h2>
        <form className="form-grid" onSubmit={handleInvoiceCreate}>
          <label>
            Invoice type
            <select value={invoiceDraft.invoice_type} onChange={(event) => setInvoiceDraft((current) => ({ ...current, invoice_type: event.target.value }))}>
              <option value="FINAL">FINAL</option>
              <option value="INTERIM">INTERIM</option>
            </select>
          </label>
          <label>
            Billing name
            <input type="text" value={invoiceDraft.billing_name} onChange={(event) => setInvoiceDraft((current) => ({ ...current, billing_name: event.target.value }))} />
          </label>
          <label>
            Tax number
            <input type="text" value={invoiceDraft.billing_tax_no} onChange={(event) => setInvoiceDraft((current) => ({ ...current, billing_tax_no: event.target.value }))} />
          </label>
          <label className="full-span">
            Billing address
            <textarea rows="3" value={invoiceDraft.billing_address} onChange={(event) => setInvoiceDraft((current) => ({ ...current, billing_address: event.target.value }))} />
          </label>
          <button className="primary-button" type="submit" disabled={!reservationData || invoiceBusy === 'create'}>
            {invoiceBusy === 'create' ? 'Generating...' : 'Generate Invoice'}
          </button>
        </form>
        <div className="compact-list">
          {invoiceList.map((invoice) => (
            <button key={invoice.invoice_id} type="button" className="compact-item button-reset" onClick={() => handleInvoiceSelect(invoice.invoice_id)}>
              <strong>{invoice.invoice_no}</strong>
              <span>{invoice.invoice_type}</span>
              <span>{invoice.status}</span>
            </button>
          ))}
          {!invoiceList.length ? <p className="muted-copy">No invoice has been generated for this reservation yet.</p> : null}
        </div>
      </section>

      {/* ── Invoice Detail ──────────────────────────── */}
      <section className="panel panel-span-2">
        <p className="section-kicker">Invoice detail</p>
        <h2>Line items</h2>
        {invoiceDetail ? (
          <>
            <div className="stats-grid">
              <article className="compact-item"><strong>{invoiceDetail.invoice_no}</strong><span>{invoiceDetail.status}</span></article>
              <article className="compact-item"><strong>Total</strong><span>{money(invoiceDetail.total_amount, invoiceDetail.currency_code)}</span></article>
              <article className="compact-item"><strong>Guest</strong><span>{invoiceDetail.guest_name}</span></article>
            </div>
            <div className="ops-columns">
              <div className="compact-list">
                <h3>Room line items</h3>
                {invoiceDetail.line_items.rooms.map((room, index) => (
                  <div key={`${room.room_number || 'room'}-${index}`} className="compact-item">
                    <strong>{room.room_type_name}</strong>
                    <span>{room.room_number ? `Room ${room.room_number}` : 'Unassigned room'}</span>
                    <span>{money(room.final_amount, invoiceDetail.currency_code)}</span>
                  </div>
                ))}
              </div>
              <div className="compact-list">
                <h3>Service line items</h3>
                {invoiceDetail.line_items.services.map((service, index) => (
                  <div key={`${service.service_name}-${index}`} className="compact-item">
                    <strong>{service.service_name}</strong>
                    <span>{service.quantity} unit(s)</span>
                    <span>{money(service.final_amount, invoiceDetail.currency_code)}</span>
                  </div>
                ))}
                {!invoiceDetail.line_items.services.length ? <p className="muted-copy">No service line items on this invoice.</p> : null}
              </div>
            </div>
          </>
        ) : <p className="muted-copy">Generate or select an invoice to inspect its line items.</p>}
      </section>
    </>
  );
}
