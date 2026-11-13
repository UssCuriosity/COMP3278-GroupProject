// Reads settings from the .env file (see .env.example) with sensible defaults.
require('dotenv').config({ quiet: true });

module.exports = {
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lantern_stays',
  },
  sessionSecret: process.env.SESSION_SECRET || 'lantern-stays-local-dev-secret',
  sqlInspector: (process.env.SQL_INSPECTOR || 'true').toLowerCase() !== 'false',
};
