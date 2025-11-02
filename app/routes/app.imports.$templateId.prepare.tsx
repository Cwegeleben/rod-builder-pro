import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useEffect, useState } from 'react'
import { useLoaderData, useNavigate } from '@remix-run/react'
import { requireHqShopOr404 } from '../lib/access.server'
import { Card, Page, ProgressBar, Text, BlockStack, InlineStack } from '@shopify/polaris'

type PrepareData = { runId: string; candidates: number; etaSeconds: number }

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireHqShopOr404(request)
  const templateId = String(params.templateId || '')
  if (!templateId) throw new Response('Not Found', { status: 404 })
  // Do not start work here; the client will POST to prepare and then poll.
  return json({ templateId })
}

export default function PrepareReviewPage() {
  const { templateId } = useLoaderData<typeof loader>()
  const [snapshot, setSnapshot] = useState<PrepareData | null>(null)
  const [progress, setProgress] = useState(0)
  const nav = useNavigate()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Kick off prepare
      const res = await fetch('/api/importer.prepare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateId }),
      })
      if (!res.ok) return
      const data = (await res.json()) as PrepareData
      if (cancelled) return
      setSnapshot(data)

      // Poll status
      const started = Date.now()
      const t = setInterval(async () => {
        if (!data.runId) return
        const s = await fetch(`/api/importer/runs/${data.runId}/status`)
        if (!s.ok) return
        const j = (await s.json()) as {
          status: string
          counts?: Record<string, number>
          preflight?: { candidates?: number; etaSeconds?: number }
        }
        const elapsed = (Date.now() - started) / 1000
        const eta = data.etaSeconds || 60
        const pct = Math.max(5, Math.min(95, Math.round((elapsed / Math.max(eta, 30)) * 100)))
        setProgress(j.status === 'started' ? Math.max(pct, 30) : pct)
        if (j.status === 'started') {
          // We consider this ready for review; navigate now.
          clearInterval(t)
          nav(`/app/imports/runs/${data.runId}/review`)
        }
        if (j.status === 'failed' || j.status === 'canceled') {
          clearInterval(t)
          // Navigate back to settings with an error indicator
          nav(`/app/imports/${templateId}?reviewError=1`)
        }
      }, 2000)
      return () => clearInterval(t)
    })()
    return () => {
      cancelled = true
    }
  }, [templateId, nav])

  return (
    <Page title="Preparing review">
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd">
            We’re preparing your review. You can leave this page and return anytime.
          </Text>
          <ProgressBar progress={progress} size="small" />
          {snapshot && (
            <InlineStack gap="400" align="space-between">
              <Text as="span" tone="subdued">
                Candidates: {snapshot.candidates}
              </Text>
              <Text as="span" tone="subdued">
                ETA: ~{Math.ceil((snapshot.etaSeconds || 60) / 60)} min
              </Text>
            </InlineStack>
          )}
        </BlockStack>
      </Card>
    </Page>
  )
}
