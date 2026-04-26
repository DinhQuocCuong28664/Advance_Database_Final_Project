import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import '../styles/Hotel.css';
import { resolveHotelImage, imgError } from '../utils/hotelImages';

function today() { return new Date().toISOString().slice(0, 10); }
function addDays(dateValue, days) {
  const nextDate = new Date(dateValue);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}
function nightsBetween(checkinDate, checkoutDate) {
  const ms = new Date(checkoutDate) - new Date(checkinDate);
  return Math.max(1, Math.round(ms / 86400000));
}

function StarRating({ stars }) {
  return (
    <span className="star-rating">
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} style={{ opacity: index < stars ? 1 : 0.25 }}>★</span>
      ))}
    </span>
  );
}

function RoomCard({ room, checkin, checkout, onSelect }) {
  const nights = nightsBetween(checkin, checkout);
  const nightlyRate = Number(room.min_nightly_rate || room.nightly_rate || 0);
  const total = nightlyRate * nights;
  const isOpen = room.availability_status === 'OPEN' || !room.availability_status;

  return (
    <div
      className={`room-card ${isOpen ? 'room-card-clickable' : 'room-card-unavail'}`}
      role={isOpen ? 'button' : undefined}
      tabIndex={isOpen ? 0 : undefined}
      onClick={isOpen ? () => onSelect(room) : undefined}
      onKeyDown={isOpen ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(room);
        }
      } : undefined}
    >
      <div className="room-card-body">
        <div>
          <h3 className="room-card-name">{room.room_type_name || room.room_type}</h3>
          <div className="room-card-meta">
            <span>🛏️ {room.bed_type || 'Standard'}</span>
            <span>👥 Max {room.max_adults} adults</span>
            {room.floor_number && <span>Floor {room.floor_number}</span>}
            {room.view_type && <span>🪟 {room.view_type}</span>}
            {room.category && <span className="room-cat-pill">{room.category}</span>}
          </div>
          <p className="room-card-status-text">
            Status:{' '}
            <strong style={{ color: room.availability_status === 'OPEN' ? '#2d6a4f' : '#9e3825' }}>
              {room.availability_status || 'OPEN'}
            </strong>
          </p>
          {room.sql_features?.length > 0 && (
            <div className="room-feature-pills">
              {room.sql_features.slice(0, 6).map((feature) => (
                <span
                  key={feature.code}
                  className={`room-feature-pill ${feature.is_premium ? 'room-feature-pill--premium' : ''}`}
                  title={feature.value || feature.name}
                >
                  {feature.is_premium && '⭐ '}
                  {feature.name}
                </span>
              ))}
              {room.sql_features.length > 6 && (
                <span className="room-feature-pill room-feature-pill--more">
                  +{room.sql_features.length - 6} more
                </span>
              )}
            </div>
          )}
        </div>
        <div className="room-card-price-block">
          {nightlyRate > 0 ? (
            <>
              <div className="room-nightly">
                <strong>{nightlyRate.toLocaleString('en-US')} VND</strong>
                <span>/night</span>
              </div>
              <div className="room-total">
                {total.toLocaleString('en-US')} VND total - {nights} night{nights > 1 ? 's' : ''}
              </div>
            </>
          ) : (
            <span className="search-price-na">Rate on request</span>
          )}
          <button
            className="primary-button room-select-btn"
            type="button"
            disabled={!isOpen}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(room);
            }}
          >
            {isOpen ? 'Select room' : 'Unavailable'}
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
    let cancelled = false;

    async function loadHotelData() {
      setLoading(true);
      setError(null);
      try {
        const [hotelRes, roomsRes, promosRes] = await Promise.all([
          apiRequest(`/hotels/${id}`),
          apiRequest(`/rooms/availability?hotel_id=${id}&checkin=${checkin}&checkout=${checkout}`),
          apiRequest('/promotions').catch(() => ({ data: [], promotions: [] })),
        ]);
        if (cancelled) return;

        setHotel(hotelRes.data || hotelRes.hotel || hotelRes);
        setRooms(roomsRes.data || roomsRes.rooms || roomsRes.availability || []);
        const promoList = promosRes.data || promosRes.promotions || [];
        setPromos(promoList.slice(0, 2));
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHotelData();
    return () => {
      cancelled = true;
    };
  }, [id, checkin, checkout]);

  function handleSelectRoom(room) {
    navigate(
      `/booking/${id}/${room.room_id || room.availability_id}?checkin=${checkin}&checkout=${checkout}&guests=${guests}&rate=${room.min_nightly_rate || room.nightly_rate || 0}&room_name=${encodeURIComponent(room.room_type_name || room.room_type || 'Room')}`
    );
  }

  if (loading) {
    return <div className="hotel-loading"><p>Loading hotel...</p></div>;
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
          <div className="hotel-header">
            <div>
              <p className="hotel-brand">{hotel.brand_name || hotel.chain_name || 'LuxeReserve'}</p>
              <h1 className="hotel-name">{hotel.hotel_name}</h1>
              <p className="hotel-loc">
                📍{' '}
                {[
                  hotel.address_line_1 || hotel.address,
                  hotel.city_name,
                  hotel.country_name,
                ].filter(Boolean).join(', ') || ''}
              </p>
              <StarRating stars={hotel.star_rating || 0} />
            </div>
            <div className="hotel-type-pill">{hotel.hotel_type || 'Luxury Hotel'}</div>
          </div>

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

          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="hotel-amenities">
              <h2 className="hotel-section-title">Amenities</h2>
              <div className="amenity-list">
                {hotel.amenities.map((amenity, index) => (
                  <span
                    key={index}
                    className={`amenity-pill${amenity.is_chargeable ? ' amenity-paid' : ''}`}
                    title={amenity.description || ''}
                  >
                    {amenity.is_complimentary && <span className="amenity-free-dot" />}
                    {amenity.name || amenity.amenity_code}
                    {amenity.is_chargeable && <small> paid</small>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {hotel.policies && hotel.policies.length > 0 && (
            <div className="hotel-policies">
              <h2 className="hotel-section-title">Hotel Policies</h2>
              <div className="policy-list">
                {hotel.policies.map((policy, index) => (
                  <div key={index} className="policy-card">
                    <div className="policy-card-head">
                      <span className="policy-type-tag">{policy.type}</span>
                    </div>
                    <p className="policy-text">{policy.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="hotel-rooms">
            <h2 className="hotel-section-title">Available rooms</h2>
            {rooms.length === 0 ? (
              <div className="hotel-no-rooms">
                <p>No available rooms for the selected dates.</p>
                <button className="ghost-button" type="button" onClick={() => navigate(-1)}>Change dates</button>
              </div>
            ) : (
              <div className="room-list">
                {rooms.map((room) => (
                  <RoomCard
                    key={room.room_id || room.availability_id || room.room_number}
                    room={room}
                    checkin={checkin}
                    checkout={checkout}
                    onSelect={handleSelectRoom}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {promos.length > 0 && (
          <aside className="hotel-promos">
            <h3 className="hotel-section-title">Current offers</h3>
            {promos.map((promo, index) => (
              <div key={promo.promotion_id ?? index} className="hotel-promo-card">
                <p className="promo-card-badge">
                  {promo.discount_value
                    ? `${Number(promo.discount_value).toLocaleString()} ${promo.currency_code || 'VND'} off`
                    : 'Special offer'}
                </p>
                <strong>{promo.promotion_name || promo.promo_name}</strong>
                {promo.description && <p style={{ color: 'var(--text-soft)', marginTop: '4px' }}>{promo.description}</p>}
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}
