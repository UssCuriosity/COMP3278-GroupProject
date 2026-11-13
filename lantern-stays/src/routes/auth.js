// Register, log in, log out.
const express = require('express');
const { HttpError } = require('../errors');
const { hashPassword, verifyPassword } = require('../auth');
const v = require('../validate');

const router = express.Router();

// Start a fresh session for the user (a new session id on every login).
function signIn(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.userId = userId;
      resolve();
    });
  });
}

router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const [user] = await req.db.query('SELECT id, name, email FROM users WHERE id = ?', [req.session.userId]);
  res.json({ user: user || null });
});

// CREATE a user
router.post('/register', async (req, res) => {
  const name = v.text(req.body.name, 'Name', { max: 100 });
  const email = v.text(req.body.email, 'Email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Please enter a valid email address.');
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');

  let result;
  try {
    result = await req.db.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hashPassword(password)],
      { hideParams: true }
    );
  } catch (error) {
    // The UNIQUE key on users.email rejects a second account with the same email.
    if (error.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'An account with this email already exists.');
    throw error;
  }

  await signIn(req, result.insertId);
  res.status(201).json({ user: { id: result.insertId, name, email } });
});

router.post('/login', async (req, res) => {
  const email = v.text(req.body.email, 'Email', { max: 254 }).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const [user] = await req.db.query('SELECT id, name, email, password_hash FROM users WHERE email = ?', [email]);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new HttpError(401, 'Incorrect email or password.');
  }

  await signIn(req, user.id);
  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    res.json({ user: null });
  });
});

module.exports = router;
