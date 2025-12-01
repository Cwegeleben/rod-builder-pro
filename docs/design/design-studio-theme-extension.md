# Rod Design Studio Theme Block

_Last updated: 2025-11-27_

## Overview

The Theme App Extension located in `extensions/design-studio` ships a configurable Online Store **app block** named **Rod Design Studio**. Merchants can drop this block into any theme section through the Shopify Theme Editor to embed the existing `/apps/proxy/design` wizard inside their storefront.

## Prerequisites

1. Install/upgrade the RBP app so the theme extension deploys with the latest release.
2. Ensure the shop is enrolled in Design Studio (`designStudioEnabled` + `DESIGN_STUDIO_V1` flag).
3. Confirm the shop’s app proxy is configured at `/apps/proxy/design` (default). If a custom proxy path is required, update the block setting accordingly.

## Adding the Block

1. From Shopify Admin, navigate to **Online Store → Customize**.
2. Choose the template (e.g., `product`, `page`, `index`) where the Design Studio should appear.
3. Select **Add block → Apps → Rod Design Studio** within the section where you want the wizard to appear.
4. Configure the block settings as desired:
   - **Heading / Subheading**: Optional copy that renders above the iframe.
   - **Wizard height**: Controls the iframe height (600‑1600px).
   - **Background + Border**: Toggle background swatches and drop shadow container.
   - **Append preview flag**: Keeps preview traffic isolated while customizing.
   - **Proxy path**: Only change if the proxy lives outside `/apps/proxy/design`.
5. Save the template and preview the storefront. The block loads the wizard via an iframe pointed at `/apps/proxy/design?shop={shop}&rbp_theme=1`.

## How It Works

- The block injects identifying query parameters (`rbp_theme=1`, `rbp_theme_section={id}`) so the Remix loader can distinguish theme iframe traffic, require the `shop` param, and serve the correct tenant config.
- `/apps/proxy/design` now returns a `requestContext` payload to the client, paving the way for storefront-specific behavior (Storefront API calls, JWT issuance, etc.).
- Client-side fetches to `/api/design-studio/*` automatically forward the `shop` + theme identifiers so Fly-hosted APIs can resolve the tenant while responding with `Access-Control-Allow-Origin: https://{shop}.myshopify.com` for Theme Editor CORS.
- Merchants do **not** need to edit theme liquid; all assets (CSS + translations) are bundled with the extension.

## Static Asset CORS + Custom Remix Server

- Shopify Theme Editor loads our Remix bundles directly from Fly. Shopify blocks responses that do not echo the exact `Origin`, so we swapped the default `remix-serve` entrypoint with `server/remix-serve.mjs`, an Express wrapper that adds `Access-Control-Allow-Origin` for trusted Shopify hostnames and serves `build/client` with long-term caching.
- The helper lives in `server/shopify-cors.js` and is now unit-tested (`server/shopify-cors.unit.test.ts`) to prevent future regressions when Shopify introduces new preview domains.
- To exercise the production server locally, run a build (`npm run build`) and start it with explicit env vars (example):

  ```bash
  SHOPIFY_API_KEY=dev \
  SHOPIFY_API_SECRET=dev \
  SHOPIFY_APP_URL=http://localhost:4000 \
  SCOPES=read_products \
  DATABASE_URL="file:./prisma/dev.sqlite" \
  SKIP_MIGRATE=1 \
  PORT=4000 \
  npm start
  ```

  You can then `curl -I -H "Origin: https://admin.shopify.com" http://localhost:4000/assets/<bundle>.js` to confirm the shim returns the Shopify origin.

## Testing Checklist

- [ ] Add the block in a development theme on the target shop and confirm it renders without CSP or mixed-content warnings.
- [ ] Switch between sections/templates to verify the wizard keeps the correct tenant gating per shop.
- [ ] Load the Theme Editor (design mode) to ensure the `preview=1` flag is appended when enabled.
- [ ] Validate that removing the block cleans up the iframe and no residual scripts remain.

## Deployment Notes

- Shopify CLI will automatically include `extensions/design-studio` on the next `deploy:shopify:*` run.
- If the block schema is updated, re-run `npm run -s deploy:shopify:staging` (or prod) so the extension bundle syncs with Shopify.
- Keep merchant-facing docs in sync with this file; link to it from onboarding and support responses.
