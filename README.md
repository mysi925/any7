# WinOnAny

Digital vault storefront with Square embedded checkout.

---

## Stack

- **Frontend** — single-file HTML/CSS/JS (`public/index.html`)
- **Backend** — Node.js + Express
- **Payments** — Square Checkout API (embedded)
- **Webhooks** — Square webhook for payment delivery trigger

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/yourname/winonany.git
cd winonany
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your `.env`:

| Variable | Where to find it |
|---|---|
| `SQUARE_ACCESS_TOKEN` | [Square Developer Dashboard](https://developer.squareup.com/apps) → your app → Credentials |
| `SQUARE_LOCATION_ID` | Square Dashboard → Locations |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Square Developer Dashboard → Webhooks → your endpoint |
| `SQUARE_ENVIRONMENT` | `sandbox` for testing, `production` for live |
| `APP_URL` | Your public domain e.g. `https://winonany.com` |
| `PRODUCT_ID_ACCESS` | Square Dashboard → Catalog → your item → variation ID |
| `PRODUCT_ID_SYSTEM` | Same — The Vault variation ID |
| `PRODUCT_ID_CONTROL` | Same — Full Access variation ID |

### 3. Create your products in Square

1. Go to [Square Dashboard](https://squareup.com/dashboard) → **Items & orders → Items**
2. Create three items:
   - **WinOnAny Starter** — $49
   - **WinOnAny The Vault** — $97
   - **WinOnAny Full Access** — $197
3. For each item, copy the **Variation ID** (not the item ID) into `.env`

### 4. Set up your webhook

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps) → your app → **Webhooks**
2. Add endpoint: `https://yourdomain.com/api/webhook`
3. Subscribe to: `payment.completed`, `payment.failed`
4. Copy the **Signature Key** into `.env` as `SQUARE_WEBHOOK_SIGNATURE_KEY`

### 5. Run locally

```bash
# Development (auto-restarts on file change — requires Node 18+)
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000` by default.

To test webhooks locally, use the [Square CLI](https://developer.squareup.com/docs/devtools/cli/webhooks) or [ngrok](https://ngrok.com):

```bash
ngrok http 3000
# Then update your webhook URL in Square dashboard to the ngrok URL
```

---

## Deployment

### Render (recommended — free tier available)

1. Push repo to GitHub
2. New Web Service → connect repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add all `.env` variables under **Environment**

### Railway

```bash
railway init
railway up
```
Add env vars in the Railway dashboard.

### VPS / DigitalOcean

```bash
npm install --production
node server.js
```

Use [pm2](https://pm2.keymetrics.io/) to keep it alive:

```bash
npm install -g pm2
pm2 start server.js --name winonany
pm2 save
```

---

## Delivering access after payment

Edit `api/webhook.js` → `case 'payment.completed'` block.

Recommended options:

**Email delivery (simplest)**
```bash
npm install @sendgrid/mail
# or: npm install resend
```
Send the buyer a download link or access code when payment completes.

**Whop integration**
Whop has a REST API — hit it from the webhook to add the buyer to your membership.

**Custom member portal**
Store `{ email, orderId, tier, timestamp }` in a database (Supabase, PlanetScale, SQLite) and build a login-gated download page.

---

## File structure

```
winonany/
├── public/
│   ├── index.html          # Main storefront (all CSS + JS inline)
│   └── success.html        # Post-purchase confirmation page
├── api/
│   ├── checkout.js         # POST /api/checkout — creates Square payment link
│   └── webhook.js          # POST /api/webhook — handles Square events
├── lib/
│   └── square.js           # Square client + helper functions
├── server.js               # Express app entry point
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Testing payments

Use Square sandbox credentials and these [test card numbers](https://developer.squareup.com/docs/devtools/sandbox/payments):

| Card | Result |
|---|---|
| `4111 1111 1111 1111` | Success |
| `4000 0000 0000 0002` | Card declined |

Any future expiry, any CVV.
