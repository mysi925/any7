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

const { checkoutApi, paymentsApi } = client;

// ─── Product → Square variation ID map ───────────────────────────────────────
// Populated from .env so you never hardcode IDs in source.
const PRODUCT_VARIATION_IDS = {
  access:  process.env.PRODUCT_ID_ACCESS,
  system:  process.env.PRODUCT_ID_SYSTEM,
  control: process.env.PRODUCT_ID_CONTROL,
};

// Human-readable labels for each tier (used in order receipts)
const PRODUCT_LABELS = {
  access:  'WinOnAny — Starter',
  system:  'WinOnAny — The Vault',
  control: 'WinOnAny — Full Access',
};

// Prices in cents — keep in sync with what you set in Square dashboard
const PRODUCT_PRICES = {
  access:  4900,   // $49
  system:  9700,   // $97
  control: 19700,  // $197
};

/**
 * Create a Square embedded checkout payment link.
 *
 * @param {string} tier  - 'access' | 'system' | 'control'
 * @param {string} idempotencyKey - unique key per request (use uuid v4)
 * @returns {Promise<{ url: string, checkoutId: string }>}
 */
async function createCheckoutSession(tier, idempotencyKey) {
  const variationId = PRODUCT_VARIATION_IDS[tier];
  if (!variationId) {
    throw new Error(`Unknown product tier: ${tier}`);
  }

  const response = await checkoutApi.createPaymentLink({
    idempotencyKey,
    order: {
      locationId: process.env.SQUARE_LOCATION_ID,
      lineItems: [
        {
          quantity: '1',
          catalogObjectId: variationId,
          itemType: 'ITEM',
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
      // Embedded checkout: set to true so Square renders inline
      // on your page rather than redirecting to Square's hosted page.
      // You can also use false and redirect — both work.
      enableCoupon: false,
      enableLoyalty: false,
    },
    paymentNote: `WinOnAny — ${PRODUCT_LABELS[tier]}`,
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
 * Verify a Square webhook signature.
 * https://developer.squareup.com/docs/webhooks/step3validate
 *
 * @param {string} body       - raw request body string
 * @param {string} signature  - value of the 'x-square-hmacsha256-signature' header
 * @param {string} url        - your webhook endpoint URL (must match exactly)
 * @returns {boolean}
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
