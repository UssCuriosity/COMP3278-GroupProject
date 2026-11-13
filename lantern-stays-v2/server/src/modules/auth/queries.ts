// SQL for accounts.
import type { User } from '../../api-types.js';
import type { Queryable } from '../../db/request-db.js';
import { HttpError, mysqlErrorCode } from '../../errors.js';

export async function findUserById(db: Queryable, id: number): Promise<User | null> {
  const [user] = await db.query<User>('SELECT id, name, email FROM users WHERE id = ?', [id]);
  return user ?? null;
}

export async function findUserWithHash(db: Queryable, email: string) {
  const [user] = await db.query<User & { password_hash: string }>('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
  return user ?? null;
}

// CREATE a user. The UNIQUE key on users.email rejects a second account with the same email.
export async function insertUser(db: Queryable, name: string, email: string, passwordHash: string): Promise<User> {
  try {
    const result = await db.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, passwordHash], { hideParams: true });
    return { id: result.insertId, name, email };
  } catch (error) {
    if (mysqlErrorCode(error) === 'ER_DUP_ENTRY') throw new HttpError(409, 'An account with this email already exists.');
    throw error;
  }
}
