// <!-- BEGIN RBP GENERATED: products-module-v3-0 -->
import type { LoaderFunctionArgs } from '@remix-run/node'
import { Page, Layout, Card, Text } from '@shopify/polaris'
import { authenticate } from '../shopify.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  return null
}

export default function SettingsIndexPage() {
  return (
    <Page title="Settings">
      <Layout>
        <Layout.Section>
          <Card>
            <div className="p-m">
              <Text as="p">Settings placeholder</Text>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
// <!-- END RBP GENERATED: products-module-v3-0 -->
