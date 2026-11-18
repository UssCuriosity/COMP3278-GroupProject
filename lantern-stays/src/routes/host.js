// Hosting: dashboard statistics and full CRUD on my own listings.
const express = require('express');
const { HttpError } = require('../errors');
const { requireLogin } = require('../auth');
const { PROPERTY_TYPES, COVERS } = require('../constants');
const v = require('../validate');

const router = express.Router();
router.use(requireLogin);

function readListing(body) {
  const amenityIds = Array.isArray(body.amenity_ids) ? body.amenity_ids : [];
  return {
    title: v.text(body.title, 'Title', { min: 5, max: 120 }),
    description: v.text(body.description, 'Description', { min: 20, max: 2000 }),
    city: v.text(body.city, 'City', { max: 80 }),
    propertyType: v.oneOf(body.property_type, 'Property type', PROPERTY_TYPES),
    price: v.money(body.price_per_night, 'Price per night', { min: 1, max: 99999 }),
    maxGuests: v.integer(body.max_guests, 'Guests', { min: 1, max: 16 }),
    bedrooms: v.integer(body.bedrooms, 'Bedrooms', { min: 0, max: 20 }),
    bathrooms: v.integer(body.bathrooms, 'Bathrooms', { min: 0, max: 20 }),
    cover: v.oneOf(body.cover, 'Cover', COVERS),
    amenityIds: [...new Set(amenityIds.map((id) => v.integer(id, 'Amenity', { min: 1 })))],
  };
}

// One multi-row INSERT for all the amenities of a listing.
async function insertAmenities(tx, listingId, amenityIds) {
  if (amenityIds.length === 0) return;
  try {
    await tx.query(
      `INSERT INTO listing_amenities (listing_id, amenity_id) VALUES ${amenityIds.map(() => '(?, ?)').join(', ')}`,
      amenityIds.flatMap((amenityId) => [listingId, amenityId])
    );
  } catch (error) {
    // The foreign key to amenities rejects ids that do not exist.
    if (error.code === 'ER_NO_REFERENCED_ROW_2') throw new HttpError(400, 'Unknown amenity.');
    throw error;
  }
}

// READ: my listings with booking statistics, plus the reservations on them.
router.get('/dashboard', async (req, res) => {
  const hostId = req.session.userId;

  // LEFT JOIN keeps listings that have no bookings yet (their counts are 0).
  // Only confirmed bookings count towards nights and revenue.
  const listings = await req.db.query(
    `
    SELECT l.id, l.title, l.city, l.property_type, l.price_per_night, l.cover, l.is_active,
           COUNT(b.id)                                                           AS booking_count,
           COALESCE(SUM(b.check_in > CURDATE()), 0)                              AS upcoming_count,
           COALESCE(SUM(DATEDIFF(b.check_out, b.check_in)), 0)                   AS nights_booked,
           COALESCE(SUM(DATEDIFF(b.check_out, b.check_in) * b.nightly_price), 0) AS revenue,
           lr.avg_rating,
           COALESCE(lr.review_count, 0)                                          AS review_count
    FROM listings l
    LEFT JOIN bookings b ON b.listing_id = l.id AND b.status = 'confirmed'
    LEFT JOIN listing_ratings lr ON lr.listing_id = l.id
    WHERE l.host_id = ?
    GROUP BY l.id, lr.avg_rating, lr.review_count
    ORDER BY revenue DESC, l.id`,
    [hostId]
  );

  const reservations = await req.db.query(
    `
    SELECT b.id, b.check_in, b.check_out, b.guests, b.status,
           DATEDIFF(b.check_out, b.check_in)                   AS nights,
           DATEDIFF(b.check_out, b.check_in) * b.nightly_price AS total_price,
           l.id   AS listing_id,
           l.title,
           g.name AS guest_name
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    JOIN users g ON g.id = b.guest_id
    WHERE l.host_id = ?
      AND b.check_out >= CURDATE()
    ORDER BY b.check_in`,
    [hostId]
  );

  res.json({ listings, reservations });
});

// CREATE a listing and its amenity links in one transaction:
// either the listing and all its amenities are saved, or nothing is.
router.post('/listings', async (req, res) => {
  const data = readListing(req.body);

  const id = await req.db.transaction(async (tx) => {
    const result = await tx.query(
      `
      INSERT INTO listings
          (host_id, title, description, city, property_type, price_per_night, max_guests, bedrooms, bathrooms, cover)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.userId,
        data.title,
        data.description,
        data.city,
        data.propertyType,
        data.price,
        data.maxGuests,
        data.bedrooms,
        data.bathrooms,
        data.cover,
      ]
    );
    await insertAmenities(tx, result.insertId, data.amenityIds);
    return result.insertId;
  });

  res.status(201).json({ id });
});

// UPDATE a listing. "AND host_id = ?" means a host can only edit their own.
router.put('/listings/:id', async (req, res) => {
  const listingId = v.integer(req.params.id, 'Listing id', { min: 1 });
  const data = readListing(req.body);

  await req.db.transaction(async (tx) => {
    // Booking writes also lock the listing, so the capacity check sees prior reservations.
    const [listing] = await tx.query(
      'SELECT max_guests FROM listings WHERE id = ? AND host_id = ? FOR UPDATE',
      [listingId, req.session.userId]
    );
    if (!listing) throw new HttpError(404, 'Listing not found.');
    if (data.maxGuests < listing.max_guests) {
      const [reservation] = await tx.query(
        `SELECT id FROM bookings
         WHERE listing_id = ? AND status = 'confirmed' AND check_out > CURDATE() AND guests > ?
         LIMIT 1`,
        [listingId, data.maxGuests]
      );
      if (reservation) throw new HttpError(409, 'This capacity is too low for an existing confirmed booking.');
    }

    const result = await tx.query(
      `
      UPDATE listings
      SET title = ?, description = ?, city = ?, property_type = ?, price_per_night = ?,
          max_guests = ?, bedrooms = ?, bathrooms = ?, cover = ?
      WHERE id = ? AND host_id = ?`,
      [
        data.title,
        data.description,
        data.city,
        data.propertyType,
        data.price,
        data.maxGuests,
        data.bedrooms,
        data.bathrooms,
        data.cover,
        listingId,
        req.session.userId,
      ]
    );
    if (result.affectedRows === 0) throw new HttpError(404, 'Listing not found.');

    // Replace the amenity links with the new selection.
    await tx.query('DELETE FROM listing_amenities WHERE listing_id = ?', [listingId]);
    await insertAmenities(tx, listingId, data.amenityIds);
  });

  res.json({ id: listingId });
});

// UPDATE: pause (hide from search) or reactivate a listing.
router.patch('/listings/:id/active', async (req, res) => {
  const listingId = v.integer(req.params.id, 'Listing id', { min: 1 });
  const isActive = req.body.is_active ? 1 : 0;
  const result = await req.db.query('UPDATE listings SET is_active = ? WHERE id = ? AND host_id = ?', [
    isActive,
    listingId,
    req.session.userId,
  ]);
  if (result.affectedRows === 0) throw new HttpError(404, 'Listing not found.');
  res.json({ is_active: isActive });
});

// DELETE a listing. Its amenity links and favorites disappear with it
// (ON DELETE CASCADE), but bookings reference listings WITHOUT cascade, so
// MySQL refuses to delete a listing that has booking history.
router.delete('/listings/:id', async (req, res) => {
  const listingId = v.integer(req.params.id, 'Listing id', { min: 1 });
  let result;
  try {
    result = await req.db.query('DELETE FROM listings WHERE id = ? AND host_id = ?', [listingId, req.session.userId]);
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      throw new HttpError(
        409,
        'This listing has booking history, so the database will not let it be deleted. Pause it instead to hide it from search.'
      );
    }
    throw error;
  }
  if (result.affectedRows === 0) throw new HttpError(404, 'Listing not found.');
  res.json({ ok: true });
});

module.exports = router;
