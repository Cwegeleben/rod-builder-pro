# Design Studio Storefront Loader

Shopify storefront support is landing in additive phases. The Remix-powered `/apps/proxy/design` route remains the source of truth for HQ/admin flows while the theme extension path proves Shopify-specific constraints.

## Phase 1 summary

- `extensions/design-studio/blocks/rbp-design-studio-storefront.liquid`
  - Renders marketing copy, placeholder container, and loader asset.
  - Adds `data-rbp-design-studio-*` attributes so JS can discover boot metadata without inline scripts.
- `extensions/design-studio/assets/design-studio-loader.js`
  - Finds each storefront container, calls the boot endpoint, and dispatches `rbp:design-studio:boot` events.
  - Keeps placeholders/failure states visible unless a bundle confirms it mounted.
- `GET /apps/proxy/design/boot`
  - JSON-only endpoint exposing `{ access, requestContext, draft }` from within the App Proxy so the loader has tenant context without rendering HTML.

## Phase 2.1 additions (storefront skeleton)

- `npm run design-studio:storefront:build`
  - Runs `scripts/design-studio/buildStorefront.ts`, which bundles `extensions/design-studio/src/storefront/entry.tsx` with esbuild, writes hashed assets (e.g. `design-studio-ui.<hash>.js`), and emits `design-studio-ui.manifest.json` for the loader.
- Loader/manifest integration
  - The block now passes `data-rbp-design-studio-manifest-url`, the loader fetches the manifest once, and dynamically injects the hashed bundle.
  - Boot events now include `{ bootUrl, payload }` and stash the payload on the root so the React bundle can mount even if it loads late.
- Minimal storefront bundle skeleton
  - `extensions/design-studio/src/storefront/entry.tsx` mounts a single `<div>` via React, hides the placeholder, and logs `storefront bundle booted` with the block metadata.
  - The bundle consumes only the boot payload delivered by the loader—no additional fetches yet. This keeps the Theme Editor experience stable while we validate hashed assets + event flow.

## Phase 2.2 additions (first read-only slice)

- Config fetch via App Proxy
  - The bundle reuses `GET /apps/proxy/design/config` (same data source as HQ) with `credentials: include`, only after confirming `access.enabled` from the boot payload.
- Minimal read-only UI
  - Hero summary card draws from `config.hero` with safe defaults so the section always renders meaningful copy.
  - A “First step” preview chip surfaces `config.steps[0]` details (label, optional description, roles). Missing steps fall back to a friendly reminder card.
  - All states (access disabled, loading, error) stay self-contained, and no POST/draft mutations occur.
- Loader compatibility
  - Placeholder hides only after React mounts; if the hashed bundle or manifest is missing, the loader’s fallback text still displays because the script never runs.

## Verifying in the Theme Editor (Phase 2.1)

1. Run `npm run design-studio:storefront:build` and deploy the theme app extension so the hashed bundle + manifest exist in Shopify.
2. Add the “Rod Design Studio (Storefront)” block to any Online Store 2.0 template.
3. In the Theme Editor dev tools:
   - Network: confirm `design-studio-loader.js`, `design-studio-ui.manifest.json`, the hashed `design-studio-ui.*.js`, and `/apps/proxy/design/boot` return 200. Removing the hashed asset should fall back to the placeholder.
   - Console: each block should emit a single `[DesignStudio] storefront bundle booted` log with the section + shop metadata.
   - Elements: the container should progress from `data-rbp-design-studio-state="loading"` → `boot-complete` → `mounted` once React attaches.
4. Visual result (Phase 2.2): the placeholder briefly shows, then the hero + first-step preview render using live data. Disabled tenants still receive the unavailable card. If the bundle fails to load, the placeholder text remains and the console logs the loader error.

## What’s next

- Phase 2.2 will introduce the first read-only UI slice, including config fetches via the App Proxy.
- Gradually move additional read-only panels (options lists, validation badges) into the storefront bundle after 2.2 is validated.
- Introduce POST flows (draft autosave/build saves) only after the read-only experience is battle-tested.
- Keep the bundler isolated to theme assets—Remix builds continue to power admin flows.
