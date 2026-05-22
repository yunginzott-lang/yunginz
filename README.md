# Yunginz Producer Platform

Premium full-stack beat-selling platform for Yunginz, built with Next.js App Router, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Auth.js credentials auth, PayPal checkout, Resend email, and Vercel Blob uploads.

## What’s Included

- Premium one-page public producer site inspired by the supplied screenshots
- Searchable beat catalog with sticky global preview player
- License comparison and per-beat license selection
- Cart and PayPal checkout flow
- Post-purchase delivery page with Dropbox links
- Exclusive beat offer flow with a $1000 minimum
- Protected admin dashboard for beats, license templates, content, orders, and inquiries
- Prisma schema and seed data with realistic demo content

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- Auth.js / NextAuth credentials auth
- PayPal REST checkout flow
- Resend transactional email
- Vercel Blob for preview MP3s and cover images only
- Zustand for cart state

## Core Business Workflow

Only preview MP3s and cover images are uploaded into app-managed storage.

Full leased files are not stored in this app.

Delivery works like this:

1. Admin uploads preview MP3 + cover art to Blob.
2. Admin creates or edits beat metadata.
3. Admin assigns licenses to the beat.
4. Admin stores Dropbox delivery links on each beat-license combination.
5. Customer purchases a non-exclusive license through PayPal.
6. Order is recorded in PostgreSQL.
7. Order success page and confirmation email reveal the correct Dropbox links.
8. If a license includes stems, the order is marked for partial/manual fulfillment and the customer is told stems will be delivered manually later.

## License Model

Seeded license tiers:

- `Basic` — `$30`
- `Standard` — `$50`
- `Unlimited` — `$200`
- `Exclusive` — offer-based, minimum `$1000`

Each license template stores:

- public summary bullets
- rights JSON
- optional contract preview text/RTF
- default price or minimum offer
- active state
- exclusive/non-exclusive behavior

Each beat can override:

- custom name
- custom description
- custom price
- manual fulfillment flag
- delivery notes
- file notes
- Dropbox delivery links

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp .env.example .env.local
```

3. Fill in:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `RESEND_API_KEY`
- `ORDER_FROM_EMAIL`
- `NOTIFY_TO_EMAIL`
- `BLOB_READ_WRITE_TOKEN`
- `NEXT_PUBLIC_SITE_URL`

4. Generate Prisma client:

```bash
npm run prisma:generate
```

5. Run migrations:

```bash
npm run prisma:migrate
```

6. Seed demo content:

```bash
npm run prisma:seed
```

7. Start development server:

```bash
npm run dev
```

## Admin Access

Seed defaults:

- email: `admin@yunginz.prod`
- password: `ChangeMe123!`

Change these immediately in production by updating the seeded user or replacing it in the database.

Admin route:

- `/admin`

## PayPal Notes

The checkout flow uses server-side PayPal order creation and capture.

- `/api/checkout/create` builds a PayPal order from the validated cart snapshot
- `/checkout/success` captures the approved order and finalizes the local order
- `/api/payments/paypal/webhook` stores raw webhook payloads and updates order state when applicable

Required PayPal app setup:

- create sandbox/live REST app
- add return URL to your deployed app
- add webhook URL: `https://your-domain.com/api/payments/paypal/webhook`
- copy webhook ID into `PAYPAL_WEBHOOK_ID`

## Resend Notes

Emails currently send:

- new contact inquiry notifications
- new exclusive offer notifications
- order confirmation emails after successful payment

If `RESEND_API_KEY` is missing, the app skips email sending gracefully.

## Vercel Blob Notes

Blob is used only for:

- preview MP3 uploads
- cover art uploads

It is intentionally not used for:

- WAV lease masters
- stems
- exclusive delivery bundles

Those stay external and are attached through Dropbox links in the admin dashboard.

## Deploying to Vercel

Recommended production setup:

1. Create a new Vercel project named `yunginz` in the client account.
2. Attach a Postgres-compatible database connection.
3. Add Blob storage.
4. Add all environment variables from `.env.example`.
5. Run database migrations against the production database.
6. Seed production content if needed.
7. Configure PayPal return URL and webhook URL to the live domain.
8. Configure Resend sending domain.

## Production Handoff Hardening

Before handing this project to the client, verify these production safeguards:

1. Use Vercel-managed environment variables only.
2. Keep `.env` files out of production uploads with `.vercelignore`.
3. Confirm Turnstile keys are set in Vercel:
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `TURNSTILE_SECRET_KEY`
4. Confirm PayPal live settings:
   - `PAYPAL_ENVIRONMENT=live`
   - webhook ID is set and matches PayPal dashboard
5. Confirm Resend sender domain is verified and `ORDER_FROM_EMAIL` uses that verified domain.
6. Rotate any temporary credentials used during setup.
7. Verify `/admin/login`, contact form, exclusive offer form, and checkout in production.

## Environment Upload Safety

This repo includes `.vercelignore` so local `.env` files are not uploaded during deploy:

- `.env`
- `.env.local`
- `.env.production.local`
- `.env.vp`

Keep secrets in Vercel project environment variables instead of repository files.

## Commands

```bash
npm run dev
npm run build
npm run start
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

## Verification

Current local verification completed:

- `npm run build`

## Known v1 Notes

- The dashboard is intentionally section-based rather than page-builder based.
- Exclusive offers are inquiry-only in v1; they do not go through direct checkout.
- The success page reveals Dropbox links stored on the purchased beat license.
- Stem-inclusive licenses are flagged for manual fulfillment rather than auto-revealing stem links.
