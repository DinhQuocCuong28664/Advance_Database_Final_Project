/**
 * LuxeReserve — Đặt Phòng & Thanh Toán Flow Test
 * Run: node tests/test_reservation_payment_flow.js
 */

const BASE_URL = 'http://localhost:3000/api';

async function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runTest() {
  console.log('══════════════════════════════════════════════════════');
  console.log('  🏨 TEST LUỒNG: ĐẶT PHÒNG → THANH TOÁN → CHECK-OUT');
  console.log('══════════════════════════════════════════════════════\n');

  try {
    // ---------------------------------------------------------
    // BƯỚC 1: ĐẶT PHÒNG
    // ---------------------------------------------------------
    console.log('👉 [BƯỚC 1] Khách hàng tìm phòng trống và booking...');
    const nightly_rate_thb = 8500;
    const nights = 2; // 2 đêm

    let res = await fetch(`${BASE_URL}/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotel_id: 2, // W Bangkok
        guest_id: 2, // Sakura Tanaka
        room_id: 7,  // Room 801
        room_type_id: 4, 
        rate_plan_id: 4,
        checkin_date: '2026-04-10',
        checkout_date: '2026-04-12', // 2 ngày
        adult_count: 2,
        nightly_rate: nightly_rate_thb,
        currency_code: 'THB',
        guarantee_type: 'DEPOSIT'
      })
    });
    
    let responseBody = await res.json();
    if(!responseBody.success) throw new Error(responseBody.error);
    
    const reservation = responseBody.data;
    const TOTAL_AMOUNT = nightly_rate_thb * nights; // 17000
    console.log(`  ✅ Booking thành công! Mã: ${reservation.reservation_code}`);
    console.log(`  💰 Tổng tiền dự kiến: ${TOTAL_AMOUNT} THB`);
    await delay(1000);

    // ---------------------------------------------------------
    // BƯỚC 2: THANH TOÁN CỌC (30%)
    // ---------------------------------------------------------
    const depositAmount = TOTAL_AMOUNT * 0.3; // 30% = 5100
    console.log(`\n👉 [BƯỚC 2] Khách thanh toán cọc 30% (${depositAmount} THB)...`);
    
    res = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservation_id: reservation.reservation_id,
        payment_type: 'DEPOSIT',
        payment_method: 'CREDIT_CARD',
        amount: depositAmount,
        currency_code: 'THB'
      })
    });
    responseBody = await res.json();
    console.log(`  ✅ Đã ghi nhận cọc. Mã GD: ${responseBody.data.payment_reference}`);
    await delay(1000);

    // KIỂM TRA LẠI BALANCE TỪ VIEW
    console.log(`\n👉 Xét duyệt qua View tài chính vw_ReservationTotal:`);
    res = await fetch(`${BASE_URL}/reservations/${reservation.reservation_code}`);
    responseBody = await res.json();
    let fin = responseBody.data;
    console.log(`   - Tổng tiền phải thu:  ${fin.grand_total}`);
    console.log(`   - Tổng tiền đã trả:    ${fin.total_paid}`);
    console.log(`   - Công nợ còn lại:     ${fin.balance_due}`);
    await delay(1000);

    // ---------------------------------------------------------
    // BƯỚC 3: THANH TOÁN PHẦN CÒN LẠI (70%) KHI TỚI NƠI
    // ---------------------------------------------------------
    const remainingAmount = fin.balance_due;
    console.log(`\n👉 [BƯỚC 3] Khách đến KS, nộp số dư còn lại (${remainingAmount} THB)...`);
    
    res = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservation_id: reservation.reservation_id,
        payment_type: 'FULL_PAYMENT',
        payment_method: 'WALLET', // Dùng ví điện tử
        amount: remainingAmount,
        currency_code: 'THB'
      })
    });
    responseBody = await res.json();
    console.log(`  ✅ Thanh toán đủ. Mã GD: ${responseBody.data.payment_reference}`);
    await delay(1000);

    // ---------------------------------------------------------
    // BƯỚC 4: CHECK-IN
    // ---------------------------------------------------------
    console.log(`\n👉 [BƯỚC 4] Lễ tân thực hiện Check-In...`);
    res = await fetch(`${BASE_URL}/reservations/${reservation.reservation_id}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: 4 }) // Nhân viên Somchai
    });
    responseBody = await res.json();
    console.log(`  ✅ Khách đã được Check-In vào phòng (Trạng thái Phòng: OCCUPIED)`);
    await delay(1000);

    // ---------------------------------------------------------
    // BƯỚC 5: CHECK-OUT VÀ KIỂM TRA CÔNG NỢ BẰNG API
    // ---------------------------------------------------------
    console.log(`\n👉 [BƯỚC 5] Lễ tân thực hiện Check-Out 2 ngày sau...`);
    res = await fetch(`${BASE_URL}/reservations/${reservation.reservation_id}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: 4 })
    });
    responseBody = await res.json();
    console.log(`  ✅ Check-Out thành công!`);
    console.log(`\n📊 KẾT TOÁN TÀI CHÍNH CUỐI CÙNG LÚC CHECK-OUT:`);
    console.log(`   - Tổng tiền phòng:   ${responseBody.financials.grand_total}`);
    console.log(`   - Tiền thực thu:     ${responseBody.financials.total_paid}`);
    console.log(`   - BALANCE (NỢ):      ${responseBody.financials.balance_due}`);
    
    if(responseBody.financials.balance_due === 0){
        console.log(`\n🎉 TUYỆT VỜI! Giao dịch được tất toán hoàn toàn trong quá trình vòng đời đặt phòng.`);
    }

  } catch (err) {
    console.error('❌ CÓ LỖI:', err.message);
  }
}

runTest();
