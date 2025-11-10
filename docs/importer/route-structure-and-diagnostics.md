# Importer routes: structure and diagnostics

This doc captures the structure for Import Settings and Schedule pages, and the lightweight diagnostics we surface to verify correct routing in embedded Shopify Admin.

## Route structure

- Parent layout: `app/routes/app.imports.$templateId.tsx`
  - Renders only `<Outlet />`; contains no content or loader.
- Settings (index child): `app/routes/app.imports.$templateId._index.tsx`
  - The Import Settings UI lives here.
  - Loader adds diagnostic headers: `X-RBP-Route: imports-settings` and `X-RBP-Template: <id>`.
  - `headers()` export forwards those headers to the document response.
- Schedule child: `app/routes/app.imports.$templateId.schedule.tsx`
  - The Import Schedule UI.
  - Loader adds headers: `X-RBP-Route: imports-schedule` and `X-RBP-Template: <id>`.
  - `headers()` export forwards those headers to the document response.

Rationale: Using an Outlet-only parent with an index child avoids component shadowing and SSR/CSR ambiguity between Settings and Schedule.

## Client diagnostics (temporary)

- Both pages accept a `?debugRoute=1` query param that adds a small subtitle badge showing the resolved route name.
- Client `console.info('[ImportSettings] mounted')` and `console.info('[ImportsSchedule] mounted')` are gated behind `?debugRoute=1` or non-production environments.

Remove the subtitle and logs after verification if desired.

## Server diagnostics

- Loader emits `X-RBP-Route` and `X-RBP-Template` on all document responses (forwarded via `headers()`).
- This makes it easy to verify in Shopify Admin (Network panel) which route handled the request.

## Verifying in Admin

1. Open the Schedule page inside Shopify Admin.
2. In Network → the document request, confirm:
   - `X-RBP-Route: imports-schedule`
   - `X-RBP-Template: <templateId>`
3. Open the Settings page and confirm `X-RBP-Route: imports-settings`.
4. Optionally append `?debugRoute=1` to surface the visual subtitle.

## Testing

- E2E coverage: `tests/e2e/importer.route-identity.spec.ts` asserts that the Schedule page returns the expected `X-RBP-Route` when `PW_BASE_URL` and `PW_TEMPLATE_ID` point to a reachable environment.
- Settings may require authentication; the test permits 4xx without failing.

## Notes

- Keeping `X-RBP-*` headers in production is low-risk and useful; you can gate them behind an env if needed, but default is to leave them enabled.
- If you see Settings content on the Schedule route, check headers first; if headers show the correct route, the issue is client-side.
