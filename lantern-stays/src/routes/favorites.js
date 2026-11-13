// Saved listings: rows in the favorites table link a user to a listing (M:N).
const express = require('express');
const { requireLogin } = require('../auth');
const v = require('../validate');

const router = express.Router();
router.use(requireLogin);

// READ my saved listings, most recently saved first.
router.get('/', async (req, res) => {
  const listings = await req.db.query(
    `
    SELECT l.id, l.title, l.city, l.property_type, l.price_per_night,
           l.max_guests, l.bedrooms, l.bathrooms, l.cover,
           u.name                       AS host_name,
           lr.avg_rating,
           COALESCE(lr.review_count, 0) AS review_count,
           TRUE                         AS is_favorite
    FROM favorites f
    JOIN listings l ON l.id = f.listing_id
    JOIN users u ON u.id = l.host_id
    LEFT JOIN listing_ratings lr ON lr.listing_id = l.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC`,
    [req.session.userId]
  );
  res.json({ listings });
});

// CREATE the link. INSERT IGNORE makes saving twice harmless
// (the composite primary key already holds this pair).
router.put('/:listingId', async (req, res) => {
  const listingId = v.integer(req.params.listingId, 'Listing id', { min: 1 });
  await req.db.query('INSERT IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?)', [
    req.session.userId,
    listingId,
  ]);
  res.json({ is_favorite: true });
});

// DELETE the link.
router.delete('/:listingId', async (req, res) => {
  const listingId = v.integer(req.params.listingId, 'Listing id', { min: 1 });
  await req.db.query('DELETE FROM favorites WHERE user_id = ? AND listing_id = ?', [req.session.userId, listingId]);
  res.json({ is_favorite: false });
});

module.exports = router;
