'use strict';

const express = require('express');
const { verifyWebhookSignature, PRODUCT_PRICES, PRODUCT_LABELS } = require('../lib/square');

const router = express.Router();

// ── Reverse-lookup tier from the amount Square reports ────────────────────────
function tierFromAmount(cents) {
  const entry = Object.entries(PRODUCT_PRICES).find(([, v]) => v === cents);
  return entry ? entry[0] : null;
}

// ── Fire a Discord embed on payment events ────────────────────────────────────
async function notifyDiscord({ tier, amountCents, buyerEmail, orderId, failed = false }) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;

  const tierLabel = tier ? PRODUCT_LABELS[tier] : 'Unknown tier';
  const amount    = `$${(amountCents / 100).toFixed(2)}`;

  const embed = failed
    ? {
        title:  '❌ Payment Failed',
        color:  0xef4444,
        fields: [
          { name: 'Order ID', value: orderId || '—', inline: true },
        ],
        timestamp: new Date().toISOString(),
      }
    : {
        title:  '💸 New Payment',
        color:  0x6E56F8,
        fields: [
          { name: 'Tier',     value: tierLabel,         inline: true },
          { name: 'Amount',   value: amount,            inline: true },
          { name: 'Email',    value: buyerEmail || '—', inline: true },
          { name: 'Order ID', value: `\`${orderId}\``,  inline: false },
        ],
        timestamp: new Date().toISOString(),
      };

  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username: 'WinOnAny', embeds: [embed] }),
    });
  } catch (e) {
    console.warn('[webhook] Discord notify failed:', e.message);
  }
}

/**
 * POST /api/webhook
 *
 * Square sends events here. Signature is verified, then:
 *   - payment.completed → Discord notification + TODO: deliver access
 *   - payment.failed    → Discord alert
 *
 * Webhook URL to register in Square Dashboard:
 *   https://winonany.com/api/webhook
 *
 * Required env vars:
 *   SQUARE_WEBHOOK_SIGNATURE_KEY
 *   DISCORD_WEBHOOK_URL
 *   APP_URL
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const signature  = req.headers['x-square-hmacsha256-signature'];
      const webhookUrl = `${process.env.APP_URL}/api/webhook`;
      const rawBody    = req.body.toString('utf8');

      // ── Verify signature ──────────────────────────────────────────────────
      if (!verifyWebhookSignature(rawBody, signature, webhookUrl)) {
        console.warn('[webhook] invalid signature — possible spoofed request');
        return res.status(403).json({ error: 'Invalid signature.' });
      }

      const event = JSON.parse(rawBody);
      console.log(`[webhook] received event: ${event.type}`);

      // ── Handle events ─────────────────────────────────────────────────────
      switch (event.type) {

        case 'payment.completed': {
          const payment     = event.data.object.payment;
          const orderId     = payment.orderId;
          const buyerEmail  = payment.buyerEmailAddress;
          const amountCents = payment.totalMoney.amount;
          const tier        = tierFromAmount(amountCents);

          console.log(`[webhook] payment.completed — order: ${orderId}, email: ${buyerEmail}, amount: ${amountCents}, tier: ${tier}`);

          // Notify Discord
          await notifyDiscord({ tier, amountCents, buyerEmail, orderId });

          // ── Deliver access ────────────────────────────────────────────────
          // TODO: wire your delivery method here (email, Whop, signed URL, etc.)
          console.log(`[webhook] TODO: deliver access to ${buyerEmail} for order ${orderId} (tier: ${tier})`);
          break;
        }

        case 'payment.failed': {
          const payment = event.data.object.payment;
          console.warn(`[webhook] payment.failed — order: ${payment.orderId}`);
          await notifyDiscord({ orderId: payment.orderId, amountCents: 0, failed: true });
          break;
        }

        default:
          console.log(`[webhook] unhandled event type: ${event.type}`);
      }

      // Square expects a fast 200
      return res.status(200).json({ received: true });

    } catch (err) {
      console.error('[webhook] unhandled error:', err.message);
      return res.status(500).json({ error: 'Webhook handler failed.' });
    }
  }
);

module.exports = router;
