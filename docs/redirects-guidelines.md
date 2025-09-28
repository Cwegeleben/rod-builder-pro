# Redirects in a Shopify Embedded Remix App

This doc captures the pitfalls and best practices for redirects inside our Shopify embedded app. We hit a production 404 on legacy URLs (`/app/products/templates/...`) and fixed it with safe redirects that preserve Shopify context.

## Why it matters

Shopify embeds apps in an iframe and appends critical query params (e.g., `embedded`, `hmac`, `host`, `id_token`, `locale`, `session`, `shop`, `timestamp`). If a redirect drops or alters these, auth and app bridge context can break, causing 401/403 or blank screens.

## Golden rules

- Preserve the full query string on every redirect.
- Redirect within the same origin. Use App Bridge for top-level redirects only when required.
- Avoid redirect loops (check guards before bouncing).
- Prefer 303 for POST→GET flows to avoid resubmitting forms; 302 is fine for GET.
- Keep legacy routes around as thin redirect stubs rather than 404s.

## Code patterns (Remix)

### 1) Redirect a GET loader and preserve query params

```ts
// app/routes/legacy._index.tsx
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'

function preserveSearch(request: Request, to: string) {
  const url = new URL(request.url)
  const target = new URL(to, url.origin)
  target.search = url.search // keep all Shopify params
  return target.toString()
}

export async function loader({ request }: LoaderFunctionArgs) {
  return redirect(preserveSearch(request, '/app/product-types'), { status: 302 })
}
```

### 2) Redirect an action after POST using 303 See Other

```ts
// app/routes/legacy-action._index.tsx
import type { ActionFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'

export async function action({ request }: ActionFunctionArgs) {
  // handle form or auth handshake if needed
  const url = new URL(request.url)
  const target = new URL('/app/product-types', url.origin)
  target.search = url.search
  return redirect(target.toString(), { status: 303 })
}
```

### 3) Dynamic legacy path redirect (e.g., "/:id")

```ts
// app/routes/legacy.$id._index.tsx
import type { LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const target = new URL('/app/product-types', url.origin)
  target.search = url.search
  return redirect(target.toString(), { status: 302 })
}
```

## App Bridge top-level redirects

If you must kick the merchant out of the iframe (e.g., OAuth, billing), use App Bridge Redirect. For normal in-app navigation, keep redirects same-origin and preserve the query string.

## Testing checklist

- URL query preserved after redirect (embedded/hmac/host/shop/timestamp/id_token).
- No infinite loops between the source and target routes.
- GET redirects: 302; POST action redirects: 303.
- Legacy bookmarks and Shopify admin deep links do not 404.

## Our implementation

- Added redirect stubs:
  - `/app/products/templates` → `/app/product-types`
  - `/app/products/templates/:id` → `/app/product-types`
- Both preserve the full query string to keep Shopify context intact.

## References

- Shopify CLI app config and embedded app docs
- Remix docs on loaders/actions and redirects
