// Talks to the JSON API. Every response carries the SQL statements the server
// ran for it (_sql); they are collected here for the SQL inspector.
import type { SqlLogEntry } from '../../server/src/api-types';

export type * from '../../server/src/api-types';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export interface SqlCall {
  key: number;
  method: string;
  path: string;
  status: number;
  time: string;
  statements: SqlLogEntry[];
}

// ---- a small external store for the SQL inspector (see useSyncExternalStore) --
const MAX_CALLS = 40;
let calls: SqlCall[] = [];
let total = 0;
let nextKey = 1;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export const sqlLog = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  getCalls: () => calls,
  getTotal: () => total,
  clear() {
    calls = [];
    total = 0;
    notify();
  },
};

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is it still running?', 0);
  }

  let data: { error?: string; _sql?: SqlLogEntry[] } = {};
  try {
    data = await response.json();
  } catch {
    /* not JSON: handled by the status check below */
  }

  if (data._sql?.length) {
    const call: SqlCall = { key: nextKey++, method, path: `/api${path}`, status: response.status, time: new Date().toLocaleTimeString('en-GB'), statements: data._sql };
    calls = [call, ...calls].slice(0, MAX_CALLS);
    total += data._sql.length;
    notify();
  }
  if (!response.ok) throw new ApiError(data.error ?? `Request failed (${response.status}).`, response.status);
  return data as T;
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.');
