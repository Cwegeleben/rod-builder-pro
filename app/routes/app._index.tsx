import type { LoaderFunctionArgs } from '@remix-run/node'
import { Page, Layout, Card, Text, Button } from '@shopify/polaris'
import { authenticate } from '../shopify.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  return null
}

export default function Index() {
  return (
    <Page title="Home">
      <Layout>
        <Layout.Section>
          <Card>
            <div className="space-y-m p-m bg-background">
              <Text as="h1" variant="headingLg">
                Welcome
              </Text>
              <Text as="p" tone="subdued">
                Jump into your catalog workflows:
              </Text>
              <div className="gap-m mt-m flex">
                <Button url="products" variant="primary">
                  Products
                </Button>
                <Button url="products/import">Import Products</Button>
                <Button url="products/templates" variant="secondary">
                  Spec Templates
                </Button>
              </div>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
