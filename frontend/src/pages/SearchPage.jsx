import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import '../styles/Search.css';
import { resolveHotelImage, imgError } from '../utils/hotelImages';
import SearchDirectionsPreview from '../components/maps/SearchDirectionsPreview';

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

function clampGuests(value) {
  const guests = Number(value);
  if (!Number.isFinite(guests)) return 1;
  return Math.min(10, Math.max(1, guests));
}

function normalizeQueryState(query) {
  const checkin = query.checkin || today();
  const checkoutCandidate = query.checkout || addDays(checkin, 2);
  const checkout = checkoutCandidate > checkin ? checkoutCandidate : addDays(checkin, 1);

  return {
    destination: String(query.destination || ''),
    checkin,
    checkout,
    guests: clampGuests(query.guests),
  };
}

function readQueryState(searchParams) {
  return normalizeQueryState({
    destination: searchParams.get('destination') || '',
    checkin: searchParams.get('checkin') || today(),
    checkout: searchParams.get('checkout') || addDays(today(), 2),
    guests: Number(searchParams.get('guests')) || 1,
  });
}

function buildQueryParams(query) {
  return new URLSearchParams({
    destination: query.destination,
    checkin: query.checkin,
    checkout: query.checkout,
    guests: String(query.guests),
  });
}

function hasHotelCoordinates(hotel) {
  const latitude = Number(hotel.latitude);
  const longitude = Number(hotel.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function getCurrentPositionAsync() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, (error) => {
      if (error?.code === error.PERMISSION_DENIED) {
        reject(new Error('Location access was denied.'));
        return;
      }
      if (error?.code === error.POSITION_UNAVAILABLE) {
        reject(new Error('Your location is currently unavailable.'));
        return;
      }
      if (error?.code === error.TIMEOUT) {
        reject(new Error('Location request timed out.'));
        return;
      }
      reject(new Error('Could not get your current location.'));
    }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
  });
}

function buildGoogleDirectionsUrl(originLat, originLng, destinationLat, destinationLng) {
  const params = new URLSearchParams({
    api: '1',
    destination: `${destinationLat},${destinationLng}`,
    travelmode: 'driving',
  });
  if (Number.isFinite(originLat) && Number.isFinite(originLng)) {
    params.set('origin', `${originLat},${originLng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
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
    hotel.district_name,
    hotel.city_name,
    hotel.country_name,
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
          
        </span>
      ))}
    </span>
  );
}

function formatMoney(value, currency = 'VND') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: ['VND', 'JPY', 'KRW'].includes(currency) ? 0 : 2,
  }).format(Number(value || 0));
}

function HotelCard({ hotel, checkin, checkout, guests, onPreviewDirections, directionsState, directionsLoading }) {
  const navigate = useNavigate();
  const minRate = hotel.min_nightly_rate;
  const currency = hotel.currency_code || 'VND';
  const locationText = [
    hotel.location_detail?.district || hotel.city_name,
    hotel.location_detail?.city,
    hotel.location_detail?.country,
  ].filter(Boolean).join(', ');
  const canOpenDirections = hasHotelCoordinates(hotel);

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
            <p className="search-hotel-loc"> {locationText || hotel.city_name}</p>
            <StarRating stars={hotel.star_rating || 0} />
          </div>
          <div className="search-hotel-price">
            {minRate ? (
              <>
                <span className="search-price-from">from</span>
                <strong className="search-price-val">{formatMoney(minRate, currency)}</strong>
                <span className="search-price-night">/night</span>
              </>
            ) : (
              <span className="search-price-na">Check availability</span>
            )}
          </div>
        </div>
        {hotel.hotel_type ? <span className="search-hotel-type-pill">{hotel.hotel_type}</span> : null}
        <div className="search-hotel-actions">
          <button
            className="primary-button search-hotel-cta"
            type="button"
            onClick={() =>
              navigate(`/hotel/${hotel.hotel_id}?checkin=${checkin}&checkout=${checkout}&guests=${guests}`)
            }
          >
            View hotel
          </button>
          <button
            className="ghost-button search-hotel-cta search-hotel-cta-secondary"
            type="button"
            onClick={() => onPreviewDirections(hotel)}
            disabled={!canOpenDirections || directionsLoading}
            title={canOpenDirections ? 'Preview the route from your location' : 'Directions unavailable for this hotel'}
          >
            {directionsLoading ? 'Locating...' : 'Preview route'}
          </button>
        </div>
        {directionsState?.message ? (
          <p className={`search-route-note search-route-note--${directionsState.tone || 'info'}`}>
            {directionsState.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [search, setSearch] = useState(() => readQueryState(searchParams));

  const [allHotels, setAllHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availabilityByHotel, setAvailabilityByHotel] = useState({});
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [filters, setFilters] = useState({ minPrice: '', maxPrice: '', stars: '', brand: '' });
  const [destinationOptions, setDestinationOptions] = useState([]);
  const [directionsLoadingHotelId, setDirectionsLoadingHotelId] = useState(null);
  const [directionsStateByHotel, setDirectionsStateByHotel] = useState({});
  const [previewHotel, setPreviewHotel] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);

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

  useEffect(() => {
    let cancelled = false;

    apiRequest('/locations')
      .then((res) => {
        if (cancelled) return;
        const options = (res.data || [])
          .filter((location) => ['CITY', 'DISTRICT'].includes(location.location_type))
          .map((location) => location.location_name)
          .filter(Boolean);
        setDestinationOptions([...new Set(options)].sort((a, b) => a.localeCompare(b)));
      })
      .catch(() => {
        if (!cancelled) setDestinationOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const brands = useMemo(
    () => [...new Set(allHotels.map((hotel) => hotel.brand_name || hotel.chain_name).filter(Boolean))],
    [allHotels],
  );

  const activeQuery = useMemo(
    () => normalizeQueryState({ ...search, guests: search.guests || 1 }),
    [search],
  );

  const candidateHotels = useMemo(() => {
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
    return result;
  }, [activeQuery.destination, allHotels, filters.stars, filters.brand]);

  useEffect(() => {
    let cancelled = false;

    if (candidateHotels.length === 0) {
      setAvailabilityByHotel({});
      return () => {
        cancelled = true;
      };
    }

    setAvailabilityLoading(true);

    Promise.all(
      candidateHotels.map(async (hotel) => {
        try {
          const payload = await apiRequest(
            `/rooms/availability?hotel_id=${hotel.hotel_id}&checkin=${activeQuery.checkin}&checkout=${activeQuery.checkout}`,
          );
          const rooms = payload.data || payload.rooms || payload.availability || [];
          const minRate = rooms.reduce((lowest, room) => {
            const rate = Number(room.min_nightly_rate || 0);
            if (!rate) return lowest;
            return lowest == null ? rate : Math.min(lowest, rate);
          }, null);

          return [hotel.hotel_id, { count: rooms.length, minRate }];
        } catch {
          return [hotel.hotel_id, { count: 0, minRate: null }];
        }
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setAvailabilityByHotel(Object.fromEntries(entries));
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeQuery.checkin, activeQuery.checkout, candidateHotels]);

  const hotels = useMemo(() => {
    let result = candidateHotels
      .map((hotel) => {
        const availability = availabilityByHotel[hotel.hotel_id];
        if (!availability || availability.count === 0) return null;

        return {
          ...hotel,
          available_room_count: availability.count,
          min_nightly_rate: availability.minRate || hotel.min_nightly_rate,
        };
      })
      .filter(Boolean);

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
  }, [availabilityByHotel, candidateHotels, filters.minPrice, filters.maxPrice]);

  function updateSearch(updater) {
    setSearch((prev) => {
      const draft = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      if (!draft.checkin || !draft.checkout || draft.checkout > draft.checkin) {
        return draft;
      }

      return {
        ...draft,
        checkout: addDays(draft.checkin, 1),
      };
    });
  }

  function applyQuery(nextQuery, replace = true) {
    const normalizedQuery = normalizeQueryState(nextQuery);
    const nextParams = buildQueryParams(normalizedQuery);
    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace });
    }
  }

  useEffect(() => {
    if (!search.checkin || !search.checkout || search.checkout <= search.checkin || search.guests === '') {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const normalizedQuery = normalizeQueryState(search);
      const nextParams = buildQueryParams(normalizedQuery);
      if (nextParams.toString() !== searchParams.toString()) {
        setSearchParams(nextParams, { replace: true });
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [search, searchParams, setSearchParams]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    applyQuery(search, false);
  }

  function handleFilterChange(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePreviewDirections(hotel, forceRefresh = false) {
    if (!hasHotelCoordinates(hotel)) {
      setDirectionsStateByHotel((prev) => ({
        ...prev,
        [hotel.hotel_id]: { tone: 'error', message: 'Directions are unavailable for this hotel.' },
      }));
      return;
    }

    setPreviewHotel(hotel);

    if (!forceRefresh && currentLocation) {
      setDirectionsStateByHotel((prev) => ({
        ...prev,
        [hotel.hotel_id]: { tone: 'success', message: 'Map preview is ready. Open Google Maps for the full route.' },
      }));
      return;
    }

    try {
      setDirectionsLoadingHotelId(hotel.hotel_id);
      setDirectionsStateByHotel((prev) => ({
        ...prev,
        [hotel.hotel_id]: { tone: 'info', message: 'Requesting your current location for the preview...' },
      }));

      const position = await getCurrentPositionAsync();
      setCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });

      setDirectionsStateByHotel((prev) => ({
        ...prev,
        [hotel.hotel_id]: { tone: 'success', message: 'Map preview is ready. Open Google Maps for turn-by-turn directions.' },
      }));
    } catch (err) {
      setDirectionsStateByHotel((prev) => ({
        ...prev,
        [hotel.hotel_id]: { tone: 'error', message: err.message || 'Could not load the route preview.' },
      }));
    } finally {
      setDirectionsLoadingHotelId(null);
    }
  }

  function handleOpenGoogleMaps(hotel = previewHotel) {
    if (!hotel || !hasHotelCoordinates(hotel)) {
      return;
    }

    const directionsUrl = buildGoogleDirectionsUrl(
      currentLocation?.latitude,
      currentLocation?.longitude,
      Number(hotel.latitude),
      Number(hotel.longitude),
    );

    window.open(directionsUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="search-page">
      <div className="search-top-bar">
        <form className="search-top-form" onSubmit={handleSearchSubmit}>
          <input
            list="search-destination-list"
            type="text"
            placeholder="Destination, hotel, city..."
            value={search.destination}
            onChange={(event) => updateSearch({ destination: event.target.value })}
            className="search-top-input"
          />
          <datalist id="search-destination-list">
            {destinationOptions.map((destination) => (
              <option key={destination} value={destination} />
            ))}
          </datalist>
          <input
            type="date"
            value={search.checkin}
            min={today()}
            onChange={(event) => updateSearch({ checkin: event.target.value })}
            className="search-top-input"
          />
          <input
            type="date"
            value={search.checkout}
            min={addDays(search.checkin, 1)}
            onChange={(event) => updateSearch({ checkout: event.target.value })}
            className="search-top-input"
          />
          <div className="guests-stepper search-guests-stepper">
            <button
              type="button"
              className="guests-btn"
              onClick={() => updateSearch((prev) => ({ ...prev, guests: Math.max(1, Number(prev.guests) - 1) }))}
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
                updateSearch((prev) => ({
                  ...prev,
                  guests: Number.isNaN(value) ? '' : Math.min(10, Math.max(1, value)),
                }));
              }}
              onBlur={() => updateSearch((prev) => ({ ...prev, guests: prev.guests || 1 }))}
            />
            <button
              type="button"
              className="guests-btn"
              onClick={() => updateSearch((prev) => ({ ...prev, guests: Math.min(10, Number(prev.guests) + 1) }))}
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
          {loading || availabilityLoading ? (
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
              {previewHotel ? (
                <SearchDirectionsPreview
                  hotel={previewHotel}
                  userLocation={currentLocation}
                  status={directionsStateByHotel[previewHotel.hotel_id]}
                  isLocating={directionsLoadingHotelId === previewHotel.hotel_id}
                  onOpenGoogleMaps={() => handleOpenGoogleMaps(previewHotel)}
                  onRefreshLocation={() => handlePreviewDirections(previewHotel, true)}
                />
              ) : null}
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
                    onPreviewDirections={handlePreviewDirections}
                    directionsState={directionsStateByHotel[hotel.hotel_id]}
                    directionsLoading={directionsLoadingHotelId === hotel.hotel_id}
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
