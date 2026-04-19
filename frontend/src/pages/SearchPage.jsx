import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { resolveHotelImage, imgError } from '../utils/hotelImages';


function today() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function StarRating({ stars }) {
  return (
    <span className="star-rating">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ opacity: i < stars ? 1 : 0.25 }}>★</span>
      ))}
    </span>
  );
}

function HotelCard({ hotel, checkin, checkout, guests }) {
  const navigate = useNavigate();
  const minRate = hotel.min_nightly_rate;
  // location_detail: { city, country, district, ... } from MongoDB
  // city_name from SQL = district/area name
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
        {hotel.hotel_type && (
          <span className="search-hotel-type-pill">{hotel.hotel_type}</span>
        )}
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

  // ── controlled form state (what user is typing) ──────────────────────────
  const [search, setSearch] = useState({
    destination: searchParams.get('destination') || '',
    checkin: searchParams.get('checkin') || today(),
    checkout: searchParams.get('checkout') || addDays(today(), 2),
    guests: Number(searchParams.get('guests')) || 1,
  });

  // ── committed query — only updates when user hits Search ─────────────────
  const [activeQuery, setActiveQuery] = useState({
    destination: searchParams.get('destination') || '',
    checkin: searchParams.get('checkin') || today(),
    checkout: searchParams.get('checkout') || addDays(today(), 2),
    guests: Number(searchParams.get('guests')) || 1,
  });

  const [allHotels, setAllHotels] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [filters, setFilters]     = useState({ minPrice: '', maxPrice: '', stars: '', brand: '' });

  // ── fetch hotels once ─────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    apiRequest('/hotels')
      .then((res) => {
        // backend: { success, count, data: [...] }
        const list = res.data || res.hotels || [];
        setAllHotels(list);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // ── derived filter — computed inline (no stale closures, always reactive) ─
  const hotels = (() => {
    let result = allHotels;
    const dest = activeQuery.destination.trim();

    if (dest) {
      // Build a combined text blob per hotel; search each word of query separately
      // e.g. "Dicstric 1" → words ["dicstric","1"] → "1" matches "District 1"
      const words = dest.toLowerCase().split(/\s+/).filter(Boolean);

      result = result.filter((h) => {
        const haystack = [
          h.hotel_name, h.city_name, h.brand_name, h.chain_name,
          h.location_detail?.city, h.location_detail?.country,
          h.location_detail?.district, h.hotel_type,
        ].filter(Boolean).join(' ').toLowerCase();

        // Pass if ANY word from the query matches somewhere in the hotel text
        return words.some((w) => haystack.includes(w));
      });
    }

    if (filters.stars)    result = result.filter((h) => Number(h.star_rating) >= Number(filters.stars));
    if (filters.brand)    result = result.filter((h) => h.brand_name === filters.brand || h.chain_name === filters.brand);
    if (filters.minPrice) result = result.filter((h) => !h.min_nightly_rate || Number(h.min_nightly_rate) >= Number(filters.minPrice));
    if (filters.maxPrice) result = result.filter((h) => !h.min_nightly_rate || Number(h.min_nightly_rate) <= Number(filters.maxPrice));

    return result;
  })();

  function handleSearchSubmit(e) {
    e.preventDefault();
    // Commit form values to activeQuery — triggers re-render, filter recomputes
    setActiveQuery({ ...search });
    setSearchParams(new URLSearchParams({
      destination: search.destination,
      checkin: search.checkin,
      checkout: search.checkout,
      guests: String(search.guests),
    }));
  }

  function handleFilterChange(key, val) {
    setFilters((prev) => ({ ...prev, [key]: val }));
  }

  const brands = [...new Set(allHotels.map((h) => h.brand_name || h.chain_name).filter(Boolean))];

  return (
    <div className="search-page">
      {/* ── persistent search row ── */}
      <div className="search-top-bar">
        <form className="search-top-form" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            placeholder="Destination, hotel, city…"
            value={search.destination}
            onChange={(e) => setSearch((s) => ({ ...s, destination: e.target.value }))}
            className="search-top-input"
          />
          <input
            type="date"
            value={search.checkin}
            min={today()}
            onChange={(e) => setSearch((s) => ({ ...s, checkin: e.target.value }))}
            className="search-top-input"
          />
          <input
            type="date"
            value={search.checkout}
            min={addDays(search.checkin, 1)}
            onChange={(e) => setSearch((s) => ({ ...s, checkout: e.target.value }))}
            className="search-top-input"
          />
          <div className="guests-stepper search-guests-stepper">
            <button type="button" className="guests-btn"
              onClick={() => setSearch((s) => ({ ...s, guests: Math.max(1, s.guests - 1) }))}
              disabled={search.guests <= 1}>−</button>
            <input
              type="text" inputMode="numeric"
              className="guests-val guests-input"
              value={search.guests}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const val = parseInt(e.target.value.replace(/\D/g, ''), 10);
                setSearch((s) => ({ ...s, guests: isNaN(val) ? '' : Math.min(10, Math.max(1, val)) }));
              }}
              onBlur={() => setSearch((s) => ({ ...s, guests: s.guests || 1 }))}
            />
            <button type="button" className="guests-btn"
              onClick={() => setSearch((s) => ({ ...s, guests: Math.min(10, s.guests + 1) }))}
              disabled={search.guests >= 10}>+</button>
          </div>
          <button className="primary-button" type="submit">Search</button>
        </form>
      </div>

      <div className="search-body">
        {/* ── sidebar filters ── */}
        <aside className="search-sidebar">
          <h3 className="search-filter-title">Filter results</h3>

          <div className="search-filter-group">
            <label className="search-filter-label">Min stars</label>
            <select className="search-filter-select" value={filters.stars} onChange={(e) => handleFilterChange('stars', e.target.value)}>
              <option value="">Any</option>
              <option value="3">3+</option>
              <option value="4">4+</option>
              <option value="5">5 only</option>
            </select>
          </div>

          <div className="search-filter-group">
            <label className="search-filter-label">Brand</label>
            <select className="search-filter-select" value={filters.brand} onChange={(e) => handleFilterChange('brand', e.target.value)}>
              <option value="">All brands</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="search-filter-group">
            <label className="search-filter-label">Price / night</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                placeholder="Min $"
                value={filters.minPrice}
                onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                className="search-filter-input"
              />
              <input
                type="number"
                placeholder="Max $"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
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

        {/* ── results ── */}
        <div className="search-results">
          {loading ? (
            <div className="search-loading"><span>Loading hotels…</span></div>
          ) : error ? (
            <div className="search-error">
              <p>{error}</p>
              <button className="ghost-button" type="button" onClick={() => navigate('/')}>Back to home</button>
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
              <button className="ghost-button" type="button" onClick={() => navigate('/')}>Back to home</button>
            </div>
          ) : (
            <>
              <p className="search-result-count">
                <strong>{hotels.length}</strong> {hotels.length === 1 ? 'hotel' : 'hotels'} found
                {activeQuery.destination ? ` for "${activeQuery.destination}"` : ''}
              </p>
              <div className="search-hotel-list">
                {hotels.map((h) => (
                  <HotelCard
                    key={h.hotel_id}
                    hotel={h}
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
