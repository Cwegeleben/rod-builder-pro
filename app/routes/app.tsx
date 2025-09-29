import type { HeadersFunction, LoaderFunctionArgs } from '@remix-run/node'
import { Link, Outlet, useLoaderData, useRouteError } from '@remix-run/react'
import { boundary } from '@shopify/shopify-app-remix/server'
import { AppProvider } from '@shopify/shopify-app-remix/react'
import { NavMenu } from '@shopify/app-bridge-react'
import polarisStyles from '@shopify/polaris/build/esm/styles.css?url'

import { authenticate } from '../shopify.server'
import AdminLayout from '../components/AdminLayout'

export const links = () => [{ rel: 'stylesheet', href: polarisStyles }]

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)

  return { apiKey: process.env.SHOPIFY_API_KEY ?? '' }
}

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>()

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      {/* SENTINEL: products-workspace-v3-0 (Sidebar nav flattening -> AdminLayout) */}
      {/* BEGIN products-workspace-v3-0 */}
      <NavMenu>
        <Link to="." rel="home">
          Home
        </Link>
        <Link to="products">Products</Link>
      </NavMenu>
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
