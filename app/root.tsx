import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react'
import type { LinksFunction } from '@remix-run/node'
// Import CSS as side effects so Remix/Vite add them to the route's CSS manifest.
// This ensures the same hashed filenames are used on server and client, avoiding hydration mismatches.
import './styles/globals.css'
import './styles/theme.css'

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://cdn.shopify.com/' },
  { rel: 'stylesheet', href: 'https://cdn.shopify.com/static/fonts/inter/v4/styles.css' },
]

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
