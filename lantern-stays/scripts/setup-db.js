// Creates the database, tables and initial data:   npm run db:setup
//
// It simply executes db/schema.sql and then db/seed.sql with the MySQL account
// from .env, so it works the same on macOS, Linux and Windows. Use --reset
// to replace the existing demo data.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

const SQL_DATABASE = 'lantern_stays'; // the name used inside db/*.sql
const TABLES = ['users', 'listings', 'amenities', 'listing_amenities', 'bookings', 'reviews', 'favorites'];

async function main() {
  const { host, port, user, password, database } = config.db;
  if (!/^[A-Za-z0-9_]{1,64}$/.test(database)) throw new Error('Invalid DB_NAME.');
  const identifier = mysql.escapeId(database);
  const lockName = `lantern-setup:${database.toLowerCase()}`.slice(0, 64);
  const reset = process.argv.includes('--reset');
  console.log(`Connecting to MySQL at ${host}:${port} as "${user}" ...`);

  const connection = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  try {
    const [[lock]] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', [lockName]);
    if (lock?.acquired !== 1) throw new Error('Another database setup is running. Try again shortly.');
    const [tables] = await connection.execute(
      'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
      [database]
    );
    if (tables.some(({ name }) => name.toLowerCase() === 'sessions')) {
      throw new Error(`Database "${database}" contains v2 sessions. Choose a separate DB_NAME for Express.`);
    }
    if (tables.length && !reset) throw new Error(`Database "${database}" already contains tables. Use npm run db:setup -- --reset to replace its demo data.`);
    for (const file of ['schema.sql', 'seed.sql']) {
      const sql = fs.readFileSync(path.join(__dirname, '..', 'db', file), 'utf8')
        .replace(`CREATE DATABASE IF NOT EXISTS ${SQL_DATABASE}`, `CREATE DATABASE IF NOT EXISTS ${identifier}`)
        .replace(`USE ${SQL_DATABASE};`, `USE ${identifier};`);
      await connection.query(sql);
      console.log(`  ran db/${file}`);
    }

    console.log(`\nDatabase "${database}" is ready:`);
    for (const table of TABLES) {
      const [[row]] = await connection.query(`SELECT COUNT(*) AS n FROM ${identifier}.${table}`);
      console.log(`  ${table.padEnd(18)} ${String(row.n).padStart(3)} rows`);
    }

    console.log('\nNext step:  npm start');
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error('\nDatabase setup failed.');
  if (error.code === 'ECONNREFUSED') {
    console.error('Could not reach MySQL. Is the server running, and are DB_HOST / DB_PORT in .env correct?');
  } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('MySQL rejected the login. Check DB_USER / DB_PASSWORD in .env.');
  } else {
    console.error(error.message);
  }
  process.exit(1);
});
