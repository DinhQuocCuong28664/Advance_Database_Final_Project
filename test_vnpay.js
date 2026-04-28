const qs = require('qs');

const params = {
  vnp_Version: '2.1.0',
  vnp_Command: 'pay',
  vnp_TmnCode: '3ZEQZZ0D',
  vnp_Amount: 1000000,
  vnp_CurrCode: 'VND',
  vnp_TxnRef: 'R-12345',
  vnp_OrderInfo: 'Dat coc dat phong R-12345',
  vnp_OrderType: 'other',
  vnp_Locale: 'vn',
  vnp_ReturnUrl: 'http://localhost/return',
  vnp_IpAddr: '127.0.0.1',
  vnp_CreateDate: '20230101120000',
};

// 1. My current method
function sortedQueryString(p) {
  const keys = Object.keys(p)
    .filter((k) => p[k] !== '' && p[k] !== null && p[k] !== undefined)
    .sort();
  
  const parts = keys.map((k) => {
    return `${encodeURIComponent(k)}=${encodeURIComponent(p[k]).replace(/%20/g, '+')}`;
  });
  
  return parts.join('&');
}
const myStr = sortedQueryString(params);

// 2. Old VNPay example method
function sortObject(obj) {
  let sorted = {};
  let str = [];
  for (let key in obj){
    if (obj.hasOwnProperty(key)) str.push(encodeURIComponent(key));
  }
  str.sort();
  for (let key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
  }
  return sorted;
}
const vnpStr = qs.stringify(sortObject(params), { encode: false });

console.log('My  :', myStr);
console.log('VNP :', vnpStr);
console.log('Match?', myStr === vnpStr);
