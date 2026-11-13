-- ---------------------------------------------------------------------------
-- Lantern Stays - database schema (MySQL 8.0 or newer)
--
-- Run with:   mysql -u root -p < db/schema.sql
-- or:         npm run db:setup          (runs this file, then db/seed.sql)
--
-- Re-running this file drops and recreates every table, so it also works as
-- a "reset". Load db/seed.sql afterwards to get the initial data back.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS lantern_stays CHARACTER SET utf8mb4;
USE lantern_stays;

-- Drop in reverse dependency order so foreign keys never block the reset.
DROP VIEW  IF EXISTS listing_ratings;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS listing_amenities;
DROP TABLE IF EXISTS amenities;
DROP TABLE IF EXISTS listings;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------------
-- users: every account can both book stays (guest) and publish listings (host)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- listings: a place to stay, owned by exactly one host   (users 1 : N listings)
-- ---------------------------------------------------------------------------
CREATE TABLE listings (
    id              INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    host_id         INT UNSIGNED     NOT NULL,
    title           VARCHAR(120)     NOT NULL,
    description     TEXT             NOT NULL,
    city            VARCHAR(80)      NOT NULL,
    property_type   ENUM('apartment', 'studio', 'house', 'villa', 'cabin', 'room') NOT NULL,
    price_per_night DECIMAL(8, 2)    NOT NULL,
    max_guests      TINYINT UNSIGNED NOT NULL,
    bedrooms        TINYINT UNSIGNED NOT NULL DEFAULT 1,
    bathrooms       TINYINT UNSIGNED NOT NULL DEFAULT 1,
    cover           VARCHAR(40)      NOT NULL DEFAULT 'skyline-day',
    is_active       BOOLEAN          NOT NULL DEFAULT TRUE,
    created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_listings_city (city),
    KEY idx_listings_host (host_id),
    CONSTRAINT fk_listings_host FOREIGN KEY (host_id) REFERENCES users (id),
    CONSTRAINT chk_listings_price  CHECK (price_per_night > 0),
    CONSTRAINT chk_listings_guests CHECK (max_guests BETWEEN 1 AND 16)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- amenities + listing_amenities: listings M : N amenities
-- ---------------------------------------------------------------------------
CREATE TABLE amenities (
    id   SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(50)       NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_amenities_name (name)
) ENGINE = InnoDB;

CREATE TABLE listing_amenities (
    listing_id INT UNSIGNED      NOT NULL,
    amenity_id SMALLINT UNSIGNED NOT NULL,
    PRIMARY KEY (listing_id, amenity_id),
    CONSTRAINT fk_la_listing FOREIGN KEY (listing_id) REFERENCES listings (id)  ON DELETE CASCADE,
    CONSTRAINT fk_la_amenity FOREIGN KEY (amenity_id) REFERENCES amenities (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- bookings: a guest reserves a listing for [check_in, check_out)
--   users 1 : N bookings   and   listings 1 : N bookings
--
-- nightly_price is a snapshot of the listing price at booking time, so later
-- price changes never alter an existing booking. The booking total is a
-- derived attribute and is NOT stored:
--     total = DATEDIFF(check_out, check_in) * nightly_price
--
-- fk_bookings_listing has no ON DELETE action (RESTRICT): a listing that has
-- booking history cannot be deleted, which protects guests' records.
-- ---------------------------------------------------------------------------
CREATE TABLE bookings (
    id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    listing_id    INT UNSIGNED     NOT NULL,
    guest_id      INT UNSIGNED     NOT NULL,
    check_in      DATE             NOT NULL,
    check_out     DATE             NOT NULL,
    guests        TINYINT UNSIGNED NOT NULL DEFAULT 1,
    nightly_price DECIMAL(8, 2)    NOT NULL,
    status        ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
    created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_bookings_listing_dates (listing_id, check_in, check_out),
    KEY idx_bookings_guest (guest_id),
    CONSTRAINT fk_bookings_listing FOREIGN KEY (listing_id) REFERENCES listings (id),
    CONSTRAINT fk_bookings_guest   FOREIGN KEY (guest_id)   REFERENCES users (id),
    CONSTRAINT chk_bookings_dates  CHECK (check_out > check_in),
    CONSTRAINT chk_bookings_guests CHECK (guests >= 1)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- reviews: bookings 1 : 1 reviews
-- The UNIQUE key on booking_id enforces "at most one review per stay", and
-- because a review hangs off a booking, only someone who stayed can review.
-- ---------------------------------------------------------------------------
CREATE TABLE reviews (
    id         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
    booking_id INT UNSIGNED     NOT NULL,
    rating     TINYINT UNSIGNED NOT NULL,
    comment    VARCHAR(1000)    NOT NULL,
    created_at DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_reviews_booking (booking_id),
    CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings (id) ON DELETE CASCADE,
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- favorites: users M : N listings, with the time the listing was saved
-- ---------------------------------------------------------------------------
CREATE TABLE favorites (
    user_id    INT UNSIGNED NOT NULL,
    listing_id INT UNSIGNED NOT NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, listing_id),
    CONSTRAINT fk_favorites_user    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE CASCADE,
    CONSTRAINT fk_favorites_listing FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- sessions: login sessions (infrastructure, not part of the ER model).
-- Keeping them in MySQL means users stay logged in when the server restarts.
-- ---------------------------------------------------------------------------
CREATE TABLE sessions (
    id         VARCHAR(128) NOT NULL,
    data       JSON         NOT NULL,
    expires_at DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_sessions_expires (expires_at)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- listing_ratings: average rating and review count per listing.
-- A review reaches its listing through the booking, so this view saves every
-- query from repeating the same join + GROUP BY.
-- SQL SECURITY INVOKER: the view runs with the permissions of whoever queries
-- it, so it keeps working even if the account that created it is removed.
-- ---------------------------------------------------------------------------
CREATE SQL SECURITY INVOKER VIEW listing_ratings AS
SELECT b.listing_id,
       ROUND(AVG(r.rating), 2) AS avg_rating,
       COUNT(*)                AS review_count
FROM reviews r
JOIN bookings b ON b.id = r.booking_id
GROUP BY b.listing_id;
