// <!-- BEGIN RBP GENERATED: supplier-importer-ui-v1 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { Page, Layout, Banner, Card, Text, BlockStack } from '@shopify/polaris'
import { authenticate } from '../shopify.server'
import { ImportWizard } from '../components/importer/ImportWizard'
import { requireHqShopOr404 } from '../lib/access.server'

interface ImportLoaderData {
  hq: boolean
}

// Gating now handled via shared util.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  await requireHqShopOr404(request)
  return json<ImportLoaderData>({ hq: true })
}

export default function ProductsImportPage() {
  useLoaderData<typeof loader>()
  return (
    <Page title="Import from Supplier" backAction={{ url: '/app/products', content: 'Products' }}>
      <Layout>
        <Layout.Section>
          <Banner tone="info" title="Draft + No Access">
            <p>Imported products are created as Draft with rbp.access.level = none until reviewed and approved.</p>
          </Banner>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Text as="p" tone="subdued">
                Paste supplier listing URL → Define/select mapping → Preview → Import.
              </Text>
              <ImportWizard />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
// <!-- END RBP GENERATED: supplier-importer-ui-v1 -->
