/**
 * hotelImages.js
 * Resolves a display image for a hotel using:
 *  1. hero_image from backend (if valid, non-fake URL)
 *  2. City/destination-specific Unsplash photo
 *  3. Hotel-type-specific Unsplash photo
 *  4. Generic luxury hotel fallback
 *
 * All Unsplash IDs are stable  they won't break over time.
 */

const CITY_IMAGES = {
  'ho chi minh': 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&q=80',
  'hanoi':       'https://images.unsplash.com/photo-1597838816882-4435b1977fbe?w=800&q=80',
  'da nang':     'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&q=80',
  'phu quoc':    'https://images.unsplash.com/photo-1614082242765-7c98ca0f3df3?w=800&q=80',
  'bangkok':     'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=800&q=80',
  'singapore':   'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80',
  'tokyo':       'https://images.unsplash.com/photo-1492571350019-22de08371fd3?w=800&q=80',
  'osaka':       'https://images.unsplash.com/photo-1589452271712-64b8a66c7b71?w=800&q=80',
  'bali':        'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80',
  'jakarta':     'https://images.unsplash.com/photo-1555899434-94d1368aa7af?w=800&q=80',
  'kuala lumpur':'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800&q=80',
  'seoul':       'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&q=80',
  'beijing':     'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800&q=80',
  'shanghai':    'https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=800&q=80',
};

const TYPE_IMAGES = {
  'CITY_HOTEL':   'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
  'RESORT':       'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
  'BOUTIQUE':     'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80',
  'AIRPORT':      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80',
  'BUSINESS':     'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80',
  'EXTENDED_STAY':'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',
};

const GENERIC = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80';

// Fake domain used by MongoDB seed data  always replace these
const FAKE_DOMAINS = ['cdn.luxereserve.com', 'luxereserve.com'];

function isFakeOrBroken(url) {
  if (!url) return true;
  return FAKE_DOMAINS.some((d) => url.includes(d));
}

/**
 * Returns the best available image URL for a hotel object.
 * @param {object} hotel  hotel object from backend
 * @returns {string}  Unsplash or valid CDN URL
 */
export function resolveHotelImage(hotel) {
  if (!isFakeOrBroken(hotel?.hero_image)) {
    return hotel.hero_image;
  }

  // Try city from location_detail
  const cityRaw = (hotel?.location_detail?.city || hotel?.city_name || '').toLowerCase();
  for (const [key, url] of Object.entries(CITY_IMAGES)) {
    if (cityRaw.includes(key)) return url;
  }

  // Try hotel type
  const type = hotel?.hotel_type || '';
  if (TYPE_IMAGES[type]) return TYPE_IMAGES[type];

  return GENERIC;
}

/**
 * Always-safe onError handler  set as <img onError={imgError} />
 */
export function imgError(e) {
  e.target.onerror = null; // prevent infinite loop
  e.target.src = GENERIC;
}
