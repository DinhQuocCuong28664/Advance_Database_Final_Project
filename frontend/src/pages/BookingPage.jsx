import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Booking.css';
import { apiRequest } from '../lib/api';

const DEPOSIT_RATE = 0.30; // 30% mandatory

function nightsBetween(a, b) {
  const ms = new Date(b) - new Date(a);
  return Math.max(1, Math.round(ms / 86400000));
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function looksLikeEmail(value) {
  return /\S+@\S+\.\S+/.test(String(value || '').trim());
}

export default function BookingPage() {
  const { hotelId, roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { authSession, isGuestUser } = useAuth();

  const checkin     = searchParams.get('checkin')    || '';
  const checkout    = searchParams.get('checkout')   || '';
  const guests      = Number(searchParams.get('guests')) || 1;
  const nightlyRate = Number(searchParams.get('rate'))   || 0;
  const roomName    = searchParams.get('room_name')  || 'Selected room';

  const nights       = checkin && checkout ? nightsBetween(checkin, checkout) : 1;
  const subtotal     = nightlyRate * nights;
  const depositDue   = Math.round(subtotal * DEPOSIT_RATE);
  const balanceDue   = subtotal - depositDue;

  const [form, setForm] = useState({
    first_name:     authSession?.user?.first_name || '',
    last_name:      authSession?.user?.last_name  || '',
    email:          authSession?.user?.login_email || authSession?.user?.email || '',
    phone:          '',
    booking_email_otp: '',
    loyalty_redemption_code: '',
    special_requests: '',
    payment_method: 'CREDIT_CARD',
  });
  const [step, setStep]           = useState('details'); // details | confirm | done
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState(null);
  const [reservation, setReservation] = useState(null);
  const [emailStatus, setEmailStatus] = useState({ checking: false, exists: false, checkedEmail: '' });
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const enteredLoyaltyCode = String(form.loyalty_redemption_code || '').trim().toUpperCase();

  function setField(key, val) {
    setForm((s) => ({ ...s, [key]: val }));
  }

  useEffect(() => {
    if (isGuestUser) return undefined;

    const email = String(form.email || '').trim();
    if (!looksLikeEmail(email)) {
      setEmailStatus({ checking: false, exists: false, checkedEmail: '' });
      setOtpSent(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setEmailStatus((current) => ({ ...current, checking: true }));
      apiRequest('/auth/guest/booking-email-status', {
        method: 'POST',
        body: JSON.stringify({ login_email: email }),
      })
        .then((payload) => {
          const exists = Boolean(payload.data?.exists);
          setEmailStatus({ checking: false, exists, checkedEmail: email });
          if (!exists) {
            setOtpSent(false);
            setForm((current) => (current.booking_email_otp ? { ...current, booking_email_otp: '' } : current));
          }
        })
        .catch(() => {
          setEmailStatus({ checking: false, exists: false, checkedEmail: email });
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [form.email, isGuestUser]);

  async function handleSendBookingOtp() {
    const email = String(form.email || '').trim();
    if (!looksLikeEmail(email)) {
      setError('Enter a valid email address first.');
      return;
    }

    setOtpBusy(true);
    setError(null);
    try {
      await apiRequest('/auth/guest/booking-email-otp', {
        method: 'POST',
        body: JSON.stringify({ login_email: email }),
      });
      setOtpSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleConfirm(e) {
    e.preventDefault();
    if (step === 'details') { setStep('confirm'); return; }

    setBusy(true);
    setError(null);
    try {
      const guestId     = isGuestUser ? authSession?.user?.guest_id : null;
      const guestProfile = {
        first_name:   form.first_name,
        last_name:    form.last_name,
        email:        form.email,
        phone_number: form.phone || null,
      };

      //  Step 1: Create reservation 
      const resPayload = await apiRequest('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          hotel_id:             Number(hotelId),
          room_id:              Number(roomId),
          checkin_date:         checkin,
          checkout_date:        checkout,
          adult_count:          guests,
          nightly_rate:         nightlyRate,
          currency_code:        'VND',
          guest_id:             guestId || undefined,
          guest_profile:        guestProfile,
          special_request_text: form.special_requests || null,
          guarantee_type:       'DEPOSIT',
          purpose_of_stay:      'LEISURE',
          booking_source:       'DIRECT_WEB',
          booking_email_otp:    emailStatus.exists ? form.booking_email_otp || undefined : undefined,
          loyalty_redemption_code: enteredLoyaltyCode || undefined,
        }),
      });

      const res = resPayload.data || resPayload.reservation || resPayload;
      const serverDepositAmt = res.deposit_amount ?? depositDue;

      //  TODO: Enable VNPay when ready 
      // const vnpPayload = await apiRequest('/vnpay/create-payment', {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     reservation_id: res.reservation_id,
      //     amount:         serverDepositAmt,
      //     order_info:     `Dat coc dat phong ${res.reservation_code}`,
      //     locale:         'vn',
      //   }),
      // });
      // sessionStorage.setItem('pendingReservation', JSON.stringify({
      //   ...res, deposit_amount: serverDepositAmt,
      //   room_name: roomName, checkin, checkout, nights, subtotal, guests,
      // }));
      // window.location.href = vnpPayload.paymentUrl;
      // 

      //  Step 2: Mock payment  write DEPOSIT directly to DB 
      await apiRequest('/payments', {
        method: 'POST',
        body: JSON.stringify({
          reservation_id: res.reservation_id,
          amount:         serverDepositAmt,
          payment_method: form.payment_method,
          currency_code:  'VND',
          payment_type:   'DEPOSIT',
        }),
      }).catch(() => null); // non-blocking

      setReservation({ ...res, deposit_amount: serverDepositAmt });
      setStep('done');

    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  //  DONE 
  if (step === 'done' && reservation) {
    const paidDeposit  = reservation.deposit_amount ?? depositDue;
    const subtotalAmount = reservation.subtotal_amount ?? subtotal;
    const discountAmount = reservation.discount_amount ?? 0;
    const grandTotal   = reservation.total ?? reservation.grand_total_amount ?? subtotal;
    const remaining    = grandTotal - paidDeposit;

    return (
      <div className="booking-done">
        <div className="booking-done-icon"></div>
        <p className="page-eyebrow">Booking confirmed</p>
        <h1 className="booking-done-title">You're all set!</h1>
        <p className="booking-done-sub">
          Your reservation code is{' '}
          <strong className="booking-res-code">
            {reservation.reservation_code || reservation.reservation_id}
          </strong>.
          Save it to look up or manage your booking.
        </p>

        <div className="booking-done-summary">
          <div><span>Check-in</span><strong>{checkin}</strong></div>
          <div><span>Check-out</span><strong>{checkout}</strong></div>
          <div><span>Nights</span><strong>{nights}</strong></div>
          <div><span>Stay subtotal</span><strong>{fmt(subtotalAmount)} VND</strong></div>
          {discountAmount > 0 && (
            <div><span>Loyalty discount</span><strong>-{fmt(discountAmount)} VND</strong></div>
          )}
          <div><span>Total stay</span><strong>{fmt(grandTotal)} VND</strong></div>
          {reservation.loyalty_redemption_code && (
            <div className="booking-done-balance">
              <span>Applied voucher</span>
              <strong>{reservation.loyalty_redemption_code}</strong>
            </div>
          )}
          <div className="booking-done-deposit">
            <span>Deposit paid (30%)</span>
            <strong className="done-deposit-val">{fmt(paidDeposit)} VND</strong>
          </div>
          <div className="booking-done-balance">
            <span>Balance due at check-out</span>
            <strong>{fmt(remaining)} VND</strong>
          </div>
        </div>

        <div className="booking-done-actions">
          <button className="primary-button" type="button" onClick={() => navigate('/reservation')}>
            View reservation
          </button>
          <button className="ghost-button" type="button" onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  //  FORM 
  return (
    <div className="booking-page">
      {/*  PROGRESS BAR  */}
      <div className="booking-stepper">
        {['Your details', 'Confirm', 'Done'].map((s, i) => {
          const active = step === ['details', 'confirm', 'done'][i];
          const done   = (step === 'confirm' && i === 0) || step === 'done';
          return (
            <div key={s} className={`booking-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
              <span className="booking-step-num">{i + 1}</span>
              <span className="booking-step-label">{s}</span>
            </div>
          );
        })}
      </div>

      <div className="booking-layout">
        {/*  MAIN FORM  */}
        <form className="booking-form" onSubmit={handleConfirm}>
          {step === 'details' && (
            <>
              <h2 className="booking-section-title">Your details</h2>
              {isGuestUser && (
                <p className="booking-member-note">
                   You're booking as a loyalty member. Your details are pre-filled.
                </p>
              )}
              {!isGuestUser && emailStatus.checking && (
                <p className="booking-inline-note">Checking whether this email already exists...</p>
              )}
              <div className="booking-form-grid">
                <label>
                  First name
                  <input required value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} />
                </label>
                <label>
                  Last name
                  <input required value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} />
                </label>
                <label className="field-span-2">
                  Email
                  <input type="email" required value={form.email} onChange={(e) => setField('email', e.target.value)} />
                </label>
                {!isGuestUser && emailStatus.exists && emailStatus.checkedEmail === String(form.email || '').trim() && (
                  <div className="field-span-2 booking-email-otp-block">
                    <div className="booking-existing-email-note">
                      <strong>Email already exists in the system.</strong>
                      <span>Enter the OTP sent to this email to continue the booking with the existing guest profile.</span>
                    </div>
                    <div className="booking-otp-row">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Enter OTP code"
                        value={form.booking_email_otp}
                        onChange={(e) => setField('booking_email_otp', e.target.value.replace(/\D/g, '').slice(0, 6))}
                      />
                      <button type="button" className="ghost-button" onClick={handleSendBookingOtp} disabled={otpBusy}>
                        {otpBusy ? 'Sending...' : otpSent ? 'Resend OTP' : 'Send OTP'}
                      </button>
                    </div>
                    {otpSent && <small className="booking-otp-help">A verification code was sent to {form.email}.</small>}
                  </div>
                )}
                <label className="field-span-2">
                  Phone (optional)
                  <input type="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                </label>
                <label className="field-span-2">
                  Loyalty voucher code (optional)
                  <input
                    type="text"
                    value={form.loyalty_redemption_code}
                    onChange={(e) => setField('loyalty_redemption_code', e.target.value.toUpperCase())}
                    placeholder="Enter a redeemed loyalty voucher code"
                  />
                  <small className="booking-field-help">
                    Redeem member-only rewards in your account first, then apply the issued code here.
                  </small>
                </label>
                <label className="field-span-2">
                  Special requests (optional)
                  <textarea rows={3} value={form.special_requests} onChange={(e) => setField('special_requests', e.target.value)} placeholder="E.g. high floor, late check-in..." />
                </label>
                <label className="field-span-2">
                  Payment method
                  <select value={form.payment_method} onChange={(e) => setField('payment_method', e.target.value)}>
                    <option value="CREDIT_CARD">Credit card</option>
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="WALLET">Digital wallet</option>
                  </select>
                </label>
              </div>

              {/* Deposit notice */}
              <div className="booking-deposit-notice">
                <span className="deposit-notice-icon">i</span>
                <span>
                  A non-refundable deposit of{' '}
                  <strong>{fmt(depositDue)} VND</strong>{' '}
                  (30% of total) is charged at booking. The remaining{' '}
                  <strong>{fmt(balanceDue)} VND</strong> is due at check-out.
                </span>
              </div>

              <button className="primary-button booking-next-btn" type="submit">
                Continue to confirm 
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <h2 className="booking-section-title">Review your booking</h2>
              <div className="booking-review">
                <div><span>Name</span><strong>{form.first_name} {form.last_name}</strong></div>
                <div><span>Email</span><strong>{form.email}</strong></div>
                {form.phone && <div><span>Phone</span><strong>{form.phone}</strong></div>}
                {enteredLoyaltyCode && <div><span>Loyalty voucher</span><strong>{enteredLoyaltyCode}</strong></div>}
                {form.special_requests && <div><span>Requests</span><strong>{form.special_requests}</strong></div>}
                <div><span>Payment</span><strong>{form.payment_method.replace('_', ' ')}</strong></div>
              </div>

              <div className="booking-deposit-notice">
                <span className="deposit-notice-icon"></span>
                <span>
                  By confirming, you authorise a deposit charge of{' '}
                  <strong>{fmt(depositDue)} VND</strong>.
                  {enteredLoyaltyCode ? ' If the voucher is valid, the final charge will be recalculated after the discount is applied.' : ''}
                  This deposit is <strong>non-refundable</strong> upon cancellation.
                </span>
              </div>

              {error && <p className="booking-error">{error}</p>}
              <div className="booking-confirm-actions">
                <button type="button" className="ghost-button" onClick={() => setStep('details')}> Edit details</button>
                <button className="primary-button" type="submit" disabled={busy}>
                  {busy ? 'Confirming...' : `Pay deposit ${fmt(depositDue)} VND`}
                </button>
              </div>
            </>
          )}
        </form>

        {/*  SUMMARY SIDEBAR  */}
        <aside className="booking-summary">
          <h3 className="booking-summary-title">Booking summary</h3>
          <div className="booking-summary-body">
            <div className="booking-summary-row">
              <span>Room</span><strong>{roomName}</strong>
            </div>
            <div className="booking-summary-row">
              <span>Check-in</span><strong>{checkin}</strong>
            </div>
            <div className="booking-summary-row">
              <span>Check-out</span><strong>{checkout}</strong>
            </div>
            <div className="booking-summary-row">
              <span>{nights} night{nights > 1 ? 's' : ''}  {fmt(nightlyRate)} VND</span>
              <strong>{fmt(subtotal)} VND</strong>
            </div>
            {enteredLoyaltyCode && (
              <div className="booking-summary-row">
                <span>Loyalty voucher</span>
                <strong>{enteredLoyaltyCode}</strong>
              </div>
            )}
            <div className="booking-summary-row">
              <span>Guests</span><strong>{guests}</strong>
            </div>
            <hr className="booking-summary-divider" />
            <div className="booking-summary-total">
              <span>Total stay</span>
              <strong>{fmt(subtotal)} VND</strong>
            </div>
            <hr className="booking-summary-divider" />
            <div className="booking-summary-row booking-deposit-row">
              <span>Deposit now (30%)</span>
              <strong className="deposit-highlight">{fmt(depositDue)} VND</strong>
            </div>
            <div className="booking-summary-row">
              <span>Balance at check-out</span>
              <strong>{fmt(balanceDue)} VND</strong>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
