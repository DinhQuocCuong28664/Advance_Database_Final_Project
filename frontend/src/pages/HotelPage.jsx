import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { resolveHotelImage, imgError } from '../utils/hotelImages';


function today() { return new Date().toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
function nightsBetween(a, b) {
  const ms = new Date(b) - new Date(a);
  return Math.max(1, Math.round(ms / 86400000));
}

function StarRating({ stars }) {
  return (
    <span className="star-rating">
      {Array.from({ length: 5 }, (_, i) => <span key={i} style={{ opacity: i < stars ? 1 : 0.25 }}>★</span>)}
    </span>
  );
}

function RoomCard({ room, checkin, checkout, hotelId, onSelect }) {
  const nights = nightsBetween(checkin, checkout);
  const nightlyRate = Number(room.min_nightly_rate || room.nightly_rate || 0);
  const total = nightlyRate * nights;

  return (
    <div className={`room-card ${room.availability_status === 'OPEN' ? '' : 'room-card-unavail'}`}>
      <div className="room-card-body">
        <div>
          <h3 className="room-card-name">{room.room_type_name || room.room_type}</h3>
          <div className="room-card-meta">
            <span>🛏 {room.bed_type || 'Standard'}</span>
            <span>👥 Max {room.max_adults} adults
            </span>
            {room.floor_number && <span>Floor {room.floor_number}</span>}
            {room.view_type && <span>🪟 {room.view_type}</span>}
            {room.category && <span className="room-cat-pill">{room.category}</span>}
          </div>
          <p className="room-card-status-text">
            Status: <strong style={{ color: room.availability_status === 'OPEN' ? '#2d6a4f' : '#9e3825' }}>
              {room.availability_status || 'OPEN'}
            </strong>
          </p>
        </div>
        <div className="room-card-price-block">
          {nightlyRate > 0 ? (
            <>
              <div className="room-nightly">
                <strong>{nightlyRate.toLocaleString('en-US')} VND</strong>
                <span>/night</span>
              </div>
              <div className="room-total">{total.toLocaleString('en-US')} VND total · {nights} night{nights > 1 ? 's' : ''}</div>
            </>
          ) : (
            <span className="search-price-na">Rate on request</span>
          )}
          <button
            className="primary-button room-select-btn"
            type="button"
            disabled={room.availability_status && room.availability_status !== 'OPEN'}
            onClick={() => onSelect(room)}
          >
            {room.availability_status === 'OPEN' || !room.availability_status ? 'Select room' : 'Unavailable'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HotelPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const checkin = searchParams.get('checkin') || today();
  const checkout = searchParams.get('checkout') || addDays(today(), 2);
  const guests = searchParams.get('guests') || 1;

  const [hotel, setHotel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    Promise.all([
      apiRequest(`/hotels/${id}`),
      apiRequest(`/rooms/availability?hotel_id=${id}&checkin=${checkin}&checkout=${checkout}`),
      apiRequest('/promotions').catch(() => ({ data: [], promotions: [] })),
    ])
      .then(([hotelRes, roomsRes, promosRes]) => {
        // All endpoints return { success, count, data: [...] }
        setHotel(hotelRes.data || hotelRes.hotel || hotelRes);
        setRooms(roomsRes.data || roomsRes.rooms || roomsRes.availability || []);
        const pList = promosRes.data || promosRes.promotions || [];
        setPromos(pList.slice(0, 2));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, checkin, checkout]);

  function handleSelectRoom(room) {
    navigate(
      `/booking/${id}/${room.room_id || room.availability_id}?checkin=${checkin}&checkout=${checkout}&guests=${guests}&rate=${room.min_nightly_rate || room.nightly_rate || 0}&room_name=${encodeURIComponent(room.room_type_name || room.room_type || 'Room')}`
    );
  }

  if (loading) {
    return <div className="hotel-loading"><p>Loading hotel…</p></div>;
  }
  if (error || !hotel) {
    return (
      <div className="page-card">
        <h2>Hotel not found</h2>
        <p style={{ color: 'var(--text-soft)' }}>{error || 'This hotel does not exist or has been removed.'}</p>
        <button className="ghost-button" type="button" onClick={() => navigate(-1)}>Go back</button>
      </div>
    );
  }

  const nights = nightsBetween(checkin, checkout);

  return (
    <div className="hotel-page">
      {/* ── gallery ── */}
      <div className="hotel-gallery">
        <img
          src={resolveHotelImage(hotel)}
          alt={hotel.hotel_name}
          className="hotel-gallery-main"
          onError={imgError}
        />

      </div>

      <div className="hotel-content">
        <div className="hotel-main">
          {/* ── header ── */}
          <div className="hotel-header">
            <div>
              <p className="hotel-brand">{hotel.brand_name || hotel.chain_name || 'LuxeReserve'}</p>
              <h1 className="hotel-name">{hotel.hotel_name}</h1>
              <p className="hotel-loc">
                📍{' '}
                {[
                  hotel.address_line_1 || hotel.address,
                  hotel.city_name,      // SQL: district name e.g. "District 1"
                  hotel.country_name,   // SQL: city name e.g. "Ho Chi Minh City"
                ].filter(Boolean).join(', ') || '—'}
              </p>
              <StarRating stars={hotel.star_rating || 0} />
            </div>
            <div className="hotel-type-pill">{hotel.hotel_type || 'Luxury Hotel'}</div>
          </div>

          {/* ── stay summary ── */}
          <div className="hotel-stay-summary">
            <div className="hotel-stay-item">
              <span>Check-in</span>
              <strong>{new Date(checkin).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong>
            </div>
            <div className="hotel-stay-divider">{nights} night{nights > 1 ? 's' : ''}</div>
            <div className="hotel-stay-item">
              <span>Check-out</span>
              <strong>{new Date(checkout).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong>
            </div>
            <div className="hotel-stay-item">
              <span>Guests</span>
              <strong>{guests} guest{guests > 1 ? 's' : ''}</strong>
            </div>
          </div>

          {/* ── amenities ── */}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="hotel-amenities">
              <h2 className="hotel-section-title">Amenities</h2>
              <div className="amenity-list">
                {hotel.amenities.map((a, i) => (
                  <span key={i} className="amenity-pill">
                    {a.icon ? `${a.icon} ` : ''}{a.name || a.amenity_code}
                  </span>
                ))}
              </div>
            </div>
          )}


          {/* ── rooms ── */}
          <div className="hotel-rooms">
            <h2 className="hotel-section-title">Available rooms</h2>
            {rooms.length === 0 ? (
              <div className="hotel-no-rooms">
                <p>No available rooms for the selected dates.</p>
                <button className="ghost-button" type="button" onClick={() => navigate(-1)}>Change dates</button>
              </div>
            ) : (
              <div className="room-list">
                {rooms.map((r) => (
                  <RoomCard
                    key={r.room_id || r.availability_id || r.room_number}
                    room={r}
                    checkin={checkin}
                    checkout={checkout}
                    hotelId={id}
                    onSelect={handleSelectRoom}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── promotions sidebar ── */}
        {promos.length > 0 && (
          <aside className="hotel-promos">
            <h3 className="hotel-section-title">Current offers</h3>
            {promos.map((p, i) => (
              <div key={p.promotion_id ?? i} className="hotel-promo-card">
                <p className="promo-card-badge">
                  {p.discount_value
                    ? `${Number(p.discount_value).toLocaleString()} ${p.currency_code || 'VND'} off`
                    : 'Special offer'}
                </p>
                <strong>{p.promotion_name || p.promo_name}</strong>
                {p.description && <p style={{ color: 'var(--text-soft)', marginTop: '4px' }}>{p.description}</p>}
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}
