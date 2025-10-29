// hq-importer-new-import-v2
import { useState } from 'react'
import { Card, BlockStack, Text, Select, Checkbox, Button } from '@shopify/polaris'

export type UnmatchedLabel = { label: string; sample: string | null }
export type TemplateFieldOption = { key: string; label: string; required?: boolean }

export function MatchFieldsPanel({
  unmatched,
  templateFields,
  onApply,
}: {
  unmatched: UnmatchedLabel[]
  templateFields: TemplateFieldOption[]
  onApply: (m: { label: string; fieldKey: string; remember: boolean }) => void
}) {
  const [selection, setSelection] = useState<Record<string, { fieldKey: string; remember: boolean }>>({})
  const opts = templateFields.map(f => ({ label: f.label, value: f.key }))

  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          Match Fields
        </Text>
        {unmatched.length === 0 ? (
          <Text as="p" tone="subdued">
            All fields matched automatically.
          </Text>
        ) : (
          <div className="space-y-2">
            {unmatched.map(u => {
              const cur = selection[u.label] || { fieldKey: '', remember: true }
              return (
                <div key={u.label} className="flex items-center gap-2">
                  <div className="min-w-[220px]">
                    <Text as="span" variant="bodySm">
                      {u.label}
                    </Text>
                    {u.sample && (
                      <Text as="span" tone="subdued" variant="bodySm">
                        {' '}
                        — {u.sample}
                      </Text>
                    )}
                  </div>
                  <div className="grow">
                    <Select
                      label="Choose template field"
                      labelHidden
                      placeholder="Choose template field"
                      options={opts}
                      value={cur.fieldKey}
                      onChange={v => setSelection(s => ({ ...s, [u.label]: { ...cur, fieldKey: v || '' } }))}
                    />
                  </div>
                  <Checkbox
                    label="Remember"
                    checked={cur.remember}
                    onChange={v => setSelection(s => ({ ...s, [u.label]: { ...cur, remember: v } }))}
                  />
                  <Button
                    onClick={() => {
                      if (cur.fieldKey) onApply({ label: u.label, fieldKey: cur.fieldKey, remember: cur.remember })
                    }}
                  >
                    Apply
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </BlockStack>
    </Card>
  )
}
