const nodemailer = require('nodemailer');

let transporter = null;

function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!isMailConfigured()) throw new Error('Mail service is not configured');
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

//  Shared HTML wrapper 
function htmlWrap(bodyHtml) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </head>
    <body style="margin:0;padding:0;background:#f5f0eb;font-family:'Segoe UI',Arial,sans-serif;color:#1b2c33;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#fffdf9;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            <!-- Header -?
            <tr>
              <td style="background:#143d42;padding:28px 36px;">
                <span style="font-size:22px;font-weight:700;color:#c8a96e;letter-spacing:0.1em;">LuxeReserve</span>
              </td>
            </tr>
            <!-- Body -?
            <tr><td style="padding:32px 36px;">${bodyHtml}</td></tr>
            <!-- Footer -?
            <tr>
              <td style="background:#f0ebe4;padding:18px 36px;font-size:12px;color:#8a8a8a;text-align:center;">
                 LuxeReserve  Global Luxury Hotel Reservation Engine<br />
                This email was sent to you because you have a reservation with us.
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

//  Safe send (fire-and-forget, logs on failure) 
async function safeSend(mailOptions) {
  if (!isMailConfigured()) {
    console.log('[Mail] SMTP not configured  skipping email:', mailOptions.subject);
    return;
  }
  try {
    const mailer = getTransporter();
    const from = process.env.MAIL_FROM || process.env.SMTP_USER;
    await mailer.sendMail({ from, ...mailOptions });
    console.log(`[Mail]  Sent "${mailOptions.subject}" to ${mailOptions.to}`);
  } catch (err) {
    console.error('[Mail]  Failed to send email:', err.message);
  }
}

//  1. OTP Verification 
async function sendGuestVerificationOtp({ to, fullName, otpCode }) {
  await safeSend({
    to,
    subject: 'LuxeReserve  Your verification code',
    text: `Hello ${fullName || 'guest'},\n\nYour verification code is: ${otpCode}\n\nExpires in 10 minutes.`,
    html: htmlWrap(`
      <h2 style="margin:0 0 16px;color:#143d42;">Welcome to LuxeReserve</h2>
      <p style="margin:0 0 8px;">Hello <strong>${fullName || 'guest'}</strong>,</p>
      <p style="margin:0 0 16px;">Your email verification code is:</p>
      <div style="background:#143d42;color:#c8a96e;font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;border-radius:12px;margin:0 0 16px;">
        ${otpCode}
      </div>
      <p style="margin:0;color:#888;">This code expires in 10 minutes. If you did not create this account, you can safely ignore this email.</p>
    `),
  });
}

async function sendGuestBookingAccessOtp({ to, fullName, otpCode }) {
  await safeSend({
    to,
    subject: 'LuxeReserve  Booking verification code',
    text: `Hello ${fullName || 'guest'},\n\nUse this one-time code to continue your reservation with your existing email: ${otpCode}\n\nExpires in 10 minutes.`,
    html: htmlWrap(`
      <h2 style="margin:0 0 16px;color:#143d42;">Confirm your booking email</h2>
      <p style="margin:0 0 8px;">Hello <strong>${fullName || 'guest'}</strong>,</p>
      <p style="margin:0 0 16px;">We detected that this email is already linked to a LuxeReserve guest account. Enter this one-time code in the booking form to continue:</p>
      <div style="background:#143d42;color:#c8a96e;font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;border-radius:12px;margin:0 0 16px;">
        ${otpCode}
      </div>
      <p style="margin:0;color:#888;">This code expires in 10 minutes. If you did not request this booking, you can ignore this email.</p>
    `),
  });
}

async function sendGuestPasswordResetOtp({ to, fullName, otpCode }) {
  await safeSend({
    to,
    subject: 'LuxeReserve  Password reset code',
    text: `Hello ${fullName || 'guest'},\n\nUse this code to reset your LuxeReserve password: ${otpCode}\n\nExpires in 10 minutes.`,
    html: htmlWrap(`
      <h2 style="margin:0 0 16px;color:#143d42;">Reset your password</h2>
      <p style="margin:0 0 8px;">Hello <strong>${fullName || 'guest'}</strong>,</p>
      <p style="margin:0 0 16px;">Use this one-time code to reset your LuxeReserve password:</p>
      <div style="background:#143d42;color:#c8a96e;font-size:36px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;border-radius:12px;margin:0 0 16px;">
        ${otpCode}
      </div>
      <p style="margin:0;color:#888;">This code expires in 10 minutes. If you did not request a password reset, you can ignore this email.</p>
    `),
  });
}

//  2. Booking Confirmation 
async function sendBookingConfirmation({ to, fullName, reservation }) {
  const {
    reservation_code, hotel_name, room_type_name, room_number,
    checkin_date, checkout_date, nights, adult_count,
    grand_total_amount, currency_code, special_request_text,
  } = reservation;

  const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtMoney = (n) => Number(n || 0).toLocaleString('en-US');

  await safeSend({
    to,
    subject: `LuxeReserve  Booking confirmed: ${reservation_code}`,
    text: [
      `Hello ${fullName || 'guest'},`,
      '',
      `Your reservation has been confirmed!`,
      `Reservation code: ${reservation_code}`,
      `Hotel: ${hotel_name}`,
      `Room: ${room_type_name || ''}${room_number ? ` (Room ${room_number})` : ''}`,
      `Check-in: ${fmt(checkin_date)}`,
      `Check-out: ${fmt(checkout_date)}`,
      `Nights: ${nights} | Guests: ${adult_count}`,
      `Total: ${fmtMoney(grand_total_amount)} ${currency_code || 'VND'}`,
      special_request_text ? `Special requests: ${special_request_text}` : '',
      '',
      `To view your booking details, visit: ${process.env.APP_URL || 'http://localhost:5173'}/reservation`,
    ].filter((l) => l !== undefined).join('\n'),
    html: htmlWrap(`
      <h2 style="margin:0 0 4px;color:#143d42;">Booking Confirmed </h2>
      <p style="margin:0 0 24px;color:#888;">Hello <strong>${fullName || 'guest'}</strong>, your stay is all set.</p>

      <div style="background:#f5f0eb;border-radius:12px;padding:20px 24px;margin:0 0 20px;">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:.1em;color:#888;text-transform:uppercase;">Confirmation code</p>
        <p style="margin:0;font-size:22px;font-weight:700;color:#143d42;letter-spacing:.05em;">${reservation_code}</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:14px;width:40%;">Hotel</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">${hotel_name}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:14px;">Room</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;">${room_type_name || 'Standard'}${room_number ? `  Room ${room_number}` : ''}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:14px;">Check-in</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;">${fmt(checkin_date)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:14px;">Check-out</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;">${fmt(checkout_date)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:14px;">Duration</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;">${nights} night${nights > 1 ? 's' : ''}, ${adult_count} guest${adult_count > 1 ? 's' : ''}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#888;font-size:14px;">Total paid</td>
          <td style="padding:10px 0;font-weight:700;font-size:18px;color:#143d42;">${fmtMoney(grand_total_amount)} ${currency_code || 'VND'}</td>
        </tr>
        ${special_request_text ? `
        <tr>
          <td style="padding:10px 0;color:#888;font-size:14px;">Special requests</td>
          <td style="padding:10px 0;font-style:italic;">${special_request_text}</td>
        </tr>` : ''}
      </table>

      <a href="${process.env.APP_URL || 'http://localhost:5173'}/reservation"
         style="display:inline-block;background:#143d42;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;">
        View my reservation 
      </a>
    `),
  });
}

//  3. Cancellation Notice 
async function sendCancellationNotice({ to, fullName, reservation, cancelledBy = 'guest', reason }) {
  const { reservation_code, hotel_name, checkin_date, checkout_date } = reservation;
  const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const byMsg = cancelledBy === 'hotel' ? 'cancelled by the property' : 'cancelled at your request';

  await safeSend({
    to,
    subject: `LuxeReserve  Reservation ${reservation_code} cancelled`,
    text: [
      `Hello ${fullName || 'guest'},`,
      '',
      `Your reservation ${reservation_code} has been ${byMsg}.`,
      `Hotel: ${hotel_name}`,
      `Check-in: ${fmt(checkin_date)} | Check-out: ${fmt(checkout_date)}`,
      reason ? `Reason: ${reason}` : '',
      '',
      cancelledBy === 'hotel'
        ? 'A full refund will be processed within 510 business days. We apologise for the inconvenience.'
        : 'No refund will be issued for guest-initiated cancellations after the deposit window.',
      '',
      `Questions? Visit ${process.env.APP_URL || 'http://localhost:5173'}/reservation`,
    ].filter((l) => l !== undefined).join('\n'),
    html: htmlWrap(`
      <h2 style="margin:0 0 4px;color:#c0392b;">Reservation Cancelled</h2>
      <p style="margin:0 0 24px;color:#888;">Hello <strong>${fullName || 'guest'}</strong>,</p>

      <div style="background:#fff0ef;border:1px solid rgba(192,57,43,0.2);border-radius:12px;padding:20px 24px;margin:0 0 20px;">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:.1em;color:#c0392b;text-transform:uppercase;">Cancelled reservation</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#1b2c33;">${reservation_code}</p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:14px;width:40%;">Hotel</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">${hotel_name}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:14px;">Original check-in</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;">${fmt(checkin_date)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:14px;">Cancelled by</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;">${cancelledBy === 'hotel' ? 'Property' : 'You (guest)'}</td>
        </tr>
        ${reason ? `
        <tr>
          <td style="padding:10px 0;color:#888;font-size:14px;">Reason</td>
          <td style="padding:10px 0;font-style:italic;">${reason}</td>
        </tr>` : ''}
      </table>

      <p style="margin:0 0 20px;padding:14px 18px;background:#f5f0eb;border-radius:10px;font-size:14px;">
        ${cancelledBy === 'hotel'
          ? ' A full refund will be processed within 510 business days. We sincerely apologise for any inconvenience.'
          : ' Per our cancellation policy, deposits are non-refundable for guest-initiated cancellations.'}
      </p>

      <a href="${process.env.APP_URL || 'http://localhost:5173'}/reservation"
         style="display:inline-block;background:#143d42;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;">
        View reservation status 
      </a>
    `),
  });
}

//  4. Check-in Reminder 
async function sendCheckinReminder({ to, fullName, reservation }) {
  const { reservation_code, hotel_name, checkin_date, checkout_date } = reservation;
  const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  await safeSend({
    to,
    subject: `LuxeReserve  Check-in confirmed: ${reservation_code}`,
    text: `Hello ${fullName || 'guest'},\n\nYou have successfully checked in to ${hotel_name}.\nReservation: ${reservation_code}\nCheck-out: ${fmt(checkout_date)}\n\nEnjoy your stay!`,
    html: htmlWrap(`
      <h2 style="margin:0 0 4px;color:#143d42;">Welcome! You're checked in </h2>
      <p style="margin:0 0 24px;color:#888;">Hello <strong>${fullName || 'guest'}</strong>, enjoy your stay.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:14px;width:40%;">Hotel</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">${hotel_name}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;color:#888;font-size:14px;">Reservation</td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600;">${reservation_code}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#888;font-size:14px;">Check-out</td>
          <td style="padding:10px 0;font-weight:600;">${fmt(checkout_date)}</td>
        </tr>
      </table>
    `),
  });
}

module.exports = {
  isMailConfigured,
  sendGuestVerificationOtp,
  sendGuestBookingAccessOtp,
  sendGuestPasswordResetOtp,
  sendBookingConfirmation,
  sendCancellationNotice,
  sendCheckinReminder,
};
