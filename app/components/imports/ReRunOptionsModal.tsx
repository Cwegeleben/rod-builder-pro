// <!-- BEGIN RBP GENERATED: admin-hq-importer-ux-v2 -->
import { Modal, TextField, Checkbox, Text, BlockStack } from '@shopify/polaris'
import { useState } from 'react'

export function ReRunOptionsModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (opts: { skipSuccessful: boolean; manualUrls: string; schedule: 'once' | 'next' }) => void
}) {
  const [skipSuccessful, setSkipSuccessful] = useState(true)
  const [manualUrls, setManualUrls] = useState('')
  const [schedule, setSchedule] = useState<'once' | 'next'>('once')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Re-run Options"
      primaryAction={{
        content: 'Confirm',
        onAction: () => onConfirm({ skipSuccessful, manualUrls, schedule }),
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="200">
          <Checkbox
            label="Skip previously successful products"
            checked={skipSuccessful}
            onChange={v => setSkipSuccessful(Boolean(v))}
          />
          <div>
            <Text as="h3" variant="headingSm">
              Manual URLs
            </Text>
            <Text as="p" tone="subdued" variant="bodySm">
              Paste URLs to include in this run (newline or comma separated)
            </Text>
            <TextField
              label="Manual URLs"
              labelHidden
              value={manualUrls}
              onChange={setManualUrls}
              multiline
              autoComplete="off"
            />
          </div>
          <div>
            <Text as="h3" variant="headingSm">
              Scheduler override
            </Text>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="schedule"
                  value="once"
                  checked={schedule === 'once'}
                  onChange={() => setSchedule('once')}
                />
                Once
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="schedule"
                  value="next"
                  checked={schedule === 'next'}
                  onChange={() => setSchedule('next')}
                />
                Next window
              </label>
            </div>
          </div>
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}
// <!-- END RBP GENERATED: admin-hq-importer-ux-v2 -->
