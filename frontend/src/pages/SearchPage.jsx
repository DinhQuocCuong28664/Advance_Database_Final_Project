import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import '../styles/Search.css';
import { resolveHotelImage, imgError } from '../utils/hotelImages';

const GENERIC_SEARCH_WORDS = new Set([
  'city',
  'hotel',
  'hotels',
  'resort',
  'resorts',
  'stay',
  'stays',
  'the',
]);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + n);
  return date.toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchHaystack(hotel) {
  return normalizeText([
    hotel.hotel_name,
    hotel.city_name,
    hotel.brand_name,
    hotel.chain_name,
    hotel.location_detail?.city,
    hotel.location_detail?.country,
    hotel.location_detail?.district,
    hotel.hotel_type,
  ].filter(Boolean).join(' '));
}

function hotelMatchesDestination(hotel, destination) {
  const normalizedQuery = normalizeText(destination);
  if (!normalizedQuery) return true;

  const haystack = buildSearchHaystack(hotel);
  if (!haystack) return false;

  if (haystack.includes(normalizedQuery)) return true;

  const rawTokens = normalizedQuery.split(' ').filter(Boolean);
  const meaningfulTokens = rawTokens.filter((token) => !GENERIC_SEARCH_WORDS.has(token));
  const tokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;

  return tokens.every((token) => haystack.includes(token));
}

function StarRating({ stars }) {
  return (
    <span className="star-rating" aria-label={`${stars} star rating`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} style={{ opacity: index < stars ? 1 : 0.25 }}>
          ★
        </span>
      ))}
    </span>
  );
}

function HotelCard({ hotel, checkin, checkout, guests }) {
  const navigate = useNavigate();
  const minRate = hotel.min_nightly_rate;
  const locationText = [
    hotel.location_detail?.district || hotel.city_name,
    hotel.location_detail?.city,
    hotel.location_detail?.country,
  ].filter(Boolean).join(', ');

  return (
    <div className="search-hotel-card">
      <img
        src={resolveHotelImage(hotel)}
        alt={hotel.hotel_name}
        className="search-hotel-img"
        onError={imgError}
      />
      <div className="search-hotel-body">
        <div className="search-hotel-top">
          <div>
            <p className="search-hotel-brand">{hotel.brand_name || hotel.chain_name || 'LuxeReserve'}</p>
            <h3 className="search-hotel-name">{hotel.hotel_name}</h3>
            <p className="search-hotel-loc">📍 {locationText || hotel.city_name}</p>
            <StarRating stars={hotel.star_rating || 0} />
          </div>
          <div className="search-hotel-price">
            {minRate ? (
              <>
                <span className="search-price-from">from</span>
                <strong className="search-price-val">{Number(minRate).toLocaleString('en-US')} VND</strong>
                <span className="search-price-night">/night</span>
              </>
            ) : (
              <span className="search-price-na">Check availability</span>
            )}
          </div>
        </div>
        {hotel.hotel_type ? <span className="search-hotel-type-pill">{hotel.hotel_type}</span> : null}
        <button
          className="primary-button search-hotel-cta"
          type="button"
          onClick={() =>
            navigate(`/hotel/${hotel.hotel_id}?checkin=${checkin}&checkout=${checkout}&guests=${guests}`)
          }
        >
          View hotel
        </button>
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState({
    destination: searchParams.get('destination') || '',
    checkin: searchParams.get('checkin') || today(),
    checkout: searchParams.get('checkout') || addDays(today(), 2),
    guests: Number(searchParams.get('guests')) || 1,
  });

  const [activeQuery, setActiveQuery] = useState({
    destination: searchParams.get('destination') || '',
    checkin: searchParams.get('checkin') || today(),
    checkout: searchParams.get('checkout') || addDays(today(), 2),
    guests: Number(searchParams.get('guests')) || 1,
  });

  const [allHotels, setAllHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ minPrice: '', maxPrice: '', stars: '', brand: '' });

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    apiRequest('/hotels')
      .then((res) => {
        if (cancelled) return;
        const list = res.data || res.hotels || [];
        setAllHotels(list);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const brands = useMemo(
    () => [...new Set(allHotels.map((hotel) => hotel.brand_name || hotel.chain_name).filter(Boolean))],
    [allHotels],
  );

  const hotels = useMemo(() => {
    let result = allHotels;
    const destination = activeQuery.destination.trim();

    if (destination) {
      result = result.filter((hotel) => hotelMatchesDestination(hotel, destination));
    }

    if (filters.stars) {
      result = result.filter((hotel) => Number(hotel.star_rating) >= Number(filters.stars));
    }
    if (filters.brand) {
      result = result.filter(
        (hotel) => hotel.brand_name === filters.brand || hotel.chain_name === filters.brand,
      );
    }
    if (filters.minPrice) {
      result = result.filter(
        (hotel) => !hotel.min_nightly_rate || Number(hotel.min_nightly_rate) >= Number(filters.minPrice),
      );
    }
    if (filters.maxPrice) {
      result = result.filter(
        (hotel) => !hotel.min_nightly_rate || Number(hotel.min_nightly_rate) <= Number(filters.maxPrice),
      );
    }

    return result;
  }, [activeQuery.destination, allHotels, filters]);

  function handleSearchSubmit(event) {
    event.preventDefault();

    const nextQuery = {
      destination: search.destination,
      checkin: search.checkin,
      checkout: search.checkout,
      guests: Number(search.guests) || 1,
    };

    setActiveQuery(nextQuery);
    setSearchParams(new URLSearchParams({
      destination: nextQuery.destination,
      checkin: nextQuery.checkin,
      checkout: nextQuery.checkout,
      guests: String(nextQuery.guests),
    }));
  }

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="search-page">
      <div className="search-top-bar">
        <form className="search-top-form" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            placeholder="Destination, hotel, city..."
            value={search.destination}
            onChange={(event) => setSearch((prev) => ({ ...prev, destination: event.target.value }))}
            className="search-top-input"
          />
          <input
            type="date"
            value={search.checkin}
            min={today()}
            onChange={(event) => setSearch((prev) => ({ ...prev, checkin: event.target.value }))}
            className="search-top-input"
          />
          <input
            type="date"
            value={search.checkout}
            min={addDays(search.checkin, 1)}
            onChange={(event) => setSearch((prev) => ({ ...prev, checkout: event.target.value }))}
            className="search-top-input"
          />
          <div className="guests-stepper search-guests-stepper">
            <button
              type="button"
              className="guests-btn"
              onClick={() => setSearch((prev) => ({ ...prev, guests: Math.max(1, Number(prev.guests) - 1) }))}
              disabled={Number(search.guests) <= 1}
            >
              -
            </button>
            <input
              type="text"
              inputMode="numeric"
              className="guests-val guests-input"
              value={search.guests}
              onFocus={(event) => event.target.select()}
              onChange={(event) => {
                const value = parseInt(event.target.value.replace(/\D/g, ''), 10);
                setSearch((prev) => ({
                  ...prev,
                  guests: Number.isNaN(value) ? '' : Math.min(10, Math.max(1, value)),
                }));
              }}
              onBlur={() => setSearch((prev) => ({ ...prev, guests: prev.guests || 1 }))}
            />
            <button
              type="button"
              className="guests-btn"
              onClick={() => setSearch((prev) => ({ ...prev, guests: Math.min(10, Number(prev.guests) + 1) }))}
              disabled={Number(search.guests) >= 10}
            >
              +
            </button>
          </div>
          <button className="primary-button" type="submit">Search</button>
        </form>
      </div>

      <div className="search-body">
        <aside className="search-sidebar">
          <h3 className="search-filter-title">Filter results</h3>

          <div className="search-filter-group">
            <label className="search-filter-label">Min stars</label>
            <select
              className="search-filter-select"
              value={filters.stars}
              onChange={(event) => handleFilterChange('stars', event.target.value)}
            >
              <option value="">Any</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
              <option value="5">5 only</option>
            </select>
          </div>

          <div className="search-filter-group">
            <label className="search-filter-label">Brand</label>
            <select
              className="search-filter-select"
              value={filters.brand}
              onChange={(event) => handleFilterChange('brand', event.target.value)}
            >
              <option value="">All brands</option>
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          <div className="search-filter-group">
            <label className="search-filter-label">Price / night</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                placeholder="Min $"
                value={filters.minPrice}
                onChange={(event) => handleFilterChange('minPrice', event.target.value)}
                className="search-filter-input"
              />
              <input
                type="number"
                placeholder="Max $"
                value={filters.maxPrice}
                onChange={(event) => handleFilterChange('maxPrice', event.target.value)}
                className="search-filter-input"
              />
            </div>
          </div>

          <button
            className="ghost-button"
            type="button"
            style={{ width: '100%', marginTop: '8px' }}
            onClick={() => setFilters({ minPrice: '', maxPrice: '', stars: '', brand: '' })}
          >
            Clear filters
          </button>
        </aside>

        <div className="search-results">
          {loading ? (
            <div className="search-loading"><span>Loading hotels...</span></div>
          ) : error ? (
            <div className="search-error">
              <p>{error}</p>
              <button className="ghost-button" type="button" onClick={() => navigate('/')}>
                Back to home
              </button>
            </div>
          ) : hotels.length === 0 ? (
            <div className="search-empty">
              <p className="page-eyebrow">No results</p>
              <h2>No hotels found for your search</h2>
              <p style={{ color: 'var(--text-soft)' }}>
                {activeQuery.destination
                  ? `No results for "${activeQuery.destination}". Try a broader query.`
                  : 'Try entering a destination above.'}
              </p>
              <button className="ghost-button" type="button" onClick={() => navigate('/')}>
                Back to home
              </button>
            </div>
          ) : (
            <>
              <p className="search-result-count">
                <strong>{hotels.length}</strong> {hotels.length === 1 ? 'hotel' : 'hotels'} found
                {activeQuery.destination ? ` for "${activeQuery.destination}"` : ''}
              </p>
              <div className="search-hotel-list">
                {hotels.map((hotel) => (
                  <HotelCard
                    key={hotel.hotel_id}
                    hotel={hotel}
                    checkin={activeQuery.checkin}
                    checkout={activeQuery.checkout}
                    guests={activeQuery.guests}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
