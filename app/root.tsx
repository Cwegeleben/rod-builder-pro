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
function hasStatus(err: unknown): err is { status?: number; message?: string } {
  return typeof err === 'object' && err !== null && 'status' in (err as Record<string, unknown>)
}
export function ErrorBoundary() {
  const error = useRouteError()
  let status = 500
  let message = 'An unexpected error occurred.'
  if (isRouteErrorResponse(error)) {
    status = error.status
    if (status === 404) message = 'Not Found'
    else if (status === 401) message = 'Unauthorized'
    else if (status === 403) message = 'HQ Access Required'
  } else if (hasStatus(error)) {
    // Handle thrown Errors that carry a status code (not a RouteErrorResponse)
    const err = error
    if (typeof err.status === 'number') {
      status = err.status
      if (status === 404) message = 'Not Found'
      else if (status === 401) message = 'Unauthorized'
      else if (status === 403) message = 'HQ Access Required'
      else if (err.message) message = err.message
    }
  }
  return (
    <html>
      <head>
        <Meta />
        <Links />
        <title>{message}</title>
      </head>
      <body>
        {status === 403 ? (
          <div
            style={{
              margin: '2rem auto',
              maxWidth: 960,
              fontFamily: 'Inter,system-ui,sans-serif',
              border: '1px solid #f59e0b',
              background: '#fffbeb',
              color: '#92400e',
              borderRadius: 8,
              padding: '1rem 1.25rem',
            }}
          >
            <h1 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>HQ access required</h1>
            <p style={{ margin: '0.5rem 0 0', fontSize: 14 }}>
              This section is limited to HQ shops. If you believe you should have access, contact your admin to add your
              shop to <code>HQ_SHOPS</code> or <code>HQ_SHOPS_REGEX</code>.
            </p>
            <p style={{ marginTop: '0.75rem' }}>
              <a href="/app/products" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>
                Return to Products
              </a>
            </p>
          </div>
        ) : (
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
        )}
        <Scripts />
      </body>
    </html>
  )
}
// <!-- END RBP GENERATED: supplier-importer-ui-v1 -->
