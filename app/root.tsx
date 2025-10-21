import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError, isRouteErrorResponse } from '@remix-run/react'
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
        {/* Suppress noisy OTLP beacon errors from Shopify metrics when queue saturates. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{const ORIG=navigator.sendBeacon?.bind(navigator);if(!ORIG)return;const BLOCK=["https://otlp-http-production.shopifysvc.com/v1/traces","https://otlp-http-production.shopifysvc.com/v1/metrics"];navigator.sendBeacon=function(u,d){try{if(typeof u==="string"&&BLOCK.some(b=>u.startsWith(b))){return true;} }catch{} return ORIG(u,d);};}catch(e){}})();`,
          }}
        />
        <Scripts />
      </body>
    </html>
  )
}

// <!-- BEGIN RBP GENERATED: supplier-importer-ui-v1 -->
export function ErrorBoundary() {
  const error = useRouteError()
  let status = 500
  let message = 'An unexpected error occurred.'
  if (isRouteErrorResponse(error)) {
    status = error.status
    if (status === 404) message = 'Not Found'
    else if (status === 401) message = 'Unauthorized'
  }
  return (
    <html>
      <head>
        <Meta />
        <Links />
        <title>{message}</title>
      </head>
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100dvh',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Inter,system-ui,sans-serif',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 360, padding: '2rem' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>{message}</h1>
            <p style={{ color: '#555', fontSize: 14, marginBottom: '1.25rem' }}>
              {status === 404
                ? 'The page you are looking for does not exist.'
                : 'Please try again or return to the previous page.'}
            </p>
            <a
              href="/app/products"
              style={{
                display: 'inline-block',
                background: '#2C62F6',
                color: '#fff',
                textDecoration: 'none',
                padding: '0.5rem 1rem',
                borderRadius: 6,
                fontSize: 14,
              }}
            >
              Go to Products
            </a>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  )
}
// <!-- END RBP GENERATED: supplier-importer-ui-v1 -->
