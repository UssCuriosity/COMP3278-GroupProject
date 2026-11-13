// Creates the database, tables and initial data:   npm run db:setup
//
// It executes db/schema.sql and then db/seed.sql with the MySQL account from
// .env, so it works the same on macOS, Linux and Windows. Running it again
// resets the database to its initial state.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../server/src/config.js';

const SQL_DATABASE = 'lantern_stays'; // the name written inside db/*.sql
const TABLES = ['users', 'listings', 'amenities', 'listing_amenities', 'bookings', 'reviews', 'favorites'];
const DB_DIR = path.resolve(import.meta.dirname, '../db');

/** Runs both SQL files. `database` lets the tests build a separate copy. */
export async function setupDatabase({ database = config.db.database, log = (_line: string) => {} } = {}) {
  const { host, port, user, password } = config.db;
  log(`Connecting to MySQL at ${host}:${port} as "${user}" ...`);

  const connection = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  try {
    for (const file of ['schema.sql', 'seed.sql']) {
      let sql = await readFile(path.join(DB_DIR, file), 'utf8');
      // The files name the database "lantern_stays"; honour DB_NAME if it differs.
      if (database !== SQL_DATABASE) {
        sql = sql
          .replace(`CREATE DATABASE IF NOT EXISTS ${SQL_DATABASE}`, `CREATE DATABASE IF NOT EXISTS ${database}`)
          .replace(`USE ${SQL_DATABASE};`, `USE ${database};`);
      }
      await connection.query(sql);
      log(`  ran db/${file}`);
    }

    log(`\nDatabase "${database}" is ready:`);
    for (const table of TABLES) {
      const [rows] = await connection.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${database}.${table}`);
      log(`  ${table.padEnd(18)} ${String(rows[0]?.n).padStart(3)} rows`);
    }
  } finally {
    await connection.end();
  }
}

// Run only when started directly (npm run db:setup), not when imported by the tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await setupDatabase({ log: console.log });
    console.log('\nNext step:  npm start');
  } catch (error) {
    const code = (error as { code?: string }).code;
    console.error('\nDatabase setup failed.');
    if (code === 'ECONNREFUSED') console.error('Could not reach MySQL. Is the server running, and are DB_HOST / DB_PORT in .env correct?');
    else if (code === 'ER_ACCESS_DENIED_ERROR') console.error('MySQL rejected the login. Check DB_USER / DB_PASSWORD in .env.');
    else console.error((error as Error).message);
    process.exit(1);
  }
}
