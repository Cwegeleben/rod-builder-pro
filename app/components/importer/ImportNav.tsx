// Lightweight navigation bar for Importer sections, modeled after Shopify Admin
import { InlineStack, Button, ButtonGroup, Text } from '@shopify/polaris'
import { useLocation } from '@remix-run/react'

type Props = {
  current?: 'runs' | 'settings'
  title?: string
  actions?: React.ReactNode
}

export function ImportNav({ current, title, actions }: Props) {
  const loc = useLocation()
  const isRuns = current === 'runs' || loc.pathname.startsWith('/app/admin/import/runs')
  const isSettings = current === 'settings' || loc.pathname.startsWith('/app/admin/import/settings')

  return (
    <InlineStack align="space-between" blockAlign="center">
      <InlineStack gap="300" blockAlign="center">
        {title ? (
          <Text as="h2" variant="headingLg">
            {title}
          </Text>
        ) : null}
        <ButtonGroup>
          <Button url="/app/admin/import/runs" variant={isRuns ? 'primary' : undefined}>
            Runs
          </Button>
          <Button url="/app/admin/import/settings" variant={isSettings ? 'primary' : undefined}>
            Settings
          </Button>
        </ButtonGroup>
      </InlineStack>
      {actions}
    </InlineStack>
  )
}
