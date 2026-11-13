// Stores login sessions in the MySQL table `sessions`, so users stay logged in
// across server restarts (the default in-memory store forgets everyone).
import type { SessionStore } from '@fastify/session';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Pool } from './pool.js';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Session = Parameters<SessionStore['set']>[1];
type Done = (error?: Error | null) => void;

const expiryOf = (session: Session) => (session.cookie.expires ? new Date(session.cookie.expires) : new Date(Date.now() + ONE_WEEK_MS));

export function createSessionStore(pool: Pool): SessionStore & { removeExpired(): Promise<void> } {
  return {
    // A brand-new session (first save after logging in).
    set(sessionId, session, callback) {
      pool
        .execute('REPLACE INTO sessions (id, data, expires_at) VALUES (?, ?, ?)', [sessionId, JSON.stringify(session), expiryOf(session)])
        .then(() => callback(), callback as Done);
    },

    get(sessionId, callback) {
      pool.execute<RowDataPacket[]>('SELECT data FROM sessions WHERE id = ? AND expires_at > NOW()', [sessionId]).then(([rows]) => {
        const data = rows[0]?.data as unknown;
        // mysql2 already parses JSON columns; be tolerant if a driver hands back text.
        callback(null, (typeof data === 'string' ? JSON.parse(data) : (data ?? null)) as Session);
      }, callback as Done);
    },

    // Update an existing session, but only if it is still the same "generation".
    // The single UPDATE is atomic, so a request that is still running cannot
    // bring back a session that was destroyed (logout) or regenerated (login).
    compareAndSet(sessionId, expectedGeneration, session, callback) {
      pool
        .execute<ResultSetHeader>(
          `UPDATE sessions
           SET data = ?, expires_at = ?
           WHERE id = ?
             AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(data, '$.__fastifySessionMetadata.generation')), id) = ?`,
          [JSON.stringify(session), expiryOf(session), sessionId, expectedGeneration]
        )
        .then(([result]) => {
          if (result.affectedRows > 0) return callback();
          callback(Object.assign(new Error('The session does not exist or has changed'), { code: 'ENOENT' }));
        }, callback as Done);
    },

    destroy(sessionId, callback) {
      pool.execute('DELETE FROM sessions WHERE id = ?', [sessionId]).then(() => callback(), callback as Done);
    },

    async removeExpired() {
      await pool.execute('DELETE FROM sessions WHERE expires_at <= NOW()');
    },
  };
}
