import type { HeadersFunction, LoaderFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { Link, Outlet, useLoaderData, useRouteError } from '@remix-run/react'
import { boundary } from '@shopify/shopify-app-remix/server'
import { AppProvider } from '@shopify/shopify-app-remix/react'
import { NavMenu } from '@shopify/app-bridge-react'
import polarisStyles from '@shopify/polaris/build/esm/styles.css?url'
import { useEffect, useState, type PropsWithChildren } from 'react'

import { authenticate } from '../shopify.server'
import { isProductDbExclusive } from '../lib/flags.server'
function isLegacyImporterPath(pathname: string): boolean {
  return (
    pathname.startsWith('/app/imports') || pathname.startsWith('/app/admin/import') || pathname.startsWith('/hq/import')
  )
}
import AdminLayout from '../components/AdminLayout'

export const links = () => [{ rel: 'stylesheet', href: polarisStyles }]

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request)
    // Centralized gating: if exclusive, steer legacy importer routes to canonical products
    const u = new URL(request.url)
    const exclusive = isProductDbExclusive()
    if (exclusive && isLegacyImporterPath(u.pathname)) {
      const dest = new URL('/app/products', u.origin)
      dest.searchParams.set('legacy', 'disabled')
      throw redirect(dest.pathname + dest.search)
    }
    return { apiKey: process.env.SHOPIFY_API_KEY ?? '', exclusive }
  } catch (err) {
    // Allow HQ override in local/e2e runs without a full Shopify session
    try {
      const { isHqShop } = await import('../lib/access.server')
      const allow = process.env.ALLOW_HQ_OVERRIDE === '1' || (await isHqShop(request))
      if (allow) {
        const u = new URL(request.url)
        const exclusive = isProductDbExclusive()
        if (exclusive && isLegacyImporterPath(u.pathname)) {
          const dest = new URL('/app/products', u.origin)
          dest.searchParams.set('legacy', 'disabled')
          throw redirect(dest.pathname + dest.search)
        }
        return { apiKey: process.env.SHOPIFY_API_KEY ?? '', exclusive }
      }
    } catch {
      /* ignore */
    }
    throw err
  }
}

export default function App() {
  const { apiKey, exclusive } = useLoaderData<typeof loader>() as { apiKey: string; exclusive?: boolean }

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      {/* SENTINEL: products-workspace-v3-0 (Sidebar nav flattening -> AdminLayout) */}
      {/* BEGIN products-workspace-v3-0 */}
      {/* BEGIN RBP GENERATED: admin-hq-importer-ux-v2 */}
      {/* Admin HQ Importer v2 Nav additions: keep links relative to preserve shop/host/embedded */}
      {/* Guard against duplicate App Bridge nav mounts (Shopify warns if more than one exists). */}
      <SafeNavMenu>
        <Link to="." rel="home">
          Dashboard
        </Link>
        <Link to="products">Products</Link>
        {/** Import links updated for importer-v2-3 */}
        {/* <!-- BEGIN RBP GENERATED: importer-v2-3 --> */}
        {!exclusive ? <Link to="imports">Imports</Link> : null}
        {/* <!-- END RBP GENERATED: importer-v2-3 --> */}
      </SafeNavMenu>
      {/* END RBP GENERATED: admin-hq-importer-ux-v2 */}
      <AdminLayout>
        <Outlet />
      </AdminLayout>
      {/* END products-workspace-v3-0 */}
    </AppProvider>
  )
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError())
}

export const headers: HeadersFunction = headersArgs => {
  return boundary.headers(headersArgs)
}

// Ensures only a single App Bridge NavMenu exists at a time.
function SafeNavMenu({ children }: PropsWithChildren) {
  // Start with render=false to avoid SSR/CSR hydration mismatches due to App Bridge DOM mutations.
  const [render, setRender] = useState(false)
  useEffect(() => {
    try {
      const w = window as unknown as { __RBP_NAV_MENU_MOUNTED?: boolean }
      if (!w.__RBP_NAV_MENU_MOUNTED) {
        w.__RBP_NAV_MENU_MOUNTED = true
        setRender(true)
      } else {
        setRender(false)
        return
      }
      return () => {
        w.__RBP_NAV_MENU_MOUNTED = false
      }
    } catch {
      // SSR environment: window is not defined
    }
  }, [])
  if (!render) return null
  return <NavMenu>{children}</NavMenu>
}
