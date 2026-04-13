import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppData } from '../context/AppDataContext';
import PromotionCard from '../components/ui/PromotionCard';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isGuestUser, guestPromotions } = useAuth();
  const { hotels, publicPromotions } = useAppData();

  /* ── Derived ─────────────────────────────────────── */
  const hotelsByCity = Object.entries(
    hotels.reduce((acc, hotel) => {
      const city = hotel.city_name || 'Unknown city';
      if (!acc[city]) acc[city] = [];
      acc[city].push(hotel);
      return acc;
    }, {})
  ).sort((a, b) => b[1].length - a[1].length);

  const topDestinations = hotelsByCity.slice(0, 4);
  const promotions = isGuestUser ? guestPromotions : publicPromotions;

  return (
    <>
      {/* ── Welcome Banner ──────────────────────────── */}
      <section className="panel panel-span-3 home-hero-card">
        <p className="section-kicker">Chào mừng đến với LuxeReserve</p>
        <h2>Khám phá điểm đến, đặt phòng cao cấp và nhận ưu đãi thành viên</h2>
        <p className="lede">
          Hệ thống đặt phòng khách sạn luxury với chương trình khách hàng thân thiết,
          dịch vụ tiện ích và quản lý đặt phòng toàn diện.
        </p>
        <div className="cta-row">
          <button className="primary-button" type="button" onClick={() => navigate('/booking')}>
            Đặt phòng ngay
          </button>
          <button className="ghost-button" type="button" onClick={() => navigate('/reservation')}>
            Tra cứu đặt phòng
          </button>
        </div>
      </section>

      {/* ── Hotels by City ──────────────────────────── */}
      <section className="panel panel-span-2">
        <p className="section-kicker">Khách sạn theo thành phố</p>
        <h2>Danh sách khách sạn nổi bật</h2>
        <div className="city-sections">
          {hotelsByCity.slice(0, 4).map(([city, cityHotels]) => (
            <article key={city} className="city-card">
              <div className="panel-header-inline">
                <div>
                  <h3>{city}</h3>
                  <p className="muted-copy">{cityHotels.length} khách sạn</p>
                </div>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => navigate(`/booking?hotel=${cityHotels[0].hotel_id}`)}
                >
                  Khám phá
                </button>
              </div>
              <div className="compact-list">
                {cityHotels.slice(0, 3).map((hotel) => (
                  <div key={hotel.hotel_id} className="compact-item">
                    <strong>{hotel.hotel_name}</strong>
                    <span>{hotel.brand_name}</span>
                    <span>{hotel.total_rooms} rooms</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Top Destinations ────────────────────────── */}
      <section className="panel">
        <p className="section-kicker">Top điểm đến</p>
        <h2>Điểm đến nổi bật</h2>
        <div className="compact-list">
          {topDestinations.map(([city, cityHotels]) => (
            <div key={city} className="compact-item">
              <strong>{city}</strong>
              <span>{cityHotels.length} khách sạn luxury</span>
              <span>{cityHotels.reduce((sum, hotel) => sum + Number(hotel.total_rooms || 0), 0)} phòng</span>
            </div>
          ))}
          {!topDestinations.length ? <p className="muted-copy">No destination data loaded.</p> : null}
        </div>
      </section>

      {/* ── Promotions Showcase ─────────────────────── */}
      <section className="panel panel-span-2">
        <p className="section-kicker">Top khuyến mãi</p>
        <h2>Ưu đãi nổi bật toàn hệ thống</h2>
        <div className="promo-grid">
          {promotions.slice(0, 6).map((promotion) => (
            <PromotionCard key={promotion.promotion_id} promotion={promotion} />
          ))}
          {!promotions.length ? (
            <p className="muted-copy">Chưa có khuyến mãi active để hiển thị.</p>
          ) : null}
        </div>
      </section>
    </>
  );
}
