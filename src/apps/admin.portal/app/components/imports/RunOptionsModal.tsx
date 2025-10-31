import { useEffect, useState } from 'react'
import { useFetcher } from '@remix-run/react'
import { Modal, TextField, Checkbox, FormLayout } from '@shopify/polaris'

export default function RunOptionsModal({
  open,
  onClose,
  onConfirmed,
  context,
}: {
  open: boolean
  onClose: () => void
  onConfirmed: () => void
  context?: { runId?: string }
}) {
  // <!-- BEGIN RBP GENERATED: hq-imports-shopify-style-v1 -->
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>()
  const [seedUrl, setSeedUrl] = useState('')
  const [manualUrls, setManualUrls] = useState('')
  const [skipSuccessful, setSkipSuccessful] = useState(true)

  const busy = fetcher.state === 'submitting'

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok) onConfirmed()
  }, [fetcher.state, fetcher.data, onConfirmed])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Run options"
      primaryAction={{
        content: busy ? 'Starting…' : 'Start import',
        loading: busy,
        onAction: () => {
          const fd = new FormData()
          fd.append('seedUrl', seedUrl)
          fd.append('manualUrls', manualUrls)
          fd.append('skipSuccessful', String(skipSuccessful))
          if (context?.runId) fd.append('runId', context.runId)
          fetcher.submit(fd, { method: 'post', action: '/api/importer/run' })
        },
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <FormLayout>
          <TextField label="Seed URL to crawl" value={seedUrl} onChange={setSeedUrl} autoComplete="off" />
          <TextField
            label="Manual product URLs"
            value={manualUrls}
            onChange={setManualUrls}
            autoComplete="off"
            multiline={4}
            helpText="One per line"
          />
          <Checkbox label="Skip already successful" checked={skipSuccessful} onChange={setSkipSuccessful} />
        </FormLayout>
      </Modal.Section>
    </Modal>
  )
  // <!-- END RBP GENERATED: hq-imports-shopify-style-v1 -->
}
