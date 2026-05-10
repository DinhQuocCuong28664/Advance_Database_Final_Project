/**
 * Resolves a display image for a hotel using backend hero image first,
 * then stable destination/type fallbacks.
 */
const CITY_IMAGES: Record<string, string> = {
  'ho chi minh': 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&q=80',
  hanoi: 'https://images.unsplash.com/photo-1597838816882-4435b1977fbe?w=800&q=80',
  'da nang': 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&q=80',
  'phu quoc': 'https://images.unsplash.com/photo-1614082242765-7c98ca0f3df3?w=800&q=80',
  bangkok: 'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=800&q=80',
  singapore: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=80',
  tokyo: 'https://images.unsplash.com/photo-1492571350019-22de08371fd3?w=800&q=80',
  osaka: 'https://images.unsplash.com/photo-1589452271712-64b8a66c7b71?w=800&q=80',
  bali: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80',
  jakarta: 'https://images.unsplash.com/photo-1555899434-94d1368aa7af?w=800&q=80',
  'kuala lumpur': 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800&q=80',
  seoul: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&q=80',
  beijing: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800&q=80',
  shanghai: 'https://images.unsplash.com/photo-1474181487882-5abf3f0ba6c2?w=800&q=80',
};

const TYPE_IMAGES: Record<string, string> = {
  CITY_HOTEL: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
  RESORT: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
  BOUTIQUE: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80',
  AIRPORT: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80',
  BUSINESS: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80',
  EXTENDED_STAY: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',
};

const GENERIC = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80';
const FAKE_DOMAINS = ['cdn.luxereserve.com', 'luxereserve.com'];

type HotelImageLike = {
  hero_image?: string | null;
  city_name?: string | null;
  hotel_type?: string | null;
  location_detail?: { city?: string | null } | null;
} | null | undefined;

function isFakeOrBroken(url?: string | null) {
  if (!url) return true;
  return FAKE_DOMAINS.some((domain) => url.includes(domain));
}

export function resolveHotelImage(hotel: HotelImageLike) {
  if (!isFakeOrBroken(hotel?.hero_image)) {
    return hotel?.hero_image as string;
  }

  const cityRaw = (hotel?.location_detail?.city || hotel?.city_name || '').toLowerCase();
  for (const [key, url] of Object.entries(CITY_IMAGES)) {
    if (cityRaw.includes(key)) return url;
  }

  const type = hotel?.hotel_type || '';
  if (TYPE_IMAGES[type]) return TYPE_IMAGES[type];

  return GENERIC;
}

export function imgError(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.onerror = null;
  event.currentTarget.src = GENERIC;
}
