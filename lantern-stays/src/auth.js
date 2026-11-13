// Password hashing (Node's built-in scrypt, no native add-ons to compile)
// and the middleware that protects routes which need a logged-in user.
const crypto = require('crypto');
const { HttpError } = require('./errors');

// Stored format:  scrypt$<salt hex>$<hash hex>
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const candidate = crypto.scryptSync(password, salt, expected.length || 64);
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function requireLogin(req, res, next) {
  if (!req.session.userId) throw new HttpError(401, 'Please log in first.');
  next();
}

module.exports = { hashPassword, verifyPassword, requireLogin };
