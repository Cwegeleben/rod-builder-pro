# Products Module

Last updated: 2025-09-28

This document specifies the Products workspace behavior to emulate Shopify Admin.

## Goals

- Full index with URL-driven filters, sorting, and cursor pagination.
- Bulk actions (status, tags, vendor/type, collections) with optimistic updates + rollback.
- Saved views and column chooser with stable defaults.
- Detail pages for product with variants, media, organization sections.

## Data Model (Shopify Admin GraphQL)

We use Shopify Admin API for products. Minimum fields:

- id, title, status, handle, vendor, productType, tags
- totalInventory, createdAt, updatedAt
- variants(first: 10) { id, title, sku, price }

## URL Parameters

- q: text query applied to Shopify product query syntax
- status: active|draft|archived
- vendor, productType: strings
- sort: updatedAt desc | title asc | totalInventory desc (maps to sortKey + reverse)
- first/after, last/before: cursor pagination
- columns: comma-separated keys e.g. title,vendor,productType,status,inventory,updatedAt
- view: saved view id/slug (maps to a preset of filters + columns)

## Table Columns (defaults)

- Title
- Status
- Vendor
- Type
- Inventory
- Updated

## Bulk Actions

- Change status: active, draft, archived
- Add/remove tags
- Set vendor
- Set product type
- Add/remove from collections (future)

Implementation notes:

- Submit bulk actions to a resource route: POST /app/resources/products with \_action.
- Optimistic UI: update selected rows immediately, then refetch loader; rollback on failure.

## Empty & Error States

- Empty: show call-to-action to Import or Create in Shopify.
- Error: inline banner with retry.

## Accessibility

- Use Polaris IndexTable and IndexFilters for consistent a11y.
- Provide aria-labels for bulk actions; ensure keyboard support is intact.

## Detail Page

Sections:

- Summary: title, status, vendor, type, tags
- Organization: collections, product category (future)
- Media: first image preview; link to Shopify for full media management
- Variants: grid of variants (id, title, sku, price)

## Performance

- Always page using cursors; keep page size small (e.g., 25).
- Avoid n+1: request only columns on screen.
