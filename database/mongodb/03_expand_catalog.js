require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxereserve';
const DB_NAME = process.env.MONGODB_DB_NAME || 'luxereserve';

const roomTypeCatalogDocs = [
  {
    room_type_code: 'RT-HN-DELUXE',
    name: 'Hanoi Heritage Deluxe',
    category: 'DELUXE',
    description: 'A calm city-view room with warm wood finishes and easy access to Hanoi old-quarter dining.',
    features: { has_balcony: false, has_private_pool: false, has_lounge_access: false, has_butler_service: false },
    images: ['https://cdn.luxereserve.com/rooms/hanoi-heritage-deluxe.jpg'],
    highlight: 'French Quarter views and marble bathroom',
  },
  {
    room_type_code: 'RT-HN-CARLTON',
    name: 'Carlton Capital Suite',
    category: 'SUITE',
    description: 'A landmark-facing suite with formal living space and elevated arrival experience for premium guests.',
    features: { has_balcony: false, has_private_pool: false, has_lounge_access: true, has_butler_service: true },
    images: ['https://cdn.luxereserve.com/rooms/hanoi-carlton-suite.jpg'],
    highlight: 'Landmark-facing suite with club access',
  },
  {
    room_type_code: 'RT-DN-CLASSIC',
    name: 'Classic Peninsula Room',
    category: 'PREMIER',
    description: 'A spacious hillside room overlooking the bay, designed for destination-led resort stays.',
    features: { has_balcony: true, has_private_pool: false, has_lounge_access: false, has_butler_service: false },
    images: ['https://cdn.luxereserve.com/rooms/danang-classic-room.jpg'],
    highlight: 'Ocean-facing terrace on Son Tra Peninsula',
  },
  {
    room_type_code: 'RT-DN-PENINSULA',
    name: 'Peninsula Suite',
    category: 'SUITE',
    description: 'A resort suite with sweeping ocean panoramas, a generous lounge, and private-host service.',
    features: { has_balcony: true, has_private_pool: false, has_lounge_access: true, has_butler_service: true },
    images: ['https://cdn.luxereserve.com/rooms/danang-peninsula-suite.jpg'],
    highlight: 'Full-ocean suite built for luxury leisure stays',
  },
  {
    room_type_code: 'RT-PQ-CLASSIC',
    name: 'Classic Long Beach Room',
    category: 'DELUXE',
    description: 'A bright resort room near the beach, positioned for family-friendly island stays.',
    features: { has_balcony: true, has_private_pool: false, has_lounge_access: false, has_butler_service: false },
    images: ['https://cdn.luxereserve.com/rooms/phuquoc-classic-room.jpg'],
    highlight: 'Garden-to-beach resort layout',
  },
  {
    room_type_code: 'RT-PQ-OCEANSTE',
    name: 'Ocean View Suite',
    category: 'SUITE',
    description: 'A suite with direct sea-view framing, lounge seating, and elevated family or couple escape value.',
    features: { has_balcony: true, has_private_pool: false, has_lounge_access: true, has_butler_service: false },
    images: ['https://cdn.luxereserve.com/rooms/phuquoc-ocean-suite.jpg'],
    highlight: 'Sunset-facing suite for island stays',
  },
  {
    room_type_code: 'RT-BALI-WONDER',
    name: 'Wonderful Garden Escape',
    category: 'DELUXE',
    description: 'A lifestyle-led guest room with tropical textures and resort energy close to Seminyak dining.',
    features: { has_balcony: true, has_private_pool: false, has_lounge_access: false, has_butler_service: false },
    images: ['https://cdn.luxereserve.com/rooms/bali-wonderful-garden.jpg'],
    highlight: 'Tropical design with resort garden outlook',
  },
  {
    room_type_code: 'RT-BALI-VILLA',
    name: 'Pool Villa Retreat',
    category: 'VILLA',
    description: 'A private villa with plunge pool and a strong honeymoon and celebratory-stay appeal.',
    features: { has_balcony: true, has_private_pool: true, has_lounge_access: true, has_butler_service: true },
    images: ['https://cdn.luxereserve.com/rooms/bali-pool-villa.jpg'],
    highlight: 'Private-pool villa in Seminyak',
  },
  {
    room_type_code: 'RT-TYO-SKYLINE',
    name: 'Tokyo Skyline Premier',
    category: 'PREMIER',
    description: 'A refined Tokyo room with skyline framing and quick access to business and dining districts.',
    features: { has_balcony: false, has_private_pool: false, has_lounge_access: false, has_butler_service: false },
    images: ['https://cdn.luxereserve.com/rooms/tokyo-skyline-premier.jpg'],
    highlight: 'Tokyo Midtown skyline framing',
  },
  {
    room_type_code: 'RT-TYO-CLUBSTE',
    name: 'Club Roppongi Suite',
    category: 'SUITE',
    description: 'A high-floor suite tailored to extended luxury city stays and elite member travel.',
    features: { has_balcony: false, has_private_pool: false, has_lounge_access: true, has_butler_service: true },
    images: ['https://cdn.luxereserve.com/rooms/tokyo-roppongi-suite.jpg'],
    highlight: 'High-floor suite with club experience',
  },
  {
    room_type_code: 'RT-SEL-CLUBDLX',
    name: 'Club Deluxe Room',
    category: 'DELUXE',
    description: 'A polished Gangnam guest room with club access and strong business-travel positioning.',
    features: { has_balcony: false, has_private_pool: false, has_lounge_access: true, has_butler_service: false },
    images: ['https://cdn.luxereserve.com/rooms/seoul-club-deluxe.jpg'],
    highlight: 'Business-luxury room with club lounge access',
  },
  {
    room_type_code: 'RT-SEL-SUITE',
    name: 'Gangnam Executive Suite',
    category: 'SUITE',
    description: 'An executive-grade suite for long-stay business guests, with separate lounge and city views.',
    features: { has_balcony: false, has_private_pool: false, has_lounge_access: true, has_butler_service: false },
    images: ['https://cdn.luxereserve.com/rooms/seoul-executive-suite.jpg'],
    highlight: 'Executive suite for premium city stays',
  },
];

const hotelDocs = [
  {
    hotel_id: 4,
    hotel_code: 'RITZ-HAN-001',
    hotel_name: 'The Ritz-Carlton, Hanoi',
    brand: 'The Ritz-Carlton',
    chain: 'Marriott International',
    hotel_type: 'CITY_HOTEL',
    star_rating: 5,
    luxury_segment: 'ULTRA_LUXURY',
    description: {
      short: 'A French Quarter luxury address built for premium Hanoi stays.',
      long: 'The Ritz-Carlton, Hanoi positions the chain in the capital with landmark views, refined dining, and an elite city-stay profile.',
      highlights: [
        'French Quarter positioning near premium retail and dining',
        'Heritage-inspired rooms and capital-view suites',
        'Signature wellness and club-level service',
      ],
    },
    images: [
      { url: 'https://cdn.luxereserve.com/hotels/ritz-hanoi/exterior.jpg', caption: 'Hanoi exterior', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://cdn.luxereserve.com/hotels/ritz-hanoi/lobby.jpg', caption: 'Lobby lounge', category: 'LOBBY', is_hero: false, sort_order: 2 },
    ],
    amenities: [
      { amenity_code: 'AMN-POOL-PRIV', name: 'Private Pool', category: 'RECREATION' },
      { amenity_code: 'AMN-SPA-ESPA', name: 'ESPA Life Spa', category: 'WELLNESS' },
      { amenity_code: 'AMN-BUTLER', name: 'Butler Service', category: 'EXCLUSIVE' },
    ],
    room_types: [
      { room_type_code: 'RT-HN-DELUXE', name: 'Hanoi Heritage Deluxe', category: 'DELUXE' },
      { room_type_code: 'RT-HN-CARLTON', name: 'Carlton Capital Suite', category: 'SUITE' },
    ],
    location: {
      region: 'Southeast Asia',
      country: 'Vietnam',
      city: 'Hanoi',
      district: 'Hoan Kiem',
      address: '12 Trang Tien Street',
      coordinates: { lat: 21.0254, lng: 105.8558 },
    },
    contact: {
      phone: '+84-24-3926-8888',
      email: 'reservations.hanoi@ritzcarlton.com',
      website: 'https://www.ritzcarlton.com/hanoi',
    },
  },
  {
    hotel_id: 5,
    hotel_code: 'IC-DAD-001',
    hotel_name: 'InterContinental Danang Sun Peninsula Resort',
    brand: 'InterContinental',
    chain: 'IHG Hotels & Resorts',
    hotel_type: 'RESORT',
    star_rating: 5,
    luxury_segment: 'LUXURY_RESORT',
    description: {
      short: 'A flagship resort destination for Danang leisure stays.',
      long: 'This Danang property brings resort depth into the chain network with ocean-facing rooms, premium suites, and destination-led leisure positioning.',
      highlights: [
        'Son Tra Peninsula resort setting',
        'Ocean-view rooms and premium resort suites',
        'Strong spa and destination-transfer positioning',
      ],
    },
    images: [
      { url: 'https://cdn.luxereserve.com/hotels/ic-danang/exterior.jpg', caption: 'Resort arrival', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://cdn.luxereserve.com/hotels/ic-danang/beach.jpg', caption: 'Private bay access', category: 'AMENITY', is_hero: false, sort_order: 2 },
    ],
    amenities: [
      { amenity_code: 'AMN-POOL-PRIV', name: 'Private Pool', category: 'RECREATION' },
      { amenity_code: 'AMN-SPA-CLUB', name: 'Club Spa', category: 'WELLNESS' },
      { amenity_code: 'AMN-TRANSFER', name: 'Airport Luxury Transfer', category: 'TRANSPORT' },
    ],
    room_types: [
      { room_type_code: 'RT-DN-CLASSIC', name: 'Classic Peninsula Room', category: 'PREMIER' },
      { room_type_code: 'RT-DN-PENINSULA', name: 'Peninsula Suite', category: 'SUITE' },
    ],
    location: {
      region: 'Southeast Asia',
      country: 'Vietnam',
      city: 'Da Nang',
      district: 'Son Tra',
      address: 'Bai Bac, Son Tra Peninsula',
      coordinates: { lat: 16.1362, lng: 108.2467 },
    },
    contact: {
      phone: '+84-236-393-8888',
      email: 'reservations.danang@ihg.com',
      website: 'https://www.ihg.com/intercontinental/danang',
    },
  },
  {
    hotel_id: 6,
    hotel_code: 'IC-PQC-001',
    hotel_name: 'InterContinental Phu Quoc Long Beach Resort',
    brand: 'InterContinental',
    chain: 'IHG Hotels & Resorts',
    hotel_type: 'RESORT',
    star_rating: 5,
    luxury_segment: 'LUXURY_RESORT',
    description: {
      short: 'An island resort branch designed for family and couple escapes.',
      long: 'Phu Quoc expands the chain into high-demand beach travel with premium suites, member offers, and flexible leisure positioning.',
      highlights: [
        'Long Beach destination positioning',
        'Island-ready family and suite inventory',
        'Strong fit for seasonal promotion campaigns',
      ],
    },
    images: [
      { url: 'https://cdn.luxereserve.com/hotels/ic-phuquoc/exterior.jpg', caption: 'Resort overview', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://cdn.luxereserve.com/hotels/ic-phuquoc/beach.jpg', caption: 'Long Beach frontage', category: 'AMENITY', is_hero: false, sort_order: 2 },
    ],
    amenities: [
      { amenity_code: 'AMN-POOL-PRIV', name: 'Private Pool', category: 'RECREATION' },
      { amenity_code: 'AMN-SPA-CLUB', name: 'Club Spa', category: 'WELLNESS' },
      { amenity_code: 'AMN-BUTLER', name: 'Butler Service', category: 'EXCLUSIVE' },
    ],
    room_types: [
      { room_type_code: 'RT-PQ-CLASSIC', name: 'Classic Long Beach Room', category: 'DELUXE' },
      { room_type_code: 'RT-PQ-OCEANSTE', name: 'Ocean View Suite', category: 'SUITE' },
    ],
    location: {
      region: 'Southeast Asia',
      country: 'Vietnam',
      city: 'Phu Quoc',
      district: 'Duong To',
      address: 'Bai Truong, Long Beach',
      coordinates: { lat: 10.1406, lng: 103.9862 },
    },
    contact: {
      phone: '+84-297-397-8888',
      email: 'reservations.phuquoc@ihg.com',
      website: 'https://www.ihg.com/intercontinental/phuquoc',
    },
  },
  {
    hotel_id: 7,
    hotel_code: 'W-BALI-001',
    hotel_name: 'W Bali - Seminyak',
    brand: 'W Hotels',
    chain: 'Marriott International',
    hotel_type: 'RESORT',
    star_rating: 5,
    luxury_segment: 'LIFESTYLE_LUXURY',
    description: {
      short: 'A high-energy Bali branch built around Seminyak demand.',
      long: 'W Bali brings lifestyle resort energy, villa inventory, and premium nightlife adjacency into the chain destination mix.',
      highlights: [
        'Seminyak hotspot positioning',
        'Strong lifestyle and celebration demand fit',
        'Pool-villa inventory for premium stays',
      ],
    },
    images: [
      { url: 'https://cdn.luxereserve.com/hotels/w-bali/exterior.jpg', caption: 'Seminyak arrival', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://cdn.luxereserve.com/hotels/w-bali/pool.jpg', caption: 'Pool deck', category: 'AMENITY', is_hero: false, sort_order: 2 },
    ],
    amenities: [
      { amenity_code: 'AMN-POOL-PRIV', name: 'Private Pool', category: 'RECREATION' },
      { amenity_code: 'AMN-SPA-AWAY', name: 'AWAY Spa', category: 'WELLNESS' },
      { amenity_code: 'AMN-CLUB-WOW', name: 'W Lounge & WooBar', category: 'NIGHTLIFE' },
    ],
    room_types: [
      { room_type_code: 'RT-BALI-WONDER', name: 'Wonderful Garden Escape', category: 'DELUXE' },
      { room_type_code: 'RT-BALI-VILLA', name: 'Pool Villa Retreat', category: 'VILLA' },
    ],
    location: {
      region: 'Southeast Asia',
      country: 'Indonesia',
      city: 'Seminyak',
      district: 'Seminyak Beach',
      address: 'Jl. Petitenget',
      coordinates: { lat: -8.6799, lng: 115.1512 },
    },
    contact: {
      phone: '+62-361-300-0106',
      email: 'reservations@wbali.com',
      website: 'https://www.marriott.com/w-bali',
    },
  },
  {
    hotel_id: 8,
    hotel_code: 'RITZ-TYO-001',
    hotel_name: 'The Ritz-Carlton, Tokyo',
    brand: 'The Ritz-Carlton',
    chain: 'Marriott International',
    hotel_type: 'CITY_HOTEL',
    star_rating: 5,
    luxury_segment: 'ULTRA_LUXURY',
    description: {
      short: 'A flagship Tokyo city branch for high-end urban stays.',
      long: 'The Ritz-Carlton, Tokyo strengthens the chain presence in one of Asias strongest premium city markets.',
      highlights: [
        'Roppongi business and dining positioning',
        'High-floor skyline inventory',
        'Member-friendly premium city stay appeal',
      ],
    },
    images: [
      { url: 'https://cdn.luxereserve.com/hotels/ritz-tokyo/exterior.jpg', caption: 'Tokyo Midtown tower', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://cdn.luxereserve.com/hotels/ritz-tokyo/bar.jpg', caption: 'Skyline lounge', category: 'DINING', is_hero: false, sort_order: 2 },
    ],
    amenities: [
      { amenity_code: 'AMN-POOL-PRIV', name: 'Private Pool', category: 'RECREATION' },
      { amenity_code: 'AMN-SPA-ESPA', name: 'ESPA Life Spa', category: 'WELLNESS' },
      { amenity_code: 'AMN-BUTLER', name: 'Butler Service', category: 'EXCLUSIVE' },
    ],
    room_types: [
      { room_type_code: 'RT-TYO-SKYLINE', name: 'Tokyo Skyline Premier', category: 'PREMIER' },
      { room_type_code: 'RT-TYO-CLUBSTE', name: 'Club Roppongi Suite', category: 'SUITE' },
    ],
    location: {
      region: 'East Asia',
      country: 'Japan',
      city: 'Tokyo',
      district: 'Roppongi',
      address: 'Tokyo Midtown 9-7-1 Akasaka',
      coordinates: { lat: 35.6655, lng: 139.731 },
    },
    contact: {
      phone: '+81-3-3423-8000',
      email: 'reservations.tokyo@ritzcarlton.com',
      website: 'https://www.ritzcarlton.com/tokyo',
    },
  },
  {
    hotel_id: 9,
    hotel_code: 'IC-SEL-001',
    hotel_name: 'InterContinental Seoul COEX',
    brand: 'InterContinental',
    chain: 'IHG Hotels & Resorts',
    hotel_type: 'BUSINESS_LUXURY',
    star_rating: 5,
    luxury_segment: 'LUXURY_BUSINESS',
    description: {
      short: 'A Gangnam business-luxury branch for premium Seoul travel.',
      long: 'InterContinental Seoul COEX extends the chain into a major business and event destination with strong club-level inventory.',
      highlights: [
        'Gangnam business district location',
        'Club and executive-suite inventory',
        'Ideal fit for premium corporate and mixed-purpose stays',
      ],
    },
    images: [
      { url: 'https://cdn.luxereserve.com/hotels/ic-seoul/exterior.jpg', caption: 'COEX tower frontage', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://cdn.luxereserve.com/hotels/ic-seoul/lounge.jpg', caption: 'Club lounge', category: 'LOUNGE', is_hero: false, sort_order: 2 },
    ],
    amenities: [
      { amenity_code: 'AMN-POOL-PRIV', name: 'Private Pool', category: 'RECREATION' },
      { amenity_code: 'AMN-SPA-CLUB', name: 'Club Spa', category: 'WELLNESS' },
      { amenity_code: 'AMN-BUTLER', name: 'Butler Service', category: 'EXCLUSIVE' },
    ],
    room_types: [
      { room_type_code: 'RT-SEL-CLUBDLX', name: 'Club Deluxe Room', category: 'DELUXE' },
      { room_type_code: 'RT-SEL-SUITE', name: 'Gangnam Executive Suite', category: 'SUITE' },
    ],
    location: {
      region: 'East Asia',
      country: 'South Korea',
      city: 'Seoul',
      district: 'Gangnam',
      address: '524 Bongeunsa-ro',
      coordinates: { lat: 37.5126, lng: 127.059 },
    },
    contact: {
      phone: '+82-2-3452-2500',
      email: 'reservations.seoul@ihg.com',
      website: 'https://www.ihg.com/intercontinental/seoul',
    },
  },
];

async function expandCatalog() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const roomTypeCatalog = db.collection('room_type_catalog');
    const hotelCatalog = db.collection('Hotel_Catalog');

    for (const doc of roomTypeCatalogDocs) {
      await roomTypeCatalog.updateOne(
        { room_type_code: doc.room_type_code },
        { $set: doc },
        { upsert: true },
      );
    }

    for (const hotel of hotelDocs) {
      const now = new Date();
      await hotelCatalog.updateOne(
        { hotel_id: hotel.hotel_id },
        {
          $set: {
            ...hotel,
            last_synced_at: now,
            updated_at: now,
          },
          $setOnInsert: {
            created_at: now,
          },
        },
        { upsert: true },
      );
    }

    await roomTypeCatalog.createIndex({ room_type_code: 1 }, { unique: true });
    await roomTypeCatalog.createIndex({ category: 1 });
    await hotelCatalog.createIndex({ hotel_id: 1 }, { unique: true });
    await hotelCatalog.createIndex({ hotel_code: 1 }, { unique: true });
    await hotelCatalog.createIndex({ 'location.city': 1 });
    await hotelCatalog.createIndex({ star_rating: -1 });

    console.log('[OK] Expanded Mongo hotel catalog successfully.');
    console.log(`    - Upserted ${roomTypeCatalogDocs.length} room types`);
    console.log(`    - Upserted ${hotelDocs.length} hotels`);
  } catch (error) {
    console.error('[ERROR] Mongo catalog expansion failed:', error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

expandCatalog();
