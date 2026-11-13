import mysql from 'mysql2/promise';
import type { Config } from '../config.js';

export type Pool = mysql.Pool;

export function createPool(db: Config['db']): Pool {
  return mysql.createPool({
    ...db,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true, // DATE / DATETIME come back as plain strings, no time-zone shifting
    decimalNumbers: true, // DECIMAL comes back as a JavaScript number
  });
}
