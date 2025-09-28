# Admin Integration Guide (Shopify Embedded App)

A concise reference for integrating our app with the Shopify Admin, based on Shopify’s Admin best practices.

## App home

- Treat App Home as the primary entry point. Merchants should land here from Admin navigation.
- Use Polaris for structure (Page, Layout, Card, IndexTable). Keep it fast and focused.
- Provide clear primary actions and recent activity or quick links.
- Follow Shopify App Design Guidelines and Admin performance best practices.

## App Bridge + Polaris

- Use App Bridge for:
  - Navigation menu / NavMenu integration
  - Full-screen modals and contextual save bars
  - TitleBar and actions
- Use Polaris React components for a native look-and-feel.
- Keep App Bridge configuration in a single place (root), pass through context in routes.

## UI extensions in admin

Prefer UI extensions when the experience belongs inline in Admin:

- Admin actions (modal workflows on key pages like Products, Customers, Orders)
- Admin print actions (generate/preview/print documents from Orders/Products)
- Admin blocks (persistent cards with contextual info or editing on resource pages)

When to use which:

- Actions: transactional flows that should appear as a modal from an Admin page.
- Print actions: document generation/preview/print flows available under Print menus.
- Blocks: persistent, contextual information and controls on resource pages.

## Admin link extensions

- Use sparingly; they navigate to a page in our app. Prefer UI extensions if the task can be done inline to avoid full-page context switches.

## Navigation and deep links

- Ensure deep links route correctly and do not 404. Keep legacy routes as thin redirects that preserve Shopify query params.
- Use App Bridge Redirect for top-level navigation if leaving the iframe; otherwise keep same-origin navigations within the embedded app.

## Performance and security

- Follow Admin performance best practices for install and OAuth.
- Minimize JS/CSS, avoid hydration mismatches (cssBundleHref), and render deterministic timestamps (UTC) to prevent client/server drift.
- Gate sensitive pages behind auth checks; avoid leaking query parameters in logs.

## Internationalization

- Use `locale` from Shopify context when available. Favor resource keys over inline strings for future i18n.

## Testing and verification

- Verify embedded query params are preserved across redirects (embedded, hmac, host, id_token, locale, session, shop, timestamp).
- Test inside Shopify Admin iframe and on mobile WebView.
- Ensure no redirect loops; GET → 302; POST action → 303.

## References

- Apps in admin: https://shopify.dev/docs/apps/build/admin
- App Bridge: https://shopify.dev/docs/api/app-bridge
- Polaris: https://polaris-react.shopify.com/
- Design guidelines: https://shopify.dev/docs/apps/design-guidelines
- Admin performance best practices: https://shopify.dev/docs/apps/build/performance/admin-installation-oauth
