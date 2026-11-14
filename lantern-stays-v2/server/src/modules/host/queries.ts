// SQL for hosting: dashboard statistics and full CRUD on my own listings.
import type { HostListing, Reservation } from '../../api-types.js';
import type { Queryable, RequestDb } from '../../db/request-db.js';
import { HttpError, mysqlErrorCode } from '../../errors.js';
import type { ListingInput } from '../../schemas.js';

// READ: my listings with booking statistics.
// LEFT JOIN keeps listings that have no bookings yet (their counts are 0).
// Only confirmed bookings count towards nights and revenue.
export function hostListings(db: Queryable, hostId: number) {
  return db.query<HostListing>(
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
}

export function hostReservations(db: Queryable, hostId: number) {
  return db.query<Reservation>(
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
}

// One multi-row INSERT for all the amenities of a listing.
async function insertAmenities(tx: Queryable, listingId: number, amenityIds: number[]) {
  if (amenityIds.length === 0) return;
  try {
    await tx.execute(
      `INSERT INTO listing_amenities (listing_id, amenity_id) VALUES ${amenityIds.map(() => '(?, ?)').join(', ')}`,
      amenityIds.flatMap((amenityId) => [listingId, amenityId])
    );
  } catch (error) {
    // The foreign key to amenities rejects ids that do not exist.
    if (mysqlErrorCode(error) === 'ER_NO_REFERENCED_ROW_2') throw new HttpError(400, 'Unknown amenity.');
    throw error;
  }
}

// CREATE a listing and its amenity links in one transaction:
// either the listing and all its amenities are saved, or nothing is.
export function createListing(db: RequestDb, hostId: number, data: ListingInput) {
  return db.transaction(async (tx) => {
    const result = await tx.execute(
      `
      INSERT INTO listings
          (host_id, title, description, city, property_type, price_per_night, max_guests, bedrooms, bathrooms, cover)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [hostId, data.title, data.description, data.city, data.property_type, data.price_per_night, data.max_guests, data.bedrooms, data.bathrooms, data.cover]
    );
    await insertAmenities(tx, result.insertId, data.amenity_ids);
    return result.insertId;
  });
}

// UPDATE a listing. "AND host_id = ?" means a host can only edit their own.
export function updateListing(db: RequestDb, hostId: number, listingId: number, data: ListingInput) {
  return db.transaction(async (tx) => {
    // Booking writes also lock the listing, so the capacity check sees prior reservations.
    const [listing] = await tx.query<{ max_guests: number }>(
      'SELECT max_guests FROM listings WHERE id = ? AND host_id = ? FOR UPDATE',
      [listingId, hostId]
    );
    if (!listing) throw new HttpError(404, 'Listing not found.');
    if (data.max_guests < listing.max_guests) {
      const [reservation] = await tx.query<{ id: number }>(
        `SELECT id FROM bookings
         WHERE listing_id = ? AND status = 'confirmed' AND check_out > CURDATE() AND guests > ?
         LIMIT 1`,
        [listingId, data.max_guests]
      );
      if (reservation) throw new HttpError(409, 'This capacity is too low for an existing confirmed booking.');
    }

    const result = await tx.execute(
      `
      UPDATE listings
      SET title = ?, description = ?, city = ?, property_type = ?, price_per_night = ?,
          max_guests = ?, bedrooms = ?, bathrooms = ?, cover = ?
      WHERE id = ? AND host_id = ?`,
      [data.title, data.description, data.city, data.property_type, data.price_per_night, data.max_guests, data.bedrooms, data.bathrooms, data.cover, listingId, hostId]
    );
    if (result.affectedRows === 0) throw new HttpError(404, 'Listing not found.');

    // Replace the amenity links with the new selection.
    await tx.execute('DELETE FROM listing_amenities WHERE listing_id = ?', [listingId]);
    await insertAmenities(tx, listingId, data.amenity_ids);
  });
}

// UPDATE: pause (hide from search) or reactivate a listing.
export async function setListingActive(db: Queryable, hostId: number, listingId: number, isActive: boolean) {
  const result = await db.execute('UPDATE listings SET is_active = ? WHERE id = ? AND host_id = ?', [isActive ? 1 : 0, listingId, hostId]);
  if (result.affectedRows === 0) throw new HttpError(404, 'Listing not found.');
}

// DELETE a listing. Its amenity links and favorites disappear with it
// (ON DELETE CASCADE), but bookings reference listings WITHOUT cascade, so
// MySQL refuses to delete a listing that has booking history.
export async function deleteListing(db: Queryable, hostId: number, listingId: number) {
  let affected: number;
  try {
    affected = (await db.execute('DELETE FROM listings WHERE id = ? AND host_id = ?', [listingId, hostId])).affectedRows;
  } catch (error) {
    if (mysqlErrorCode(error) === 'ER_ROW_IS_REFERENCED_2') {
      throw new HttpError(409, 'This listing has booking history, so the database will not let it be deleted. Pause it instead to hide it from search.');
    }
    throw error;
  }
  if (affected === 0) throw new HttpError(404, 'Listing not found.');
}
