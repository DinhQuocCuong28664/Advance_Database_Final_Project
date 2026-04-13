import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useBooking } from '../hooks/useBooking';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../context/AuthContext';
import PromotionCard from '../components/ui/PromotionCard';
import { money } from '../utils/formatters';

export default function BookingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hotels } = useAppData();
  const { isGuestUser } = useAuth();

  const {
    bookingSearch, setBookingSearch,
    bookingRooms, bookingBusy,
    selectedRoomId, setSelectedRoomId,
    bookingDraft, setBookingDraft,
    bookingResult,
    hotelPromotions,
    selectedHotel, selectedRoom,
    bookingGuestOptions,
    handleAvailabilitySearch,
    handleReservationCreate,
  } = useBooking();

  // Handle hotel param from URL (e.g. from city "Khám phá" button)
  useEffect(() => {
    const hotelParam = searchParams.get('hotel');
    if (hotelParam) {
      setBookingSearch((current) => ({ ...current, hotelId: hotelParam }));
    }
  }, [searchParams, setBookingSearch]);

  async function onReservationCreate(event) {
    const result = await handleReservationCreate(event);
    if (result) {
      navigate(`/reservation?code=${encodeURIComponent(result.reservation_code)}`);
    }
  }

  return (
    <>
      {/* ── Step 1: Search Inventory ────────────────── */}
      <section className="panel">
        <p className="section-kicker">Step 1</p>
        <h2>Search inventory</h2>
        <form className="form-grid" onSubmit={handleAvailabilitySearch}>
          <label>
            Hotel
            <select value={bookingSearch.hotelId} onChange={(event) => setBookingSearch((current) => ({ ...current, hotelId: event.target.value }))}>
              {hotels.map((hotel) => <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>)}
            </select>
          </label>
          <label>
            Check-in
            <input type="date" value={bookingSearch.checkin} onChange={(event) => setBookingSearch((current) => ({ ...current, checkin: event.target.value }))} />
          </label>
          <label>
            Check-out
            <input type="date" value={bookingSearch.checkout} onChange={(event) => setBookingSearch((current) => ({ ...current, checkout: event.target.value }))} />
          </label>
          <button className="primary-button" type="submit" disabled={bookingBusy}>
            {bookingBusy ? 'Searching...' : 'Load Available Rooms'}
          </button>
        </form>
        <div className="room-stack">
          {bookingRooms.map((room) => (
            <button
              key={room.room_id}
              type="button"
              className={room.room_id === selectedRoomId ? 'room-card active' : 'room-card'}
              onClick={() => setSelectedRoomId(room.room_id)}
            >
              <div className="room-card-head">
                <strong>Room {room.room_number}</strong>
                <span>{money(room.min_nightly_rate, selectedHotel?.currency_code)}</span>
              </div>
              <p>{room.room_type_name}</p>
              <div className="room-card-meta">
                <span>{room.category}</span>
                <span>{room.view_type}</span>
                <span>{room.max_adults} adults</span>
              </div>
            </button>
          ))}
          {!bookingRooms.length ? <p className="muted-copy">Search to populate the inventory grid.</p> : null}
        </div>
      </section>

      {/* ── Step 2: Create Reservation ──────────────── */}
      <section className="panel">
        <p className="section-kicker">Step 2</p>
        <h2>Create reservation</h2>
        {selectedRoom ? (
          <div className="selected-room-banner">
            <span>Selected room</span>
            <strong>{selectedRoom.room_type_name}</strong>
            <small>Room {selectedRoom.room_number} | {selectedRoom.view_type} | {money(selectedRoom.min_nightly_rate, selectedHotel?.currency_code)}</small>
          </div>
        ) : <p className="muted-copy">Choose a room card from the left.</p>}
        <form className="form-grid" onSubmit={onReservationCreate}>
          <label>
            Guest
            <select value={bookingDraft.guestId} disabled={isGuestUser} onChange={(event) => setBookingDraft((current) => ({ ...current, guestId: event.target.value }))}>
              {bookingGuestOptions.map((guest) => <option key={guest.guest_id} value={guest.guest_id}>{guest.full_name}</option>)}
            </select>
          </label>
          <label>
            Adults
            <input type="number" min="1" value={bookingDraft.adultCount} onChange={(event) => setBookingDraft((current) => ({ ...current, adultCount: event.target.value }))} />
          </label>
          <label>
            Children
            <input type="number" min="0" value={bookingDraft.childCount} onChange={(event) => setBookingDraft((current) => ({ ...current, childCount: event.target.value }))} />
          </label>
          <label>
            Guarantee
            <select value={bookingDraft.guaranteeType} onChange={(event) => setBookingDraft((current) => ({ ...current, guaranteeType: event.target.value }))}>
              <option value="DEPOSIT">DEPOSIT</option>
              <option value="CARD">CARD</option>
            </select>
          </label>
          <label>
            Purpose
            <select value={bookingDraft.purposeOfStay} onChange={(event) => setBookingDraft((current) => ({ ...current, purposeOfStay: event.target.value }))}>
              <option value="LEISURE">LEISURE</option>
              <option value="BUSINESS">BUSINESS</option>
            </select>
          </label>
          <label className="full-span">
            Special request
            <textarea rows="4" value={bookingDraft.specialRequestText} onChange={(event) => setBookingDraft((current) => ({ ...current, specialRequestText: event.target.value }))} />
          </label>
          <button className="primary-button" type="submit" disabled={bookingBusy || !selectedRoom}>
            {bookingBusy ? 'Processing...' : 'Create Reservation'}
          </button>
        </form>
        {bookingResult ? (
          <div className="result-card success-card">
            <h3>{bookingResult.reservation_code}</h3>
            <p>{bookingResult.nights} night(s) | total {money(bookingResult.total, selectedHotel?.currency_code)}</p>
            <p>Deposit: {bookingResult.deposit_required ? money(bookingResult.deposit_amount, selectedHotel?.currency_code) : 'No deposit required'}</p>
          </div>
        ) : null}
      </section>

      {/* ── Hotel Promotions ────────────────────────── */}
      <section className="panel panel-span-2">
        <p className="section-kicker">Offers</p>
        <h2>Hotel-level promotions</h2>
        <div className="promo-grid">
          {hotelPromotions.map((promotion) => <PromotionCard key={promotion.promotion_id} promotion={promotion} />)}
          {!hotelPromotions.length ? <p className="muted-copy">No active promotions returned for the selected hotel.</p> : null}
        </div>
      </section>
    </>
  );
}
