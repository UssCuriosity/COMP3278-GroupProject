// Trips: book a stay, list my trips, change dates, cancel, remove,
// and write / edit / delete the review of a finished stay.
const express = require('express');
const { HttpError } = require('../errors');
const { requireLogin } = require('../auth');
const { MAX_NIGHTS } = require('../constants');
const v = require('../validate');

const router = express.Router();
router.use(requireLogin);

function readStay(body) {
  const checkIn = v.isoDate(body.check_in, 'Check-in');
  const checkOut = v.isoDate(body.check_out, 'Check-out');
  if (checkOut <= checkIn) throw new HttpError(400, 'Check-out must be after check-in.');
  if (v.nightsBetween(checkIn, checkOut) > MAX_NIGHTS) {
    throw new HttpError(400, `A stay can be at most ${MAX_NIGHTS} nights.`);
  }
  return { checkIn, checkOut, guests: v.integer(body.guests, 'Guests', { min: 1, max: 16 }) };
}

// CREATE a booking.
// The check "is the listing free?" and the INSERT must happen as one unit,
// otherwise two guests could both pass the check and double-book the listing.
router.post('/', async (req, res) => {
  const listingId = v.integer(req.body.listing_id, 'Listing', { min: 1 });
  const { checkIn, checkOut, guests } = readStay(req.body);
  const guestId = req.session.userId;

  const booking = await req.db.transaction(async (tx) => {
    // FOR UPDATE locks this listing row until COMMIT, so concurrent bookings
    // of the same listing wait here and run one after another.
    const [listing] = await tx.query(
      `
      SELECT id, host_id, price_per_night, max_guests, is_active, CURDATE() AS today
      FROM listings
      WHERE id = ?
      FOR UPDATE`,
      [listingId]
    );
    if (!listing) throw new HttpError(404, 'This listing does not exist.');
    if (!listing.is_active) throw new HttpError(409, 'This listing is not accepting bookings right now.');
    if (listing.host_id === guestId) throw new HttpError(400, 'You cannot book your own listing.');
    if (guests > listing.max_guests) throw new HttpError(400, `This place sleeps at most ${listing.max_guests} guests.`);
    if (checkIn < listing.today) throw new HttpError(400, 'Check-in cannot be in the past.');

    const [{ clashes }] = await tx.query(
      `
      SELECT COUNT(*) AS clashes
      FROM bookings
      WHERE listing_id = ?
        AND status = 'confirmed'
        AND check_in < ?
        AND check_out > ?`,
      [listingId, checkOut, checkIn]
    );
    if (clashes > 0) throw new HttpError(409, 'Those dates are no longer available. Please pick different dates.');

    // nightly_price stores today's price, so later price changes do not affect this booking.
    const result = await tx.query(
      `
      INSERT INTO bookings (listing_id, guest_id, check_in, check_out, guests, nightly_price)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [listingId, guestId, checkIn, checkOut, guests, listing.price_per_night]
    );
    return { id: result.insertId, nightly_price: listing.price_per_night };
  });

  res.status(201).json({ booking });
});

// READ my trips, each with its listing, the derived total and my review (if any).
router.get('/', async (req, res) => {
  const bookings = await req.db.query(
    `
    SELECT b.id, b.listing_id, b.check_in, b.check_out, b.guests, b.nightly_price, b.status,
           DATEDIFF(b.check_out, b.check_in)                   AS nights,
           DATEDIFF(b.check_out, b.check_in) * b.nightly_price AS total_price,
           CASE
               WHEN b.status = 'cancelled'  THEN 'cancelled'
               WHEN b.check_out <= CURDATE() THEN 'past'
               WHEN b.check_in <= CURDATE()  THEN 'current'
               ELSE 'upcoming'
           END                                                 AS phase,
           l.title, l.city, l.cover, l.max_guests,
           h.name   AS host_name,
           r.rating  AS review_rating,
           r.comment AS review_comment
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    JOIN users h ON h.id = l.host_id
    LEFT JOIN reviews r ON r.booking_id = b.id
    WHERE b.guest_id = ?
    ORDER BY b.check_in DESC`,
    [req.session.userId]
  );
  res.json({ bookings });
});

// UPDATE the dates / number of guests of an upcoming booking.
router.patch('/:id', async (req, res) => {
  const bookingId = v.integer(req.params.id, 'Booking id', { min: 1 });
  const { checkIn, checkOut, guests } = readStay(req.body);

  await req.db.transaction(async (tx) => {
    const [booking] = await tx.query(
      `
      SELECT b.listing_id, b.status, b.check_in, l.max_guests, CURDATE() AS today
      FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE b.id = ? AND b.guest_id = ?
      FOR UPDATE`,
      [bookingId, req.session.userId]
    );
    if (!booking) throw new HttpError(404, 'Booking not found.');
    if (booking.status !== 'confirmed' || booking.check_in <= booking.today) {
      throw new HttpError(409, 'Only upcoming bookings can be changed.');
    }
    if (checkIn < booking.today) throw new HttpError(400, 'Check-in cannot be in the past.');
    if (guests > booking.max_guests) throw new HttpError(400, `This place sleeps at most ${booking.max_guests} guests.`);

    // Same overlap test as when booking, but ignoring this booking itself.
    const [{ clashes }] = await tx.query(
      `
      SELECT COUNT(*) AS clashes
      FROM bookings
      WHERE listing_id = ?
        AND id <> ?
        AND status = 'confirmed'
        AND check_in < ?
        AND check_out > ?`,
      [booking.listing_id, bookingId, checkOut, checkIn]
    );
    if (clashes > 0) throw new HttpError(409, 'Those dates are not available for this listing.');

    await tx.query('UPDATE bookings SET check_in = ?, check_out = ?, guests = ? WHERE id = ?', [
      checkIn,
      checkOut,
      guests,
      bookingId,
    ]);
  });

  res.json({ ok: true });
});

// UPDATE: cancel. The row is kept (status changes) so the history stays intact.
// The WHERE clause itself enforces the rules: mine, still confirmed, not started.
router.post('/:id/cancel', async (req, res) => {
  const bookingId = v.integer(req.params.id, 'Booking id', { min: 1 });
  const result = await req.db.query(
    `
    UPDATE bookings
    SET status = 'cancelled'
    WHERE id = ?
      AND guest_id = ?
      AND status = 'confirmed'
      AND check_in > CURDATE()`,
    [bookingId, req.session.userId]
  );
  if (result.affectedRows === 0) throw new HttpError(409, 'Only upcoming confirmed bookings can be cancelled.');
  res.json({ ok: true });
});

// DELETE a cancelled booking from my history.
router.delete('/:id', async (req, res) => {
  const bookingId = v.integer(req.params.id, 'Booking id', { min: 1 });
  const result = await req.db.query(
    `
    DELETE FROM bookings
    WHERE id = ?
      AND guest_id = ?
      AND status = 'cancelled'`,
    [bookingId, req.session.userId]
  );
  if (result.affectedRows === 0) throw new HttpError(409, 'Only cancelled bookings can be removed.');
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Reviews (one per booking)
// ---------------------------------------------------------------------------
function readReview(body) {
  return {
    rating: v.integer(body.rating, 'Rating', { min: 1, max: 5 }),
    comment: v.text(body.comment, 'Comment', { min: 10, max: 1000 }),
  };
}

// CREATE a review. INSERT ... SELECT inserts a row only if the booking is
// mine, was not cancelled and has already ended - one statement, no race.
router.post('/:id/review', async (req, res) => {
  const bookingId = v.integer(req.params.id, 'Booking id', { min: 1 });
  const { rating, comment } = readReview(req.body);

  let result;
  try {
    result = await req.db.query(
      `
      INSERT INTO reviews (booking_id, rating, comment)
      SELECT b.id, ?, ?
      FROM bookings b
      WHERE b.id = ?
        AND b.guest_id = ?
        AND b.status = 'confirmed'
        AND b.check_out <= CURDATE()`,
      [rating, comment, bookingId, req.session.userId]
    );
  } catch (error) {
    // The UNIQUE key on reviews.booking_id allows one review per stay.
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'You have already reviewed this stay.');
    throw error;
  }
  if (result.affectedRows === 0) throw new HttpError(409, 'You can review a stay only after it has ended.');
  res.status(201).json({ ok: true });
});

// UPDATE my review (multi-table UPDATE: the join proves the booking is mine).
router.put('/:id/review', async (req, res) => {
  const bookingId = v.integer(req.params.id, 'Booking id', { min: 1 });
  const { rating, comment } = readReview(req.body);
  const result = await req.db.query(
    `
    UPDATE reviews r
    JOIN bookings b ON b.id = r.booking_id
    SET r.rating = ?, r.comment = ?
    WHERE r.booking_id = ?
      AND b.guest_id = ?`,
    [rating, comment, bookingId, req.session.userId]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Review not found.');
  res.json({ ok: true });
});

// DELETE my review.
router.delete('/:id/review', async (req, res) => {
  const bookingId = v.integer(req.params.id, 'Booking id', { min: 1 });
  const result = await req.db.query(
    `
    DELETE r
    FROM reviews r
    JOIN bookings b ON b.id = r.booking_id
    WHERE r.booking_id = ?
      AND b.guest_id = ?`,
    [bookingId, req.session.userId]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Review not found.');
  res.json({ ok: true });
});

module.exports = router;
