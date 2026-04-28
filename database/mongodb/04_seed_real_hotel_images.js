/**
 * LuxeReserve - MongoDB real image URL refresh
 * Run: node database/mongodb/04_seed_real_hotel_images.js
 *
 * Stores public image URLs as MongoDB metadata. Binary files stay outside DB.
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxereserve';
const DB_NAME = process.env.MONGODB_DB_NAME || 'luxereserve';

const HOTEL_INSERT_META = {
  10: {
    hotel_code: 'RITZ-BKK-002',
    hotel_name: 'The Ritz-Carlton, Bangkok Riverside',
    brand: 'The Ritz-Carlton',
    chain: 'Marriott International',
    hotel_type: 'CITY_HOTEL',
    star_rating: 5,
    location: {
      region: 'Southeast Asia',
      country: 'Thailand',
      city: 'Bangkok',
      district: 'Silom',
      address: '88 Charoen Krung Road',
      coordinates: { lat: 13.7244, lng: 100.5142 },
    },
  },
  11: {
    hotel_code: 'W-SG-002',
    hotel_name: 'W Singapore Marina Bay',
    brand: 'W Hotels',
    chain: 'Marriott International',
    hotel_type: 'BUSINESS_LUXURY',
    star_rating: 5,
    location: {
      region: 'Southeast Asia',
      country: 'Singapore',
      city: 'Singapore City',
      district: 'Marina Bay',
      address: '9 Raffles Boulevard',
      coordinates: { lat: 1.2917, lng: 103.8592 },
    },
  },
  12: {
    hotel_code: 'W-SGN-002',
    hotel_name: 'W Saigon Riverside',
    brand: 'W Hotels',
    chain: 'Marriott International',
    hotel_type: 'CITY_HOTEL',
    star_rating: 4,
    location: {
      region: 'Southeast Asia',
      country: 'Vietnam',
      city: 'Ho Chi Minh City',
      district: 'District 7',
      address: '2 Nguyen Van Linh Boulevard',
      coordinates: { lat: 10.7297, lng: 106.7217 },
    },
  },
};

const REAL_HOTEL_IMAGES = [
  {
    hotel_id: 1,
    images: [
      { url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200&q=82', caption: 'Ho Chi Minh City skyline', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=82', caption: 'Luxury city hotel lobby', category: 'LOBBY', is_hero: false, sort_order: 2 },
    ],
  },
  {
    hotel_id: 2,
    images: [
      { url: 'https://images.unsplash.com/photo-1563492065599-3520f775eeed?w=1200&q=82', caption: 'Bangkok skyline', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=1200&q=82', caption: 'Bangkok destination view', category: 'LOCATION', is_hero: false, sort_order: 2 },
    ],
  },
  {
    hotel_id: 3,
    images: [
      { url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&q=82', caption: 'Singapore Marina Bay skyline', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=1200&q=82', caption: 'Singapore city lights', category: 'LOCATION', is_hero: false, sort_order: 2 },
    ],
  },
  {
    hotel_id: 4,
    images: [
      { url: 'https://images.unsplash.com/photo-1597838816882-4435b1977fbe?w=1200&q=82', caption: 'Hanoi old quarter', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=1200&q=82', caption: 'Vietnam heritage destination', category: 'LOCATION', is_hero: false, sort_order: 2 },
    ],
  },
  {
    hotel_id: 5,
    images: [
      { url: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=1200&q=82', caption: 'Da Nang coastline', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=1200&q=82', caption: 'Resort pool deck', category: 'AMENITY', is_hero: false, sort_order: 2 },
    ],
  },
  {
    hotel_id: 6,
    images: [
      { url: 'https://images.unsplash.com/photo-1614082242765-7c98ca0f3df3?w=1200&q=82', caption: 'Phu Quoc beach resort', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=82', caption: 'Island resort pool', category: 'AMENITY', is_hero: false, sort_order: 2 },
    ],
  },
  {
    hotel_id: 7,
    images: [
      { url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=82', caption: 'Bali resort landscape', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=1200&q=82', caption: 'Bali coastal sunset', category: 'LOCATION', is_hero: false, sort_order: 2 },
    ],
  },
  {
    hotel_id: 8,
    images: [
      { url: 'https://images.unsplash.com/photo-1492571350019-22de08371fd3?w=1200&q=82', caption: 'Tokyo skyline', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=82', caption: 'Tokyo city night', category: 'LOCATION', is_hero: false, sort_order: 2 },
    ],
  },
  {
    hotel_id: 9,
    images: [
      { url: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1200&q=82', caption: 'Seoul city view', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=1200&q=82', caption: 'Seoul night district', category: 'LOCATION', is_hero: false, sort_order: 2 },
    ],
  },
  {
    hotel_id: 10,
    images: [
      { url: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=1200&q=82', caption: 'Bangkok riverside landmark', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=1200&q=82', caption: 'Thailand luxury destination', category: 'LOCATION', is_hero: false, sort_order: 2 },
    ],
  },
  {
    hotel_id: 11,
    images: [
      { url: 'https://images.unsplash.com/photo-1508964942454-1a56651d54ac?w=1200&q=82', caption: 'Singapore marina lights', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&q=82', caption: 'Singapore bay skyline', category: 'LOCATION', is_hero: false, sort_order: 2 },
    ],
  },
  {
    hotel_id: 12,
    images: [
      { url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=1200&q=82', caption: 'Saigon riverside skyline', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
      { url: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=82', caption: 'Lifestyle hotel interior', category: 'LOBBY', is_hero: false, sort_order: 2 },
    ],
  },
];

async function seedRealImages() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const hotelCatalog = db.collection('Hotel_Catalog');
    const now = new Date();

    for (const item of REAL_HOTEL_IMAGES) {
      const insertMeta = HOTEL_INSERT_META[item.hotel_id] || {};
      await hotelCatalog.updateOne(
        { hotel_id: item.hotel_id },
        {
          $set: {
            ...insertMeta,
            images: item.images,
            updated_at: now,
            image_source: 'unsplash-public-demo',
          },
          $setOnInsert: {
            hotel_id: item.hotel_id,
            created_at: now,
          },
        },
        { upsert: true },
      );
    }

    console.log(`[OK] Updated real image URLs for ${REAL_HOTEL_IMAGES.length} hotels.`);
  } finally {
    await client.close();
  }
}

seedRealImages().catch((error) => {
  console.error('[ERROR] Real image seed failed:', error);
  process.exit(1);
});
