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

Check `.env.example` to review which are the required environment variables. You need to set the variables in staging and production. You need to set them using fly.io:

```
fly secrets set FOO=bar --config fly.production.toml
fly secrets set FOO=bar --config fly.staging.toml
```

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
