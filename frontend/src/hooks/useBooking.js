import { startTransition, useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../context/AuthContext';
import { useFlash } from '../context/FlashContext';
import { nextDate, money } from '../utils/formatters';

export function useBooking() {
  const { hotels, guests, ensureHotelDetail } = useAppData();
  const { isGuestUser, authSession } = useAuth();
  const { setFlash } = useFlash();

  const [bookingSearch, setBookingSearch] = useState({ hotelId: '', checkin: nextDate(1), checkout: nextDate(3) });
  const [bookingRooms, setBookingRooms] = useState([]);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [bookingDraft, setBookingDraft] = useState({
    guestId: '',
    adultCount: 2,
    childCount: 0,
    guaranteeType: 'DEPOSIT',
    purposeOfStay: 'LEISURE',
    specialRequestText: '',
  });
  const [bookingResult, setBookingResult] = useState(null);
  const [hotelPromotions, setHotelPromotions] = useState([]);

  /* ── Derived ─────────────────────────────────────── */
  const selectedHotel = hotels.find((hotel) => String(hotel.hotel_id) === bookingSearch.hotelId) || null;
  const selectedRoom = bookingRooms.find((room) => room.room_id === selectedRoomId) || null;
  const bookingGuestOptions = isGuestUser
    ? guests.filter((guest) => guest.guest_id === authSession.user.guest_id)
    : guests;

  /* ── Effects ─────────────────────────────────────── */
  useEffect(() => {
    if (!hotels.length) return;
    const firstHotelId = String(hotels[0].hotel_id);
    setBookingSearch((current) => (current.hotelId ? current : { ...current, hotelId: firstHotelId }));
  }, [hotels]);

  useEffect(() => {
    if (!guests.length) return;
    const firstGuestId = String(guests[0].guest_id);
    setBookingDraft((current) => (current.guestId ? current : { ...current, guestId: firstGuestId }));
  }, [guests]);

  useEffect(() => {
    if (!isGuestUser || !authSession?.user?.guest_id) return;
    setBookingDraft((current) => ({ ...current, guestId: String(authSession.user.guest_id) }));
  }, [authSession, isGuestUser]);

  useEffect(() => {
    async function loadHotelPromotions() {
      if (!bookingSearch.hotelId) {
        setHotelPromotions([]);
        return;
      }

      try {
        const payload = await apiRequest(`/promotions?hotel_id=${bookingSearch.hotelId}`);
        setHotelPromotions(payload.data || []);
      } catch {
        setHotelPromotions([]);
      }
    }

    loadHotelPromotions();
  }, [bookingSearch.hotelId]);

  /* ── Handlers ────────────────────────────────────── */
  async function handleAvailabilitySearch(event) {
    event.preventDefault();
    setBookingBusy(true);
    setBookingResult(null);
    try {
      await ensureHotelDetail(bookingSearch.hotelId);
      const query = new URLSearchParams({
        hotel_id: bookingSearch.hotelId,
        checkin: bookingSearch.checkin,
        checkout: bookingSearch.checkout,
      });
      const payload = await apiRequest(`/rooms/availability?${query.toString()}`);
      startTransition(() => {
        setBookingRooms(payload.data || []);
        setSelectedRoomId(payload.data?.[0]?.room_id || null);
      });
      setFlash({ tone: 'success', text: `Loaded ${payload.count || 0} room(s).` });
    } catch (error) {
      setBookingRooms([]);
      setSelectedRoomId(null);
      setFlash({ tone: 'error', text: error.message });
    } finally {
      setBookingBusy(false);
    }
  }

  async function handleReservationCreate(event) {
    event.preventDefault();
    if (!selectedRoom) {
      setFlash({ tone: 'error', text: 'Select a room before creating the reservation.' });
      return null;
    }

    setBookingBusy(true);
    try {
      const hotelDetail = await ensureHotelDetail(bookingSearch.hotelId);
      const roomType = hotelDetail?.room_types?.find((item) => item.room_type_code === selectedRoom.room_type_code);
      const payload = await apiRequest('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          hotel_id: Number(bookingSearch.hotelId),
          guest_id: Number(bookingDraft.guestId),
          room_id: selectedRoom.room_id,
          room_type_id: roomType?.room_type_id,
          checkin_date: bookingSearch.checkin,
          checkout_date: bookingSearch.checkout,
          adult_count: Number(bookingDraft.adultCount),
          child_count: Number(bookingDraft.childCount),
          nightly_rate: Number(selectedRoom.min_nightly_rate || 0),
          currency_code: selectedHotel?.currency_code || 'VND',
          guarantee_type: bookingDraft.guaranteeType,
          purpose_of_stay: bookingDraft.purposeOfStay,
          special_request_text: bookingDraft.specialRequestText,
        }),
      });

      setBookingResult(payload.data);
      setFlash({ tone: 'success', text: `Created ${payload.data.reservation_code}.` });
      return payload.data;
    } catch (error) {
      setFlash({ tone: 'error', text: error.message });
      return null;
    } finally {
      setBookingBusy(false);
    }
  }

  return {
    bookingSearch, setBookingSearch,
    bookingRooms,
    bookingBusy,
    selectedRoomId, setSelectedRoomId,
    bookingDraft, setBookingDraft,
    bookingResult,
    hotelPromotions,
    selectedHotel,
    selectedRoom,
    bookingGuestOptions,
    handleAvailabilitySearch,
    handleReservationCreate,
  };
}
