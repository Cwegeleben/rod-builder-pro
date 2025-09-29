# Admin Architecture

Last updated: 2025-09-28

This document defines the Admin-style UX direction for the app. The goal is to closely emulate Shopify Admin patterns while remaining embedded-safe inside the Shopify Admin iframe.

## Principles

- URL is the source of truth for view state
  - Filters, sorting, pagination cursors, selected columns, and saved views are represented in the query string.
  - Navigating back/forward restores state without extra client storage.
- Server-first data flow
  - Cursor-based pagination and server-side filtering. Avoid fetching giant lists on the client.
  - Actions perform server mutations optimistically in the UI, with rollback if the server rejects.
- Familiar Admin layout
  - Left-hand navigation with consistent sections.
  - Page headers with primary and secondary actions.
  - Index tables with filters, sorting, bulk actions.
  - Detail/edit pages with clear sections and sticky primary actions when appropriate.
- Embedded-safe
  - No absolute URLs; always use relative links that respect Shopify’s embedded context.
  - Use App Bridge + Polaris for styling and navigation consistency.
- Accessibility and keyboard parity
  - Respect Polaris accessibility guidance; ensure tab order, roles, labels are correct.
  - Empty and error states mirror Shopify Admin conventions.
- Performance
  - Prefer incremental data loading (cursor pagination) and compact payloads.
  - Cache-friendly loaders; avoid unnecessary re-renders.

## Layout

- Global shell uses Polaris Frame with Navigation (left nav) and TopBar placeholder.
- Routes render into the Frame content area using Remix Outlet.
- The left nav contains high-level entry points only. Deeper navigation happens via in-page tabs/links when needed.

Suggested navigation:

- Home
- Products
  - Import
  - Spec Templates
- Settings (future)

## URL-Driven State Contract

Filters and table state are synchronized with the URL. Example query parameters:

- q: text query
- status: active|draft|archived (repeatable)
- vendor, productType, collection: strings (repeatable)
- sort: field direction, e.g. title asc or updatedAt desc
- first/after, last/before: cursor pagination
- columns: comma-separated column keys
- view: saved view id or slug

On navigation:

- Update search params with replace when adjusting local state to prevent history spam for small tweaks (e.g., typing).
- Use standard links for major transitions (e.g., changing view) to allow back/forward.

## Bulk Actions

- Optimistic UI: immediately reflect changes in selected rows.
- Rollback if the server returns failure; show inline toast/alert.
- Group common actions:
  - Change status (active/draft/archived)
  - Add/remove tags
  - Set vendor/type
  - Add/remove from collections

## Saved Views and Columns

- Provide stable default columns per module.
- Allow users to toggle columns; persist selection via URL (columns=) and eventually per-user saved views.
- Saved views are identified by a slug/id in the URL (view=). The view defines a filter+columns preset.

## Accessibility & States

- Provide descriptive labels for controls and bulk actions.
- Keyboard shortcuts (future): basic navigation via tab, enter, space is sufficient initially.
- Empty states: follow Shopify Admin style with a helpful call-to-action.
- Error states: keep context, show inline retry.

## Embedded Considerations

- Keep routes relative (e.g., /app/products) to preserve embedded context.
- Use App Bridge’s NavMenu for Admin breadcrumbs and deep links; the in-app left nav mirrors the same links.

---

See also: `docs/admin/products.md` for the Products module details.
