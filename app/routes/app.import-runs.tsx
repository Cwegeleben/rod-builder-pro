import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'
import { Banner, BlockStack } from '@shopify/polaris'
import { requireHqShopOr404 } from '../lib/access.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  return json({})
}

export default function ImportRunsLayout() {
  const _data = useLoaderData<typeof loader>()
  return (
    <BlockStack gap="200">
      <Banner tone="info" title="Catalog import runs">
        Review diff results and apply approved changes directly to Product DB.
      </Banner>
      <Outlet />
    </BlockStack>
  )
}
