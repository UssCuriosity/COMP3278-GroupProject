// SQL for trips and reviews: book, list, change, cancel, remove, review.
import type { Trip } from '../../api-types.js';
import type { Queryable, RequestDb } from '../../db/request-db.js';
import { HttpError, mysqlErrorCode } from '../../errors.js';
import type { ChangeBookingInput, CreateBookingInput, ReviewInput } from '../../schemas.js';

interface LockedListing {
  host_id: number;
  price_per_night: number;
  max_guests: number;
  is_active: number;
  today: string;
}

// CREATE a booking.
// "Is the listing free?" and the INSERT must happen as one unit, otherwise two
// guests could both pass the check and double-book the listing.
export function createBooking(db: RequestDb, guestId: number, input: CreateBookingInput) {
  return db.transaction(async (tx) => {
    // FOR UPDATE locks this listing row until COMMIT, so concurrent bookings
    // of the same listing wait here and run one after another.
    const [listing] = await tx.query<LockedListing>(
      `
      SELECT host_id, price_per_night, max_guests, is_active, CURDATE() AS today
      FROM listings
      WHERE id = ?
      FOR UPDATE`,
      [input.listing_id]
    );
    if (!listing) throw new HttpError(404, 'This listing does not exist.');
    if (!listing.is_active) throw new HttpError(409, 'This listing is not accepting bookings right now.');
    if (listing.host_id === guestId) throw new HttpError(400, 'You cannot book your own listing.');
    if (input.guests > listing.max_guests) throw new HttpError(400, `This place sleeps at most ${listing.max_guests} guests.`);
    if (input.check_in < listing.today) throw new HttpError(400, 'Check-in cannot be in the past.');

    await assertDatesFree(tx, input.listing_id, input, 0, 'Those dates are no longer available. Please pick different dates.');

    // nightly_price stores today's price, so later price changes do not affect this booking.
    const result = await tx.execute(
      `
      INSERT INTO bookings (listing_id, guest_id, check_in, check_out, guests, nightly_price)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [input.listing_id, guestId, input.check_in, input.check_out, input.guests, listing.price_per_night]
    );
    return { id: result.insertId, nightly_price: listing.price_per_night };
  });
}

// The overlap test: two stays clash when each starts before the other ends.
// `ignoreBookingId` lets a booking that is being changed ignore itself.
async function assertDatesFree(tx: Queryable, listingId: number, stay: { check_in: string; check_out: string }, ignoreBookingId: number, message: string) {
  const [row] = await tx.query<{ clashes: number }>(
    `
    SELECT COUNT(*) AS clashes
    FROM bookings
    WHERE listing_id = ?
      AND id <> ?
      AND status = 'confirmed'
      AND check_in < ?
      AND check_out > ?`,
    [listingId, ignoreBookingId, stay.check_out, stay.check_in]
  );
  if ((row?.clashes ?? 0) > 0) throw new HttpError(409, message);
}

// READ my trips, each with its listing, the derived total and my review (if any).
export function listTrips(db: Queryable, guestId: number) {
  return db.query<Trip>(
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
           h.name    AS host_name,
           r.rating  AS review_rating,
           r.comment AS review_comment
    FROM bookings b
    JOIN listings l ON l.id = b.listing_id
    JOIN users h ON h.id = l.host_id
    LEFT JOIN reviews r ON r.booking_id = b.id
    WHERE b.guest_id = ?
    ORDER BY b.check_in DESC`,
    [guestId]
  );
}

// UPDATE the dates / number of guests of an upcoming booking.
export function changeBooking(db: RequestDb, guestId: number, bookingId: number, input: ChangeBookingInput) {
  return db.transaction(async (tx) => {
    const [booking] = await tx.query<{ listing_id: number; status: string; check_in: string; max_guests: number; today: string }>(
      `
      SELECT b.listing_id, b.status, b.check_in, l.max_guests, CURDATE() AS today
      FROM bookings b
      JOIN listings l ON l.id = b.listing_id
      WHERE b.id = ? AND b.guest_id = ?
      FOR UPDATE`,
      [bookingId, guestId]
    );
    if (!booking) throw new HttpError(404, 'Booking not found.');
    if (booking.status !== 'confirmed' || booking.check_in <= booking.today) throw new HttpError(409, 'Only upcoming bookings can be changed.');
    if (input.check_in < booking.today) throw new HttpError(400, 'Check-in cannot be in the past.');
    if (input.guests > booking.max_guests) throw new HttpError(400, `This place sleeps at most ${booking.max_guests} guests.`);

    await assertDatesFree(tx, booking.listing_id, input, bookingId, 'Those dates are not available for this listing.');

    await tx.execute('UPDATE bookings SET check_in = ?, check_out = ?, guests = ? WHERE id = ?', [input.check_in, input.check_out, input.guests, bookingId]);
  });
}

// UPDATE: cancel. The row is kept (status changes) so the history stays intact.
// The WHERE clause itself enforces the rules: mine, still confirmed, not started.
export async function cancelBooking(db: Queryable, guestId: number, bookingId: number) {
  const result = await db.execute(
    `
    UPDATE bookings
    SET status = 'cancelled'
    WHERE id = ?
      AND guest_id = ?
      AND status = 'confirmed'
      AND check_in > CURDATE()`,
    [bookingId, guestId]
  );
  if (result.affectedRows === 0) throw new HttpError(409, 'Only upcoming confirmed bookings can be cancelled.');
}

// DELETE a cancelled booking from my history.
export async function removeBooking(db: Queryable, guestId: number, bookingId: number) {
  const result = await db.execute(
    `
    DELETE FROM bookings
    WHERE id = ?
      AND guest_id = ?
      AND status = 'cancelled'`,
    [bookingId, guestId]
  );
  if (result.affectedRows === 0) throw new HttpError(409, 'Only cancelled bookings can be removed.');
}

// CREATE a review. INSERT ... SELECT inserts a row only if the booking is
// mine, was not cancelled and has already ended: one statement, no race.
export async function createReview(db: Queryable, guestId: number, bookingId: number, review: ReviewInput) {
  let affected: number;
  try {
    const result = await db.execute(
      `
      INSERT INTO reviews (booking_id, rating, comment)
      SELECT b.id, ?, ?
      FROM bookings b
      WHERE b.id = ?
        AND b.guest_id = ?
        AND b.status = 'confirmed'
        AND b.check_out <= CURDATE()`,
      [review.rating, review.comment, bookingId, guestId]
    );
    affected = result.affectedRows;
  } catch (error) {
    // The UNIQUE key on reviews.booking_id allows one review per stay.
    if (mysqlErrorCode(error) === 'ER_DUP_ENTRY') throw new HttpError(409, 'You have already reviewed this stay.');
    throw error;
  }
  if (affected === 0) throw new HttpError(409, 'You can review a stay only after it has ended.');
}

// UPDATE my review (multi-table UPDATE: the join proves the booking is mine).
export async function updateReview(db: Queryable, guestId: number, bookingId: number, review: ReviewInput) {
  const result = await db.execute(
    `
    UPDATE reviews r
    JOIN bookings b ON b.id = r.booking_id
    SET r.rating = ?, r.comment = ?
    WHERE r.booking_id = ?
      AND b.guest_id = ?`,
    [review.rating, review.comment, bookingId, guestId]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Review not found.');
}

// DELETE my review.
export async function deleteReview(db: Queryable, guestId: number, bookingId: number) {
  const result = await db.execute(
    `
    DELETE r
    FROM reviews r
    JOIN bookings b ON b.id = r.booking_id
    WHERE r.booking_id = ?
      AND b.guest_id = ?`,
    [bookingId, guestId]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Review not found.');
}
