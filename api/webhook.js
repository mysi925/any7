'use strict';

const express = require('express');
const { verifyWebhookSignature } = require('../lib/square');

const router = express.Router();

/**
 * POST /api/webhook
 *
 * Square sends events here. We verify the signature then act on
 * payment.completed to deliver access to the buyer.
 *
 * Webhook events to subscribe to in your Square dashboard:
 *   - payment.completed
 *   - payment.failed  (optional, for logging)
 *
 * Set your webhook URL in:
 * https://developer.squareup.com/apps → your app → Webhooks
 */
router.post(
  '/webhook',
  // Square needs the raw body to verify the signature — do NOT use express.json() before this.
  express.raw({ type: 'application/json' }),
  (req, res) => {
    try {
      const signature = req.headers['x-square-hmacsha256-signature'];
      const webhookUrl = `${process.env.APP_URL}/api/webhook`;
      const rawBody = req.body.toString('utf8');

      // ── Verify signature ────────────────────────────────────────────────────
      if (!verifyWebhookSignature(rawBody, signature, webhookUrl)) {
        console.warn('[webhook] invalid signature — possible spoofed request');
        return res.status(403).json({ error: 'Invalid signature.' });
      }

      const event = JSON.parse(rawBody);
      console.log(`[webhook] received event: ${event.type}`);

      // ── Handle events ───────────────────────────────────────────────────────
      switch (event.type) {

        case 'payment.completed': {
          const payment = event.data.object.payment;
          const orderId = payment.orderId;
          const buyerEmail = payment.buyerEmailAddress;
          const amountCents = payment.totalMoney.amount;

          console.log(`[webhook] payment.completed — order: ${orderId}, email: ${buyerEmail}, amount: ${amountCents}`);

          // ── Deliver access ──────────────────────────────────────────────────
          // TODO: hook your delivery logic here.
          //
          // Options:
          //   1. Email the buyer a download link / access code (e.g. via SendGrid, Resend, Postmark)
          //   2. Add them to a membership platform (e.g. Whop, Gumroad, your own DB)
          //   3. Generate a one-time signed URL to your protected content
          //
          // Example with a hypothetical mailer:
          //   await mailer.sendAccessEmail(buyerEmail, orderId);
          //
          // For now we just log it so you can see it working end-to-end.
          console.log(`[webhook] TODO: deliver access to ${buyerEmail} for order ${orderId}`);
          break;
        }

        case 'payment.failed': {
          const payment = event.data.object.payment;
          console.warn(`[webhook] payment.failed — order: ${payment.orderId}`);
          break;
        }

        default:
          // Acknowledge unknown events without erroring
          console.log(`[webhook] unhandled event type: ${event.type}`);
      }

      // Square expects a 200 quickly — always acknowledge
      return res.status(200).json({ received: true });

    } catch (err) {
      console.error('[webhook] unhandled error:', err.message);
      return res.status(500).json({ error: 'Webhook handler failed.' });
    }
  }
);

module.exports = router;
