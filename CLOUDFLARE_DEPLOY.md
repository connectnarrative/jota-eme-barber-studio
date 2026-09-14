# Deploy Jota Eme with Cloudflare + GitHub

This application is a Cloudflare Worker with static assets and a D1 booking
database. It should be connected through **Workers & Pages → Workers Builds**,
not deployed as a Vercel/standard Next.js application.

## 1. Create the GitHub repository

Create a private GitHub repository and push this project to its default branch.
Do not commit `.env` files or Cloudflare API tokens.

## 2. Create the D1 database

In Cloudflare, open **Storage & databases → D1 SQL database → Create** and name
it `jota-eme-bookings`. Copy the database ID shown on its overview page.

Apply `drizzle/0000_aberrant_gwen_stacy.sql` in the D1 console before accepting
real bookings.

## 3. Connect GitHub to Cloudflare

Open **Workers & Pages → Create → Import a repository**, authorize GitHub, and
select the Jota Eme repository.

Use these build settings:

- Build command: `pnpm run build:cloudflare`
- Deploy command: `pnpm exec wrangler deploy --config dist/server/wrangler.json`
- Root directory: `/`
- Production branch: `main`

The production D1 database ID is already configured. These optional build
environment variables can be used later to override the defaults:

- `CLOUDFLARE_D1_DATABASE_ID`: replacement D1 database ID
- `CLOUDFLARE_D1_DATABASE_NAME`: `jota-eme-bookings`
- `CLOUDFLARE_WORKER_NAME`: `jota-eme-barber-studio`
- `NODE_VERSION`: `22.13.0`

## 4. Protect the admin dashboard

In **Cloudflare Zero Trust → Access → Applications**, create a self-hosted
application for both of these paths on the final domain:

- `/admin*`
- `/api/admin*`

Allow only the owner's approved email address. Cloudflare Access supplies the
verified email header used by the application. Do not launch the admin routes
without this Access policy.

## 5. Add the domain

In the Worker, open **Settings → Domains & Routes → Add → Custom domain** and
choose the final domain or subdomain. Cloudflare will create and manage the DNS
record and TLS certificate.

## Verification

After the first deployment:

1. Open the homepage and service page.
2. Submit a test booking and confirm it appears in D1.
3. Open `/admin` and confirm Cloudflare Access requires login.
4. Change the booking status and open the customer management link.
5. Delete the test booking before launch if it should not remain in analytics.
