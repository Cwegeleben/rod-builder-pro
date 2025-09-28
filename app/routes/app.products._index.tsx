import type { LoaderFunctionArgs } from '@remix-run/node'
import { Page, Layout, Card, Text, Button } from '@shopify/polaris'
// <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
import { ProductsTabs } from '../components/products-tabs'
// <!-- END RBP GENERATED: products-module-v3-0 -->
import { authenticate } from '../shopify.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  return null
}

export default function ProductsIndex() {
  return (
    <Page title="Products" primaryAction={{ content: 'Import Products', url: 'import' }}>
      {/* <!-- BEGIN RBP GENERATED: products-module-v3-0 --> */}
      <div className="mb-m">
        <ProductsTabs />
      </div>
      {/* <!-- END RBP GENERATED: products-module-v3-0 --> */}
      <Layout>
        <Layout.Section>
          <Card>
            <div className="p-m space-y-m">
              <Text as="h2" variant="headingLg">
                Products
              </Text>
              <div className="space-y-s">
                <Text as="p" tone="subdued">
                  No products yet.
                </Text>
                <div className="gap-s flex">
                  <Button url="import" variant="primary">
                    Import Products
                  </Button>
                  <Button url="../product-types" variant="secondary">
                    Manage Spec Templates
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
