# Key SQL statements

The statements below are copied from the `queries.ts` files in `server/src/modules/`. Each `?` is a placeholder of a prepared statement: the value is sent to MySQL separately from the SQL text, so user input can never change the query (no SQL injection).

You can watch all of them run live in the app's **SQL inspector** (the SQL button in the bottom-left corner).

---

## 1. Search: which listings are free for my dates? (`server/src/modules/listings/queries.ts`)

```sql
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
WHERE l.is_active = TRUE
  AND l.city = ?
  AND l.max_guests >= ?
  AND NOT EXISTS (
        SELECT 1
        FROM bookings b
        WHERE b.listing_id = l.id
          AND b.status = 'confirmed'
          AND b.check_in < ?          -- requested check-out
          AND b.check_out > ?         -- requested check-in
  )
  AND (
        SELECT COUNT(*)
        FROM listing_amenities la
        WHERE la.listing_id = l.id
          AND la.amenity_id IN (?, ?)
  ) = ?                               -- number of amenities asked for
ORDER BY lr.avg_rating DESC, review_count DESC, l.id
LIMIT ? OFFSET ?
```

Points to explain:

- **Availability with `NOT EXISTS`.** A listing is kept only if no confirmed booking overlaps the requested stay. Two date ranges overlap exactly when *each one starts before the other ends*: `existing.check_in < my_check_out AND existing.check_out > my_check_in`. Because the comparison is strict, a guest can check in on the day another guest checks out.
- **"Has all selected amenities" is relational division.** We count how many of the requested amenities the listing has and require that count to equal the number requested.
- **`LEFT JOIN`** keeps listings that have no reviews yet (their rating is `NULL`) and listings the user has not saved.
- **Pagination with a window function.** `LIMIT ? OFFSET ?` returns one page (12 listings). `COUNT(*) OVER ()` is computed over all rows that match the `WHERE` clause, before `LIMIT` is applied, so every row also carries the total number of matches. One query therefore gives both the page and "21 stays, page 1 of 2"; no second `COUNT(*)` query is needed.
- **Dynamic but safe.** Each filter line is added only if the user filled it in. Only fixed SQL text is concatenated; every value is still a `?` parameter.
- The index `idx_bookings_listing_dates (listing_id, check_in, check_out)` supports the subquery.

## 2. The view behind every rating (`db/schema.sql`)

```sql
CREATE SQL SECURITY INVOKER VIEW listing_ratings AS
SELECT b.listing_id,
       ROUND(AVG(r.rating), 2) AS avg_rating,
       COUNT(*)                AS review_count
FROM reviews r
JOIN bookings b ON b.id = r.booking_id
GROUP BY b.listing_id;
```

A review belongs to a booking, and the booking belongs to a listing, so a review reaches its listing through a join. The average rating is a **derived attribute**: it is always computed from `reviews` and never stored, so it cannot go out of date. The view lets the search, the listing page, the favourites page and the host dashboard share this one definition.

## 3. Booking a stay: a transaction that prevents double booking (`server/src/modules/bookings/queries.ts`)

```sql
START TRANSACTION;

SELECT id, host_id, price_per_night, max_guests, is_active, CURDATE() AS today
FROM listings
WHERE id = ?
FOR UPDATE;                          -- (a) lock this listing row

SELECT COUNT(*) AS clashes           -- (b) is it still free?
FROM bookings
WHERE listing_id = ?
  AND status = 'confirmed'
  AND check_in < ?
  AND check_out > ?;

INSERT INTO bookings (listing_id, guest_id, check_in, check_out, guests, nightly_price)
VALUES (?, ?, ?, ?, ?, ?);           -- (c) only if clashes = 0

COMMIT;                              -- or ROLLBACK if any check failed
```

Points to explain:

- **Why a transaction?** "Check that the dates are free" and "insert the booking" must behave as one step. Without it, two guests could both pass the check and both insert: a double booking.
- **`FOR UPDATE`** locks the listing's row until `COMMIT`. A second booking request for the same listing waits at (a), then runs its own check (b) and now sees the first booking. We tested this by sending two identical requests at the same moment: exactly one succeeds, the other gets "dates no longer available".
- **Atomicity.** If any rule fails (dates taken, too many guests, own listing), the server issues `ROLLBACK` and nothing is saved.
- **`nightly_price` is a snapshot** of the price at booking time, so a later price change by the host does not change existing bookings.

## 4. My trips: a derived total and a computed status (`server/src/modules/bookings/queries.ts`)

```sql
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
ORDER BY b.check_in DESC
```

The total price is the dashed (derived) attribute in the ER diagram: `nights x nightly_price`, computed with `DATEDIFF`. The `CASE` expression turns dates into a status. `LEFT JOIN reviews` returns `NULL` for stays that have no review yet, which is how the page decides between "Write a review" and "Edit review".

## 5. Host dashboard: aggregation (`server/src/modules/host/queries.ts`)

```sql
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
ORDER BY revenue DESC, l.id
```

Points to explain:

- One row per listing (`GROUP BY l.id`) with `COUNT` and `SUM` over its bookings.
- **`LEFT JOIN` with the status test in the `ON` clause** keeps a listing that has no confirmed bookings (its counts become 0). Putting `b.status = 'confirmed'` in `WHERE` instead would remove such listings from the result.
- `COUNT(b.id)` counts only matched bookings, because `COUNT(column)` ignores `NULL`.
- `SUM(b.check_in > CURDATE())` counts upcoming stays: in MySQL a comparison evaluates to 1 or 0.

## 6. Writing a review: a conditional `INSERT ... SELECT` (`server/src/modules/bookings/queries.ts`)

```sql
INSERT INTO reviews (booking_id, rating, comment)
SELECT b.id, ?, ?
FROM bookings b
WHERE b.id = ?
  AND b.guest_id = ?              -- it is my booking
  AND b.status = 'confirmed'      -- it was not cancelled
  AND b.check_out <= CURDATE()    -- the stay has ended
```

The `SELECT` returns one row only if all three rules hold, so the statement inserts either one review or nothing (the app reports "0 rows affected" as "you can review only after your stay"). The check and the insert are a single statement, so there is no gap between them. A second review for the same stay is rejected by the `UNIQUE` key on `reviews.booking_id` (error `ER_DUP_ENTRY`), which is what makes the bookings-reviews relationship one-to-one.

Editing and deleting a review use MySQL's multi-table forms; the join proves the review belongs to the logged-in user:

```sql
UPDATE reviews r
JOIN bookings b ON b.id = r.booking_id
SET r.rating = ?, r.comment = ?
WHERE r.booking_id = ? AND b.guest_id = ?;

DELETE r
FROM reviews r
JOIN bookings b ON b.id = r.booking_id
WHERE r.booking_id = ? AND b.guest_id = ?;
```

## 7. Deleting a listing: referential integrity in action (`server/src/modules/host/queries.ts`)

```sql
DELETE FROM listings WHERE id = ? AND host_id = ?
```

What happens depends on the foreign keys declared in `db/schema.sql`:

| Child table | Foreign key rule | Effect of deleting the listing |
| --- | --- | --- |
| `listing_amenities` | `ON DELETE CASCADE` | its amenity links are deleted automatically |
| `favorites` | `ON DELETE CASCADE` | it disappears from users' saved lists |
| `bookings` | no action (`RESTRICT`) | MySQL **refuses** the delete with error 1451 `ER_ROW_IS_REFERENCED_2` |

So a listing with booking history cannot be deleted: the database itself protects guests' records, and the app turns the error into a message suggesting to pause the listing instead (`UPDATE listings SET is_active = 0`). `AND host_id = ?` ensures a host can delete only their own listings.

## 8. Other statements worth a mention

```sql
-- Cancel: the WHERE clause enforces the business rules (mine, confirmed, not started yet)
UPDATE bookings
SET status = 'cancelled'
WHERE id = ? AND guest_id = ? AND status = 'confirmed' AND check_in > CURDATE();

-- Save a favourite: the composite primary key (user_id, listing_id) makes a repeat harmless
INSERT IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?);

-- Publish a listing: listing row + amenity links in ONE transaction (all or nothing)
INSERT INTO listings (host_id, title, description, city, property_type,
                      price_per_night, max_guests, bedrooms, bathrooms, cover)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
INSERT INTO listing_amenities (listing_id, amenity_id) VALUES (?, ?), (?, ?), (?, ?);
```

## From ER diagram to tables

| ER element | Relational table |
| --- | --- |
| Entity `users`, `listings`, `amenities`, `bookings`, `reviews` | one table each |
| `hosts` (users 1:N listings, total on listings) | `listings.host_id` `NOT NULL` foreign key |
| `makes` (users 1:N bookings) | `bookings.guest_id` `NOT NULL` foreign key |
| `reserves` (listings 1:N bookings) | `bookings.listing_id` `NOT NULL` foreign key |
| `rates` (bookings 1:1 reviews, total on reviews) | `reviews.booking_id` `NOT NULL` + `UNIQUE` foreign key |
| `offers` (listings M:N amenities) | table `listing_amenities (listing_id, amenity_id)` |
| `favorites` (users M:N listings, attribute `created_at`) | table `favorites (user_id, listing_id, created_at)` |
| Derived `bookings.total`, `listings.avg_rating` | not stored; computed by SQL |
