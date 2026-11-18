// Shared client state (who is logged in, form choices) and navigation helpers.
import { api, resetSqlSession } from './api.js';

export const state = { user: null, meta: null };

const userListeners = new Set();
export const onUserChange = (listener) => userListeners.add(listener);

export function setUser(user) {
  resetSqlSession();
  state.user = user;
  userListeners.forEach((listener) => listener(user));
}

export async function loadSession() {
  state.user = (await api('GET', '/auth/me')).user;
}

// Cities, amenities, property types and covers for the forms.
export async function loadMeta({ fresh = false } = {}) {
  if (!state.meta || fresh) state.meta = await api('GET', '/meta');
  return state.meta;
}

// ---- navigation (hash routes such as #/listing/5?check_in=2026-12-01) ------
let rerender = () => {};
export const setRenderer = (fn) => (rerender = fn);
export const refresh = () => rerender();

export function toHash(path, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return `#${path}${qs ? `?${qs}` : ''}`;
}

export function navigate(path, query) {
  const hash = toHash(path, query);
  if (location.hash === hash) rerender();
  else location.hash = hash;
}
