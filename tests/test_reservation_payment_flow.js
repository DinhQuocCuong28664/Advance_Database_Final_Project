/**
 * LuxeReserve  Reservation & Payment Flow Test
 * Run: node tests/test_reservation_payment_flow.js
 */

const BASE_URL = 'http://localhost:3000/api/v1';

async function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runTest() {
  console.log('');
  console.log('   TEST FLOW: RESERVATION  PAYMENT  CHECK-OUT');
  console.log('\n');

  try {
// ------------------------------------------------------------
    // STEP 1: RESERVATION
// ------------------------------------------------------------
    console.log(' [STEP 1] Guest searches for available rooms and booking...');
    const nightly_rate_thb = 8500;
    const nights = 2; // 2 nights

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
        checkout_date: '2026-04-12', // 2 days
        adult_count: 2,
        nightly_rate: nightly_rate_thb,
        currency_code: 'THB',
        guarantee_type: 'DEPOSIT'
      })
    });
    
    let responseBody = await res.json();
    if(!responseBody.success) throw new Error(responseBody.error || responseBody.message || JSON.stringify(responseBody));
    
    const reservation = responseBody.data;
    const TOTAL_AMOUNT = nightly_rate_thb * nights; // 17000
    console.log(`   Booking successful! Code: ${reservation.reservation_code}`);
    console.log(`   Estimated total: ${TOTAL_AMOUNT} THB`);
    await delay(1000);

// ------------------------------------------------------------
    // STEP 2: DEPOSIT PAYMENT (30%)
// ------------------------------------------------------------
    const depositAmount = TOTAL_AMOUNT * 0.3; // 30% = 5100
    console.log(`\n [STEP 2] Guest pays 30% deposit (${depositAmount} THB)...`);
    
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
    console.log(`   Deposit recorded. TXN Code: ${responseBody.data.payment_reference}`);
    await delay(1000);

    // CHECK BALANCE AGAIN FROM VIEW
    console.log(`\n Checking via financial View vw_ReservationTotal:`);
    res = await fetch(`${BASE_URL}/reservations/${reservation.reservation_code}`);
    responseBody = await res.json();
    let fin = responseBody.data;
    console.log(`   - Total receivable:  ${fin.grand_total}`);
    console.log(`   - Total paid:    ${fin.total_paid}`);
    console.log(`   - Remaining balance:     ${fin.balance_due}`);
    await delay(1000);

// ------------------------------------------------------------
    // STEP 3: PAY REMAINING AMOUNT (70%) UPON ARRIVAL
// ------------------------------------------------------------
    const remainingAmount = fin.balance_due;
    console.log(`\n [STEP 3] Guest arrives, pays remaining balance (${remainingAmount} THB)...`);
    
    res = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservation_id: reservation.reservation_id,
        payment_type: 'FULL_PAYMENT',
        payment_method: 'WALLET', // Use e-wallet
        amount: remainingAmount,
        currency_code: 'THB'
      })
    });
    responseBody = await res.json();
    console.log(`   Fully paid. TXN Code: ${responseBody.data.payment_reference}`);
    await delay(1000);

// ------------------------------------------------------------
    // STEP 4: CHECK-IN
// ------------------------------------------------------------
    console.log(`\n [STEP 4] Receptionist performs Check-In...`);
    res = await fetch(`${BASE_URL}/reservations/${reservation.reservation_id}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: 4 }) // Agent Somchai
    });
    responseBody = await res.json();
    console.log(`   Guest has been Checked-In to the room (Room Status: OCCUPIED)`);
    await delay(1000);

// ------------------------------------------------------------
    // STEP 5: CHECK-OUT AND CHECK BALANCE VIA API
// ------------------------------------------------------------
    console.log(`\n [STEP 5] Receptionist performs Check-Out 2 days later...`);
    res = await fetch(`${BASE_URL}/reservations/${reservation.reservation_id}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: 4 })
    });
    responseBody = await res.json();
    console.log(`   Check-Out successful!`);
    console.log(`\n FINAL FINANCIAL SETTLEMENT AT CHECK-OUT:`);
    console.log(`   - Total room fee:   ${responseBody.financials.grand_total}`);
    console.log(`   - Actual collected:     ${responseBody.financials.total_paid}`);
    console.log(`   - BALANCE (DEBT):      ${responseBody.financials.balance_due}`);
    
    if(responseBody.financials.balance_due === 0){
        console.log(`\n EXCELLENT! Transaction fully settled during the reservation lifecycle.`);
    }

  } catch (err) {
    console.error(' ERROR OCCURRED:', err.message);
  }
}

runTest();
