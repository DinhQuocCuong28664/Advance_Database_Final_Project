-- 14_seed_service_catalog.sql  (v2 — English descriptions)
USE LuxeReserve;
GO

DELETE FROM ReservationService;
DELETE FROM ServiceCatalog;
GO

-- HOTEL 1 — The Ritz-Carlton, Saigon (VND)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(1,'SPA001','VIP Signature Spa Treatment','SPA','PER_USE',3500000,'Indulgent 90-minute spa ritual with premium imported oils'),
(1,'SPA002','Deep Tissue Massage','SPA','PER_HOUR',1200000,'Therapeutic deep-pressure massage to release tension'),
(1,'SPA003','Facial & Skin Renewal','SPA','PER_USE',2200000,'Professional restorative facial and skin treatment'),
(1,'TRN001','Airport Rolls-Royce Transfer','AIRPORT_TRANSFER','PER_TRIP',5000000,'Rolls-Royce Ghost airport pickup and drop-off service'),
(1,'TRN002','City Limousine Tour','AIRPORT_TRANSFER','PER_TRIP',2800000,'Explore Ho Chi Minh City in a luxury limousine'),
(1,'BUT001','24h Personal Butler','BUTLER','PER_USE',0,'Dedicated personal butler available 24/7 throughout your stay'),
(1,'DIN001','Private Dining Experience','DINING','PER_PERSON',8000000,'7-course private dinner on the rooftop with Saigon views'),
(1,'DIN002','In-Room Breakfast Deluxe','DINING','PER_PERSON',650000,'Premium breakfast delivered to your room at 7 AM'),
(1,'DIN003','Wine & Cheese Pairing','DINING','PER_PERSON',1500000,'Curated selection of imported wines and artisan cheeses'),
(1,'WEL001','Yoga & Meditation Session','WELLNESS','PER_USE',800000,'Private yoga and meditation with a certified instructor'),
(1,'WEL002','Personal Training','WELLNESS','PER_HOUR',1000000,'One-on-one PT session in the hotel''s private gym'),
(1,'TOT001','Cu Chi Tunnels Private Tour','TOUR','PER_PERSON',2500000,'Exclusive guided tour of the historic Cu Chi Tunnels'),
(1,'TOT002','Mekong Delta Boat Trip','TOUR','PER_PERSON',3200000,'Discover the Mekong Delta by traditional wooden boat'),
(1,'EVT001','Meeting Room - Half Day','EVENT','PER_USE',4500000,'Standard meeting room for 4 hours, seats up to 10'),
(1,'OTH001','Laundry Express','OTHER','PER_USE',300000,'Express laundry and pressing service, ready in 3 hours');
GO

-- HOTEL 2 — W Bangkok (THB)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(2,'SPA001','AWAY Spa Retreat','SPA','PER_USE',4500,'Signature treatment blending Thai healing techniques'),
(2,'SPA002','Thai Herbal Compress','SPA','PER_HOUR',2200,'Traditional Thai herbal compress massage'),
(2,'TRN001','BTS Siam Station Transfer','AIRPORT_TRANSFER','PER_TRIP',800,'Hotel electric vehicle shuttle to and from BTS Siam'),
(2,'TRN002','Suvarnabhumi Airport VIP Transfer','AIRPORT_TRANSFER','PER_TRIP',3800,'Luxury sedan pickup at Suvarnabhumi International Airport'),
(2,'DIN001','Chef Table at W Kitchen','DINING','PER_PERSON',6500,'9-course Asian fusion tasting menu at the chef''s table'),
(2,'DIN002','Pool Bar Cabana Package','DINING','PER_USE',3200,'Drinks and light bites package at a poolside cabana'),
(2,'WEL001','FIT Gym Personal Training','WELLNESS','PER_HOUR',1500,'Personal training session in the state-of-the-art FIT gym'),
(2,'TOT001','Floating Market Day Trip','TOUR','PER_PERSON',2800,'Guided day trip to the iconic Damnoen Saduak floating market'),
(2,'TOT002','Grand Palace & Wat Pho Tour','TOUR','PER_PERSON',2200,'Private tour of the Royal Palace and Reclining Buddha temple'),
(2,'OTH001','Tuk-Tuk City Night Ride','OTHER','PER_USE',1200,'Guided Bangkok night tour by traditional tuk-tuk');
GO

-- HOTEL 3 — InterContinental Singapore (SGD)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(3,'DIN001','Club Lounge Access','DINING','PER_USE',180,'All-day Club Lounge access with food and beverages included'),
(3,'DIN002','Afternoon High Tea','DINING','PER_PERSON',98,'Traditional Singapore-style afternoon high tea in the lobby'),
(3,'SPA001','Remede Spa Signature','SPA','PER_USE',380,'Premium 90-minute Remede-brand signature spa treatment'),
(3,'TRN001','Changi Airport VIP Transfer','AIRPORT_TRANSFER','PER_TRIP',120,'Mercedes S-Class pickup at Changi International Airport'),
(3,'TOT001','Gardens by the Bay Night Tour','TOUR','PER_PERSON',85,'Light garden tour at Marina Bay after dark'),
(3,'TOT002','Sentosa & USS Day Trip','TOUR','PER_PERSON',200,'Day trip to Sentosa Island and Universal Studios Singapore'),
(3,'WEL001','Yoga on the Rooftop','WELLNESS','PER_USE',60,'Rooftop yoga session with panoramic Marina Bay views'),
(3,'OTH001','Concierge Restaurant Booking','OTHER','PER_USE',0,'Concierge-assisted reservation at Singapore''s top restaurants'),
(3,'OTH002','Laundry Valet Service','OTHER','PER_USE',28,'Full laundry and pressing service, returned within 4 hours');
GO

-- HOTEL 4 — The Ritz-Carlton, Hanoi (VND)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(4,'SPA001','Imperial Spa Experience','SPA','PER_USE',4200000,'Spa journey inspired by the royal heritage of Hanoi'),
(4,'SPA002','Hot Stone Therapy','SPA','PER_HOUR',1800000,'Deep-muscle relaxation using heated basalt stones'),
(4,'TRN001','Noi Bai Airport Luxury Transfer','AIRPORT_TRANSFER','PER_TRIP',4800000,'Limousine pickup and drop-off at Noi Bai International Airport'),
(4,'DIN001','Hanoi Street Food Night Tour','DINING','PER_PERSON',1200000,'Evening Hanoi street food tour led by our executive chef'),
(4,'DIN002','Rooftop Pho Experience','DINING','PER_PERSON',450000,'Authentic Hanoi pho served on the hotel rooftop'),
(4,'TOT001','Hoan Kiem Cultural Walk','TOUR','PER_PERSON',900000,'Cultural walking tour around Hoan Kiem Lake and the Old Quarter'),
(4,'TOT002','Halong Bay Day Cruise','TOUR','PER_PERSON',5500000,'Luxury day cruise through the UNESCO-listed Halong Bay'),
(4,'WEL001','Tai Chi at Hoan Kiem','WELLNESS','PER_USE',400000,'Sunrise Tai Chi class at Hoan Kiem Lake with a local master'),
(4,'BUT001','Personal Concierge Butler','BUTLER','PER_USE',0,'Dedicated concierge butler available 24/7 for all requests'),
(4,'OTH001','Traditional Ao Dai Rental','OTHER','PER_USE',600000,'Traditional Vietnamese Ao Dai rental for cultural photography');
GO

-- HOTEL 5 — InterContinental Danang (VND)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(5,'SPA001','Harnn Heritage Spa Journey','SPA','PER_USE',3800000,'Harnn-brand spa experience surrounded by natural landscape'),
(5,'SPA002','Couple Ocean View Massage','SPA','PER_USE',2600000,'Couples massage with a stunning view of Da Nang Bay'),
(5,'TRN001','Da Nang Airport Transfer','AIRPORT_TRANSFER','PER_TRIP',800000,'Luxury SUV pickup and drop-off at Da Nang Airport'),
(5,'DIN001','CITRON Restaurant Fine Dining','DINING','PER_PERSON',2200000,'French-Vietnamese fusion dining experience at CITRON'),
(5,'DIN002','Sunset Cocktail on the Cliff','DINING','PER_PERSON',800000,'Cocktails at sunset on the clifftop terrace of Sun Peninsula'),
(5,'TOT001','Ancient Hoi An Town Tour','TOUR','PER_PERSON',950000,'Private guided tour of the UNESCO Hoi An Ancient Town'),
(5,'TOT002','My Son Sanctuary Sunrise Tour','TOUR','PER_PERSON',1500000,'Sunrise tour of the UNESCO My Son Cham Sanctuary'),
(5,'WEL001','Beach Yoga at Sunrise','WELLNESS','PER_USE',500000,'Instructor-led sunrise yoga session on the beach'),
(5,'YAC001','Sunset Catamaran Cruise','YACHT','PER_PERSON',2800000,'Catamaran sunset cruise on the East Sea'),
(5,'OTH001','Water Sports Package','OTHER','PER_USE',1200000,'Water sports bundle: surfing, kayaking, and snorkeling');
GO

-- HOTEL 6 — InterContinental Phu Quoc (VND)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(6,'SPA001','Phu Quoc Coconut Spa Ritual','SPA','PER_USE',2800000,'Island-inspired coconut spa ritual unique to Phu Quoc'),
(6,'YAC001','Sunset Yacht Charter','YACHT','PER_TRIP',18000000,'Private 2-hour sunset yacht charter around the island'),
(6,'YAC002','Snorkeling Day Cruise','YACHT','PER_PERSON',2200000,'Day cruise with coral reef snorkeling around the island'),
(6,'TRN001','Phu Quoc Airport Transfer','AIRPORT_TRANSFER','PER_TRIP',600000,'Electric vehicle pickup at Phu Quoc International Airport'),
(6,'DIN001','Beach BBQ Dinner','DINING','PER_PERSON',1800000,'Fresh seafood BBQ dinner on a private beach'),
(6,'TOT001','Phu Quoc Pepper Farm Tour','TOUR','PER_PERSON',800000,'Guided tour of Phu Quoc''s famous pepper plantations'),
(6,'TOT002','North Island Explorer','TOUR','PER_PERSON',1500000,'Explore the northern island: rock streams and national park'),
(6,'WEL001','Stand-Up Paddleboard','WELLNESS','PER_HOUR',400000,'Stand-up paddleboarding along the scenic Bai Dai Beach'),
(6,'OTH001','Night Market Tuk-Tuk','OTHER','PER_USE',350000,'Guided tuk-tuk ride through Phu Quoc Night Market');
GO

-- HOTEL 7 — W Bali - Seminyak (IDR)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(7,'SPA001','AWAY Spa Balinese Journey','SPA','PER_USE',1400000,'Traditional Balinese healing ritual with frangipani oil'),
(7,'SPA002','Volcano Mud Body Wrap','SPA','PER_USE',900000,'Purifying Balinese volcanic mud body wrap treatment'),
(7,'YAC001','Sunset Boat to Tanah Lot','YACHT','PER_PERSON',750000,'Private boat transfer to watch sunset at Tanah Lot temple'),
(7,'TRN001','Ngurah Rai Airport VIP Transfer','AIRPORT_TRANSFER','PER_TRIP',600000,'Premium vehicle pickup at Bali Ngurah Rai International Airport'),
(7,'DIN001','Rooftop Dinner at WooBar','DINING','PER_PERSON',2200000,'Rooftop dinner experience at the iconic WooBar in Seminyak'),
(7,'TOT001','Ubud Rice Terrace Full Day','TOUR','PER_PERSON',1200000,'Full-day tour: Tegalalang rice terraces and craft villages'),
(7,'TOT002','Mount Batur Sunrise Trek','TOUR','PER_PERSON',1500000,'Trek the active Batur volcano to watch the sunrise at 1717m'),
(7,'WEL001','Temple Meditation Ceremony','WELLNESS','PER_USE',450000,'Guided meditation ceremony at a local Balinese temple'),
(7,'OTH001','Kecak Fire Dance Tickets','OTHER','PER_USE',350000,'Tickets to the Kecak fire dance performance at Uluwatu Temple');
GO

-- HOTEL 8 — The Ritz-Carlton, Tokyo (JPY)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(8,'SPA001','The Spa Signature Treatment','SPA','PER_USE',55000,'90-minute treatment blending Japanese and European techniques'),
(8,'DIN001','Hinokizaka Kaiseki Dinner','DINING','PER_PERSON',45000,'8-course kaiseki dinner at Hinokizaka on the 45th floor'),
(8,'DIN002','Sushi Masterclass','DINING','PER_PERSON',38000,'Hands-on sushi-making class with a Michelin-starred chef'),
(8,'TRN001','Narita Airport Limousine','AIRPORT_TRANSFER','PER_TRIP',35000,'Luxury limousine transfer from Narita International Airport'),
(8,'TRN002','Haneda Airport Limousine','AIRPORT_TRANSFER','PER_TRIP',25000,'Luxury limousine transfer from Haneda Airport'),
(8,'TOT001','Shinjuku & Shibuya Private Tour','TOUR','PER_PERSON',30000,'Private guided tour of Shinjuku and Shibuya districts'),
(8,'TOT002','Mt. Fuji & Hakone Day Trip','TOUR','PER_PERSON',65000,'Day trip to Mount Fuji, Lake Kawaguchi, and Hakone'),
(8,'WEL001','Onsen & Tea Ceremony','WELLNESS','PER_USE',18000,'Traditional onsen bathing followed by a Japanese tea ceremony'),
(8,'BUT001','Wardrobe Butler Service','BUTLER','PER_USE',0,'Professional wardrobe arrangement by a Ritz-Carlton butler'),
(8,'OTH001','Kimono Fitting & Photoshoot','OTHER','PER_USE',22000,'Kimono dressing and photoshoot in the historic Yanaka district');
GO

-- HOTEL 9 — InterContinental Seoul COEX (KRW)
INSERT INTO ServiceCatalog (hotel_id,service_code,service_name,service_category,pricing_model,base_price,description_short) VALUES
(9,'SPA001','Korean Jjimjilbang Spa','SPA','PER_USE',150000,'Authentic Korean bathhouse experience with salt sauna rooms'),
(9,'SPA002','Ginseng Revitalizing Treatment','SPA','PER_HOUR',220000,'Korean ginseng-infused energy-restoring spa treatment'),
(9,'DIN001','Club InterContinental Lounge','DINING','PER_USE',120000,'All-day Club Lounge access with panoramic Seoul views'),
(9,'DIN002','Korean BBQ at Ninth Gate','DINING','PER_PERSON',180000,'Premium Korean BBQ dining experience at Ninth Gate'),
(9,'TRN001','Incheon Airport Limousine','AIRPORT_TRANSFER','PER_TRIP',250000,'Limousine transfer to and from Incheon International Airport'),
(9,'TOT001','Gyeongbokgung Palace Tour','TOUR','PER_PERSON',95000,'Guided tour of Gyeongbokgung Palace and the National Museum'),
(9,'TOT002','K-Pop & Myeongdong Night Tour','TOUR','PER_PERSON',130000,'K-pop culture experience and Myeongdong shopping district tour'),
(9,'TOT003','DMZ & JSA Border Tour','TOUR','PER_PERSON',280000,'Guided tour of the Demilitarized Zone and Joint Security Area'),
(9,'WEL001','Taekwondo Experience Class','WELLNESS','PER_USE',80000,'Taekwondo beginner class with a professional Korean master'),
(9,'OTH001','Hanbok Photoshoot','OTHER','PER_USE',75000,'Korean Hanbok fitting and photoshoot at Bukchon Hanok Village');
GO

SELECT COUNT(*) AS total_services, COUNT(DISTINCT hotel_id) AS hotels_covered FROM ServiceCatalog;
GO
