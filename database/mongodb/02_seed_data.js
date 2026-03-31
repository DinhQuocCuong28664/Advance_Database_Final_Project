/**
 * LuxeReserve — MongoDB Collection Init & Seed Data
 * Run: node database/mongodb/02_seed_data.js
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/luxereserve';
const DB_NAME = process.env.MONGODB_DB_NAME || 'luxereserve';

async function seedMongoDB() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');

    const db = client.db(DB_NAME);

    // ═══════════════════════════════════
    // DROP existing collections for clean re-run
    // ═══════════════════════════════════
    const existing = await db.listCollections().toArray();
    const names = existing.map(c => c.name);
    for (const name of ['Hotel_Catalog', 'amenity_master', 'room_type_catalog']) {
      if (names.includes(name)) {
        await db.dropCollection(name);
        console.log(`  🗑️  Dropped: ${name}`);
      }
    }

    // ═══════════════════════════════════
    // 1. AMENITY MASTER
    // ═══════════════════════════════════
    const amenityMaster = db.collection('amenity_master');
    await amenityMaster.insertMany([
      {
        amenity_code: 'AMN-POOL-PRIV',
        name: 'Private Pool',
        category: 'RECREATION',
        description: 'Temperature-controlled private pool with cabana service',
        icon: 'pool',
        tags: ['luxury', 'rooftop', 'private'],
        images: ['https://cdn.luxereserve.com/amenities/private-pool.jpg']
      },
      {
        amenity_code: 'AMN-SPA-ESPA',
        name: 'ESPA Life Spa',
        category: 'WELLNESS',
        description: 'Award-winning spa featuring signature treatments',
        icon: 'spa',
        tags: ['wellness', 'signature', 'award-winning'],
        images: ['https://cdn.luxereserve.com/amenities/espa-spa.jpg']
      },
      {
        amenity_code: 'AMN-BUTLER',
        name: 'Butler Service',
        category: 'EXCLUSIVE',
        description: 'Dedicated 24-hour personal butler for all suite guests',
        icon: 'butler',
        tags: ['luxury', '24h', 'personalized'],
        images: []
      },
      {
        amenity_code: 'AMN-DINING-MICH',
        name: 'Michelin-Star Dining',
        category: 'DINING',
        description: '2 Michelin stars, contemporary French-Vietnamese cuisine',
        icon: 'restaurant',
        tags: ['michelin', 'fine-dining'],
        images: ['https://cdn.luxereserve.com/amenities/dining-room.jpg']
      },
      {
        amenity_code: 'AMN-TRANSFER',
        name: 'Airport Luxury Transfer',
        category: 'TRANSPORT',
        description: 'Rolls-Royce Phantom airport transfer with personal greeter',
        icon: 'car',
        tags: ['transfer', 'rolls-royce', 'VIP'],
        images: []
      },
      {
        amenity_code: 'AMN-SPA-AWAY',
        name: 'AWAY Spa',
        category: 'WELLNESS',
        description: 'W Hotels signature spa with Thai-inspired treatments',
        icon: 'spa',
        tags: ['wellness', 'thai', 'signature'],
        images: ['https://cdn.luxereserve.com/amenities/away-spa.jpg']
      },
      {
        amenity_code: 'AMN-CLUB-WOW',
        name: 'W Lounge & WooBar',
        category: 'NIGHTLIFE',
        description: 'Iconic lounge and bar with live DJ sets',
        icon: 'nightlife',
        tags: ['nightlife', 'lounge', 'cocktail'],
        images: ['https://cdn.luxereserve.com/amenities/woobar.jpg']
      },
      {
        amenity_code: 'AMN-SPA-CLUB',
        name: 'Club InterContinental Spa',
        category: 'WELLNESS',
        description: 'Premium wellness center with panoramic views',
        icon: 'spa',
        tags: ['wellness', 'club', 'panoramic'],
        images: ['https://cdn.luxereserve.com/amenities/ic-spa.jpg']
      }
    ]);
    await amenityMaster.createIndex({ amenity_code: 1 }, { unique: true });
    await amenityMaster.createIndex({ category: 1 });
    await amenityMaster.createIndex({ tags: 1 });
    console.log('  ✅ amenity_master: 8 documents + indexes');

    // ═══════════════════════════════════
    // 2. ROOM TYPE CATALOG
    // ═══════════════════════════════════
    const roomTypeCatalog = db.collection('room_type_catalog');
    await roomTypeCatalog.insertMany([
      {
        room_type_code: 'RT-DLX-CITY',
        name: 'Deluxe City View',
        category: 'DELUXE',
        description: '55 sqm of refined elegance with floor-to-ceiling windows offering stunning city panoramas.',
        features: { has_balcony: false, has_private_pool: false, has_lounge_access: false, has_butler_service: false },
        images: ['https://cdn.luxereserve.com/rooms/deluxe-city.jpg'],
        highlight: 'Floor-to-ceiling windows with city views'
      },
      {
        room_type_code: 'RT-STE-RIVER',
        name: 'Ritz-Carlton Suite — River View',
        category: 'SUITE',
        description: '120 sqm signature suite with separate living room, panoramic Saigon River views, and exclusive Club Lounge access.',
        features: { has_balcony: true, has_private_pool: false, has_lounge_access: true, has_butler_service: true },
        images: ['https://cdn.luxereserve.com/rooms/suite-river-1.jpg', 'https://cdn.luxereserve.com/rooms/suite-river-2.jpg'],
        highlight: 'Panoramic Saigon River views + Butler'
      },
      {
        room_type_code: 'RT-PRES-SKY',
        name: 'Presidential Skyline Suite',
        category: 'PRESIDENTIAL_SUITE',
        description: '300 sqm penthouse-level suite with private terrace, infinity plunge pool, dining for 12, and dedicated butler team.',
        features: { has_balcony: true, has_private_pool: true, has_lounge_access: true, has_butler_service: true },
        images: ['https://cdn.luxereserve.com/rooms/presidential-1.jpg', 'https://cdn.luxereserve.com/rooms/presidential-pool.jpg'],
        highlight: 'Private infinity pool + Dedicated butler team'
      },
      {
        room_type_code: 'RT-WONDERFUL',
        name: 'Wonderful Room',
        category: 'DELUXE',
        description: '44 sqm room with bold W design, signature bed, and vibrant city views.',
        features: { has_balcony: false, has_private_pool: false, has_lounge_access: false, has_butler_service: false },
        images: ['https://cdn.luxereserve.com/rooms/w-wonderful.jpg'],
        highlight: 'Signature W bed & bold design'
      },
      {
        room_type_code: 'RT-EWOW-STE',
        name: 'Extreme WOW Suite',
        category: 'SUITE',
        description: '175 sqm of pure extravagance with DJ booth, party space, and panoramic city views.',
        features: { has_balcony: true, has_private_pool: false, has_lounge_access: true, has_butler_service: true },
        images: ['https://cdn.luxereserve.com/rooms/w-ewow-1.jpg', 'https://cdn.luxereserve.com/rooms/w-ewow-2.jpg'],
        highlight: 'DJ booth & party-ready suite'
      },
      {
        room_type_code: 'RT-CLUB-DLX',
        name: 'Club InterContinental Deluxe',
        category: 'DELUXE',
        description: '38 sqm room with Club Lounge access, complimentary breakfast, and evening cocktails.',
        features: { has_balcony: false, has_private_pool: false, has_lounge_access: true, has_butler_service: false },
        images: ['https://cdn.luxereserve.com/rooms/ic-club-deluxe.jpg'],
        highlight: 'Club Lounge access included'
      },
      {
        room_type_code: 'RT-PRES-SG',
        name: 'Presidential Suite',
        category: 'PRESIDENTIAL_SUITE',
        description: '220 sqm suite with private dining room, study, and panoramic Marina Bay views.',
        features: { has_balcony: true, has_private_pool: false, has_lounge_access: true, has_butler_service: true },
        images: ['https://cdn.luxereserve.com/rooms/ic-presidential.jpg'],
        highlight: 'Marina Bay panoramic views'
      }
    ]);
    await roomTypeCatalog.createIndex({ room_type_code: 1 }, { unique: true });
    await roomTypeCatalog.createIndex({ category: 1 });
    console.log('  ✅ room_type_catalog: 7 documents + indexes');

    // ═══════════════════════════════════
    // 3. HOTEL CATALOG (Embedded Design)
    // ═══════════════════════════════════
    const hotelCatalog = db.collection('Hotel_Catalog');
    await hotelCatalog.insertMany([
      {
        hotel_id: 1,
        hotel_code: 'RITZ-HCMC-001',
        hotel_name: 'The Ritz-Carlton, Saigon',
        brand: 'The Ritz-Carlton',
        chain: 'Marriott International',
        hotel_type: 'CITY_HOTEL',
        star_rating: 5,
        luxury_segment: 'ULTRA_LUXURY',
        description: {
          short: 'Experience unparalleled luxury in the heart of Ho Chi Minh City.',
          long: 'Nestled in District 1, The Ritz-Carlton Saigon offers 300 rooms, world-class dining, and an award-winning spa.',
          highlights: [
            'Rooftop infinity pool with panoramic city views',
            'Michelin-starred restaurant',
            '24-hour butler service for all suites',
            'Private helipad for VIP arrivals'
          ]
        },
        images: [
          { url: 'https://cdn.luxereserve.com/hotels/ritz-hcmc/exterior.jpg', caption: 'Hotel exterior', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
          { url: 'https://cdn.luxereserve.com/hotels/ritz-hcmc/lobby.jpg', caption: 'Grand lobby', category: 'LOBBY', is_hero: false, sort_order: 2 },
          { url: 'https://cdn.luxereserve.com/hotels/ritz-hcmc/pool.jpg', caption: 'Rooftop pool', category: 'AMENITY', is_hero: false, sort_order: 3 }
        ],
        amenities: [
          { amenity_code: 'AMN-POOL-PRIV', name: 'Private Pool', category: 'RECREATION' },
          { amenity_code: 'AMN-SPA-ESPA', name: 'ESPA Life Spa', category: 'WELLNESS' },
          { amenity_code: 'AMN-BUTLER', name: 'Butler Service', category: 'EXCLUSIVE' },
          { amenity_code: 'AMN-DINING-MICH', name: 'Michelin-Star Dining', category: 'DINING' },
          { amenity_code: 'AMN-TRANSFER', name: 'Airport Luxury Transfer', category: 'TRANSPORT' }
        ],
        room_types: [
          { room_type_code: 'RT-DLX-CITY', name: 'Deluxe City View', category: 'DELUXE' },
          { room_type_code: 'RT-STE-RIVER', name: 'Ritz-Carlton Suite', category: 'SUITE' },
          { room_type_code: 'RT-PRES-SKY', name: 'Presidential Skyline Suite', category: 'PRESIDENTIAL_SUITE' }
        ],
        location: {
          region: 'Southeast Asia', country: 'Vietnam', city: 'Ho Chi Minh City',
          district: 'District 1', address: '28 Dong Khoi Street',
          coordinates: { lat: 10.7769, lng: 106.7009 }
        },
        contact: { phone: '+84-28-3823-6688', email: 'reservations.saigon@ritzcarlton.com', website: 'https://www.ritzcarlton.com/saigon' },
        last_synced_at: new Date(), created_at: new Date(), updated_at: new Date()
      },
      {
        hotel_id: 2,
        hotel_code: 'W-BKK-001',
        hotel_name: 'W Bangkok',
        brand: 'W Hotels',
        chain: 'Marriott International',
        hotel_type: 'CITY_HOTEL',
        star_rating: 5,
        luxury_segment: 'ULTRA_LUXURY',
        description: {
          short: 'Bold luxury meets Bangkok nightlife at W Bangkok.',
          long: 'Located on North Sathorn Road, W Bangkok delivers 403 rooms of daring design with WET pool deck and AWAY Spa.',
          highlights: ['WET pool deck with skyline views', 'AWAY Spa retreat', 'WooBar cocktail lounge', 'Innovative Thai cuisine']
        },
        images: [
          { url: 'https://cdn.luxereserve.com/hotels/w-bkk/exterior.jpg', caption: 'W Bangkok exterior', category: 'EXTERIOR', is_hero: true, sort_order: 1 },
          { url: 'https://cdn.luxereserve.com/hotels/w-bkk/pool.jpg', caption: 'WET pool deck', category: 'AMENITY', is_hero: false, sort_order: 2 }
        ],
        amenities: [
          { amenity_code: 'AMN-POOL-PRIV', name: 'Private Pool', category: 'RECREATION' },
          { amenity_code: 'AMN-SPA-AWAY', name: 'AWAY Spa', category: 'WELLNESS' },
          { amenity_code: 'AMN-CLUB-WOW', name: 'W Lounge & WooBar', category: 'NIGHTLIFE' }
        ],
        room_types: [
          { room_type_code: 'RT-WONDERFUL', name: 'Wonderful Room', category: 'DELUXE' },
          { room_type_code: 'RT-EWOW-STE', name: 'Extreme WOW Suite', category: 'SUITE' }
        ],
        location: {
          region: 'Southeast Asia', country: 'Thailand', city: 'Bangkok',
          district: 'Silom', address: '106 North Sathorn Road',
          coordinates: { lat: 13.7227, lng: 100.5289 }
        },
        contact: { phone: '+66-2-344-4000', email: 'reservations@wbangkok.com', website: 'https://www.marriott.com/wbangkok' },
        last_synced_at: new Date(), created_at: new Date(), updated_at: new Date()
      },
      {
        hotel_id: 3,
        hotel_code: 'IC-SG-001',
        hotel_name: 'InterContinental Singapore',
        brand: 'InterContinental',
        chain: 'IHG Hotels & Resorts',
        hotel_type: 'BUSINESS_LUXURY',
        star_rating: 5,
        luxury_segment: 'LUXURY_BUSINESS',
        description: {
          short: 'Timeless elegance in the heart of Singapore.',
          long: 'InterContinental Singapore offers 406 rooms with Club InterContinental access and Michelin dining.',
          highlights: ['Club InterContinental with panoramic views', 'Heritage wing rooms', 'Award-winning Ash & Elm restaurant', 'Outdoor pool with city views']
        },
        images: [
          { url: 'https://cdn.luxereserve.com/hotels/ic-sg/exterior.jpg', caption: 'Hotel facade', category: 'EXTERIOR', is_hero: true, sort_order: 1 }
        ],
        amenities: [
          { amenity_code: 'AMN-POOL-PRIV', name: 'Private Pool', category: 'RECREATION' },
          { amenity_code: 'AMN-SPA-CLUB', name: 'Club Spa', category: 'WELLNESS' },
          { amenity_code: 'AMN-BUTLER', name: 'Butler Service', category: 'EXCLUSIVE' }
        ],
        room_types: [
          { room_type_code: 'RT-CLUB-DLX', name: 'Club Deluxe', category: 'DELUXE' },
          { room_type_code: 'RT-PRES-SG', name: 'Presidential Suite', category: 'PRESIDENTIAL_SUITE' }
        ],
        location: {
          region: 'Southeast Asia', country: 'Singapore', city: 'Singapore City',
          district: 'Marina Bay', address: '80 Middle Road',
          coordinates: { lat: 1.2995, lng: 103.8553 }
        },
        contact: { phone: '+65-6338-7600', email: 'singapore@ihg.com', website: 'https://www.ihg.com/intercontinental/singapore' },
        last_synced_at: new Date(), created_at: new Date(), updated_at: new Date()
      }
    ]);
    await hotelCatalog.createIndex({ hotel_id: 1 }, { unique: true });
    await hotelCatalog.createIndex({ hotel_code: 1 }, { unique: true });
    await hotelCatalog.createIndex({ 'amenities.amenity_code': 1 });
    await hotelCatalog.createIndex({ 'amenities.name': 1 });
    await hotelCatalog.createIndex({ 'location.city': 1 });
    await hotelCatalog.createIndex({ star_rating: -1 });
    console.log('  ✅ Hotel_Catalog: 3 hotels + indexes');

    console.log('\n══════════════════════════════════════════');
    console.log('  ✅ MongoDB SEED COMPLETE');
    console.log('  - 8 amenities (amenity_master)');
    console.log('  - 7 room types (room_type_catalog)');
    console.log('  - 3 hotels (Hotel_Catalog)');
    console.log('══════════════════════════════════════════\n');

  } catch (err) {
    console.error('❌ MongoDB Seed Error:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seedMongoDB();
