// Entry point: connect to MySQL, start the web server, shut down cleanly.
import { buildApp } from './app.js';
import { config } from './config.js';
import { createPool } from './db/pool.js';

const pool = createPool(config.db);

// Fail early with a helpful message if MySQL is not set up yet.
try {
  await pool.query('SELECT COUNT(*) FROM listings');
  await pool.query('SELECT COUNT(*) FROM sessions');
} catch (error) {
  console.error(`\nCannot use the database: ${(error as Error).message}`);
  console.error('Check the MySQL settings in .env, then run:  npm run db:setup\n');
  process.exit(1);
}

const app = await buildApp({ pool, config });

try {
  await app.listen({ port: config.port, host: 'localhost' });
} catch (error) {
  console.error(`\nCannot start the web server: ${(error as Error).message}`);
  console.error('If the port is already in use, change PORT in .env.\n');
  process.exit(1);
}
console.log(`Lantern Stays is running at http://localhost:${config.port}`);

// Ctrl + C: stop accepting requests, let running ones finish, close MySQL connections.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
