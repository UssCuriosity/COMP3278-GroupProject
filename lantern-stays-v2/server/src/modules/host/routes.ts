// Hosting endpoints (login required).
import type { FastifyInstance } from 'fastify';
import type { HostDashboard } from '../../api-types.js';
import { parse } from '../../errors.js';
import { activeBody, idParams, listingBody } from '../../schemas.js';
import { createListing, deleteListing, hostListings, hostReservations, setListingActive, updateListing } from './queries.js';

export async function hostRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.requireLogin);

  app.get('/dashboard', async (request): Promise<HostDashboard> => ({
    listings: await hostListings(request.db, request.userId),
    reservations: await hostReservations(request.db, request.userId),
  }));

  app.post('/listings', async (request, reply) => {
    const id = await createListing(request.db, request.userId, parse(listingBody, request.body));
    return reply.code(201).send({ id });
  });

  app.put('/listings/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    await updateListing(request.db, request.userId, id, parse(listingBody, request.body));
    return { id };
  });

  app.patch('/listings/:id/active', async (request) => {
    const { id } = parse(idParams, request.params);
    const { is_active } = parse(activeBody, request.body);
    await setListingActive(request.db, request.userId, id, is_active);
    return { is_active };
  });

  app.delete('/listings/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    await deleteListing(request.db, request.userId, id);
    return { ok: true };
  });
}
