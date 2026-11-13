// Lantern Stays - Express server.
//   /api/...   JSON API (every handler talks to MySQL through req.db)
//   /          the web app in public/
const path = require('path');
const express = require('express');
const session = require('express-session');

const config = require('./src/config');
const { pool, createRequestDb } = require('./src/db');
const { HttpError } = require('./src/errors');

const app = express();
app.use(express.json());
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 },
  })
);

// Give every API request its own db helper, and attach the SQL statements it
// ran to the JSON response so the in-app SQL inspector can display them.
app.use('/api', (req, res, next) => {
  req.db = createRequestDb();
  const sendJson = res.json.bind(res);
  res.json = (body) => sendJson(config.sqlInspector ? { ...body, _sql: req.db.log } : body);
  res.set('Cache-Control', 'no-store');
  next();
});

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/bookings', require('./src/routes/bookings'));
app.use('/api/favorites', require('./src/routes/favorites'));
app.use('/api/host', require('./src/routes/host'));
app.use('/api', require('./src/routes/listings'));
app.use('/api', () => {
  throw new HttpError(404, 'Unknown API route.');
});

app.use(express.static(path.join(__dirname, 'public')));

// Central error handler: turns thrown errors into JSON responses.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  let status = 500;
  let message = 'Something went wrong on the server.';
  if (error instanceof HttpError) {
    ({ status, message } = error);
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    message = 'The request body is not valid JSON.';
  } else if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    status = 400;
    message = 'The database rejected these values (a CHECK constraint failed).';
  } else if (['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR'].includes(error.code)) {
    status = 503;
    message = 'The database is not reachable. Check the MySQL settings in .env and run "npm run db:setup".';
  }
  if (status >= 500) console.error(error);

  res.status(status).json({ error: message });
});

async function start() {
  // Fail early with a helpful message if MySQL is not set up yet.
  try {
    await pool.query('SELECT COUNT(*) FROM listings');
  } catch (error) {
    console.error(`\nCannot use the database: ${error.message}`);
    console.error('Check the MySQL settings in .env, then run:  npm run db:setup\n');
    process.exit(1);
  }
  app.listen(config.port, () => {
    console.log(`Lantern Stays is running at http://localhost:${config.port}`);
  });
}

start();
