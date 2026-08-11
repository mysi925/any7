'use strict';

require('dotenv').config();

const express       = require('express');
const path          = require('path');
const checkoutRoute = require('./api/checkout');
const webhookRoute  = require('./api/webhook');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

// Parse JSON for all routes EXCEPT /api/webhook
// (webhook needs raw body for signature verification)
app.use((req, res, next) => {
  if (req.path === '/api/webhook') return next();
  express.json()(req, res, next);
});

// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api', checkoutRoute);
app.use('/api', webhookRoute);

// ─── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — serve index.html for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`WinOnAny server running on port ${PORT}`);
  console.log(`Square environment: ${process.env.SQUARE_ENVIRONMENT || 'sandbox'}`);
});
