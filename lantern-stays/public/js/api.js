// Talks to the JSON API. Every response carries the SQL statements the server
// ran for it (_sql); they are forwarded to whoever subscribed with onSql().
const sqlListeners = new Set();
export const onSql = (listener) => sqlListeners.add(listener);

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(method, path, body) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is it still running?', 0);
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    /* not JSON: handled by the status check below */
  }

  if (Array.isArray(data._sql) && data._sql.length) {
    const call = { method, path: `/api${path}`, status: response.status, statements: data._sql };
    sqlListeners.forEach((listener) => listener(call));
  }
  if (!response.ok) throw new ApiError(data.error || `Request failed (${response.status}).`, response.status);
  return data;
}
