// The only place that talks to MySQL on behalf of a request.
//
// Every statement is a prepared statement (execute): the SQL text and the
// values travel separately, so user input can never be interpreted as SQL.
//
// Each HTTP request gets its own RequestDb, which also records the statements
// it ran. The server returns that list with the response, and the SQL
// inspector in the browser shows exactly which statements were behind a click.
import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import type { SqlLogEntry } from '../api-types.js';
import type { Pool } from './pool.js';

export type { SqlLogEntry };

export type SqlParam = string | number | boolean | null | Date;

interface QueryOptions {
  hideParams?: boolean; // never send password hashes to the browser
}

export interface Queryable {
  /** Runs a SELECT and returns its rows. */
  query<Row>(sql: string, params?: SqlParam[], options?: QueryOptions): Promise<Row[]>;
  /** Runs an INSERT / UPDATE / DELETE and returns insertId and affectedRows. */
  execute(sql: string, params?: SqlParam[], options?: QueryOptions): Promise<ResultSetHeader>;
}

export interface RequestDb extends Queryable {
  log: SqlLogEntry[];
  /** Runs `work` inside one transaction: COMMIT if it returns, ROLLBACK if it throws. */
  transaction<Result>(work: (tx: Queryable) => Promise<Result>): Promise<Result>;
}

// Removes the indentation the SQL has inside the TypeScript source so it
// reads nicely in the inspector.
function tidy(sql: string): string {
  const lines = sql.replace(/\t/g, '  ').split('\n');
  while (lines.length && !lines[0]?.trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1]?.trim()) lines.pop();
  const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => line.length - line.trimStart().length));
  return lines.map((line) => line.slice(indent).trimEnd()).join('\n');
}

export function createRequestDb(pool: Pool): RequestDb {
  const log: SqlLogEntry[] = [];

  async function run(executor: Pool | PoolConnection, sql: string, params: SqlParam[], options: QueryOptions) {
    const entry: SqlLogEntry = { sql: tidy(sql), params: options.hideParams ? params.map(() => '(hidden)') : params };
    const started = process.hrtime.bigint();
    try {
      const [result] = await executor.execute(sql, params);
      if (Array.isArray(result)) entry.rows = result.length;
      else entry.affected = result.affectedRows;
      return result;
    } catch (error) {
      entry.error = (error as { code?: string }).code ?? (error as Error).message;
      throw error;
    } finally {
      entry.ms = Number(process.hrtime.bigint() - started) / 1e6;
      log.push(entry);
    }
  }

  const on = (executor: Pool | PoolConnection): Queryable => ({
    query: async <Row>(sql: string, params: SqlParam[] = [], options: QueryOptions = {}) =>
      (await run(executor, sql, params, options)) as Row[],
    execute: async (sql: string, params: SqlParam[] = [], options: QueryOptions = {}) =>
      (await run(executor, sql, params, options)) as ResultSetHeader,
  });

  return {
    log,
    ...on(pool),

    async transaction(work) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        log.push({ sql: 'START TRANSACTION', params: [] });
        const result = await work(on(connection));
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
