// Browsing endpoints (no login needed).
import type { FastifyInstance } from 'fastify';
import type { ListingPage, Meta, SearchResult } from '../../api-types.js';
import { HttpError, parse } from '../../errors.js';
import { COVERS, PROPERTY_TYPES, idParams, searchQuery } from '../../schemas.js';
import { bookedRanges, findListing, listAmenities, listCities, listingAmenities, listingReviews, searchListings } from './queries.js';

export async function listingRoutes(app: FastifyInstance) {
  // Choices for the search form and the listing form.
  app.get('/meta', async (request): Promise<Meta> => ({
    cities: await listCities(request.db),
    amenities: await listAmenities(request.db),
    propertyTypes: [...PROPERTY_TYPES],
    covers: COVERS,
  }));

  app.get('/listings', async (request): Promise<SearchResult> => {
    const query = parse(searchQuery, request.query);
    return searchListings(request.db, request.session.userId ?? 0, query);
  });

  app.get('/listings/:id', async (request): Promise<ListingPage> => {
    const { id } = parse(idParams, request.params);
    const listing = await findListing(request.db, request.session.userId ?? 0, id);
    if (!listing) throw new HttpError(404, 'This listing does not exist.');
    return {
      listing,
      amenities: await listingAmenities(request.db, id),
      reviews: await listingReviews(request.db, id),
      booked: await bookedRanges(request.db, id),
    };
  });
}
