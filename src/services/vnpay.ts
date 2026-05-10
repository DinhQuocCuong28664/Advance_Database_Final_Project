/**
 * VNPay Payment Service
 * Docs: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 */
const crypto = require('crypto');
const qs = require('qs');

type VnpayParams = Record<string, string | number | undefined | null>;

type CreatePaymentUrlInput = {
  amount: number;
  txnRef: string;
  orderInfo: string;
  locale?: string;
  ipAddr?: string;
  expireMinutes?: number;
};

type VnpayReturn = {
  valid: boolean;
  responseCode: string;
  txnRef: string;
  amount: number;
  bankCode?: string;
  transactionNo?: string;
  payDate?: string;
  orderInfo?: string;
};

const {
  VNPAY_TMN_CODE,
  VNPAY_HASH_SECRET,
  VNPAY_URL,
  VNPAY_RETURN_URL,
  VNPAY_IPN_URL,
} = process.env;

function isConfigured() {
  return Boolean(VNPAY_TMN_CODE && VNPAY_HASH_SECRET && VNPAY_URL);
}

//  Format date yyyyMMddHHmmss (GMT+7) 
function vnpDate(date = new Date()) {
  const d = new Date(date.getTime() + 7 * 60 * 60 * 1000); // GMT+7
  return d.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
}

//  HMAC-SHA512 signature 
function sign(data: string) {
  return crypto
    .createHmac('sha512', VNPAY_HASH_SECRET as string)
    .update(Buffer.from(data, 'utf-8'))
    .digest('hex');
}

//  Build sorted query string for signing 
function sortedQueryString(params: VnpayParams) {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== null && params[k] !== undefined)
    .sort();
  
  const parts = keys.map((k) => {
    // VNPay expects encodeURIComponent format
    return `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k])).replace(/%20/g, '+')}`;
  });
  
  return parts.join('&');
}

/**
 * Create VNPay payment URL
 * @param {Object} opts
 * @param {number} opts.amount          - Amount in VND (integer)
 * @param {string} opts.txnRef          - Unique transaction ref (reservation_code)
 * @param {string} opts.orderInfo       - Description shown to user
 * @param {string} [opts.locale]        - 'vn' | 'en'
 * @param {string} [opts.ipAddr]        - Client IP
 * @param {number} [opts.expireMinutes] - Payment window (default 15 min)
 */
function createPaymentUrl({ amount, txnRef, orderInfo, locale = 'vn', ipAddr = '127.0.0.1', expireMinutes = 15 }: CreatePaymentUrlInput) {
  if (!isConfigured()) {
    throw new Error('VNPay is not configured. Set VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_URL in .env');
  }

  const now     = new Date();
  const expire  = new Date(now.getTime() + expireMinutes * 60 * 1000);

  const params = {
    vnp_Version:     '2.1.0',
    vnp_Command:     'pay',
    vnp_TmnCode:     VNPAY_TMN_CODE,
    vnp_Amount:      Math.round(amount) * 100,   // VNPay uses amount * 100
    vnp_CurrCode:    'VND',
    vnp_TxnRef:      txnRef,
    vnp_OrderInfo:   orderInfo.slice(0, 255),    // max 255 chars
    vnp_OrderType:   'other',
    vnp_Locale:      locale,
    vnp_ReturnUrl:   VNPAY_RETURN_URL,
    vnp_IpAddr:      ipAddr,
    vnp_CreateDate:  vnpDate(now),
    vnp_ExpireDate:  vnpDate(expire),
  };

  const queryStr   = sortedQueryString(params);
  const secureHash = sign(queryStr);

  return `${VNPAY_URL}?${queryStr}&vnp_SecureHash=${secureHash}`;
}

/**
 * Verify IPN / return URL signature
 * @param {Object} query - req.query from VNPay callback
 * @returns {{ valid: boolean, responseCode: string, txnRef: string, amount: number }}
 */
function verifyReturn(query: VnpayParams): VnpayReturn {
  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = query;

  // Remove hash fields, sort, re-sign
  const queryStr        = sortedQueryString(rest);
  const expectedHash    = sign(queryStr);
  const valid           = expectedHash === String(vnp_SecureHash || '').toLowerCase();

  return {
    valid,
    responseCode: String(rest.vnp_ResponseCode || ''),
    txnRef:       String(rest.vnp_TxnRef || ''),
    amount:       Math.round(Number(rest.vnp_Amount || 0) / 100), // convert back from *100
    bankCode:     rest.vnp_BankCode ? String(rest.vnp_BankCode) : undefined,
    transactionNo: rest.vnp_TransactionNo ? String(rest.vnp_TransactionNo) : undefined,
    payDate:      rest.vnp_PayDate ? String(rest.vnp_PayDate) : undefined,
    orderInfo:    rest.vnp_OrderInfo ? String(rest.vnp_OrderInfo) : undefined,
  };
}

module.exports = { isConfigured, createPaymentUrl, verifyReturn };
