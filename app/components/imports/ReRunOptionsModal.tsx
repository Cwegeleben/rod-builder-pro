// <!-- BEGIN RBP GENERATED: admin-hq-importer-ux-v2 -->
import { Modal, TextField, Checkbox, Text, BlockStack, Select } from '@shopify/polaris'
import { useState } from 'react'
// <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
import type { ImporterTemplate } from '../../loaders/templates.server'
// <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->

export function ReRunOptionsModal({
  open,
  onClose,
  onConfirm,
  // <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
  templates = [],
  // <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->
}: {
  open: boolean
  onClose: () => void
  onConfirm: (opts: {
    skipSuccessful: boolean
    manualUrls: string
    schedule: 'once' | 'next'
    // <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
    templateKey?: string
    // <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->
  }) => void
  // <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
  templates?: ImporterTemplate[]
  // <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->
}) {
  const [skipSuccessful, setSkipSuccessful] = useState(true)
  const [manualUrls, setManualUrls] = useState('')
  const [schedule, setSchedule] = useState<'once' | 'next'>('once')
  // <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
  const defaultTpl = templates.find(t => t.isDefault) || templates[0]
  const [templateKey, setTemplateKey] = useState<string | undefined>(defaultTpl?.key)
  // <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Re-run Options"
      primaryAction={{
        content: 'Confirm',
        // <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
        onAction: () => onConfirm({ skipSuccessful, manualUrls, schedule, templateKey }),
        // <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->
      }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="200">
          {/* <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 --> */}
          <div>
            <Select
              label="Template"
              placeholder="Select a template"
              options={templates.map(t => ({ label: `${t.name}${t.site ? ` (${t.site})` : ''}`, value: t.key }))}
              value={templateKey || ''}
              onChange={v => setTemplateKey(v || undefined)}
            />
            <Text as="p" variant="bodySm" tone="subdued">
              Defines how fields are extracted (JSON-LD → DOM → slug → hash)
            </Text>
          </div>
          {/* <!-- END RBP GENERATED: importer-templates-integration-v2-1 --> */}
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
