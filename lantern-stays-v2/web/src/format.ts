// Dates are handled as plain YYYY-MM-DD strings, exactly as MySQL returns them.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parts = (iso: string) => iso.slice(0, 10).split('-').map(Number) as [number, number, number];

export const todayISO = () => toISO(new Date());

export function addDays(iso: string, days: number) {
  const [y, m, d] = parts(iso);
  return toISO(new Date(y, m - 1, d + days));
}

export function nightsBetween(checkIn: string, checkOut: string) {
  const [y1, m1, d1] = parts(checkIn);
  const [y2, m2, d2] = parts(checkOut);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

export function formatDate(iso: string) {
  const [y, m, d] = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatRange(checkIn: string, checkOut: string) {
  const [y1, m1, d1] = parts(checkIn);
  const [y2, m2] = parts(checkOut);
  if (y1 === y2 && m1 === m2) return `${d1} – ${formatDate(checkOut)}`;
  if (y1 === y2) return `${d1} ${MONTHS[m1 - 1]} – ${formatDate(checkOut)}`;
  return `${formatDate(checkIn)} – ${formatDate(checkOut)}`;
}

export const money = (amount: number) => `HK$${Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
export const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
export const coverUrl = (cover: string) => `/img/covers/${encodeURIComponent(cover)}.svg`;
