import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { resolveHotelImage, imgError } from '../utils/hotelImages';
import heroImage from '../assets/hero.png';
import '../styles/Home.css';

//  tiny helpers 
function today() {
  return new Date().toISOString().slice(0, 10);
}
type LocationOption = {
  location_id: number;
  location_name: string;
  location_type: string;
};

type HotelSummary = {
  hotel_id: number;
  hotel_name: string;
  brand_name?: string | null;
  chain_name?: string | null;
  city_name?: string | null;
  district_name?: string | null;
  country_name?: string | null;
  location_detail?: { city?: string | null; country?: string | null } | null;
  hero_image?: string | null;
  hotel_type?: string | null;
};

type Promotion = {
  promotion_id: number;
  promotion_name?: string | null;
  promo_name?: string | null;
  promotion_type?: string | null;
  discount_value?: number | string | null;
  currency_code?: string | null;
  description?: string | null;
  booking_end_date?: string | null;
};

type DestinationGroup = {
  city: string;
  country: string;
  count: number;
  image: string;
};

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

//  Hero Search Bar 
function HeroSearch() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<LocationOption[]>([]);
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
        (l: LocationOption) => l.location_type === 'CITY' || l.location_type === 'DISTRICT'
      );
      setLocations(list);
    }).catch(() => {});
  }, []);

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams({
      destination: form.destination,
      checkin: form.checkin,
      checkout: form.checkout,
      guests: String(form.guests || 1),
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
                setForm((s) => ({ ...s, guests: isNaN(val) ? 1 : Math.min(10, Math.max(1, val)) }));
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
const MARQUEE_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&q=80',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=900&q=80',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=900&q=80',
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=900&q=80',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=900&q=80',
  'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=900&q=80',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=900&q=80',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=900&q=80',
];

function LuxuryMarquee() {
  return (
    <section className="luxury-marquee" aria-label="Luxury hotel imagery">
      <div className="luxury-marquee-track">
        {[...MARQUEE_IMAGES, ...MARQUEE_IMAGES].map((src, index) => (
          <img key={`${src}-${index}`} src={src} alt="Luxury hotel preview" loading="lazy" />
        ))}
      </div>
    </section>
  );
}

function StoryQuote() {
  return (
    <section className="story-quote">
      <span className="quote-mark">“</span>
      <h2>
        We design every reservation around <span>arrival, comfort, and memory.</span>
      </h2>
      <p>
        LuxeReserve brings premium hotels, secure booking, loyalty rewards, and hotel operations together in one calm
        guest journey.
      </p>
      <div className="brand-row" aria-label="Partner brands">
        <strong>Luxe</strong>
        <strong>Aurora</strong>
        <strong>Maison</strong>
      </div>
      <img
        src="https://images.unsplash.com/photo-1590490360182-c33d57733427?w=900&q=80"
        alt="Luxury suite interior"
        loading="lazy"
      />
    </section>
  );
}

function MembershipSection() {
  const navigate = useNavigate();
  return (
    <section className="membership-section">
      <div className="membership-card membership-card-dark">
        <p className="page-eyebrow">Signature stay</p>
        <h3>Suite Escape</h3>
        <p>Designed for guests who want ocean views, flexible check-in, and a polished arrival experience.</p>
        <div className="membership-price">From $500<span> / night</span></div>
        <div className="membership-actions">
          <button className="primary-button" type="button" onClick={() => navigate('/search')}>
            Reserve now
          </button>
          <button className="glass-button" type="button" onClick={() => navigate('/reservation')}>
            Existing booking
          </button>
        </div>
      </div>
      <div className="membership-card membership-card-light">
        <p className="page-eyebrow">Loyalty</p>
        <h3>Private Rewards</h3>
        <p>Earn points, redeem upgrades, and keep your preferences ready for every LuxeReserve property.</p>
        <div className="membership-price">VIP<span> tiers</span></div>
        <button className="ghost-button" type="button" onClick={() => navigate('/register')}>
          Join rewards
        </button>
      </div>
    </section>
  );
}

function CollectionShowcase() {
  const projects = [
    {
      name: 'Coastal calm',
      desc: 'Beachfront properties with spa rituals and private terraces.',
      image: 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200&q=80',
    },
    {
      name: 'City after dark',
      desc: 'Skyline suites near dining, business districts, and nightlife.',
      image: 'https://images.unsplash.com/photo-1549294413-26f195200c16?w=1200&q=80',
    },
    {
      name: 'Heritage weekends',
      desc: 'Boutique stays shaped by local craft, quiet courtyards, and long breakfasts.',
      image: 'https://images.unsplash.com/photo-1519449556851-5720b33024e7?w=1200&q=80',
    },
  ];

  return (
    <section className="collection-showcase">
      {projects.map((project) => (
        <article className="collection-item" key={project.name}>
          <div>
            <h3>{project.name}</h3>
            <p>{project.desc}</p>
          </div>
          <img src={project.image} alt={project.name} loading="lazy" />
        </article>
      ))}
    </section>
  );
}

function PartnerCta() {
  const navigate = useNavigate();
  return (
    <section className="partner-cta">
      <h2>Reserve beautifully.</h2>
      <button className="primary-button partner-button" type="button" onClick={() => navigate('/search')}>
        <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80" alt="Concierge" />
        Start with LuxeReserve
      </button>
    </section>
  );
}

function DestCard({ city, country, count, image }: DestinationGroup) {
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
function PromoCard({ promo }: { promo: Promotion }) {
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
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [hotels, setHotels] = useState<HotelSummary[]>([]);

  useEffect(() => {
    // All 3 endpoints return { success, count, data: [...] }
    apiRequest('/promotions').then((r) => {
      // JOIN in backend can produce duplicate rows per promotion  deduplicate
      const seen = new Set<number>();
      const unique = ((r.data || r.promotions || []) as Promotion[]).filter((p) => {
        if (seen.has(p.promotion_id)) return false;
        seen.add(p.promotion_id);
        return true;
      });
      setPromos(unique.slice(0, 3));
    }).catch(() => {});
    apiRequest('/hotels').then((r) => setHotels(r.data || r.hotels || [])).catch(() => {});
  }, []);

  // Build destination groups from hotel catalog so cards can use MongoDB hero images.
  const destMap: Record<string, DestinationGroup> = {};
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
        <div className="hero-main">
          <div className="hero-copy">
            <p className="hero-eyebrow">LuxeReserve Private Collection</p>
            <h1 className="hero-title">
              Luxury hotel stays, curated for your next escape.
            </h1>
            <p className="hero-sub">
              Book refined city retreats, beachfront suites, and resort hideaways with real-time availability,
              secure payments, and loyalty rewards built in.
            </p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={() => navigate('/search')}>
                Explore hotels
              </button>
              <button className="glass-button" type="button" onClick={() => navigate('/reservation')}>
                Find reservation
              </button>
            </div>
            <div className="hero-stats" aria-label="LuxeReserve highlights">
              <span><strong>12</strong> hotels</span>
              <span><strong>24/7</strong> support</span>
              <span><strong>VIP</strong> rewards</span>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <img src={heroImage} alt="" />
            <div className="hero-floating-card hero-floating-card-top">
              <span>Tonight's mood</span>
              <strong>Ocean suite upgrade</strong>
            </div>
            <div className="hero-floating-card hero-floating-card-bottom">
              <span>Guest rating</span>
              <strong>4.9 / 5 excellent</strong>
            </div>
          </div>
        </div>
        <HeroSearch />
      </section>

      <LuxuryMarquee />

      <StoryQuote />

      <section className="experience-strip">
        {[
          { value: '01', title: 'Choose your scene', desc: 'City skyline, heritage retreat, or resort coast.' },
          { value: '02', title: 'Reserve with clarity', desc: 'See dates, guest count, rates, and payment path upfront.' },
          { value: '03', title: 'Arrive remembered', desc: 'Profiles, points, and preferences follow every stay.' },
        ].map((item) => (
          <article className="experience-card" key={item.title}>
            <span>{item.value}</span>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
          </article>
        ))}
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

      <MembershipSection />

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
          { icon: '', title: 'Curated luxury', desc: 'Every property vetted for exceptional standards.' },
          { icon: '', title: 'Secure booking', desc: 'Your data and payments are always protected.' },
          { icon: '', title: 'Loyalty rewards', desc: 'Earn points on every stay. Redeem for upgrades.' },
          { icon: '', title: 'Global network', desc: "Properties across Asia's top destinations." },
        ].map((t) => (
          <div key={t.title} className="trust-item">
            <span className="trust-icon">{t.icon}</span>
            <strong>{t.title}</strong>
            <p>{t.desc}</p>
          </div>
        ))}
      </section>

      <CollectionShowcase />

      <section className="editorial-banner">
        <div>
          <p className="page-eyebrow">For every stay style</p>
          <h2>From boardroom mornings to rooftop nights.</h2>
          <p>
            LuxeReserve connects hotel operations, payments, housekeeping, invoices, and guest profiles so your booking
            feels polished before you arrive and effortless after checkout.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => navigate('/search')}>
          Start planning
        </button>
      </section>

      <PartnerCta />
    </div>
  );
}
