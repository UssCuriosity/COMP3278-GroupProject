// Saved listings: rows in the favorites table link a user to a listing (M:N).
import type { FastifyInstance } from 'fastify';
import type { ListingSummary } from '../../api-types.js';
import { parse } from '../../errors.js';
import { idParams } from '../../schemas.js';

export async function favoriteRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireLogin);

  // READ my saved listings, most recently saved first.
  app.get('/', async (request) => ({
    listings: await request.db.query<ListingSummary>(
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
      [request.userId]
    ),
  }));

  // CREATE the link. INSERT IGNORE makes saving twice harmless
  // (the composite primary key already holds this pair).
  app.put('/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    await request.db.execute('INSERT IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?)', [request.userId, id]);
    return { is_favorite: true };
  });

  // DELETE the link.
  app.delete('/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    await request.db.execute('DELETE FROM favorites WHERE user_id = ? AND listing_id = ?', [request.userId, id]);
    return { is_favorite: false };
  });
}
