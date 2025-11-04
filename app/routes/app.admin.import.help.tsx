// redirect shim only; do not expand.
import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData, useLocation } from '@remix-run/react'
import { Page, Layout, Card, Text, List, Button, InlineStack } from '@shopify/polaris'
import { requireHQAccess } from '../services/auth/guards.server'

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireHQAccess(request)
  // Point to the repository doc for the full guide
  const repo = 'Cwegeleben/rbp-app'
  const branch = 'production'
  const guideUrl = `https://github.com/${repo}/blob/${branch}/docs/importer/pipeline.md`
  return json({ guideUrl })
}

export default function ImportHelpPage() {
  const { guideUrl } = useLoaderData<typeof loader>() as { guideUrl: string }
  const loc = useLocation()
  return (
    <Page
      title="Import help"
      backAction={{ content: 'Back to Runs', url: `/app/admin/import/runs${loc.search}` }}
      primaryAction={{ content: 'Open full guide', url: guideUrl, external: true }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <div className="p-m space-y-m">
              <Text as="h2" variant="headingMd">
                Overview
              </Text>
              <Text as="p" tone="subdued">
                This importer crawls supplier pages, extracts product data via templates and fallbacks, stages changes,
                and lets you review and apply updates to Shopify. Use Templates to fine-tune extraction.
              </Text>
              <Text as="h2" variant="headingMd">
                Quick checks
              </Text>
              <List type="bullet">
                <List.Item>Pick a Template when starting a run; Preview shows a Template chip.</List.Item>
                <List.Item>Use Manual URLs to limit scope when trying a new category.</List.Item>
                <List.Item>Look for required fields in Preview; add selectors if missing.</List.Item>
                <List.Item>Approve Adds on the Run detail before applying to Shopify.</List.Item>
              </List>
              <InlineStack gap="200">
                <Button url={`/app/admin/import/runs${loc.search}`}>Go to Import Runs</Button>
                <Button url={guideUrl} external>
                  Open full guide
                </Button>
              </InlineStack>
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
