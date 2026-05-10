import { NavLink } from 'react-router-dom';

const DESTINATION_LINKS = [
  'Ho Chi Minh City hotels',
  'Hanoi hotels',
  'Da Nang hotels',
  'Phu Quoc hotels',
  'Bangkok hotels',
  'Singapore hotels',
  'Tokyo hotels',
  'Seoul hotels',
  'Seminyak hotels',
  'Luxury resorts',
];

const FOOTER_COLUMNS = [
  {
    title: 'Support',
    links: ['Manage your trips', 'Contact customer service', 'Safety resource center'],
  },
  {
    title: 'Discover',
    links: ['Seasonal hotel deals', 'Travel inspiration', 'Business stays', 'Restaurant reservations'],
  },
  {
    title: 'Terms and settings',
    links: ['Privacy notice', 'Terms of service', 'Accessibility statement', 'Cookie settings'],
  },
  {
    title: 'Partners',
    links: ['List your property', 'Partner help', 'Affiliate program', 'Corporate partnerships'],
  },
  {
    title: 'About',
    links: ['About LuxeReserve', 'How we work', 'Sustainability', 'Careers'],
  },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="shell-footer">
      <section className="footer-destinations">
        <div className="footer-destination-head">
          <h3>Popular destinations across the LuxeReserve network</h3>
          <p>Explore the cities and resort markets currently featured in the chain.</p>
        </div>
        <div className="footer-destination-links">
          {DESTINATION_LINKS.map((label) => (
            <a key={label} href="#" className="footer-destination-link">
              {label}
            </a>
          ))}
        </div>
        <div className="footer-meta-links">
          <a href="#">Cities</a>
          <a href="#">Districts</a>
          <a href="#">Hotels</a>
          <a href="#">Resorts</a>
          <a href="#">Luxury stays</a>
          <a href="#">Member offers</a>
          <a href="#">All destinations</a>
        </div>
      </section>

      <div className="footer-grid">
        <section className="footer-block">
          <h4>Quick links</h4>
          <nav className="footer-links">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/booking">Booking</NavLink>
            <NavLink to="/reservation">Reservation</NavLink>
            <NavLink to="/login">Sign in</NavLink>
            <NavLink to="/register">Register</NavLink>
          </nav>
        </section>

        {FOOTER_COLUMNS.map((column) => (
          <section key={column.title} className="footer-block">
            <h4>{column.title}</h4>
            <nav className="footer-links">
              {column.links.map((label) => (
                <a key={label} href="#">
                  {label}
                </a>
              ))}
            </nav>
          </section>
        ))}
      </div>

      <div className="footer-bottom-bar">
        <div className="footer-settings">
          <span className="footer-pill">Vietnam</span>
          <span className="footer-pill">VND</span>
        </div>
        <div className="footer-legal">
          <span>&copy; {year} LuxeReserve. All rights reserved.</span>
          <span>Advanced Database project foundation.</span>
        </div>
      </div>
    </footer>
  );
}
