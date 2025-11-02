// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import ImportList from '../components/importer/ImportList'
import GlobalLogList from '../components/importer/GlobalLogList'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from '@remix-run/react'
import { Page, BlockStack, Card, InlineStack, Text } from '@shopify/polaris'

type ImportsHomeProps = {
  search?: string
  initialDbTemplates?: Array<{
    id: string
    name?: string
    state: string
    hadFailures?: boolean
    lastRunAt?: string | null
  }>
  initialLogs?: Array<{ at: string; templateId: string; runId: string; type: string; payload?: unknown }>
}

export default function ImportsHome(props: ImportsHomeProps = {}) {
  const location = useLocation()
  // Prefer SSR-provided prop (if passed), else use Remix location on first render
  const [qs, setQs] = useState<string>(props.search ?? location.search ?? '')

  // Hydration safety: if empty, fall back to window.location.search
  useEffect(() => {
    if (!qs && typeof window !== 'undefined') {
      setQs(window.location.search || '')
    }
  }, [])

  const addImportHref = useMemo(() => {
    // Prefer the new inline Add Import wizard which now creates a Spec Template + ImportTemplate 1:1
    const search = qs || ''
    return `/app/imports/new${search}`
  }, [qs])

  return (
    <Page title="Imports" primaryAction={{ content: 'Add import', url: addImportHref }}>
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingSm">
                Your imports
              </Text>
            </InlineStack>
            <ImportList initialDbTemplates={props.initialDbTemplates} />
          </BlockStack>
        </Card>
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingSm">
                Logs
              </Text>
            </InlineStack>
            <GlobalLogList items={props.initialLogs} />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
