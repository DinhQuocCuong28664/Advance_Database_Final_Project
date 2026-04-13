import { useState } from 'react';
import { apiRequest } from '../lib/api';
import { useFlash } from '../context/FlashContext';
import { money } from '../utils/formatters';

export function useReservation() {
  const { setFlash } = useFlash();

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

  const [serviceCatalog, setServiceCatalog] = useState([]);
  const [serviceOrders, setServiceOrders] = useState([]);
  const [serviceBusy, setServiceBusy] = useState('');
  const [serviceDraft, setServiceDraft] = useState({
    serviceId: '',
    quantity: 1,
    scheduledAt: '',
    specialInstruction: '',
    paymentMethod: 'CREDIT_CARD',
  });

  const [invoiceList, setInvoiceList] = useState([]);
  const [invoiceDetail, setInvoiceDetail] = useState(null);
  const [invoiceBusy, setInvoiceBusy] = useState('');
  const [invoiceDraft, setInvoiceDraft] = useState({
    invoice_type: 'FINAL',
    billing_name: '',
    billing_tax_no: '',
    billing_address: '',
  });

  /* ── Internal helpers ────────────────────────────── */
  async function loadReservationWorkspace(reservation) {
    const [paymentsPayload, ordersPayload, servicesPayload, invoicesPayload] = await Promise.all([
      apiRequest(`/payments?reservation_id=${reservation.reservation_id}`),
      apiRequest(`/services/orders?reservation_id=${reservation.reservation_id}`),
      apiRequest(`/services?hotel_id=${reservation.hotel_id}`),
      apiRequest(`/invoices?reservation_id=${reservation.reservation_id}`),
    ]);

    const nextServices = servicesPayload.data || [];
    const nextInvoices = invoicesPayload.data || [];

    setReservationPayments(paymentsPayload.data || []);
    setServiceOrders(ordersPayload.data || []);
    setServiceCatalog(nextServices);
    setInvoiceList(nextInvoices);
    setServiceDraft((current) => ({ ...current, serviceId: current.serviceId || String(nextServices[0]?.service_id || '') }));
    setInvoiceDraft((current) => ({ ...current, billing_name: current.billing_name || reservation.guest_name || '' }));

    if (nextInvoices[0]?.invoice_id) {
      const invoicePayload = await apiRequest(`/invoices/${nextInvoices[0].invoice_id}`);
      setInvoiceDetail(invoicePayload.data);
    } else {
      setInvoiceDetail(null);
    }
  }

  /* ── Public API ──────────────────────────────────── */
  async function loadReservation(code, silent = false) {
    const target = code.trim();
    if (!target) return;

    if (!silent) setReservationBusy(true);
    try {
      const reservationPayload = await apiRequest(`/reservations/${encodeURIComponent(target)}`);
      const reservation = reservationPayload.data;
      setReservationCode(target);
      setReservationData(reservation);
      await loadReservationWorkspace(reservation);

      // Auto-fill payment amount for FULL_PAYMENT
      setPaymentDraft((current) => {
        if (current.payment_type === 'FULL_PAYMENT') {
          return { ...current, amount: String(Number(reservation.balance_due || 0)) };
        }
        return current;
      });
    } finally {
      if (!silent) setReservationBusy(false);
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
      setServiceOrders([]);
      setServiceCatalog([]);
      setInvoiceList([]);
      setInvoiceDetail(null);
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

  async function handleServiceOrder(event) {
    event.preventDefault();
    if (!reservationData) {
      setFlash({ tone: 'error', text: 'Load a reservation first.' });
      return;
    }

    setServiceBusy('order');
    try {
      await apiRequest('/services/order', {
        method: 'POST',
        body: JSON.stringify({
          reservation_id: reservationData.reservation_id,
          service_id: Number(serviceDraft.serviceId),
          quantity: Number(serviceDraft.quantity),
          special_instruction: serviceDraft.specialInstruction || null,
          scheduled_at: serviceDraft.scheduledAt || null,
        }),
      });
      setFlash({ tone: 'success', text: 'Service order created.' });
      setServiceDraft((current) => ({ ...current, quantity: 1, scheduledAt: '', specialInstruction: '' }));
      await loadReservation(reservationData.reservation_code, true);
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setServiceBusy('');
    }
  }

  async function handleServicePay(orderId) {
    setServiceBusy(`pay-${orderId}`);
    try {
      await apiRequest(`/services/orders/${orderId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ payment_method: serviceDraft.paymentMethod }),
      });
      setFlash({ tone: 'success', text: `Service order ${orderId} paid.` });
      await loadReservation(reservationData.reservation_code, true);
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setServiceBusy('');
    }
  }

  async function handleInvoiceCreate(event) {
    event.preventDefault();
    if (!reservationData) {
      setFlash({ tone: 'error', text: 'Load a reservation first.' });
      return;
    }

    setInvoiceBusy('create');
    try {
      const payload = await apiRequest('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          reservation_id: reservationData.reservation_id,
          invoice_type: invoiceDraft.invoice_type,
          billing_name: invoiceDraft.billing_name,
          billing_tax_no: invoiceDraft.billing_tax_no || null,
          billing_address: invoiceDraft.billing_address || null,
        }),
      });
      const detailPayload = await apiRequest(`/invoices/${payload.data.invoice_id}`);
      setInvoiceDetail(detailPayload.data);
      await loadReservation(reservationData.reservation_code, true);
      setFlash({ tone: 'success', text: `Invoice ${payload.data.invoice_no} generated.` });
    } catch (error) {
      if (error.message.includes('Invoice already exists')) {
        await loadReservation(reservationData.reservation_code, true);
        setFlash({ tone: 'success', text: 'Existing invoice loaded for this reservation.' });
      } else {
        setFlash({ tone: 'error', text: error.message });
      }
    } finally {
      setInvoiceBusy('');
    }
  }

  async function handleInvoiceSelect(invoiceId) {
    setInvoiceBusy(`load-${invoiceId}`);
    try {
      const payload = await apiRequest(`/invoices/${invoiceId}`);
      setInvoiceDetail(payload.data);
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setInvoiceBusy('');
    }
  }

  async function handleInvoiceIssue() {
    if (!invoiceDetail) return;
    setInvoiceBusy('issue');
    try {
      await apiRequest(`/invoices/${invoiceDetail.invoice_id}/issue`, { method: 'POST' });
      await loadReservation(reservationData.reservation_code, true);
      setFlash({ tone: 'success', text: 'Invoice issued.' });
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setInvoiceBusy('');
    }
  }

  return {
    reservationCode, setReservationCode,
    reservationBusy,
    reservationActionBusy,
    reservationData,
    reservationPayments,
    paymentDraft, setPaymentDraft,
    serviceCatalog,
    serviceOrders,
    serviceBusy,
    serviceDraft, setServiceDraft,
    invoiceList,
    invoiceDetail,
    invoiceBusy,
    invoiceDraft, setInvoiceDraft,
    loadReservation,
    handleReservationLookup,
    runReservationAction,
    handlePaymentSubmit,
    handleServiceOrder,
    handleServicePay,
    handleInvoiceCreate,
    handleInvoiceSelect,
    handleInvoiceIssue,
  };
}
