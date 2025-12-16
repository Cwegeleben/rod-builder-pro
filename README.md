# Shopify App Template - Remix

Last updated: `2025-02-27`

This is a template for building a [Shopify app](https://shopify.dev/docs/apps/getting-started) using the [Remix](https://remix.run) framework.

## Quick start

### Prerequisites

Before you begin, you'll need the following:

1. **Node.js**: [Download and install](https://nodejs.org/en/download/) it if you haven't already.
2. **Shopify Partner Account**: [Create an account](https://partners.shopify.com/signup) if you don't have one.
3. **Test Store**: Set up either a [development store](https://help.shopify.com/en/partners/dashboard/development-stores#create-a-development-store) or a [Shopify Plus sandbox store](https://help.shopify.com/en/partners/dashboard/managing-stores/plus-sandbox-store) for testing your app.

### Setup

```shell
npm install
```

### Install Playwright

```shell
npx playwright install --with-deps
```

### Local Development

Using npm:

```shell
npm run dev
```

Press P to open the URL to your app. Once you click install, you can start development.

Local development is powered by [the Shopify CLI](https://shopify.dev/docs/apps/tools/cli). It logs into your partners account, connects to an app, provides environment variables, updates remote config, creates a tunnel and provides commands to generate extensions.

### Commit Lint and Semantic Release

This project uses [Commitlint](https://commitlint.js.org/) and [Semantic Release](https://semantic-release.gitbook.io/semantic-release/) to ensure consistent commit messages and automated versioning.

#### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. Each commit message should be structured as follows:

```
type(scope): description

[optional body]

[optional footer(s)]
```

**Types:**

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Changes that don't affect the code's meaning (white-space, formatting, etc.)
- `refactor`: Code changes that neither fix a bug nor add a feature
- `perf`: Performance improvements
- `test`: Adding or correcting tests
- `chore`: Changes to build process or auxiliary tools

**Examples:**

```sh
git commit -m "feat(product): add new color selector"
git commit -m "fix(cart): resolve checkout button not working"
git commit -m "docs: update installation instructions"
```

#### Semantic Release

Semantic Release automates the whole package release workflow including:

- Determining the next version number
- Generating release notes
- Publishing the package

The version numbers are automatically determined based on commit messages:

- `feat`: triggers a minor release (1.x.0)
- `fix` or `perf`: triggers a patch release (1.0.x)
- Breaking changes (noted by `BREAKING CHANGE` in commit message): triggers a major release (x.0.0)

The release process is automated through our CI/CD pipeline, triggered on merges to the main branch.

### Build

Remix handles building the app for you, by running the command below with the package manager of your choice:

```shell
npm run build
```

## Deployment

First, create the production and staging app on fly.io:

```shell
fly apps create <APP_NAME>
fly apps create <APP_NAME>-staging
```

Remember to create them in the Lightspace organization.

## Shopify app creation

You need to create three apps: one for development, one for staging and another one for production. You can do so by running the following command:

```shell
shopify app config link
```

When setting the name follow this guidelines:

- Development environment: `<APP_NAME>-development`
- Staging environment: `<APP_NAME>-staging`
- Production environment: `<APP_NAME>`

## Setting environment variables

Check `.env.example` to review the variables. For staging/production, set secrets on Fly (not in source control).

Required for app boot (set as Fly secrets):

- `SHOPIFY_API_KEY` — from your app in Shopify Partners
- `SHOPIFY_API_SECRET` — from your app in Shopify Partners

Provided via Fly config (already in `fly.production.toml`/`fly.staging.toml`):

- `SHOPIFY_APP_URL` — public URL (e.g., `https://rbp-app.fly.dev`). Production startup fails fast if this is unset or still `example.com` so hydration never ships with placeholder origins.
- `SCOPES` — required app scopes
- `PORT`, `HOST`, `DATABASE_URL` — server binding and SQLite path

Optional (set as secrets only if you use the feature):

- `SHOP_CUSTOM_DOMAIN` — restrict auth to a specific shop domain
- `SECRET_CREDENTIALS_KEY` — 32-byte key for encrypting supplier creds (AES-256-GCM)
- `ENABLE_SMOKES`, `SMOKE_TOKEN`, `SMOKE_ALLOW_PROD` — guarded smoke routes for ops
- `PRICE_REFRESH_TOKEN` — bearer token for price/availability refresh hook
- `IMPORTER_BG_ENABLED`, `VITE_IMPORTER_SSE_ENABLED` — importer / UI flags

### Theme Editor smoke profile

Use `.env.theme-editor-smoke` when running `npm run theme-editor:smoke`. The command loads that profile, boots the Remix server on `http://127.0.0.1:3100`, and exercises the Theme Editor timeline (happy path, forced error + retry, and no-JS fallbacks) with Playwright. Update the SQLite path in the env file if your smoke database lives elsewhere. If SHOPIFY_APP_URL is wrong, hydration will never run.

Examples (production):

```bash
fly secrets set SHOPIFY_API_KEY=xxx SHOPIFY_API_SECRET=yyy --config fly.production.toml
# Optional operational flags
fly secrets set ENABLE_SMOKES=1 SMOKE_TOKEN=change-me --config fly.production.toml
```

Examples (staging):

```bash
fly secrets set SHOPIFY_API_KEY=xxx SHOPIFY_API_SECRET=yyy --config fly.staging.toml
```

### Credentials encryption secret

If you store supplier credentials or other secrets in the database, set a strong symmetric key in production for AES‑256‑GCM encryption/decryption:

- `SECRET_CREDENTIALS_KEY` → a 32‑byte key (recommend base64 or hex). Example (base64): `u8P8L1BzzS1cS0Jz6r7mXg0t9v0aQ2c3i4n5o6p7q8r=`

Notes:

- Rotate keys during maintenance windows; re-encrypt stored values if needed.
- Keep this secret out of source control; set via `fly secrets set SECRET_CREDENTIALS_KEY=... --config fly.production.toml`.

## Tech Stack

This template uses [Remix](https://remix.run). The following Shopify tools are also included to ease app development:

- [Shopify App Remix](https://shopify.dev/docs/api/shopify-app-remix) provides authentication and methods for interacting with Shopify APIs.
- [Shopify App Bridge](https://shopify.dev/docs/apps/tools/app-bridge) allows your app to seamlessly integrate your app within Shopify's Admin.
- [Polaris React](https://polaris.shopify.com/) is a powerful design system and component library that helps developers build high quality, consistent experiences for Shopify merchants.
- [Webhooks](https://github.com/Shopify/shopify-app-js/tree/main/packages/shopify-app-remix#authenticating-webhook-requests): Callbacks sent by Shopify when certain events occur
- [Polaris](https://polaris.shopify.com/): Design system that enables apps to create Shopify-like experiences

## Webhooks

This app implements Shopify webhooks to follow the [Privacy Law Compliance](https://shopify.dev/docs/apps/build/privacy-law-compliance). The following webhooks are supported:

- `customers/data-request`: Handles customer data requests
- `customers/redact`: Handles customer data deletion requests
- `shop/redact`: Handles shop data deletion requests
- `app/uninstalled`: Handles app uninstallation
- `app/scopes_update`: Handles app scopes update

### Testing Webhooks

You can test webhooks locally using the Shopify CLI. Here's how to test a webhook:

```bash
shopify app webhook trigger \
  --address <URL>/webhooks/customers/data-request \
  --api-version 2025-01 \
  --client-secret <CLIENT_SECRET> \
  --topic <TOPIC> \
  --delivery-method http
```

Replace the following placeholders:

- `<URL>`: Your app's URL (e.g., `https://some-url.trycloudflare.com` for local development)
- `<CLIENT_SECRET>`: Your app's client secret from the Shopify Partner dashboard
- `<TOPIC>`: The webhook topic to test (e.g., `customers/data-request`)

Example for testing a customer data request:

```bash
shopify app webhook trigger \
  --address https://way-pitch-behaviour-processors.trycloudflare.com/webhooks/customers/data-request \
  --api-version 2025-01 \
  --client-secret your_client_secret \
  --topic customers/data-request \
  --delivery-method http
```

## Resources

- [Remix Docs](https://remix.run/docs/en/v1)
- [Shopify App Remix](https://shopify.dev/docs/api/shopify-app-remix)
- [Introduction to Shopify apps](https://shopify.dev/docs/apps/getting-started)
- [App authentication](https://shopify.dev/docs/apps/auth)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- [App extensions](https://shopify.dev/docs/apps/app-extensions/list)
- [Shopify Functions](https://shopify.dev/docs/api/functions)
- [Getting started with internationalizing your app](https://shopify.dev/docs/apps/best-practices/internationalization/getting-started)

## Redirects in a Shopify Embedded App

When deprecating or moving routes, don’t 404 legacy URLs. Add thin redirect stubs that preserve Shopify’s query string (embedded, hmac, host, etc.). See `docs/redirects-guidelines.md` for code samples and a checklist.

## Admin Integration Guide

For best practices on integrating with Shopify Admin (App home, App Bridge + Polaris, UI extensions, admin links, performance), see `docs/admin-integration.md`.

## Admin-style UX Direction

We are restructuring the app to emulate Shopify Admin for a consistent, familiar experience:

- Global admin-style layout with left navigation and page headers
- Index/detail pages patterned after Shopify Admin
- URL-driven state for filters, sorting, pagination, and saved views
- Server-side filtering with cursor pagination; optimistic bulk actions with rollback

Design docs:

- Admin architecture: `docs/admin/admin-architecture.md`
- Products module spec: `docs/admin/products.md`

## Store setup: templates metaobjects and metafields

To enable product spec templates across the store, set up the following in Shopify Admin:

1. Metaobject definition (Settings → Custom data → Metaobjects)

- Type API handle: `rbp_template`
- Name: Product spec template
- Display name template: `{{ name }}`
- Access: Admin
- Fields:
  - `template_id` (Single line text, required)
  - `name` (Single line text, required)
  - `fields_json` (JSON, required)
  - `version` (Integer or text, optional)
  - `updated_at` (Date and time, optional)

2. Optional product metafield (Settings → Custom data → Products)

- Name: Spec template
- Namespace and key: `rbp.product_spec_template`
- Type: Metaobject
- Metaobject type: `rbp_template`
- Access: Admin

With this in place:

- Publishing templates creates/updates one metaobject per template (handle = `template_id`).
- Assigning a template to a product can store a metaobject reference in `rbp/product_spec_template`.

### Required app scopes

Add these scopes to each environment's `shopify.app.*.toml` and re-install/re-auth shops after deploying:

- `read_metaobjects,write_metaobjects`
- Existing: `write_products` (and if you still use shop metafields: `read_shop_metafields,write_shop_metafields`)

## Production build & deploy (Shopify + Fly)

This project deploys two things for production: your Shopify app configuration (via the Shopify CLI) and your server on Fly.io.

Prerequisites:

- You have `shopify.app.production.toml` configured (client_id, handle, application_url, scopes, webhooks) and pointing to your production app.
- Fly apps exist and secrets are set: `rbp-app` (production) and optionally `rbp-app-staging` (staging).
- Logged into Shopify CLI and Fly CLI.

1. Build locally (optional but recommended)

```bash
npm run typecheck
npm run build
```

2. Release a new Shopify app version (production)

The Shopify CLI reads defaults from `shopify.app.production.toml` when present.

```bash
# Ensure the default config points to production
cp shopify.app.production.toml shopify.app.toml

# Release a new version to the production app
npm run deploy
```

If scopes changed, merchants must re-authorize the app after this release.

3. Deploy server to Fly (production)

```bash
# Push latest code
git push origin production

# Deploy using the production Fly config
fly deploy --config fly.production.toml --now
```

4. Verify

- App URL: https://rbp-app.fly.dev
- Shopify Partners → Apps → rbp-app → Versions → Confirm the latest version is released.
- In your store, open the app to trigger re-auth if scopes changed.

Staging (optional):

```bash
# Shopify app release to staging
cp shopify.app.staging.toml shopify.app.toml
npm run deploy

# Fly staging deploy
fly deploy --config fly.staging.toml --now
```

Troubleshooting:

- Shopify CLI config selection: if the CLI doesn’t pick up your intended app, ensure you copied the correct `shopify.app.*.toml` to `shopify.app.toml` before running `npm run deploy`.
- Fly deploy build cache: if builds look stale, add `--build-arg` or run with `--remote-only` depending on your environment.

### Price refresh HTTP hook and scheduling

A lightweight operational route can trigger a price/availability refresh job.

- Endpoint: `POST /app/admin/import/refresh-price`
- Auth: requires HQ access (logged-in HQ shop) or `Authorization: Bearer <PRICE_REFRESH_TOKEN>`
- Body: optional `{ "supplierId": "batson" }` (JSON) or form with `supplierId`

Examples:

```bash
# From a CI runner or maintenance box
curl -X POST \
  -H "Authorization: Bearer $PRICE_REFRESH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"supplierId":"batson"}' \
  https://rbp-app.fly.dev/app/admin/import/refresh-price
```

Scheduling options:

- External scheduler (GitHub Actions, cron on a management host) calling the HTTPS endpoint with the bearer token.
- Fly Machines Runner: run a small sidecar/one-off job image via a GitHub Action on a schedule to issue the HTTP POST.
- Keep schedules conservative to avoid overlapping refreshes.

## Operations & Database Migrations

### Overview

Runtime migrations are no longer executed automatically on every container boot to avoid blocking availability when a migration fails. Instead:

- Initial startup runs a soft `prisma migrate deploy` inside `dbsetup.js` (skips failures unless `STRICT_MIGRATIONS=1`).
- The `setup` script only runs `prisma generate` (no deploy).
- A manual GitHub Actions workflow (`.github/workflows/prisma-migrate.yml`) can be triggered to apply migrations centrally.

### Handling a Failed Migration (P3009)

If you see P3009 (failed migration) in logs:

1. Backup DB (Fly volume copy of `dev.sqlite`).
2. Decide whether the migration partially applied. Inspect schema using `sqlite3`.
3. Mark it resolved:

- Rolled back: `npx prisma migrate resolve --rolled-back <migration_name>`
- Applied: `npx prisma migrate resolve --applied <migration_name>`

4. Create a corrective migration: `npx prisma migrate dev --name fix_<desc>`
5. Deploy: `npx prisma migrate deploy` (via Action or console).

Helper scripts:

```
scripts/migrate/status.sh          # Shows status
scripts/migrate/resolve-failed.sh  # Resolve a migration (applied|rolled-back)
```

### Recommended Flow for New Schema Changes

1. Develop & test locally: `npx prisma migrate dev`.
2. Push branch → PR → Merge.
3. Trigger the "Prisma Migrate Deploy" GitHub Action (select environment).
4. Confirm status is clean (no pending, no failed) before scaling or heavy tasks.

### Environment Flags

- `STRICT_MIGRATIONS=1` → Fail startup if migrate fails (use after DB is clean).
- `SKIP_MIGRATE=1` → Skip even the soft migrate attempt (emergency only).

### Removing Debug Utilities

The memory debug route and periodic memory logger were removed. To reintroduce temporary memory diagnostics, re-create a `resources.memory-debug` route and add an interval logger guarded by an env variable.

### Operational Runbook (Quick Reference)

```
# Backup DB
fly ssh console -a rbp-app
cp /data/dev.sqlite /data/dev.sqlite.bak.$(date +%Y%m%d%H%M%S)

# Check status
npx prisma migrate status

# Resolve failed migration (example)
npx prisma migrate resolve --rolled-back 20251006062503_reset_with_template_version

# Create fix
npx prisma migrate dev --name fix_template_version

# Deploy (manual console or workflow)
npx prisma migrate deploy
```

Document any manual resolve steps in the CHANGELOG for traceability.

## Importer Delete & Audit

The importer delete endpoint (`POST /api/importer/delete`) supports dry-run previews (`?dry=1`) and force overrides (`?force=1`). It removes importer template data (logs, runs, diffs, staged parts, sources). See `docs/importer/delete.md` for full contract, blocker codes, and audit logging details.

Key points:

- Structured error codes: `blocked`, `not_found`, `unknown`.
- Blocker codes: `active_prepare`, `publish_in_progress`.
- Force override bypasses blockers; audit row records `forced=true`.
- Audit model `ImportDeleteAudit` stores counts, durationMs, and usage flags.
- UI modal shows preview counts and offers a force checkbox when blockers detected.

Future ideas (tracked separately): batch delete optimization, alert on force spike, richer partial-failure reporting.

## Smoke validation routes (Fly-only)

For simple end-to-end checks in non-embedded contexts (useful on Fly), a set of minimal importer smoke routes exist. They are disabled by default and guarded by a bearer token.

- Enable smokes with an environment flag and set a token:
  - `ENABLE_SMOKES=1`
  - `SMOKE_TOKEN=<long-random-secret>`
- Auth: Provide the token via either `Authorization: Bearer <token>` header or `?token=<token>` query param.

Available routes (GET):

- `/resources/smoke/importer/start` → creates a smoke ImportRun; returns `{ ok, runId }`.
- `/resources/smoke/importer/seed-diffs?runId=<id>&count=3` → seeds N diffs for the run; returns `{ ok, ids }`.
- `/resources/smoke/importer/list-diffs?runId=<id>&page=1&pageSize=2` → lists diffs; returns `{ ok, total, rows }`.
- `/resources/smoke/importer/apply?runId=<id>` → marks run as applied; returns `{ ok }`.
  - Idempotent: returns `{ changed: 1 }` on first apply and `{ changed: 0 }` on subsequent calls.
- `/resources/smoke/importer/cleanup[?runId=<id>]` → deletes smoke runs/diffs; returns counts.

Notes:

- If `ENABLE_SMOKES` is not set to a truthy value (`1,true,on,enabled,yes`), these routes return 404.
- If the token is missing or invalid, they return 403.
- These routes only touch internal ImportRun/ImportDiff tables; they do not call Shopify.

## Importer Home and Run Options (HQ-only)

- Runs list now includes quick actions:

  - New Import → `/app/admin/import/new`
  - Re-run → `/app/admin/import/:runId/edit`
  - Settings → `/app/admin/import/settings`

- Run Options fields:

  - Include saved seeds: include previously saved/discovered product source URLs.
  - Manual URLs: paste product URLs (newline or comma separated).
  - Skip previously successful items: recorded with the run for re-run behavior (filtering wiring is planned next).
  - Notes: stored with manual sources for audit.

- Scrape Preview endpoint:
  - POST `/app/admin/import/preview` (HQ-gated)
  - Body: either JSON `{ "urls": string[] }` or form-data with `urls` set to a JSON string.
  - Response: `{ results: Array<{ url, externalId, title, images: string[], ok, error? }> }`
  - Side-effect-free: does not write to the database.

Flow:

1. New Import → set options → Preview Scrape to validate URLs.
2. Save & Continue to Review → crawl + stage + diff, then go to Run detail for review/apply.
3. Re-run → edit options for an existing run; Save Draft or Save & Continue to Review to refresh diffs in-place.

Notes:

- Delete override policy remains at apply time (on Deletes tab).
- “Skip previously successful” will compare staging hash against Shopify’s stored `rbp.hash` metafield to omit unchanged items in re-runs in a follow-up.
