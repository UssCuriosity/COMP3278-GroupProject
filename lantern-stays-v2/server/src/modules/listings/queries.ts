// SQL for browsing: search listings and read one listing in full (READ).
import type { Amenity, City, DateRange, ListingDetail, ListingSummary, Review } from '../../api-types.js';
import type { Queryable, SqlParam } from '../../db/request-db.js';
import type { SearchQuery } from '../../schemas.js';

const ORDER_BY: Record<SearchQuery['sort'], string> = {
  rating: 'lr.avg_rating DESC, review_count DESC, l.id',
  price_asc: 'l.price_per_night ASC, l.id',
  price_desc: 'l.price_per_night DESC, l.id',
  newest: 'l.created_at DESC, l.id',
};

export function listCities(db: Queryable) {
  return db.query<City>(`
    SELECT city,
           COUNT(*)             AS listing_count,
           MIN(price_per_night) AS from_price
    FROM listings
    WHERE is_active = TRUE
    GROUP BY city
    ORDER BY listing_count DESC, city`);
}

export function listAmenities(db: Queryable) {
  return db.query<Amenity>('SELECT id, name FROM amenities ORDER BY id');
}

// Search. Every filter is optional: the WHERE clause is assembled from the
// filters that were supplied. Only fixed SQL text is concatenated; every
// value is bound to a "?" placeholder.
export async function searchListings(db: Queryable, userId: number, q: SearchQuery) {
  const where = ['l.is_active = TRUE'];
  const params: SqlParam[] = [userId]; // for the favorites join

  if (q.city) {
    where.push('l.city = ?');
    params.push(q.city);
  }
  if (q.type) {
    where.push('l.property_type = ?');
    params.push(q.type);
  }
  if (q.guests) {
    where.push('l.max_guests >= ?');
    params.push(q.guests);
  }
  if (q.min_price !== undefined) {
    where.push('l.price_per_night >= ?');
    params.push(q.min_price);
  }
  if (q.max_price !== undefined) {
    where.push('l.price_per_night <= ?');
    params.push(q.max_price);
  }

  // Availability: keep a listing only if NO confirmed booking overlaps the
  // requested stay. Two stays overlap when each starts before the other ends.
  if (q.check_in && q.check_out) {
    where.push(`NOT EXISTS (
          SELECT 1
          FROM bookings b
          WHERE b.listing_id = l.id
            AND b.status = 'confirmed'
            AND b.check_in < ?
            AND b.check_out > ?
      )`);
    params.push(q.check_out, q.check_in);
  }

  // Amenities: the listing must offer ALL selected amenities (relational
  // division: count the matches and compare with how many were asked for).
  if (q.amenities?.length) {
    where.push(`(
          SELECT COUNT(*)
          FROM listing_amenities la
          WHERE la.listing_id = l.id
            AND la.amenity_id IN (${q.amenities.map(() => '?').join(', ')})
      ) = ?`);
    params.push(...q.amenities, q.amenities.length);
  }

  // COUNT(*) OVER () is a window function: every row also carries the total
  // number of matches, so one query returns the page AND the total.
  // (LIMIT / OFFSET values are sent as strings: prepared statements require it.)
  params.push(String(q.page_size), String((q.page - 1) * q.page_size));
  const rows = await db.query<ListingSummary & { total_count: number }>(
    `
    SELECT l.id, l.title, l.city, l.property_type, l.price_per_night,
           l.max_guests, l.bedrooms, l.bathrooms, l.cover,
           u.name                       AS host_name,
           lr.avg_rating,
           COALESCE(lr.review_count, 0) AS review_count,
           (f.user_id IS NOT NULL)      AS is_favorite,
           COUNT(*) OVER ()             AS total_count
    FROM listings l
    JOIN users u ON u.id = l.host_id
    LEFT JOIN listing_ratings lr ON lr.listing_id = l.id
    LEFT JOIN favorites f ON f.listing_id = l.id AND f.user_id = ?
    WHERE ${where.join('\n      AND ')}
    ORDER BY ${ORDER_BY[q.sort]}
    LIMIT ? OFFSET ?`,
    params
  );

  const total = rows[0]?.total_count ?? 0;
  const listings: ListingSummary[] = rows.map(({ total_count: _total, ...listing }) => listing);
  return { listings, total, page: q.page, pageSize: q.page_size };
}

export async function findListing(db: Queryable, userId: number, id: number): Promise<ListingDetail | null> {
  const [listing] = await db.query<ListingDetail>(
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
    [userId, id]
  );
  return listing ?? null;
}

export function listingAmenities(db: Queryable, listingId: number) {
  return db.query<Amenity>(
    `
    SELECT a.id, a.name
    FROM amenities a
    JOIN listing_amenities la ON la.amenity_id = a.id
    WHERE la.listing_id = ?
    ORDER BY a.id`,
    [listingId]
  );
}

// A review belongs to a booking, so we reach the listing through bookings.
export function listingReviews(db: Queryable, listingId: number) {
  return db.query<Review>(
    `
    SELECT r.id, r.rating, r.comment, r.created_at, u.name AS guest_name
    FROM reviews r
    JOIN bookings b ON b.id = r.booking_id
    JOIN users u ON u.id = b.guest_id
    WHERE b.listing_id = ?
    ORDER BY r.created_at DESC`,
    [listingId]
  );
}

export function bookedRanges(db: Queryable, listingId: number) {
  return db.query<DateRange>(
    `
    SELECT check_in, check_out
    FROM bookings
    WHERE listing_id = ?
      AND status = 'confirmed'
      AND check_out > CURDATE()
    ORDER BY check_in`,
    [listingId]
  );
}
