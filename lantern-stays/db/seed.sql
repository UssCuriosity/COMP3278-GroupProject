-- ---------------------------------------------------------------------------
-- Lantern Stays - initial data
--
-- Run AFTER db/schema.sql:   mysql -u root -p < db/seed.sql
-- (or simply:                npm run db:setup)
--
-- All dates are relative to the day this file is loaded (CURDATE()), so the
-- data always contains past stays, upcoming stays and reviews, no matter when
-- the database is set up.
--
-- Every seeded account uses the same demo password:  lantern123
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;
USE lantern_stays;

-- Empty every table first so this file can be re-run safely.
DELETE FROM favorites;
DELETE FROM reviews;
DELETE FROM bookings;
DELETE FROM listing_amenities;
DELETE FROM amenities;
DELETE FROM listings;
DELETE FROM users;

-- ---------------------------------------------------------------------------
-- users  (password_hash = scrypt hash of "lantern123")
-- ---------------------------------------------------------------------------
INSERT INTO users (id, name, email, password_hash, created_at) VALUES
(1, 'Alice Chan',   'alice@example.com',  'scrypt$6c616e7465726e2d64656d6f2d73616c$34a122fd701fd8fc155d7b0002e12a82c15660ab4dd2e8fa2ce0c33e6086e0f0196f9c5609e10d0371d4c0dade235bca39598681bdf9c2ee2484a189cd88bd36', NOW() - INTERVAL 400 DAY),
(2, 'Ben Wong',     'ben@example.com',    'scrypt$6c616e7465726e2d64656d6f2d73616c$34a122fd701fd8fc155d7b0002e12a82c15660ab4dd2e8fa2ce0c33e6086e0f0196f9c5609e10d0371d4c0dade235bca39598681bdf9c2ee2484a189cd88bd36', NOW() - INTERVAL 420 DAY),
(3, 'Chloe Lee',    'chloe@example.com',  'scrypt$6c616e7465726e2d64656d6f2d73616c$34a122fd701fd8fc155d7b0002e12a82c15660ab4dd2e8fa2ce0c33e6086e0f0196f9c5609e10d0371d4c0dade235bca39598681bdf9c2ee2484a189cd88bd36', NOW() - INTERVAL 390 DAY),
(4, 'Daniel Kim',   'daniel@example.com', 'scrypt$6c616e7465726e2d64656d6f2d73616c$34a122fd701fd8fc155d7b0002e12a82c15660ab4dd2e8fa2ce0c33e6086e0f0196f9c5609e10d0371d4c0dade235bca39598681bdf9c2ee2484a189cd88bd36', NOW() - INTERVAL 380 DAY),
(5, 'Emma Tanaka',  'emma@example.com',   'scrypt$6c616e7465726e2d64656d6f2d73616c$34a122fd701fd8fc155d7b0002e12a82c15660ab4dd2e8fa2ce0c33e6086e0f0196f9c5609e10d0371d4c0dade235bca39598681bdf9c2ee2484a189cd88bd36', NOW() - INTERVAL 300 DAY),
(6, 'Farid Rahman', 'farid@example.com',  'scrypt$6c616e7465726e2d64656d6f2d73616c$34a122fd701fd8fc155d7b0002e12a82c15660ab4dd2e8fa2ce0c33e6086e0f0196f9c5609e10d0371d4c0dade235bca39598681bdf9c2ee2484a189cd88bd36', NOW() - INTERVAL 260 DAY),
(7, 'Grace Lau',    'grace@example.com',  'scrypt$6c616e7465726e2d64656d6f2d73616c$34a122fd701fd8fc155d7b0002e12a82c15660ab4dd2e8fa2ce0c33e6086e0f0196f9c5609e10d0371d4c0dade235bca39598681bdf9c2ee2484a189cd88bd36', NOW() - INTERVAL 240 DAY),
(8, 'Hiro Sato',    'hiro@example.com',   'scrypt$6c616e7465726e2d64656d6f2d73616c$34a122fd701fd8fc155d7b0002e12a82c15660ab4dd2e8fa2ce0c33e6086e0f0196f9c5609e10d0371d4c0dade235bca39598681bdf9c2ee2484a189cd88bd36', NOW() - INTERVAL 410 DAY);

-- ---------------------------------------------------------------------------
-- amenities
-- ---------------------------------------------------------------------------
INSERT INTO amenities (id, name) VALUES
(1, 'Wifi'),
(2, 'Kitchen'),
(3, 'Air conditioning'),
(4, 'Washer'),
(5, 'Free parking'),
(6, 'Pool'),
(7, 'Gym'),
(8, 'Workspace'),
(9, 'Sea view'),
(10, 'Balcony'),
(11, 'Pet friendly'),
(12, 'Breakfast');

-- ---------------------------------------------------------------------------
-- listings  (hosts: 2 = Ben, 3 = Chloe, 4 = Daniel, 8 = Hiro)
-- ---------------------------------------------------------------------------
INSERT INTO listings
    (id, host_id, title, description, city, property_type, price_per_night, max_guests, bedrooms, bathrooms, cover, created_at)
VALUES
(1, 2, 'Harbour-view studio in Sai Ying Pun',
 'A bright studio on the 28th floor with floor-to-ceiling windows over Victoria Harbour. Five minutes on foot to the MTR and surrounded by cafes and dai pai dongs.',
 'Hong Kong', 'studio', 780.00, 2, 1, 1, 'harbour-dusk', NOW() - INTERVAL 380 DAY),
(2, 2, 'Family flat near Victoria Park',
 'Three bedrooms, a full kitchen and a dining table that seats six. The park, the tram and Causeway Bay shopping are all on the doorstep.',
 'Hong Kong', 'apartment', 1350.00, 5, 3, 2, 'skyline-day', NOW() - INTERVAL 360 DAY),
(3, 2, 'Lamma Island village house',
 'A three-storey village house with a rooftop and a small garden on car-free Lamma Island. Seafood restaurants and the beach are a short walk away; Central is 25 minutes by ferry.',
 'Hong Kong', 'house', 1100.00, 6, 3, 2, 'village-day', NOW() - INTERVAL 340 DAY),
(4, 2, 'Quiet room in a Kennedy Town walk-up',
 'A simple private room in a shared flat, ideal for solo travellers. Shared bathroom and kitchen, ten minutes from the waterfront promenade.',
 'Hong Kong', 'room', 420.00, 1, 1, 1, 'skyline-dusk', NOW() - INTERVAL 300 DAY),
(5, 3, 'Sai Kung beachside villa',
 'A four-bedroom villa with a private pool, a barbecue terrace and direct access to a quiet beach. Built for big groups, family reunions and long lazy weekends.',
 'Hong Kong', 'villa', 2900.00, 8, 4, 3, 'beach-day', NOW() - INTERVAL 330 DAY),
(6, 3, 'Tai O stilt-house hideaway',
 'Stay in a restored stilt house above the tidal creek of Tai O fishing village. Wake up to boats passing under the deck and watch for pink dolphins at sunset.',
 'Hong Kong', 'cabin', 690.00, 3, 1, 1, 'harbour-day', NOW() - INTERVAL 280 DAY),
(7, 8, 'Shibuya loft with skyline terrace',
 'A two-level loft with a private terrace looking over the Shibuya skyline. Eight minutes from the scramble crossing, yet on a calm residential street.',
 'Tokyo', 'apartment', 1480.00, 4, 2, 1, 'skyline-night', NOW() - INTERVAL 370 DAY),
(8, 8, 'Tatami studio near Asakusa',
 'A traditional tatami room with futon bedding, paper screens and a tiny tea corner. Senso-ji temple and the Sumida river are ten minutes away on foot.',
 'Tokyo', 'studio', 720.00, 2, 1, 1, 'village-dusk', NOW() - INTERVAL 350 DAY),
(9, 8, 'Okutama forest cabin with hot tub',
 'A cedar cabin deep in the hills of western Tokyo with a wood-fired outdoor tub. Hiking trails start at the door and the river is two minutes downhill.',
 'Tokyo', 'cabin', 1250.00, 4, 2, 1, 'forest-day', NOW() - INTERVAL 290 DAY),
(10, 8, 'Minimal room in Shimokitazawa',
 'A compact private room above a record shop in the neighbourhood of vintage stores and live houses. Shared bathroom, strong coffee downstairs.',
 'Tokyo', 'room', 390.00, 1, 1, 1, 'forest-night', NOW() - INTERVAL 250 DAY),
(11, 4, 'Hanok house in Bukchon',
 'A carefully restored hanok with heated ondol floors and a private courtyard, set among the tiled roofs of Bukchon. Palaces and tea houses are within walking distance.',
 'Seoul', 'house', 1150.00, 4, 2, 1, 'village-night', NOW() - INTERVAL 365 DAY),
(12, 4, 'Gangnam high-rise apartment',
 'A modern one-bedroom on the 31st floor with a building gym and a dedicated desk. Two minutes from the subway and surrounded by restaurants.',
 'Seoul', 'apartment', 980.00, 3, 1, 1, 'skyline-day', NOW() - INTERVAL 320 DAY),
(13, 4, 'Bukhansan mountain cabin',
 'A timber cabin at the edge of Bukhansan National Park with a fireplace and a wide deck. The trailhead is right outside and the city is 40 minutes away.',
 'Seoul', 'cabin', 860.00, 4, 2, 1, 'mountain-day', NOW() - INTERVAL 270 DAY),
(14, 3, 'Designer apartment in Daan',
 'A calm apartment styled by a local designer, on a leafy lane close to Daan Forest Park. The night market and two MRT lines are a short walk away.',
 'Taipei', 'apartment', 760.00, 3, 1, 1, 'mountain-night', NOW() - INTERVAL 310 DAY),
(15, 3, 'Jiufen tea-house room with mountain view',
 'A private room above a family tea house on the hillside of Jiufen. Drink oolong on the balcony while the clouds roll in over the coast.',
 'Taipei', 'room', 450.00, 2, 1, 1, 'mountain-dusk', NOW() - INTERVAL 295 DAY),
(16, 3, 'Beitou hot-spring house',
 'A three-bedroom house with its own indoor hot-spring bath fed by the Beitou springs. Plenty of space for a family and a garden for evening tea.',
 'Taipei', 'house', 1280.00, 6, 3, 2, 'forest-dusk', NOW() - INTERVAL 260 DAY),
(17, 4, 'Riverside studio by the Chao Phraya',
 'A compact studio with a window seat over the river. Take the boat to the old town in the morning and watch the long-tail boats at night.',
 'Bangkok', 'studio', 520.00, 2, 1, 1, 'harbour-night', NOW() - INTERVAL 345 DAY),
(18, 4, 'Sukhumvit pool villa',
 'A walled four-bedroom villa with a 12-metre pool hidden in a quiet soi off Sukhumvit. Daily housekeeping and breakfast are included.',
 'Bangkok', 'villa', 2400.00, 8, 4, 4, 'beach-dusk', NOW() - INTERVAL 305 DAY),
(19, 2, 'Garden house in Ari',
 'A two-bedroom wooden house wrapped in a tropical garden in the Ari neighbourhood. Great cafes around the corner and the BTS five minutes away.',
 'Bangkok', 'house', 890.00, 5, 2, 2, 'village-day', NOW() - INTERVAL 230 DAY),
(20, 8, 'Marina Bay view apartment',
 'A two-bedroom apartment on the 40th floor facing Marina Bay, with access to the infinity pool and gym. Watch the light show from the living room.',
 'Singapore', 'apartment', 1650.00, 4, 2, 2, 'beach-night', NOW() - INTERVAL 275 DAY),
(21, 8, 'Shophouse studio in Tiong Bahru',
 'A studio inside a 1930s shophouse with original shutters and tiled floors. The best hawker centre in town is across the street.',
 'Singapore', 'studio', 880.00, 2, 1, 1, 'skyline-day', NOW() - INTERVAL 215 DAY);

-- ---------------------------------------------------------------------------
-- listing_amenities
--   1 Wifi   2 Kitchen   3 Air conditioning   4 Washer    5 Free parking   6 Pool
--   7 Gym    8 Workspace 9 Sea view          10 Balcony  11 Pet friendly  12 Breakfast
-- ---------------------------------------------------------------------------
INSERT INTO listing_amenities (listing_id, amenity_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 8), (1, 9),
(2, 1), (2, 2), (2, 3), (2, 4), (2, 10),
(3, 1), (3, 2), (3, 3), (3, 4), (3, 9), (3, 10), (3, 11),
(4, 1), (4, 3), (4, 4),
(5, 1), (5, 2), (5, 3), (5, 4), (5, 5), (5, 6), (5, 9), (5, 11),
(6, 1), (6, 3), (6, 9), (6, 10), (6, 12),
(7, 1), (7, 2), (7, 3), (7, 4), (7, 8), (7, 10),
(8, 1), (8, 3), (8, 12),
(9, 1), (9, 2), (9, 5), (9, 10), (9, 11),
(10, 1), (10, 3), (10, 8),
(11, 1), (11, 2), (11, 3), (11, 12),
(12, 1), (12, 2), (12, 3), (12, 4), (12, 7), (12, 8),
(13, 1), (13, 2), (13, 5), (13, 10), (13, 11),
(14, 1), (14, 2), (14, 3), (14, 4), (14, 8),
(15, 1), (15, 3), (15, 10), (15, 12),
(16, 1), (16, 2), (16, 3), (16, 4), (16, 5), (16, 11),
(17, 1), (17, 3), (17, 8), (17, 10),
(18, 1), (18, 2), (18, 3), (18, 4), (18, 5), (18, 6), (18, 12),
(19, 1), (19, 2), (19, 3), (19, 4), (19, 10), (19, 11),
(20, 1), (20, 2), (20, 3), (20, 4), (20, 6), (20, 7), (20, 9), (20, 10),
(21, 1), (21, 2), (21, 3), (21, 8);

-- ---------------------------------------------------------------------------
-- bookings
-- Stays that already ended can be reviewed, stays in the future can still be
-- changed or cancelled. No two confirmed bookings of a listing overlap.
-- ---------------------------------------------------------------------------
INSERT INTO bookings
    (id, listing_id, guest_id, check_in, check_out, guests, nightly_price, status, created_at)
VALUES
-- Alice (1): the demo guest
(1,   7, 1, CURDATE() - INTERVAL 60 DAY,  CURDATE() - INTERVAL 56 DAY,  2, 1480.00, 'confirmed', NOW() - INTERVAL 75 DAY),
(2,  11, 1, CURDATE() - INTERVAL 30 DAY,  CURDATE() - INTERVAL 27 DAY,  2, 1150.00, 'confirmed', NOW() - INTERVAL 44 DAY),
(3,   5, 1, CURDATE() + INTERVAL 14 DAY,  CURDATE() + INTERVAL 17 DAY,  4, 2900.00, 'confirmed', NOW() - INTERVAL 6 DAY),
(4,  18, 1, CURDATE() + INTERVAL 40 DAY,  CURDATE() + INTERVAL 44 DAY,  2, 2400.00, 'cancelled', NOW() - INTERVAL 9 DAY),
(5,  15, 1, CURDATE() - INTERVAL 120 DAY, CURDATE() - INTERVAL 118 DAY, 2,  450.00, 'confirmed', NOW() - INTERVAL 134 DAY),
-- Ben's listings (1, 2, 3, 4, 19): Ben is the demo host
(6,   1, 5, CURDATE() - INTERVAL 45 DAY,  CURDATE() - INTERVAL 42 DAY,  2,  760.00, 'confirmed', NOW() - INTERVAL 59 DAY),
(7,   1, 6, CURDATE() - INTERVAL 20 DAY,  CURDATE() - INTERVAL 17 DAY,  1,  780.00, 'confirmed', NOW() - INTERVAL 34 DAY),
(8,   1, 7, CURDATE() + INTERVAL 5 DAY,   CURDATE() + INTERVAL 8 DAY,   2,  780.00, 'confirmed', NOW() - INTERVAL 4 DAY),
(9,   1, 8, CURDATE() + INTERVAL 20 DAY,  CURDATE() + INTERVAL 23 DAY,  2,  780.00, 'confirmed', NOW() - INTERVAL 2 DAY),
(10,  2, 7, CURDATE() - INTERVAL 70 DAY,  CURDATE() - INTERVAL 65 DAY,  4, 1300.00, 'confirmed', NOW() - INTERVAL 84 DAY),
(11,  2, 4, CURDATE() - INTERVAL 15 DAY,  CURDATE() - INTERVAL 12 DAY,  3, 1350.00, 'confirmed', NOW() - INTERVAL 29 DAY),
(12,  2, 5, CURDATE() + INTERVAL 10 DAY,  CURDATE() + INTERVAL 15 DAY,  5, 1350.00, 'confirmed', NOW() - INTERVAL 7 DAY),
(13,  3, 6, CURDATE() - INTERVAL 50 DAY,  CURDATE() - INTERVAL 47 DAY,  5, 1100.00, 'confirmed', NOW() - INTERVAL 64 DAY),
(14,  3, 3, CURDATE() + INTERVAL 30 DAY,  CURDATE() + INTERVAL 33 DAY,  4, 1100.00, 'confirmed', NOW() - INTERVAL 5 DAY),
(15,  3, 5, CURDATE() - INTERVAL 10 DAY,  CURDATE() - INTERVAL 8 DAY,   2, 1100.00, 'cancelled', NOW() - INTERVAL 24 DAY),
(16, 19, 7, CURDATE() - INTERVAL 25 DAY,  CURDATE() - INTERVAL 22 DAY,  3,  890.00, 'confirmed', NOW() - INTERVAL 39 DAY),
(17,  4, 6, CURDATE() - INTERVAL 90 DAY,  CURDATE() - INTERVAL 87 DAY,  1,  400.00, 'confirmed', NOW() - INTERVAL 104 DAY),
-- other hosts' listings
(18,  5, 8, CURDATE() - INTERVAL 35 DAY,  CURDATE() - INTERVAL 31 DAY,  6, 2900.00, 'confirmed', NOW() - INTERVAL 49 DAY),
(19,  5, 7, CURDATE() + INTERVAL 25 DAY,  CURDATE() + INTERVAL 28 DAY,  8, 2900.00, 'confirmed', NOW() - INTERVAL 3 DAY),
(20,  6, 5, CURDATE() - INTERVAL 14 DAY,  CURDATE() - INTERVAL 12 DAY,  2,  690.00, 'confirmed', NOW() - INTERVAL 28 DAY),
(21,  6, 4, CURDATE() + INTERVAL 3 DAY,   CURDATE() + INTERVAL 5 DAY,   2,  690.00, 'confirmed', NOW() - INTERVAL 8 DAY),
(22,  7, 6, CURDATE() - INTERVAL 12 DAY,  CURDATE() - INTERVAL 9 DAY,   3, 1480.00, 'confirmed', NOW() - INTERVAL 26 DAY),
(23,  7, 7, CURDATE() + INTERVAL 7 DAY,   CURDATE() + INTERVAL 11 DAY,  2, 1480.00, 'confirmed', NOW() - INTERVAL 5 DAY),
(24,  8, 5, CURDATE() - INTERVAL 80 DAY,  CURDATE() - INTERVAL 76 DAY,  2,  700.00, 'confirmed', NOW() - INTERVAL 94 DAY),
(25,  8, 2, CURDATE() + INTERVAL 18 DAY,  CURDATE() + INTERVAL 21 DAY,  2,  720.00, 'confirmed', NOW() - INTERVAL 6 DAY),
(26,  9, 3, CURDATE() - INTERVAL 22 DAY,  CURDATE() - INTERVAL 19 DAY,  4, 1250.00, 'confirmed', NOW() - INTERVAL 36 DAY),
(27,  9, 6, CURDATE() + INTERVAL 12 DAY,  CURDATE() + INTERVAL 14 DAY,  2, 1250.00, 'confirmed', NOW() - INTERVAL 4 DAY),
(28, 10, 7, CURDATE() - INTERVAL 6 DAY,   CURDATE() - INTERVAL 3 DAY,   1,  390.00, 'confirmed', NOW() - INTERVAL 20 DAY),
(29, 11, 5, CURDATE() - INTERVAL 75 DAY,  CURDATE() - INTERVAL 72 DAY,  3, 1100.00, 'confirmed', NOW() - INTERVAL 89 DAY),
(30, 11, 2, CURDATE() + INTERVAL 9 DAY,   CURDATE() + INTERVAL 12 DAY,  2, 1150.00, 'confirmed', NOW() - INTERVAL 7 DAY),
(31, 12, 6, CURDATE() - INTERVAL 33 DAY,  CURDATE() - INTERVAL 30 DAY,  2,  980.00, 'confirmed', NOW() - INTERVAL 47 DAY),
(32, 13, 8, CURDATE() - INTERVAL 18 DAY,  CURDATE() - INTERVAL 15 DAY,  4,  860.00, 'confirmed', NOW() - INTERVAL 32 DAY),
(33, 13, 5, CURDATE() + INTERVAL 35 DAY,  CURDATE() + INTERVAL 38 DAY,  3,  860.00, 'confirmed', NOW() - INTERVAL 2 DAY),
(34, 14, 7, CURDATE() - INTERVAL 55 DAY,  CURDATE() - INTERVAL 52 DAY,  2,  760.00, 'confirmed', NOW() - INTERVAL 69 DAY),
(35, 15, 4, CURDATE() + INTERVAL 6 DAY,   CURDATE() + INTERVAL 8 DAY,   2,  450.00, 'confirmed', NOW() - INTERVAL 5 DAY),
(36, 16, 6, CURDATE() - INTERVAL 28 DAY,  CURDATE() - INTERVAL 24 DAY,  5, 1280.00, 'confirmed', NOW() - INTERVAL 42 DAY),
(37, 17, 2, CURDATE() - INTERVAL 65 DAY,  CURDATE() - INTERVAL 61 DAY,  2,  500.00, 'confirmed', NOW() - INTERVAL 79 DAY),
(38, 17, 5, CURDATE() + INTERVAL 22 DAY,  CURDATE() + INTERVAL 26 DAY,  2,  520.00, 'confirmed', NOW() - INTERVAL 3 DAY),
(39, 18, 8, CURDATE() - INTERVAL 40 DAY,  CURDATE() - INTERVAL 36 DAY,  6, 2400.00, 'confirmed', NOW() - INTERVAL 54 DAY),
(40, 20, 3, CURDATE() - INTERVAL 48 DAY,  CURDATE() - INTERVAL 45 DAY,  3, 1650.00, 'confirmed', NOW() - INTERVAL 62 DAY),
(41, 20, 6, CURDATE() + INTERVAL 16 DAY,  CURDATE() + INTERVAL 19 DAY,  2, 1650.00, 'confirmed', NOW() - INTERVAL 4 DAY),
(42, 21, 7, CURDATE() - INTERVAL 16 DAY,  CURDATE() - INTERVAL 13 DAY,  2,  880.00, 'confirmed', NOW() - INTERVAL 30 DAY),
(43, 12, 3, CURDATE() + INTERVAL 2 DAY,   CURDATE() + INTERVAL 4 DAY,   2,  980.00, 'cancelled', NOW() - INTERVAL 10 DAY);

-- ---------------------------------------------------------------------------
-- reviews  (one per finished stay; booking 2 is deliberately left without a
-- review so the demo guest can write one)
-- ---------------------------------------------------------------------------
INSERT INTO reviews (booking_id, rating, comment, created_at) VALUES
(1,  5, 'The terrace view over Shibuya at night is unreal. Spotless, quiet, and Hiro left a hand-drawn map of local ramen spots.', NOW() - INTERVAL 55 DAY),
(5,  4, 'Tea on the balcony above the clouds was the highlight. The stairs up from the bus stop are steep, so pack light.', NOW() - INTERVAL 117 DAY),
(6,  5, 'Woke up to ferries crossing the harbour. Small but cleverly laid out, and five minutes from the MTR.', NOW() - INTERVAL 41 DAY),
(7,  4, 'Great location and fast wifi. Street noise picks up early in the morning.', NOW() - INTERVAL 16 DAY),
(10, 5, 'Perfect for our family of four. The kids loved the park across the road and the kitchen had everything.', NOW() - INTERVAL 64 DAY),
(11, 3, 'Spacious flat, but the air conditioning in the second bedroom struggled in the heat.', NOW() - INTERVAL 11 DAY),
(13, 4, 'Car-free island life twenty minutes from Central. Bring mosquito repellent for the garden.', NOW() - INTERVAL 46 DAY),
(16, 5, 'Leafy, calm and close to the best cafes in Ari. Ben replied within minutes whenever we had questions.', NOW() - INTERVAL 21 DAY),
(17, 4, 'Simple, clean and very good value for Hong Kong. The shared bathroom was always tidy.', NOW() - INTERVAL 86 DAY),
(18, 5, 'We had the pool and the beach almost to ourselves. Worth every dollar for a group trip.', NOW() - INTERVAL 30 DAY),
(20, 5, 'Falling asleep to the sound of the tide under the house is something I will not forget.', NOW() - INTERVAL 11 DAY),
(22, 4, 'Stylish loft and a superb location. The check-in instructions could be clearer.', NOW() - INTERVAL 8 DAY),
(24, 5, 'A traditional tatami room done right. Senso-ji at sunrise is a ten minute walk.', NOW() - INTERVAL 75 DAY),
(26, 5, 'Hot tub under the cedars after a day of hiking. Absolute peace.', NOW() - INTERVAL 18 DAY),
(28, 3, 'Fine for a short solo stay. The room is tiny and the walls are thin.', NOW() - INTERVAL 2 DAY),
(29, 5, 'Sleeping in a real hanok was the highlight of our Seoul trip. Beautiful courtyard.', NOW() - INTERVAL 71 DAY),
(31, 4, 'Modern and comfortable, with a great gym in the building.', NOW() - INTERVAL 29 DAY),
(32, 5, 'Trailhead right outside the door and a fireplace waiting when we got back.', NOW() - INTERVAL 14 DAY),
(34, 4, 'Lovely interior design and a quiet lane. The night market is a short walk away.', NOW() - INTERVAL 51 DAY),
(36, 5, 'A private hot-spring bath in the house! Ideal for a big family gathering.', NOW() - INTERVAL 23 DAY),
(37, 4, 'Watching the river boats from the window was lovely. Good value.', NOW() - INTERVAL 60 DAY),
(39, 5, 'The pool, the space, the breakfast. Everything was excellent for our reunion.', NOW() - INTERVAL 35 DAY),
(40, 4, 'The bay view is exactly as pictured. Pricey, but you get what you pay for.', NOW() - INTERVAL 44 DAY),
(42, 4, 'A charming shophouse with character, in the best food neighbourhood in Singapore.', NOW() - INTERVAL 12 DAY);

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
INSERT INTO favorites (user_id, listing_id, created_at) VALUES
(1, 3,  NOW() - INTERVAL 12 DAY),
(1, 9,  NOW() - INTERVAL 9 DAY),
(1, 16, NOW() - INTERVAL 3 DAY),
(1, 20, NOW() - INTERVAL 1 DAY),
(5, 5,  NOW() - INTERVAL 20 DAY),
(5, 7,  NOW() - INTERVAL 15 DAY),
(6, 11, NOW() - INTERVAL 8 DAY),
(7, 1,  NOW() - INTERVAL 18 DAY),
(7, 5,  NOW() - INTERVAL 6 DAY),
(7, 18, NOW() - INTERVAL 2 DAY),
(2, 7,  NOW() - INTERVAL 5 DAY);
