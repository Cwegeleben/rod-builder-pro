// <!-- BEGIN RBP GENERATED: importer-extractor-templates-v2 -->
import { Card, BlockStack, InlineStack, Text, TextField, Button, Badge } from '@shopify/polaris'
import { FieldBadge, type FieldSource, type FieldStatus } from './FieldBadge'

export type FieldRow = {
  name: string
  value: string | null
  source: FieldSource
  status: FieldStatus
}

export function PreviewPane({
  url,
  fields,
  onTestSelector,
  onSaveSelector,
}: {
  url: string
  fields: FieldRow[]
  onTestSelector?: (name: string, selector: string) => void
  onSaveSelector?: (name: string, selector: string) => void
}) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingMd">
            Extracted
          </Text>
          <Badge tone="info">
            {(() => {
              try {
                return new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://example.com')
                  .hostname
              } catch {
                return '—'
              }
            })()}
          </Badge>
        </InlineStack>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <BlockStack gap="200">
              {fields.map(f => (
                <div key={f.name} className="rounded border border-slate-200 p-2">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" fontWeight="semibold">
                      {f.name}
                    </Text>
                    <FieldBadge source={f.source} status={f.status} />
                  </InlineStack>
                  <div className="mt-1 text-sm">{f.value || '—'}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <TextField
                      label="Selector"
                      labelHidden
                      placeholder=".selector or meta[itemprop=sku]@content"
                      onChange={sel => onTestSelector?.(f.name, sel)}
                      autoComplete="off"
                    />
                    <Button
                      onClick={() => {
                        const el = document.querySelector(
                          `input[aria-label=Selector][id^=PolarisTextField]`,
                        ) as HTMLInputElement | null
                        const sel = el?.value || ''
                        onSaveSelector?.(f.name, sel)
                      }}
                    >
                      Save to template
                    </Button>
                  </div>
                </div>
              ))}
            </BlockStack>
          </div>
          <div>
            <div className="rounded border border-dashed p-6 text-center text-sm text-slate-500">
              Raw preview omitted (uses Playwright server preview).
            </div>
          </div>
        </div>
      </BlockStack>
    </Card>
  )
}
// <!-- END RBP GENERATED: importer-extractor-templates-v2 -->
