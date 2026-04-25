import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

export default function VnpayReturnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const status   = searchParams.get('status');   // success | failed | invalid | error
  const code     = searchParams.get('code');      // vnp_ResponseCode
  const txnRef   = searchParams.get('txnRef');
  const amount   = Number(searchParams.get('amount') || 0);
  const bankCode = searchParams.get('bankCode');
  const transNo  = searchParams.get('transNo');

  const [resv, setResv] = useState(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('pendingReservation');
      if (stored) setResv(JSON.parse(stored));
    } catch (_) {}
  }, []);

  const isSuccess = status === 'success';

  return (
    <div className="vnpay-return-page">
      <div className={`vnpay-result-card ${isSuccess ? 'vnpay-success' : 'vnpay-failed'}`}>
        <div className="vnpay-result-icon">{isSuccess ? '' : ''}</div>

        <p className="page-eyebrow">{isSuccess ? 'Payment successful' : 'Payment unsuccessful'}</p>

        <h1 className="vnpay-result-title">
          {isSuccess ? 'Deposit paid!' : 'Payment failed'}
        </h1>

        <p className="vnpay-result-sub">
          {isSuccess
            ? 'Your deposit has been received. Your reservation is confirmed.'
            : `Payment could not be completed (code: ${code || status}). Please try again or contact support.`}
        </p>

        {/* Transaction details */}
        <div className="vnpay-result-table">
          {txnRef && (
            <div>
              <span>Reservation code</span>
              <strong className="booking-res-code">{txnRef}</strong>
            </div>
          )}
          {isSuccess && amount > 0 && (
            <div>
              <span>Deposit paid</span>
              <strong className="done-deposit-val">{fmt(amount)} VND</strong>
            </div>
          )}
          {resv && (
            <>
              {resv.checkin && (
                <div><span>Check-in</span><strong>{resv.checkin}</strong></div>
              )}
              {resv.checkout && (
                <div><span>Check-out</span><strong>{resv.checkout}</strong></div>
              )}
              {resv.nights && (
                <div><span>Nights</span><strong>{resv.nights}</strong></div>
              )}
              {resv.subtotal != null && !isNaN(resv.subtotal) && (
                <div>
                  <span>Total stay</span>
                  <strong>{fmt(resv.subtotal)} VND</strong>
                </div>
              )}
              {resv.subtotal != null && amount > 0 && (
                <div>
                  <span>Balance at check-out</span>
                  <strong>{fmt(resv.subtotal - amount)} VND</strong>
                </div>
              )}
            </>
          )}
          {bankCode && (
            <div><span>Bank</span><strong>{bankCode}</strong></div>
          )}
          {transNo && (
            <div><span>Transaction No.</span><strong>{transNo}</strong></div>
          )}
        </div>

        <div className="vnpay-result-actions">
          {isSuccess ? (
            <>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('pendingReservation');
                  navigate('/reservation');
                }}
              >
                View my reservation
              </button>
              <button className="ghost-button" type="button" onClick={() => navigate('/')}>
                Back to home
              </button>
            </>
          ) : (
            <>
              <button className="ghost-button" type="button" onClick={() => navigate(-1)}>
                 Go back
              </button>
              <button className="primary-button" type="button" onClick={() => navigate('/')}>
                Back to home
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
