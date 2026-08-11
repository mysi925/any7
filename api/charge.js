'use strict';

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { client, PRODUCT_PRICES, PRODUCT_LABELS } = require('../lib/square');

const router = express.Router();
const { paymentsApi } = client;

/**
 * POST /api/charge
 *
 * Body: { sourceId: string, tier: 'access' | 'system' | 'control' }
 *
 * Tokenizes via Square Web Payments SDK on the frontend,
 * then charges the card server-side — card data never touches this server.
 */
router.post('/charge', async (req, res) => {
  const { sourceId, tier } = req.body;

  if (!sourceId || typeof sourceId !== 'string') {
    return res.status(400).json({ error: 'Missing sourceId.' });
  }

  const price = PRODUCT_PRICES[tier];
  const label = PRODUCT_LABELS[tier];

  if (!price || !label) {
    return res.status(400).json({ error: `Unknown tier: ${tier}` });
  }

  try {
    const { result } = await paymentsApi.createPayment({
      sourceId,
      idempotencyKey: uuidv4(),
      amountMoney: {
        amount:   BigInt(price),
        currency: 'USD',
      },
      locationId: process.env.SQUARE_LOCATION_ID,
      note:       label,
    });

    if (result.errors && result.errors.length > 0) {
      const e = result.errors[0];
      console.error(`[charge] Square error: ${e.code} — ${e.detail}`);
      return res.status(402).json({ error: e.detail || 'Payment declined.' });
    }

    const payment = result.payment;
    console.log(`[charge] success — id: ${payment.id}, tier: ${tier}, amount: ${price}`);

    return res.json({ success: true, paymentId: payment.id });

  } catch (err) {
    // Square SDK surfaces declined cards as thrown errors with result.errors
    const squareErrors = err?.result?.errors;
    if (squareErrors && squareErrors.length > 0) {
      const e = squareErrors[0];
      console.error(`[charge] declined: ${e.code} — ${e.detail}`);
      return res.status(402).json({ error: e.detail || 'Payment declined.' });
    }

    console.error('[charge] unexpected error:', err.message);
    return res.status(500).json({ error: 'Payment failed — try again.' });
  }
});

module.exports = router;
