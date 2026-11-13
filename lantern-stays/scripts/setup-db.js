// Creates the database, tables and initial data:   npm run db:setup
//
// It simply executes db/schema.sql and then db/seed.sql with the MySQL account
// from .env, so it works the same on macOS, Linux and Windows. Running it
// again resets the database to its initial state.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

const SQL_DATABASE = 'lantern_stays'; // the name used inside db/*.sql
const TABLES = ['users', 'listings', 'amenities', 'listing_amenities', 'bookings', 'reviews', 'favorites'];

async function main() {
  const { host, port, user, password, database } = config.db;
  console.log(`Connecting to MySQL at ${host}:${port} as "${user}" ...`);

  const connection = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  try {
    for (const file of ['schema.sql', 'seed.sql']) {
      const sql = fs.readFileSync(path.join(__dirname, '..', 'db', file), 'utf8');
      await connection.query(sql);
      console.log(`  ran db/${file}`);
    }

    console.log(`\nDatabase "${SQL_DATABASE}" is ready:`);
    for (const table of TABLES) {
      const [[row]] = await connection.query(`SELECT COUNT(*) AS n FROM ${SQL_DATABASE}.${table}`);
      console.log(`  ${table.padEnd(18)} ${String(row.n).padStart(3)} rows`);
    }

    if (database !== SQL_DATABASE) {
      console.warn(`\nWarning: DB_NAME in .env is "${database}", but the SQL files create "${SQL_DATABASE}".`);
      console.warn(`Set DB_NAME=${SQL_DATABASE} in .env so the app reads the database that was just created.`);
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
