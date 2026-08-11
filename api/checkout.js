'use strict';

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { createCheckoutSession } = require('../lib/square');

const router = express.Router();

const VALID_TIERS = new Set(['access', 'system', 'control']);

/**
 * POST /api/checkout
 *
 * Body: { tier: 'access' | 'system' | 'control' }
 *
 * Returns: { url: string }  — client redirects to Square checkout
 */
router.post('/checkout', async (req, res) => {
  try {
    const { tier } = req.body;

    if (!tier || !VALID_TIERS.has(tier)) {
      return res.status(400).json({ error: 'Invalid or missing tier.' });
    }

    const idempotencyKey = uuidv4();
    const session = await createCheckoutSession(tier, idempotencyKey);

    return res.json({ url: session.url, checkoutId: session.checkoutId });
  } catch (err) {
    console.error('[checkout] error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session.' });
  }
});

module.exports = router;
