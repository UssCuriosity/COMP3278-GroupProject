// Trip and review endpoints (login required).
import type { FastifyInstance } from 'fastify';
import { parse } from '../../errors.js';
import { changeBookingBody, createBookingBody, idParams, reviewBody } from '../../schemas.js';
import { cancelBooking, changeBooking, createBooking, createReview, deleteReview, listTrips, removeBooking, updateReview } from './queries.js';

export async function bookingRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireLogin);

  app.post('/', async (request, reply) => {
    const input = parse(createBookingBody, request.body);
    const booking = await createBooking(request.db, request.userId, input);
    return reply.code(201).send({ booking });
  });

  app.get('/', async (request) => ({ bookings: await listTrips(request.db, request.userId) }));

  app.patch('/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    await changeBooking(request.db, request.userId, id, parse(changeBookingBody, request.body));
    return { ok: true };
  });

  app.post('/:id/cancel', async (request) => {
    const { id } = parse(idParams, request.params);
    await cancelBooking(request.db, request.userId, id);
    return { ok: true };
  });

  app.delete('/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    await removeBooking(request.db, request.userId, id);
    return { ok: true };
  });

  // ---- reviews (one per booking) -------------------------------------------
  app.post('/:id/review', async (request, reply) => {
    const { id } = parse(idParams, request.params);
    await createReview(request.db, request.userId, id, parse(reviewBody, request.body));
    return reply.code(201).send({ ok: true });
  });

  app.put('/:id/review', async (request) => {
    const { id } = parse(idParams, request.params);
    await updateReview(request.db, request.userId, id, parse(reviewBody, request.body));
    return { ok: true };
  });

  app.delete('/:id/review', async (request) => {
    const { id } = parse(idParams, request.params);
    await deleteReview(request.db, request.userId, id);
    return { ok: true };
  });
}
