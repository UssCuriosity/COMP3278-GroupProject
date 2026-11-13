// Small input validators. Each one returns the cleaned value or throws a
// 400 error with a message the user can understand.
const { HttpError } = require('./errors');

function text(value, label, { min = 1, max = 255 } = {}) {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  if (cleaned.length < min) {
    throw new HttpError(400, min > 1 ? `${label} must be at least ${min} characters.` : `${label} is required.`);
  }
  if (cleaned.length > max) throw new HttpError(400, `${label} must be at most ${max} characters.`);
  return cleaned;
}

function integer(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const number = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isInteger(number)) {
    throw new HttpError(400, `${label} must be a whole number.`);
  }
  if (number < min || number > max) throw new HttpError(400, `${label} must be between ${min} and ${max}.`);
  return number;
}

function money(value, label, { min = 0, max = 99999 } = {}) {
  const number = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(number)) {
    throw new HttpError(400, `${label} must be a number.`);
  }
  if (number < min || number > max) throw new HttpError(400, `${label} must be between ${min} and ${max}.`);
  return Math.round(number * 100) / 100;
}

// Accepts only real calendar dates written as YYYY-MM-DD.
function isoDate(value, label) {
  const ok = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = ok ? new Date(`${value}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, `${label} must be a valid date.`);
  }
  return value;
}

function oneOf(value, label, allowed) {
  if (!allowed.includes(value)) throw new HttpError(400, `${label} is not a valid choice.`);
  return value;
}

// Whole nights between two YYYY-MM-DD strings.
function nightsBetween(checkIn, checkOut) {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86400000);
}

module.exports = { text, integer, money, isoDate, oneOf, nightsBetween };
