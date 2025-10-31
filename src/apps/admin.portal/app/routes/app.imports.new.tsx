// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
import { Form, useActionData, useNavigation, useLocation } from '@remix-run/react'
import { useRef, useState } from 'react'
import { Page, Card, BlockStack, TextField, Button, InlineStack, Text, Banner } from '@shopify/polaris'

export default function NewImportWizard() {
  const nav = useNavigation()
  const busy = nav.state !== 'idle'
  const location = useLocation()
  const [name, setName] = useState('')
  const actionData = useActionData<{ error?: string }>()
  const formRef = useRef<HTMLFormElement | null>(null)
  return (
    <Page title="Add import">
      <Card>
        <Form method="post" ref={formRef}>
          <BlockStack gap="300">
            <Text as="p" tone="subdued">
              Create a new import template. You can configure details on the next page.
            </Text>
            {actionData?.error ? <Banner tone="critical">{actionData.error}</Banner> : null}
            <div style={{ maxWidth: 520 }}>
              <TextField
                label="Import name"
                value={name}
                onChange={setName}
                autoComplete="off"
                placeholder="e.g., Batson Blanks"
                helpText="You can change this later in Settings."
                name="name"
              />
            </div>
            <InlineStack gap="200">
              <Button variant="primary" loading={busy} onClick={() => formRef.current?.requestSubmit()}>
                {busy ? 'Creating…' : 'Create import'}
              </Button>
              <Button url={`/app/imports${location.search}`}>Cancel</Button>
            </InlineStack>
          </BlockStack>
        </Form>
      </Card>
    </Page>
  )
}
// <!-- END RBP GENERATED: importer-v2-3 -->
