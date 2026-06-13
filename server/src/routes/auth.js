const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const { createUser, verifyPassword, findByEmail } = require('../db/users');
const { generateUserToken, requireUser } = require('../middleware/auth');
const { findById } = require('../db/users');

const router = express.Router();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const client = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Signup
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const result = await createUser(email, password);
  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  const token = generateUserToken(result.id);
  res.json({ token, user: { id: result.id, email: result.email } });
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await verifyPassword(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateUserToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email } });
});

// Get current user
router.get('/me', requireUser, (req, res) => {
  const user = findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ id: user.id, email: user.email });
});

// Google OAuth
router.post('/google', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  if (!client) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name;

    let user = findByEmail(email);

    if (!user) {
      const result = await createUser(email, `google_${payload.sub}`);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      user = { id: result.id, email: result.email };
    }

    const jwtToken = generateUserToken(user.id);
    res.json({ token: jwtToken, user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Google OAuth error:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
