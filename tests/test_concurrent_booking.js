/**
 * 
 * LuxeReserve  Concurrent Booking Test (Pessimistic Locking)
 * 
 *
 * This test simulates 2 guests trying to book the SAME room
 * on the SAME dates at the EXACT same time.
 *
 * Expected Result:
 *   - 1 booking succeeds (CONFIRMED)
 *   - 1 booking fails (409 REJECTED)
 *   - No double-booking occurs
 *
 * How it works (SQL Server side):
 *   sp_ReserveRoom uses: SELECT ... WITH (UPDLOCK, HOLDLOCK)
 *   - UPDLOCK: Prevents other transactions from acquiring update locks
 *   - HOLDLOCK: Holds the lock until COMMIT/ROLLBACK (SERIALIZABLE isolation)
 *    The second request is BLOCKED until the first completes
 *    When it resumes, the room status is already 'BOOKED'  REJECTED
 *
 * Run: node tests/test_concurrent_booking.js
 * 
 */

const BASE_URL = 'http://localhost:3000/api';

async function bookRoom(guestName, guestId, roomId) {
  const start = Date.now();
  console.log(`  [${guestName}]  Sending booking request...`);

  try {
    const res = await fetch(`${BASE_URL}/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hotel_id: 2,
        guest_id: guestId,
        room_id: roomId,
        room_type_id: 4,
        rate_plan_id: 4,
        checkin_date: '2026-04-13',
        checkout_date: '2026-04-14',
        adult_count: 2,
        nightly_rate: 8500,
        currency_code: 'THB',
        guarantee_type: 'CARD',
        purpose_of_stay: 'LEISURE',
      }),
    });

    const data = await res.json();
    const elapsed = Date.now() - start;

    if (res.ok) {
      console.log(`  [${guestName}]  BOOKED! Code: ${data.data.reservation_code} (${elapsed}ms)`);
      return { guest: guestName, status: 'SUCCESS', elapsed, code: data.data.reservation_code };
    } else {
      console.log(`  [${guestName}]  REJECTED: ${data.error} (${elapsed}ms)`);
      return { guest: guestName, status: 'REJECTED', elapsed, error: data.error };
    }
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`  [${guestName}]  ERROR: ${err.message} (${elapsed}ms)`);
    return { guest: guestName, status: 'ERROR', elapsed, error: err.message };
  }
}

async function runTest() {
  console.log('');
  console.log('');
  console.log('   CONCURRENT BOOKING TEST  Pessimistic Locking Demo');
  console.log('');
  console.log('');
  console.log('  Scenario: 2 guests booking Room 9 (W Bangkok, Extreme WOW Suite)');
  console.log('  Dates:    2026-04-13  2026-04-14 (1 night)');
  console.log('  Method:   Both requests fire at the EXACT same time');
  console.log('');
  console.log('   FIRING CONCURRENT REQUESTS ');
  console.log('');

  // Fire BOTH requests at the exact same moment
  const results = await Promise.all([
    bookRoom('Guest A (Sakura Tanaka)', 2, 9),
    bookRoom('Guest B (Min Park)',      4, 9),
  ]);

  console.log('');
  console.log('   RESULTS ');
  console.log('');

  const successes = results.filter(r => r.status === 'SUCCESS');
  const rejections = results.filter(r => r.status === 'REJECTED');

  console.log(`   Bookings succeeded: ${successes.length}`);
  console.log(`   Bookings rejected:  ${rejections.length}`);
  console.log('');

  // Verify no double-booking
  if (successes.length === 1 && rejections.length === 1) {
    console.log('  ');
    console.log('   TEST PASSED  Pessimistic Locking works!');
    console.log('  ');
    console.log('');
    console.log('  How it worked:');
    console.log(`    1. ${successes[0].guest} acquired UPDLOCK+HOLDLOCK first`);
    console.log(`        Room reserved successfully (${successes[0].elapsed}ms)`);
    console.log(`    2. ${rejections[0].guest} was BLOCKED waiting for lock`);
    console.log(`        Lock released  Status = BOOKED  REJECTED (${rejections[0].elapsed}ms)`);
    console.log('');
    console.log('  Key SQL mechanism:');
    console.log('    SELECT @current_status = availability_status');
    console.log('    FROM RoomAvailability WITH (UPDLOCK, HOLDLOCK)');
    console.log('    WHERE room_id = @room_id AND stay_date = @stay_date');
    console.log('');
    console.log('   UPDLOCK:  Blocks other transactions from locking the same row');
    console.log('   HOLDLOCK: Keeps the lock until COMMIT (SERIALIZABLE on row)');
  } else if (successes.length === 2) {
    console.log('  ');
    console.log('   TEST FAILED  DOUBLE BOOKING OCCURRED!');
    console.log('  ');
  } else {
    console.log('    Unexpected result  check server logs');
  }

  // Also check InventoryLockLog
  console.log('');
  console.log('   VERIFY: InventoryLockLog ');
  console.log('  Run this SQL to see lock history:');
  console.log('');
  console.log('  SELECT reservation_code_attempt, room_id, stay_date,');
  console.log("         lock_status, note, lock_acquired_at, lock_released_at");
  console.log('  FROM InventoryLockLog');
  console.log('  WHERE room_id = 9 ORDER BY lock_acquired_at DESC;');
  console.log('');
}

runTest().catch(console.error);
