import { useEffect, useState } from 'react'
import { useFetcher } from '@remix-run/react'
import {
  Page,
  Layout,
  Button,
  Card,
  Tabs,
  Frame,
  Toast,
  Badge,
  InlineStack,
  SkeletonBodyText,
  Text,
} from '@shopify/polaris'
import RunOptionsModal from './RunOptionsModal'

type Run = { id: string; status: string; createdAt: string; name: string }

export default function RunDetail({ runId, initialSearch }: { runId: string; initialSearch: URLSearchParams }) {
  // <!-- BEGIN RBP GENERATED: hq-imports-shopify-style-v1 -->
  const fetcher = useFetcher<{ run?: Record<string, unknown>; error?: string }>()
  const [toast, setToast] = useState<{ content: string; error?: boolean } | null>(null)
  const [showOptions, setShowOptions] = useState(false)

  const tabParam = initialSearch.get('tab') || 'summary'
  const tabs = [
    { id: 'summary', content: 'Summary' },
    { id: 'adds', content: 'Adds' },
    { id: 'changes', content: 'Changes' },
    { id: 'errors', content: 'Errors' },
    { id: 'completed', content: 'Completed' },
  ]
  const selected = Math.max(
    0,
    tabs.findIndex(t => t.id === tabParam),
  )

  // Load run detail (UI-only: reuse templates API as placeholder)
  useEffect(() => {
    if (!runId) return
    // No breaking changes to backend; this is a placeholder fetch
    fetcher.load(`/api/importer/templates?kind=import-templates`)
  }, [runId, tabParam])

  const fallback: Run = { id: runId, status: 'unknown', createdAt: new Date().toISOString(), name: runId }
  const run: Run = (fetcher.data?.run as unknown as Run) || fallback

  const onApproveAllAdds = () => {
    setToast({ content: 'Approved all adds (simulated)', error: false })
  }
  const onDelete = () => {
    setToast({ content: 'Deleted run (simulated)', error: false })
  }

  return (
    <Frame>
      <Page
        title={`Import #${runId.slice(0, 6)}`}
        backAction={{
          content: 'Imports',
          url: `/app/imports${initialSearch.toString() ? `?${initialSearch.toString()}` : ''}`,
        }}
      >
        <Layout>
          <Layout.Section>
            <Card>
              <div
                style={{
                  padding: 12,
                  position: 'sticky',
                  top: 0,
                  background: 'white',
                  zIndex: 1,
                  borderBottom: '1px solid #eee',
                }}
              >
                <InlineStack align="space-between">
                  <div>
                    <Text as="h2" variant="headingMd">
                      Run metadata
                    </Text>
                    <div style={{ marginTop: 4 }}>
                      <Badge>{run.status}</Badge>
                      <span style={{ marginLeft: 12, color: '#666' }}>
                        Created {new Date(run.createdAt).toISOString().replace('T', ' ').replace(/Z$/, '')}
                      </span>
                    </div>
                  </div>
                  <InlineStack gap="200">
                    <Button onClick={onApproveAllAdds}>Approve all adds</Button>
                    <Button onClick={() => setShowOptions(true)}>Re-run import</Button>
                    <Button tone="critical" onClick={onDelete}>
                      Delete
                    </Button>
                  </InlineStack>
                </InlineStack>
              </div>
              <div style={{ padding: 12 }}>
                <Tabs
                  tabs={tabs.map(t => ({ id: t.id, content: t.content }))}
                  selected={selected}
                  onSelect={idx => {
                    const next = new URLSearchParams(initialSearch)
                    next.set('tab', tabs[idx].id)
                    window.history.replaceState(null, '', `/app/imports/${runId}?${next.toString()}`)
                  }}
                />
                <div style={{ paddingTop: 16 }}>
                  {fetcher.state === 'loading' ? (
                    <SkeletonBodyText lines={6} />
                  ) : selected === 0 ? (
                    <div>
                      <p>Summary of discoveries and changes.</p>
                    </div>
                  ) : selected === 1 ? (
                    <div>
                      <p>Adds list.</p>
                    </div>
                  ) : selected === 2 ? (
                    <div>
                      <p>Changes list.</p>
                    </div>
                  ) : selected === 3 ? (
                    <div>
                      <p>Errors list.</p>
                    </div>
                  ) : (
                    <div>
                      <p>Completed items.</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
      {showOptions && (
        <RunOptionsModal
          open={showOptions}
          onClose={() => setShowOptions(false)}
          onConfirmed={() => {
            setShowOptions(false)
            setToast({ content: 'Import re-run started', error: false })
          }}
          context={{ runId }}
        />
      )}
      {toast && <Toast content={toast.content} error={toast.error} onDismiss={() => setToast(null)} />}
    </Frame>
  )
  // <!-- END RBP GENERATED: hq-imports-shopify-style-v1 -->
}
