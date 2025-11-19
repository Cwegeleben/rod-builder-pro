// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
// /app/imports parent route acts as a layout and renders child routes via <Outlet/>.
// The index child composes the Imports home UI; /app/imports/new renders the wizard, etc.
import { json } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import GlobalImportProgress from '../components/importer/GlobalImportProgress'
import { isProductDbExclusive } from '../lib/flags.server'
import { Banner, BlockStack } from '@shopify/polaris'

export async function loader() {
  // Keep Imports accessible even in exclusive mode; surface state via loader data for UI banner.
  const exclusive = isProductDbExclusive()
  return json({ exclusive })
}

export default function ImportsLayout() {
  const data = useLoaderData<typeof loader>() as { exclusive?: boolean } | undefined
  return (
    <div>
      <GlobalImportProgress />
      {data?.exclusive ? (
        <BlockStack gap="200">
          <Banner tone="info" title="Staging is disabled (canonical mode)">
            <p>
              Product DB exclusive mode is enabled. Staging and legacy diffing are disabled, but Imports are still
              available for managing settings and viewing logs.
            </p>
          </Banner>
        </BlockStack>
      ) : null}
      <Outlet />
    </div>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
