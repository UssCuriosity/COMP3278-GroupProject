// API tests:   npm test
//
// They build a separate database "<DB_NAME>_test" from db/schema.sql and
// db/seed.sql, then call the real application in-process (no network port)
// and check the responses. Your normal database is never touched.
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { setupDatabase } from '../../scripts/setup-db.js';
import type { HostDashboard, ListingPage, Meta, SearchResult, SqlLogEntry, Trip } from '../src/api-types.js';
import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';
import { createPool, type Pool } from '../src/db/pool.js';

const TEST_DATABASE = `${config.db.database}_test`;
const DEMO_PASSWORD = 'lantern123'; // the password of every seeded account (see db/seed.sql)

let app: FastifyInstance;
let pool: Pool;

type Body<T> = T & { error?: string; _sql: SqlLogEntry[] };

// A tiny browser stand-in: remembers the session cookie between calls.
function client() {
  let cookie = '';
  return async function call<T = Record<string, unknown>>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown) {
    const response = await app.inject({ method, url, payload: body as object | undefined, headers: cookie ? { cookie } : {} });
    const setCookie = response.cookies.find((c) => c.name === 'lantern_session');
    if (setCookie) cookie = setCookie.value ? `lantern_session=${setCookie.value}` : '';
    return { status: response.statusCode, body: response.json<Body<T>>() };
  };
}

async function loggedIn(name: string) {
  const call = client();
  const response = await call('POST', '/api/auth/login', { email: `${name}@example.com`, password: DEMO_PASSWORD });
  expect(response.status).toBe(200);
  return call;
}

/** today + offset days, as YYYY-MM-DD in local time (like MySQL's CURDATE()) */
function day(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const ids = (result: SearchResult) => result.listings.map((listing) => listing.id).sort((a, b) => a - b);
const search = (call: ReturnType<typeof client>, query = '') => call<SearchResult>('GET', `/api/listings?page_size=50${query ? `&${query}` : ''}`);

beforeAll(async () => {
  await setupDatabase({ database: TEST_DATABASE });
  pool = createPool({ ...config.db, database: TEST_DATABASE });
  app = await buildApp({ pool, config });
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('browsing (no login)', () => {
  const anon = client();

  test('meta lists cities and amenities, and carries the SQL log', async () => {
    const { body } = await anon<Meta>('GET', '/api/meta');
    expect(body.cities).toHaveLength(6);
    expect(body.amenities).toHaveLength(12);
    expect(body.cities[0]).toEqual({ city: 'Hong Kong', listing_count: 6, from_price: 420 });
    expect(body._sql).toHaveLength(2);
    expect(body._sql[0]?.rows).toBe(6);
  });

  test('search returns every listing, best rated first', async () => {
    const { body } = await search(anon);
    expect(body.total).toBe(21);
    expect(body.listings).toHaveLength(21);
    expect(body.listings[0]?.avg_rating).toBe(5);
    expect(body.listings.at(-1)?.avg_rating).toBeLessThanOrEqual(3.5);
  });

  test('pagination: one query returns a page and the total', async () => {
    const first = await anon<SearchResult>('GET', '/api/listings?page_size=8');
    const third = await anon<SearchResult>('GET', '/api/listings?page_size=8&page=3');
    const beyond = await anon<SearchResult>('GET', '/api/listings?page_size=8&page=9');
    expect(first.body).toMatchObject({ total: 21, page: 1, pageSize: 8 });
    expect(first.body.listings).toHaveLength(8);
    expect(third.body.listings).toHaveLength(5);
    expect(beyond.body).toMatchObject({ total: 0, listings: [] });
    expect(first.body._sql).toHaveLength(1);
    const pageIds = new Set([...first.body.listings, ...third.body.listings].map((l) => l.id));
    expect(pageIds.size).toBe(13); // pages do not overlap
  });

  test('filters: city, amenities (ALL of them), guests and price', async () => {
    expect(ids((await search(anon, 'city=Tokyo')).body)).toEqual([7, 8, 9, 10]);
    expect(ids((await search(anon, 'amenities=6')).body)).toEqual([5, 18, 20]);
    expect(ids((await search(anon, 'amenities=6,9')).body)).toEqual([5, 20]);
    const cheapBig = await search(anon, 'guests=6&max_price=1500&sort=price_asc');
    expect(cheapBig.body.listings.map((l) => l.id)).toEqual([3, 16]);
  });

  test('availability: booked listings disappear, back-to-back stays are allowed', async () => {
    const taken = await search(anon, `city=Hong%20Kong&check_in=${day(14)}&check_out=${day(17)}`);
    expect(ids(taken.body)).toEqual([1, 3, 4, 6]); // 2 and 5 are booked on those dates
    const afterCheckout = await search(anon, `city=Hong%20Kong&check_in=${day(17)}&check_out=${day(19)}`);
    expect(ids(afterCheckout.body)).toContain(5);
  });

  test('invalid input is rejected with 400', async () => {
    expect((await search(anon, `check_in=${day(5)}`)).status).toBe(400);
    expect((await search(anon, `check_in=${day(5)}&check_out=${day(5)}`)).status).toBe(400);
    expect((await search(anon, 'type=castle')).status).toBe(400);
    expect((await search(anon, 'amenities=1,abc')).status).toBe(400);
    expect((await anon('GET', '/api/listings/abc')).status).toBe(400);
  });

  test('an SQL injection attempt is treated as plain text', async () => {
    const { status, body } = await search(anon, "city=x'%20OR%20'1'='1");
    expect(status).toBe(200);
    expect(body.listings).toHaveLength(0);
  });

  test('listing page: details, amenities, reviews and booked ranges', async () => {
    const { body } = await anon<ListingPage>('GET', '/api/listings/1');
    expect(body.listing.title).toMatch(/^Harbour-view/);
    expect(body.listing.avg_rating).toBe(4.5);
    expect(body.amenities).toHaveLength(5);
    expect(body.reviews).toHaveLength(2);
    expect(body.booked).toHaveLength(2);
    expect((await anon('GET', '/api/listings/999')).status).toBe(404);
  });

  test('protected and unknown routes', async () => {
    expect((await anon('POST', '/api/bookings', { listing_id: 1, check_in: day(40), check_out: day(42), guests: 1 })).status).toBe(401);
    expect((await anon('GET', '/api/host/dashboard')).status).toBe(401);
    const unknown = await anon('GET', '/api/nope');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error).toBe('Unknown API route.');
  });
});

describe('accounts', () => {
  test('log in, session, log out', async () => {
    const call = client();
    expect((await call('POST', '/api/auth/login', { email: 'alice@example.com', password: 'wrong-password' })).status).toBe(401);
    const login = await call<{ user: { name: string } }>('POST', '/api/auth/login', { email: 'Alice@Example.com', password: DEMO_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user.name).toBe('Alice Chan');
    expect((await call<{ user: { id: number } }>('GET', '/api/auth/me')).body.user.id).toBe(1);
    await call('POST', '/api/auth/logout');
    expect((await call<{ user: null }>('GET', '/api/auth/me')).body.user).toBeNull();
    expect((await call('GET', '/api/bookings')).status).toBe(401);
  });

  test('sessions live in MySQL, so they survive a server restart', async () => {
    const call = await loggedIn('grace');
    await app.close();
    app = await buildApp({ pool, config }); // a brand-new server instance
    expect((await call<{ user: { name: string } }>('GET', '/api/auth/me')).body.user.name).toBe('Grace Lau');
  });

  test('register: validation, hidden parameters, duplicate email', async () => {
    const call = client();
    const email = `tester${Date.now()}@example.com`;
    expect((await call('POST', '/api/auth/register', { name: 'Test User', email, password: 'short' })).status).toBe(400);
    expect((await call('POST', '/api/auth/register', { name: 'Test User', email: 'not-an-email', password: DEMO_PASSWORD })).status).toBe(400);

    const created = await call<{ user: { email: string } }>('POST', '/api/auth/register', { name: 'Test User', email, password: DEMO_PASSWORD });
    expect(created.status).toBe(201);
    expect(created.body.user.email).toBe(email);
    expect(created.body._sql[0]?.params.every((p) => p === '(hidden)')).toBe(true);
    expect((await call<{ bookings: Trip[] }>('GET', '/api/bookings')).body.bookings).toHaveLength(0);

    expect((await client()('POST', '/api/auth/register', { name: 'Copy', email: email.toUpperCase(), password: DEMO_PASSWORD })).status).toBe(409);
    expect((await client()('POST', '/api/auth/login', { email, password: DEMO_PASSWORD })).status).toBe(200);
  });
});

describe('guest: trips, reviews, favourites', () => {
  let alice: ReturnType<typeof client>;
  let newBookingId: number;
  const trips = async () => (await alice<{ bookings: Trip[] }>('GET', '/api/bookings')).body.bookings;

  beforeAll(async () => {
    alice = await loggedIn('alice');
  });

  test('my trips: phases, derived total, joined review', async () => {
    const bookings = await trips();
    const byId = Object.fromEntries(bookings.map((b) => [b.id, b]));
    expect(bookings).toHaveLength(5);
    expect(byId[1]?.phase).toBe('past');
    expect(byId[3]?.phase).toBe('upcoming');
    expect(byId[4]?.phase).toBe('cancelled');
    expect(byId[3]).toMatchObject({ nights: 3, total_price: 8700 });
    expect(byId[1]?.review_rating).toBe(5);
    expect(byId[2]?.review_rating).toBeNull();
  });

  test('booking rules are enforced, and a failed booking is rolled back', async () => {
    const book = (stay: object) => alice('POST', '/api/bookings', stay);
    const clash = await book({ listing_id: 5, check_in: day(15), check_out: day(16), guests: 2 });
    expect(clash.status).toBe(409);
    expect(clash.body.error).toMatch(/no longer available/); // our own message, not the framework's
    expect(clash.body._sql[0]?.sql).toBe('START TRANSACTION');
    expect(clash.body._sql.at(-1)?.sql).toBe('ROLLBACK');

    expect((await book({ listing_id: 1, check_in: day(-2), check_out: day(1), guests: 1 })).status).toBe(400); // in the past
    expect((await book({ listing_id: 1, check_in: day(40), check_out: day(42), guests: 3 })).status).toBe(400); // too many guests
    expect((await book({ listing_id: 1, check_in: day(40), check_out: day(40), guests: 1 })).status).toBe(400); // zero nights
    expect((await book({ listing_id: 1, check_in: day(40), check_out: day(80), guests: 1 })).status).toBe(400); // too long
    expect((await book({ listing_id: 1, check_in: '2027-02-30', check_out: '2027-03-02', guests: 1 })).status).toBe(400); // not a date
    expect((await book({ listing_id: 999, check_in: day(40), check_out: day(42), guests: 1 })).status).toBe(404);
  });

  test('book a stay: one transaction (lock, check, insert, commit)', async () => {
    const created = await alice<{ booking: { id: number; nightly_price: number } }>('POST', '/api/bookings', {
      listing_id: 1,
      check_in: day(8), // the day another guest checks out
      check_out: day(10),
      guests: 2,
    });
    expect(created.status).toBe(201);
    expect(created.body.booking.nightly_price).toBe(780);
    expect(created.body._sql.map((s) => s.sql.split(/\s+/)[0])).toEqual(['START', 'SELECT', 'SELECT', 'INSERT', 'COMMIT']);
    newBookingId = created.body.booking.id;
  });

  test('change dates: clash rejected, own dates ignored, only upcoming and only mine', async () => {
    const change = (id: number, stay: object) => alice('PATCH', `/api/bookings/${id}`, stay);
    expect((await change(newBookingId, { check_in: day(9), check_out: day(21), guests: 2 })).status).toBe(409);
    expect((await change(newBookingId, { check_in: day(9), check_out: day(12), guests: 1 })).status).toBe(200);
    expect((await change(1, { check_in: day(60), check_out: day(62), guests: 1 })).status).toBe(409); // past stay
    expect((await change(8, { check_in: day(60), check_out: day(62), guests: 1 })).status).toBe(404); // not mine

    const changed = (await trips()).find((b) => b.id === newBookingId);
    expect(changed).toMatchObject({ check_in: day(9), check_out: day(12), guests: 1, total_price: 2340 });
  });

  test('cancel frees the dates; only cancelled bookings can be removed', async () => {
    expect((await alice('DELETE', `/api/bookings/${newBookingId}`)).status).toBe(409);
    expect((await alice('POST', `/api/bookings/${newBookingId}/cancel`)).status).toBe(200);
    expect((await alice('POST', `/api/bookings/${newBookingId}/cancel`)).status).toBe(409);
    expect((await alice('POST', '/api/bookings/1/cancel')).status).toBe(409); // already finished

    const free = await search(client(), `city=Hong%20Kong&check_in=${day(9)}&check_out=${day(12)}`);
    expect(ids(free.body)).toContain(1);

    expect((await alice('DELETE', `/api/bookings/${newBookingId}`)).status).toBe(200);
    expect((await alice('DELETE', `/api/bookings/${newBookingId}`)).status).toBe(409);
  });

  test('reviews: only my finished stay, once; edit and delete', async () => {
    const review = (method: 'POST' | 'PUT', id: number, body: object) => alice(method, `/api/bookings/${id}/review`, body);
    expect((await review('POST', 3, { rating: 5, comment: 'Cannot review before the stay.' })).status).toBe(409);
    expect((await review('POST', 6, { rating: 5, comment: 'Not my booking at all, sorry.' })).status).toBe(409);
    expect((await review('POST', 2, { rating: 6, comment: 'Rating out of range here.' })).status).toBe(400);
    expect((await review('POST', 2, { rating: 5, comment: 'short' })).status).toBe(400);

    expect((await review('POST', 2, { rating: 5, comment: 'A beautiful hanok, we loved the courtyard.' })).status).toBe(201);
    expect((await review('POST', 2, { rating: 4, comment: 'Trying to review the same stay twice.' })).status).toBe(409);
    expect((await review('PUT', 2, { rating: 4, comment: 'A beautiful hanok, but a little cold at night.' })).status).toBe(200);
    expect((await review('PUT', 2, { rating: 4, comment: 'A beautiful hanok, but a little cold at night.' })).status).toBe(200);

    const page = (await client()<ListingPage>('GET', '/api/listings/11')).body;
    expect(page.listing).toMatchObject({ avg_rating: 4.5, review_count: 2 }); // AVG(5, 4)
    expect(page.reviews[0]?.guest_name).toBe('Alice Chan');

    expect((await alice('DELETE', '/api/bookings/2/review')).status).toBe(200);
    expect((await alice('DELETE', '/api/bookings/2/review')).status).toBe(404);
  });

  test('favourites: save twice is harmless, newest first, shown in search', async () => {
    expect((await alice('PUT', '/api/favorites/2')).status).toBe(200);
    expect((await alice('PUT', '/api/favorites/2')).status).toBe(200);
    const saved = (await alice<{ listings: { id: number }[] }>('GET', '/api/favorites')).body.listings;
    expect(saved).toHaveLength(5);
    expect(saved[0]?.id).toBe(2);

    const hongKong = (await search(alice, 'city=Hong%20Kong')).body.listings;
    expect(hongKong.filter((l) => l.is_favorite).map((l) => l.id).sort()).toEqual([2, 3]);

    await alice('DELETE', '/api/favorites/2');
    expect((await alice<{ listings: unknown[] }>('GET', '/api/favorites')).body.listings).toHaveLength(4);
    expect((await alice('PUT', '/api/favorites/999')).status).toBe(200); // unknown listing: ignored, no crash
  });

  test("a guest cannot touch another host's listings", async () => {
    const draft = { title: 'Hacked title for listing', description: 'This should never be saved anywhere.', city: 'Hong Kong', property_type: 'room', price_per_night: 1, max_guests: 1, bedrooms: 1, bathrooms: 1, cover: 'beach-day', amenity_ids: [1] };
    expect((await alice('PUT', '/api/host/listings/1', draft)).status).toBe(404);
    expect((await alice('DELETE', '/api/host/listings/4')).status).toBe(404);
    expect((await alice('PATCH', '/api/host/listings/1/active', { is_active: false })).status).toBe(404);
  });
});

describe('host: dashboard and listing CRUD', () => {
  let ben: ReturnType<typeof client>;
  const anon = client();
  const listing = { title: 'Rooftop studio in Sheung Wan', description: 'A sunny rooftop studio with a private terrace and a view of the Peak.', city: 'Hong Kong', property_type: 'studio', price_per_night: 950.5, max_guests: 2, bedrooms: 1, bathrooms: 1, cover: 'skyline-dusk', amenity_ids: [1, 3, 10] };
  const total = async () => (await search(anon)).body.total;

  beforeAll(async () => {
    ben = await loggedIn('ben');
  });

  test('dashboard aggregates per listing; cancelled bookings do not count', async () => {
    const { body } = await ben<HostDashboard>('GET', '/api/host/dashboard');
    expect(body.listings).toHaveLength(5);
    expect(body.listings.find((l) => l.id === 1)).toMatchObject({ booking_count: 4, upcoming_count: 2, nights_booked: 12, revenue: 3 * 760 + 9 * 780, avg_rating: 4.5, review_count: 2 });
    expect(body.listings.find((l) => l.id === 3)).toMatchObject({ booking_count: 2, revenue: 6600 });
    expect(body.reservations).toHaveLength(4);
    expect(body.reservations.every((r) => r.check_out >= day(0))).toBe(true);
  });

  test('a host cannot book their own listing', async () => {
    expect((await ben('POST', '/api/bookings', { listing_id: 1, check_in: day(40), check_out: day(42), guests: 1 })).status).toBe(400);
  });

  test('create: validation, and an unknown amenity rolls the whole listing back', async () => {
    expect((await ben('POST', '/api/host/listings', { ...listing, amenity_ids: [1, 999] })).status).toBe(400);
    expect(await total()).toBe(21);
    expect((await ben('POST', '/api/host/listings', { ...listing, title: 'abc' })).status).toBe(400);
    expect((await ben('POST', '/api/host/listings', { ...listing, cover: '../../etc/passwd' })).status).toBe(400);
    expect((await ben('POST', '/api/host/listings', { ...listing, price_per_night: -5 })).status).toBe(400);
  });

  test('create, read, update, pause, reactivate, delete', async () => {
    const created = await ben<{ id: number }>('POST', '/api/host/listings', listing);
    expect(created.status).toBe(201);
    const id = created.body.id;

    let page = (await anon<ListingPage>('GET', `/api/listings/${id}`)).body;
    expect(page.listing).toMatchObject({ price_per_night: 950.5, avg_rating: null });
    expect(page.amenities.map((a) => a.id)).toEqual([1, 3, 10]);

    expect((await ben('PUT', `/api/host/listings/${id}`, { ...listing, price_per_night: 880, amenity_ids: [2, 9] })).status).toBe(200);
    page = (await anon<ListingPage>('GET', `/api/listings/${id}`)).body;
    expect(page.listing.price_per_night).toBe(880);
    expect(page.amenities.map((a) => a.id)).toEqual([2, 9]);

    await ben('PATCH', `/api/host/listings/${id}/active`, { is_active: false });
    expect(await total()).toBe(21); // hidden from search
    const alice = await loggedIn('alice');
    expect((await alice('POST', '/api/bookings', { listing_id: id, check_in: day(40), check_out: day(42), guests: 1 })).status).toBe(409);
    await ben('PATCH', `/api/host/listings/${id}/active`, { is_active: true });
    expect(await total()).toBe(22);

    await alice('PUT', `/api/favorites/${id}`); // will be removed by ON DELETE CASCADE
    expect((await ben('DELETE', `/api/host/listings/${id}`)).status).toBe(200);
    expect(await total()).toBe(21);
  });

  test('a listing with bookings cannot be deleted (foreign key RESTRICT)', async () => {
    const refused = await ben('DELETE', '/api/host/listings/1');
    expect(refused.status).toBe(409);
    expect(refused.body._sql[0]?.error).toBe('ER_ROW_IS_REFERENCED_2');
  });
});

describe('concurrency', () => {
  test('two guests racing for the same dates: exactly one booking wins', async () => {
    const emma = await loggedIn('emma');
    const farid = await loggedIn('farid');
    for (let round = 0; round < 5; round += 1) {
      const stay = { listing_id: 21, check_in: day(50 + round * 3), check_out: day(52 + round * 3), guests: 2 };
      const results = await Promise.all([emma('POST', '/api/bookings', stay), farid('POST', '/api/bookings', stay)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    }
  });
});
