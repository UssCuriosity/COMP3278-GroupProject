// Browsing: search listings and read one listing in full (READ).
const express = require('express');
const { HttpError } = require('../errors');
const { PROPERTY_TYPES, COVERS } = require('../constants');
const v = require('../validate');

const router = express.Router();

const SORTS = {
  rating: 'lr.avg_rating DESC, review_count DESC, l.id',
  price_asc: 'l.price_per_night ASC, l.id',
  price_desc: 'l.price_per_night DESC, l.id',
  newest: 'l.created_at DESC, l.id',
};

// Values for the search form and the listing form.
router.get('/meta', async (req, res) => {
  const cities = await req.db.query(`
    SELECT city,
           COUNT(*)             AS listing_count,
           MIN(price_per_night) AS from_price
    FROM listings
    WHERE is_active = TRUE
    GROUP BY city
    ORDER BY listing_count DESC, city`);
  const amenities = await req.db.query('SELECT id, name FROM amenities ORDER BY id');
  res.json({ cities, amenities, propertyTypes: PROPERTY_TYPES, covers: COVERS });
});

// Search. Every filter is optional; the WHERE clause is assembled from the
// filters that were actually supplied, always with "?" placeholders.
router.get('/listings', async (req, res) => {
  const q = req.query;
  const where = ['l.is_active = TRUE'];
  const params = [req.session.userId || 0]; // for the favorites join

  if (q.city) {
    where.push('l.city = ?');
    params.push(v.text(q.city, 'City', { max: 80 }));
  }
  if (q.type) {
    where.push('l.property_type = ?');
    params.push(v.oneOf(q.type, 'Property type', PROPERTY_TYPES));
  }
  if (q.guests) {
    where.push('l.max_guests >= ?');
    params.push(v.integer(q.guests, 'Guests', { min: 1, max: 16 }));
  }
  if (q.min_price) {
    where.push('l.price_per_night >= ?');
    params.push(v.money(q.min_price, 'Minimum price'));
  }
  if (q.max_price) {
    where.push('l.price_per_night <= ?');
    params.push(v.money(q.max_price, 'Maximum price'));
  }

  // Availability: keep a listing only if NO confirmed booking overlaps the
  // requested stay. Two stays overlap when each starts before the other ends.
  if (q.check_in || q.check_out) {
    const checkIn = v.isoDate(q.check_in, 'Check-in');
    const checkOut = v.isoDate(q.check_out, 'Check-out');
    if (checkOut <= checkIn) throw new HttpError(400, 'Check-out must be after check-in.');
    where.push(`NOT EXISTS (
        SELECT 1
        FROM bookings b
        WHERE b.listing_id = l.id
          AND b.status = 'confirmed'
          AND b.check_in < ?
          AND b.check_out > ?
    )`);
    params.push(checkOut, checkIn);
  }

  // Amenities: the listing must offer ALL of the selected amenities
  // (relational division: count the matches and compare with how many were asked for).
  if (q.amenities) {
    const ids = [...new Set(String(q.amenities).split(','))].map((id) => v.integer(id, 'Amenity', { min: 1 }));
    where.push(`(
        SELECT COUNT(*)
        FROM listing_amenities la
        WHERE la.listing_id = l.id
          AND la.amenity_id IN (${ids.map(() => '?').join(', ')})
    ) = ?`);
    params.push(...ids, ids.length);
  }

  const listings = await req.db.query(
    `
    SELECT l.id, l.title, l.city, l.property_type, l.price_per_night,
           l.max_guests, l.bedrooms, l.bathrooms, l.cover,
           u.name                       AS host_name,
           lr.avg_rating,
           COALESCE(lr.review_count, 0) AS review_count,
           (f.user_id IS NOT NULL)      AS is_favorite
    FROM listings l
    JOIN users u ON u.id = l.host_id
    LEFT JOIN listing_ratings lr ON lr.listing_id = l.id
    LEFT JOIN favorites f ON f.listing_id = l.id AND f.user_id = ?
    WHERE ${where.join('\n      AND ')}
    ORDER BY ${SORTS[q.sort] || SORTS.rating}`,
    params
  );
  res.json({ listings });
});

// One listing with everything its page shows.
router.get('/listings/:id', async (req, res) => {
  const id = v.integer(req.params.id, 'Listing id', { min: 1 });

  const [listing] = await req.db.query(
    `
    SELECT l.id, l.host_id, l.title, l.description, l.city, l.property_type, l.price_per_night,
           l.max_guests, l.bedrooms, l.bathrooms, l.cover, l.is_active,
           u.name                       AS host_name,
           u.created_at                 AS host_since,
           lr.avg_rating,
           COALESCE(lr.review_count, 0) AS review_count,
           (f.user_id IS NOT NULL)      AS is_favorite
    FROM listings l
    JOIN users u ON u.id = l.host_id
    LEFT JOIN listing_ratings lr ON lr.listing_id = l.id
    LEFT JOIN favorites f ON f.listing_id = l.id AND f.user_id = ?
    WHERE l.id = ?`,
    [req.session.userId || 0, id]
  );
  if (!listing) throw new HttpError(404, 'This listing does not exist.');

  const amenities = await req.db.query(
    `
    SELECT a.id, a.name
    FROM amenities a
    JOIN listing_amenities la ON la.amenity_id = a.id
    WHERE la.listing_id = ?
    ORDER BY a.id`,
    [id]
  );

  // A review belongs to a booking, so we reach the listing through bookings.
  const reviews = await req.db.query(
    `
    SELECT r.id, r.rating, r.comment, r.created_at, u.name AS guest_name
    FROM reviews r
    JOIN bookings b ON b.id = r.booking_id
    JOIN users u ON u.id = b.guest_id
    WHERE b.listing_id = ?
    ORDER BY r.created_at DESC`,
    [id]
  );

  const booked = await req.db.query(
    `
    SELECT check_in, check_out
    FROM bookings
    WHERE listing_id = ?
      AND status = 'confirmed'
      AND check_out > CURDATE()
    ORDER BY check_in`,
    [id]
  );

  res.json({ listing, amenities, reviews, booked });
});

module.exports = router;
