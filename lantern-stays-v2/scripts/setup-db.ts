// Creates the database, tables and initial data:   npm run db:setup
//
// It executes db/schema.sql and then db/seed.sql with the MySQL account from
// .env, so it works the same on macOS, Linux and Windows. Use --reset
// to replace the existing demo data.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../server/src/config.js';

const SQL_DATABASE = 'lantern_stays_v2'; // the name written inside db/*.sql
const TABLES = ['users', 'listings', 'amenities', 'listing_amenities', 'bookings', 'reviews', 'favorites'];
const DB_DIR = path.resolve(import.meta.dirname, '../db');

/** Runs both SQL files. `database` lets the tests build a separate copy. */
export async function setupDatabase({ database = config.db.database, reset = false, log = (_line: string) => {} } = {}) {
  if (!/^[A-Za-z0-9_]{1,64}$/.test(database)) throw new Error('Invalid database name.');
  const identifier = mysql.escapeId(database);
  const lockName = `lantern-setup:${database.toLowerCase()}`.slice(0, 64);
  const { host, port, user, password } = config.db;
  log(`Connecting to MySQL at ${host}:${port} as "${user}" ...`);

  const connection = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  try {
    const [[lock]] = await connection.execute<mysql.RowDataPacket[]>('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    if (lock?.acquired !== 1) throw new Error('Another database setup is running. Try again shortly.');
    const [tables] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
      [database]
    );
    if (tables.length && !reset) throw new Error(`Database "${database}" already contains tables. Use npm run db:setup -- --reset to replace its demo data.`);
    const tableNames = new Set(tables.map(({ name }) => String(name).toLowerCase()));
    if (tableNames.has('listing_ratings') && !tableNames.has('sessions')) {
      throw new Error(`Database "${database}" has the Express schema. Choose a separate DB_NAME for v2.`);
    }
    for (const file of ['schema.sql', 'seed.sql']) {
      const sql = (await readFile(path.join(DB_DIR, file), 'utf8'))
        .replace(`CREATE DATABASE IF NOT EXISTS ${SQL_DATABASE}`, `CREATE DATABASE IF NOT EXISTS ${identifier}`)
        .replace(`USE ${SQL_DATABASE};`, `USE ${identifier};`);
      await connection.query(sql);
      log(`  ran db/${file}`);
    }

    log(`\nDatabase "${database}" is ready:`);
    for (const table of TABLES) {
      const [rows] = await connection.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${identifier}.${table}`);
      log(`  ${table.padEnd(18)} ${String(rows[0]?.n).padStart(3)} rows`);
    }
  } finally {
    await connection.end();
  }
}

// Run only when started directly (npm run db:setup), not when imported by the tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await setupDatabase({ reset: process.argv.includes('--reset'), log: console.log });
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
