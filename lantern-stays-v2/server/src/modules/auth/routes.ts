// Register, log in, log out.
import type { FastifyInstance } from 'fastify';
import { HttpError, parse } from '../../errors.js';
import { loginBody, registerBody } from '../../schemas.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { findUserById, findUserWithHash, insertUser } from './queries.js';

// Stricter than the global limit: slows down password guessing.
const authRateLimit = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };

export async function authRoutes(app: FastifyInstance) {
  app.get('/me', async (request) => {
    const userId = request.session.userId;
    return { user: userId ? await findUserById(request.db, userId) : null };
  });

  app.post('/register', authRateLimit, async (request, reply) => {
    const { name, email, password } = parse(registerBody, request.body);
    const user = await insertUser(request.db, name, email, await hashPassword(password));
    await request.session.regenerate(); // a fresh session id on every login
    request.session.userId = user.id;
    return reply.code(201).send({ user });
  });

  app.post('/login', authRateLimit, async (request) => {
    const { email, password } = parse(loginBody, request.body);
    const found = await findUserWithHash(request.db, email);
    if (!found || !(await verifyPassword(password, found.password_hash))) {
      throw new HttpError(401, 'Incorrect email or password.');
    }
    await request.session.regenerate();
    request.session.userId = found.id;
    return { user: { id: found.id, name: found.name, email: found.email } };
  });

  app.post('/logout', async (request) => {
    await request.session.destroy();
    return { user: null };
  });
}
