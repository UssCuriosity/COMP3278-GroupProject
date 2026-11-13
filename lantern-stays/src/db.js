// MySQL access layer.
//
// Every SQL statement in the app goes through db.query(), which uses a
// prepared statement (pool.execute): the SQL text and the values travel
// separately, so user input can never be interpreted as SQL.
//
// Each HTTP request gets its own small "db" object that also records the
// statements it ran. The server returns that list to the browser, where the
// SQL inspector shows exactly which statements were behind each click.
const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // DATE / DATETIME come back as plain strings, no time-zone shifting
  decimalNumbers: true, // DECIMAL comes back as a JavaScript number
});

// Remove the indentation the SQL has inside the JavaScript source so it reads
// nicely in the inspector.
function tidy(sql) {
  const lines = sql.replace(/\t/g, '  ').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(indent).trimEnd()).join('\n');
}

function createRequestDb() {
  const log = [];

  async function run(executor, sql, params = [], options = {}) {
    const entry = {
      sql: tidy(sql),
      // Never send password hashes to the browser.
      params: options.hideParams ? params.map(() => '(hidden)') : params,
    };
    const started = process.hrtime.bigint();
    try {
      const [result] = await executor.execute(sql, params);
      if (Array.isArray(result)) entry.rows = result.length;
      else entry.affected = result.affectedRows;
      return result;
    } catch (error) {
      entry.error = error.code || error.message;
      throw error;
    } finally {
      entry.ms = Number(process.hrtime.bigint() - started) / 1e6;
      log.push(entry);
    }
  }

  return {
    log,

    // Run one statement on any free connection.
    query: (sql, params, options) => run(pool, sql, params, options),

    // Run several statements as one atomic unit on a single connection.
    // If `work` throws, everything it did is rolled back.
    async transaction(work) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        log.push({ sql: 'START TRANSACTION', params: [] });
        const result = await work({
          query: (sql, params, options) => run(connection, sql, params, options),
        });
        await connection.commit();
        log.push({ sql: 'COMMIT', params: [] });
        return result;
      } catch (error) {
        await connection.rollback();
        log.push({ sql: 'ROLLBACK', params: [] });
        throw error;
      } finally {
        connection.release();
      }
    },
  };
}

module.exports = { pool, createRequestDb };
