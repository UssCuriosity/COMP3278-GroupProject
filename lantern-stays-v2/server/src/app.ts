// Builds the Fastify application: security headers, sessions, the JSON API
// under /api and the built React app for every other URL.
// Kept separate from main.ts so the tests can build the same app without
// opening a network port.
import { existsSync } from 'node:fs';
import path from 'node:path';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import session from '@fastify/session';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest } from 'fastify';
import type { Config } from './config.js';
import type { Pool } from './db/pool.js';
import { createRequestDb, type RequestDb } from './db/request-db.js';
import { createSessionStore } from './db/session-store.js';
import { HttpError, mysqlErrorCode } from './errors.js';
import { authRoutes } from './modules/auth/routes.js';
import { bookingRoutes } from './modules/bookings/routes.js';
import { favoriteRoutes } from './modules/favorites/routes.js';
import { hostRoutes } from './modules/host/routes.js';
import { listingRoutes } from './modules/listings/routes.js';

declare module 'fastify' {
  interface FastifyRequest {
    db: RequestDb; // per-request database helper (records the SQL it runs)
    userId: number; // set by requireLogin
  }
  interface FastifyInstance {
    requireLogin(request: FastifyRequest): Promise<void>;
  }
  interface Session {
    userId?: number;
  }
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DATABASE_DOWN = new Set(['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'PROTOCOL_CONNECTION_LOST']);

export async function buildApp({ pool, config }: { pool: Pool; config: Config }): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.isTest ? false : { level: 'warn' } });
  const sessionStore = createSessionStore(pool);

  // ---- security -------------------------------------------------------------
  await app.register(helmet, {
    hsts: false, // the app is served over plain http on localhost
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:'],
        'upgrade-insecure-requests': null,
      },
    },
  });
  await app.register(rateLimit, { max: config.isTest ? 1_000_000 : 600, timeWindow: '1 minute' });

  // ---- login sessions (signed cookie + row in the MySQL "sessions" table) ----
  await app.register(cookie);
  await app.register(session, {
    secret: config.sessionSecret,
    cookieName: 'lantern_session',
    store: sessionStore,
    saveUninitialized: false, // no session row for anonymous visitors
    cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: ONE_WEEK_MS },
  });

  app.decorateRequest('db', null as unknown as RequestDb);
  app.decorateRequest('userId', 0);
  app.decorate('requireLogin', async (request: FastifyRequest) => {
    const userId = request.session.userId;
    if (!userId) throw new HttpError(401, 'Please log in first.');
    request.userId = userId;
  });

  // ---- JSON API -------------------------------------------------------------
  await app.register(
    async (api) => {
      const withSql = (request: FastifyRequest, body: object) => (config.sqlInspector ? { ...body, _sql: request.db.log } : body);

      api.addHook('onRequest', async (request, reply) => {
        request.db = createRequestDb(pool);
        reply.header('Cache-Control', 'no-store');
      });

      // Attach the SQL statements this request ran, for the in-app SQL inspector.
      api.addHook('preSerialization', async (request, _reply, payload) =>
        payload && typeof payload === 'object' && !('_sql' in payload) ? withSql(request, payload) : payload
      );

      api.setNotFoundHandler(() => {
        throw new HttpError(404, 'Unknown API route.');
      });

      // Turns every thrown error into a JSON response with a suitable status.
      api.setErrorHandler((error: FastifyError | HttpError | Error, request, reply) => {
        const code = mysqlErrorCode(error);
        let status = 500;
        let message = 'Something went wrong on the server.';

        if (error instanceof HttpError) {
          ({ status, message } = error);
        } else if (code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
          status = 400;
          message = 'The database rejected these values (a CHECK constraint failed).';
        } else if (code && DATABASE_DOWN.has(code)) {
          status = 503;
          message = 'The database is not reachable. Check the MySQL settings in .env and run "npm run db:setup".';
        } else if ('statusCode' in error && typeof error.statusCode === 'number' && error.statusCode < 500) {
          status = error.statusCode; // e.g. malformed JSON body (400) or rate limit (429)
          message = status === 429 ? 'Too many requests. Please wait a minute and try again.' : error.message;
        }
        if (status >= 500) request.log.error(error);

        return reply.code(status).send(withSql(request, { error: message }));
      });

      // Routes are registered after the handlers above so that they inherit them.
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(bookingRoutes, { prefix: '/bookings' });
      await api.register(favoriteRoutes, { prefix: '/favorites' });
      await api.register(hostRoutes, { prefix: '/host' });
      await api.register(listingRoutes);
    },
    { prefix: '/api' }
  );

  // ---- the React app --------------------------------------------------------
  // After "npm run build" the compiled front end lives in dist/web.
  const here = import.meta.dirname;
  const webRoot = [path.resolve(here, '../web'), path.resolve(here, '../../dist/web')].find((dir) => existsSync(path.join(dir, 'index.html')));

  if (webRoot) {
    await app.register(fastifyStatic, {
      root: webRoot,
      cacheControl: false,
      setHeaders(reply, filePath) {
        // Vite gives built files content-hashed names, so they can be cached forever.
        const hashed = filePath.includes(`${path.sep}assets${path.sep}`);
        reply.header('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    });
    // Client-side routes such as /trips are handled by React: serve the app shell.
    app.setNotFoundHandler((request, reply) => {
      const pathname = request.url.split('?')[0] ?? '';
      if (pathname.startsWith('/api/')) return reply.code(404).send({ error: 'Unknown API route.' });
      if (request.method === 'GET' && !path.extname(pathname)) {
        return reply.header('Cache-Control', 'no-cache').sendFile('index.html');
      }
      return reply.code(404).send({ error: 'Not found.' });
    });
  }

  // Forget expired sessions now and once an hour.
  const cleanup = setInterval(() => void sessionStore.removeExpired().catch(() => {}), 60 * 60 * 1000);
  cleanup.unref();
  app.addHook('onClose', async () => clearInterval(cleanup));
  await sessionStore.removeExpired().catch(() => {});

  return app;
}
