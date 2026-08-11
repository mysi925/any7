'use strict';

const { Client, Environment } = require('square');

// ─── Square client ────────────────────────────────────────────────────────────
const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment:
    process.env.SQUARE_ENVIRONMENT === 'production'
      ? Environment.Production
      : Environment.Sandbox,
});

const { checkoutApi } = client;

// ─── Product definitions ──────────────────────────────────────────────────────
// Prices in cents. No Square catalog items needed — amounts are sent directly.
const PRODUCT_LABELS = {
  access:  'WinOnAny — Starter',
  system:  'WinOnAny — The Vault',
  control: 'WinOnAny — Full Access',
};

const PRODUCT_PRICES = {
  access:  2999,   // $29.99
  system:  5999,   // $59.99
  control: 9999,   // $99.99
};

/**
 * Create a Square payment link with an ad-hoc line item (no catalog required).
 *
 * @param {string} tier           - 'access' | 'system' | 'control'
 * @param {string} idempotencyKey - unique key per request (uuid v4)
 * @returns {Promise<{ url: string, checkoutId: string, orderId: string }>}
 */
async function createCheckoutSession(tier, idempotencyKey) {
  const price = PRODUCT_PRICES[tier];
  const label = PRODUCT_LABELS[tier];

  if (!price || !label) {
    throw new Error(`Unknown product tier: ${tier}`);
  }

  const response = await checkoutApi.createPaymentLink({
    idempotencyKey,
    order: {
      locationId: process.env.SQUARE_LOCATION_ID,
      lineItems: [
        {
          quantity: '1',
          name: label,
          basePriceMoney: {
            amount: BigInt(price),
            currency: 'USD',
          },
        },
      ],
    },
    checkoutOptions: {
      redirectUrl: `${process.env.APP_URL}/success?tier=${tier}`,
      askForShippingAddress: false,
      acceptedPaymentMethods: {
        applePay: true,
        googlePay: true,
        cashAppPay: true,
        afterpayClearpay: false,
      },
      enableCoupon: false,
      enableLoyalty: false,
    },
    paymentNote: label,
  });

  if (response.result.errors && response.result.errors.length > 0) {
    const err = response.result.errors[0];
    throw new Error(`Square error: ${err.code} — ${err.detail}`);
  }

  const link = response.result.paymentLink;
  return {
    url:        link.url,
    checkoutId: link.id,
    orderId:    link.orderId,
  };
}

/**
 * Verify a Square webhook HMAC-SHA256 signature.
 * https://developer.squareup.com/docs/webhooks/step3validate
 */
function verifyWebhookSignature(body, signature, url) {
  const crypto = require('crypto');
  const key    = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const hash   = crypto
    .createHmac('sha256', key)
    .update(url + body)
    .digest('base64');
  return hash === signature;
}

module.exports = {
  client,
  createCheckoutSession,
  verifyWebhookSignature,
  PRODUCT_LABELS,
  PRODUCT_PRICES,
};
