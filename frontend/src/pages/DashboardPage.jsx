import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { resolveHotelImage, imgError } from '../utils/hotelImages';
import '../styles/Home.css';

//  tiny helpers 
function today() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

//  Hero Search Bar 
function HeroSearch() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({
    destination: '',
    checkin: today(),
    checkout: addDays(today(), 2),
    guests: 1,
  });

  useEffect(() => {
    // Locations: backend returns { success, count, data: [...Location rows] }
    // Filter CITY-level entries only and use location_name as display
    apiRequest('/locations').then((res) => {
      const list = (res.data || []).filter(
        (l) => l.location_type === 'CITY' || l.location_type === 'DISTRICT'
      );
      setLocations(list);
    }).catch(() => {});
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    const params = new URLSearchParams({
      destination: form.destination,
      checkin: form.checkin,
      checkout: form.checkout,
      guests: form.guests,
    });
    navigate(`/search?${params.toString()}`);
  }

  return (
    <div className="hero-search-wrap">
      <form className="hero-search-form" onSubmit={handleSearch}>
        <label className="hero-field">
          <span>Destination</span>
          <input
            list="dest-list"
            type="text"
            placeholder="City, hotel name or area..."
            value={form.destination}
            onChange={(e) => setForm((s) => ({ ...s, destination: e.target.value }))}
            required
          />
          <datalist id="dest-list">
            {locations.map((l) => (
              <option key={l.location_id} value={l.location_name} />
            ))}
          </datalist>
        </label>

        <label className="hero-field">
          <span>Check-in</span>
          <input
            type="date"
            value={form.checkin}
            min={today()}
            onChange={(e) => setForm((s) => ({ ...s, checkin: e.target.value }))}
          />
        </label>

        <label className="hero-field">
          <span>Check-out</span>
          <input
            type="date"
            value={form.checkout}
            min={addDays(form.checkin, 1)}
            onChange={(e) => setForm((s) => ({ ...s, checkout: e.target.value }))}
          />
        </label>

        <label className="hero-field hero-field-sm">
          <span>Guests</span>
          <div className="guests-stepper">
            <button type="button" className="guests-btn"
              onClick={() => setForm((s) => ({ ...s, guests: Math.max(1, s.guests - 1) }))}
              disabled={form.guests <= 1}>-</button>
            <input
              type="text" inputMode="numeric"
              className="guests-val guests-input"
              value={form.guests}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const val = parseInt(e.target.value.replace(/\D/g, ''), 10);
                setForm((s) => ({ ...s, guests: isNaN(val) ? '' : Math.min(10, Math.max(1, val)) }));
              }}
              onBlur={() => setForm((s) => ({ ...s, guests: s.guests || 1 }))}
            />
            <button type="button" className="guests-btn"
              onClick={() => setForm((s) => ({ ...s, guests: Math.min(10, s.guests + 1) }))}
              disabled={form.guests >= 10}>+</button>
          </div>
        </label>

        <button className="hero-search-btn" type="submit">
          Search
        </button>
      </form>
    </div>
  );
}

//  Destination Card 
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80';

function DestCard({ city, country, count, image }) {
  const navigate = useNavigate();
  const img = image || FALLBACK_IMG;
  return (
    <button
      className="dest-card"
      type="button"
      onClick={() => navigate(`/search?destination=${encodeURIComponent(`${city}, ${country}`)}&checkin=${today()}&checkout=${addDays(today(), 2)}&guests=1`)}
    >
      <img src={img} alt={city} className="dest-card-img" onError={imgError} />
      <div className="dest-card-overlay">
        <strong>{city}</strong>
        <span>{count} {count === 1 ? 'property' : 'properties'}</span>
      </div>
    </button>
  );
}

//  Promo Card 
function PromoCard({ promo }) {
  const navigate = useNavigate();
  // Backend fields: promotion_name, promotion_type, discount_value, booking_end_date
  const discount = ['PERCENT', 'PERCENT_OFF'].includes(promo.promotion_type)
    ? `${promo.discount_value}% off`
    : `${new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: promo.currency_code || 'USD',
        maximumFractionDigits: ['VND', 'JPY', 'KRW'].includes(promo.currency_code) ? 0 : 2,
      }).format(Number(promo.discount_value || 0))} off`;

  return (
    <div className="promo-card">
      <div className="promo-card-badge">{discount}</div>
      <h3 className="promo-card-title">{promo.promotion_name || promo.promo_name}</h3>
      <p className="promo-card-desc">{promo.description || 'Limited time offer for loyal guests.'}</p>
      {promo.booking_end_date && (
        <p className="promo-card-expire">Valid until {new Date(promo.booking_end_date).toLocaleDateString()}</p>
      )}
      <button className="ghost-button promo-card-cta" type="button" onClick={() => navigate('/search')}>
        Explore hotels
      </button>
    </div>
  );
}

//  Main Page 
export default function DashboardPage() {
  const navigate = useNavigate();
  const [promos, setPromos] = useState([]);
  const [hotels, setHotels] = useState([]);

  useEffect(() => {
    // All 3 endpoints return { success, count, data: [...] }
    apiRequest('/promotions').then((r) => {
      // JOIN in backend can produce duplicate rows per promotion  deduplicate
      const seen = new Set();
      const unique = (r.data || r.promotions || []).filter((p) => {
        if (seen.has(p.promotion_id)) return false;
        seen.add(p.promotion_id);
        return true;
      });
      setPromos(unique.slice(0, 3));
    }).catch(() => {});
    apiRequest('/hotels').then((r) => setHotels(r.data || r.hotels || [])).catch(() => {});
  }, []);

  // Build destination groups from hotel catalog so cards can use MongoDB hero images.
  const destMap = {};
  hotels.forEach((hotel) => {
    const city = hotel.location_detail?.city || hotel.city_name || hotel.district_name;
    const country = hotel.location_detail?.country || hotel.country_name || '';
    if (!city) return;

    const key = `${city}|${country}`;
    if (!destMap[key]) {
      destMap[key] = {
        city,
        country,
        count: 0,
        image: resolveHotelImage(hotel),
      };
    }
    destMap[key].count += 1;
  });
  const topDests = Object.values(destMap).slice(0, 6);
  const featuredHotels = hotels.slice(0, 4);

  return (
    <div className="home-page">
      {/*  HERO  */}
      <section className="hero-section">
        <div className="hero-copy">
          <p className="hero-eyebrow">LuxeReserve</p>
          <h1 className="hero-title">
            Extraordinary stays,<br />perfectly reserved.
          </h1>
          <p className="hero-sub">Discover premium hotels across Asia's most iconic destinations.</p>
        </div>
        <HeroSearch />
      </section>

      {/*  ALREADY HAVE A BOOKING?  */}
      <section className="home-section">
        <div className="resv-banner">
          <div className="resv-banner-copy">
            <p className="page-eyebrow">Existing booking</p>
            <h2 className="resv-banner-title">Already have a reservation?</h2>
            <p className="resv-banner-desc">
              If you received a confirmation code after booking, you can look it up here
              to check your stay details, dates, and status  no sign-in required.
            </p>
          </div>
          <button
            className="primary-button resv-banner-cta"
            type="button"
            onClick={() => navigate('/reservation')}
          >
            Look up my reservation 
          </button>
        </div>
      </section>

      {/*  HOT DESTINATIONS  */}
      {topDests.length > 0 && (
        <section className="home-section">
          <div className="home-section-head">
            <div>
              <p className="page-eyebrow">Explore</p>
              <h2 className="home-section-title">Popular destinations</h2>
            </div>
          </div>
          <div className="dest-grid">
            {topDests.map((d) => (
              <DestCard key={`${d.city}-${d.country}`} city={d.city} country={d.country} count={d.count} image={d.image} />
            ))}
          </div>
        </section>
      )}

      {/*  FEATURED HOTELS  */}
      {featuredHotels.length > 0 && (
        <section className="home-section">
          <div className="home-section-head">
            <div>
              <p className="page-eyebrow">Featured</p>
              <h2 className="home-section-title">Hotels in our collection</h2>
            </div>
            <button className="ghost-button" type="button" onClick={() => navigate('/search?destination=&checkin=' + today() + '&checkout=' + addDays(today(), 2) + '&guests=1')}>
              View all
            </button>
          </div>
          <div className="featured-grid">
            {featuredHotels.map((h) => (
              <button
                key={h.hotel_id}
                className="featured-card"
                type="button"
                onClick={() => navigate(`/hotel/${h.hotel_id}`)}
              >
                <img
                  src={resolveHotelImage(h)}
                  alt={h.hotel_name}
                  className="featured-card-img"
                  onError={imgError}
                />
                <div className="featured-card-body">
                  <div>
                    <p className="featured-card-brand">{h.brand_name || h.chain_name || 'LuxeReserve'}</p>
                    <h3 className="featured-card-name">{h.hotel_name}</h3>
                    <p className="featured-card-loc">
                      {h.city_name}{h.location_detail?.country ? `, ${h.location_detail.country}` : ''}
                    </p>
                  </div>
                  <span className="featured-card-cta">View hotel </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/*  PROMOTIONS  */}
      {promos.length > 0 && (
        <section className="home-section">
          <div className="home-section-head">
            <div>
              <p className="page-eyebrow">Limited offers</p>
              <h2 className="home-section-title">Current promotions</h2>
            </div>
          </div>
          <div className="promo-grid">
            {promos.map((p, i) => (
              <PromoCard key={`promo-${p.promotion_id}-${i}`} promo={p} />
            ))}
          </div>
        </section>
      )}

      {/*  TRUST STRIP  */}
      <section className="trust-strip">
        {[
          { icon: '💎', title: 'Curated luxury', desc: 'Every property vetted for exceptional standards.' },
          { icon: '🔒', title: 'Secure booking', desc: 'Your data and payments are always protected.' },
          { icon: '🎁', title: 'Loyalty rewards', desc: 'Earn points on every stay. Redeem for upgrades.' },
          { icon: '🌐', title: 'Global network', desc: "Properties across Asia's top destinations." },
        ].map((t) => (
          <div key={t.title} className="trust-item">
            <span className="trust-icon">{t.icon}</span>
            <strong>{t.title}</strong>
            <p>{t.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
