import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
  useLoaderData,
  useRouteLoaderData,
} from '@remix-run/react'
import { json, type LinksFunction } from '@remix-run/node'
import './styles/globals.css'
import './styles/theme.css'

export const loader = () => {
  const assetBaseUrl = process.env.SHOPIFY_APP_URL ?? ''
  return json({ assetBaseUrl })
}

export const links: LinksFunction = () => [
  { rel: 'preconnect', href: 'https://cdn.shopify.com/' },
  { rel: 'stylesheet', href: 'https://cdn.shopify.com/static/fonts/inter/v4/styles.css' },
]

export default function App() {
  const { assetBaseUrl } = useLoaderData<typeof loader>()
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        {assetBaseUrl ? <base href={assetBaseUrl} /> : null}
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
        {/* (Removed) Shopify telemetry suppression scripts */}
      </head>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{const h=document.head;const list=[...document.body.querySelectorAll('link[rel]')];for(const el of list){if(el.parentElement!==document.body)continue;const rel=el.getAttribute('rel')||'';const href=el.getAttribute('href')||'';if(!href)continue;const dup=h.querySelector('link[rel="'+rel+'"][href="'+href+'"]');if(dup){el.remove();}else{h.appendChild(el);}}}catch{}})();`,
          }}
        />
        <Outlet />
        <ScrollRestoration />
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
  const rootData = useRouteLoaderData<typeof loader>('root')
  const assetBaseUrl = rootData?.assetBaseUrl ?? ''
  const error = useRouteError()
  let status = 500
  let message = 'An unexpected error occurred.'
  let details: string | null = null
  if (isRouteErrorResponse(error)) {
    status = error.status
    if (status === 404) message = 'Not Found'
    else if (status === 401) message = 'Unauthorized'
    else if (status === 403) message = 'HQ Access Required'
    try {
      // Attempt to serialize any data or status text
      const body = (error as unknown as { data?: unknown }).data
      if (body && typeof body === 'object') details = JSON.stringify(body)
    } catch {
      /* ignore serialization issues */
    }
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
    try {
      const shallowKeys = Object.keys(err as Record<string, unknown>)
      if (shallowKeys.length)
        details = JSON.stringify(
          shallowKeys.reduce(
            (acc, k) => {
              const v = (err as Record<string, unknown>)[k]
              if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') acc[k] = v
              return acc
            },
            {} as Record<string, unknown>,
          ),
        )
    } catch {
      /* ignore shallow key access issues */
    }
  } else if (error instanceof Response) {
    status = error.status || 500
    if (status === 404) message = 'Not Found'
    else if (status === 401) message = 'Unauthorized'
    else if (status === 403) message = 'HQ Access Required'
    else message = error.statusText || message
    try {
      details = `Response status=${error.status} statusText=${error.statusText}`
    } catch {
      /* ignore response metadata access */
    }
  }
  return (
    <html>
      <head>
        {assetBaseUrl ? <base href={assetBaseUrl} /> : null}
        <Meta />
        <Links />
        <title>{message}</title>
      </head>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const h = document.head; const list = Array.prototype.slice.call(document.body.querySelectorAll('link[rel]')); for (let i = 0; i < list.length; i++) { const el = list[i]; if (el.parentElement !== document.body) continue; const rel = el.getAttribute('rel') || ''; const href = el.getAttribute('href') || ''; if (!href) continue; const dup = h.querySelector('link[rel="' + rel + '"][href="' + href + '"]'); if (dup) { el.parentElement && el.parentElement.removeChild(el); } else { h.appendChild(el); } } } catch (e) {} })();`,
          }}
        />
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
            {details ? (
              <p style={{ marginTop: '0.75rem', fontSize: 12, color: '#92400e' }}>
                <code>{details}</code>
              </p>
            ) : null}
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
              {details ? (
                <p style={{ marginTop: '1rem', fontSize: 11, color: '#666', wordBreak: 'break-word' }}>
                  <code>{details}</code>
                </p>
              ) : null}
            </div>
          </div>
        )}
        <Scripts />
      </body>
    </html>
  )
}
// <!-- END RBP GENERATED: supplier-importer-ui-v1 -->
