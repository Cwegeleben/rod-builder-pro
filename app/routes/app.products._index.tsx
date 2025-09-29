import type { LoaderFunctionArgs } from '@remix-run/node'
import { Card, Text, Button } from '@shopify/polaris'
import { authenticate } from '../shopify.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request)
  return null
}

export default function ProductsIndex() {
  return (
    <Card>
      <div className="p-m space-y-m">
        <Text as="h2" variant="headingLg">
          Products
        </Text>
        <div className="space-y-s">
          <Text as="p" tone="subdued">
            No products yet.
          </Text>
          {/* SENTINEL: products-workspace-v3-0 (Products index under tabs) */}
          <div className="gap-s flex">
            <Button url="import" variant="primary">
              Import Products
            </Button>
            <Button url="templates" variant="secondary">
              Manage Spec Templates
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
