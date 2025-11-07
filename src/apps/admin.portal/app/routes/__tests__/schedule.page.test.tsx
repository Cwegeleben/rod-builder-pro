import { describe, test, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { AppProvider } from '@shopify/polaris'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import en from '@shopify/polaris/locales/en.json'
import ImportSchedulePage from '../app.imports.$templateId.schedule'
import { ImportState } from '../../state/importerMachine'

// Basic unit/integration style test to ensure the schedule page renders distinct UX elements

describe('ImportSchedulePage', () => {
  test('renders title with template name, settings link, gating hint and version tag', async () => {
    const screen = render(
      <AppProvider i18n={en}>
        <ImportSchedulePage
          initialTemplateName="Template A"
          initialState={ImportState.APPROVED}
          initialSchedule={{ enabled: true, freq: 'daily', at: '09:00', nextRunAt: '2025-11-07T09:00:00.000Z' }}
        />
      </AppProvider>,
    )

    await expect.element(screen.getByText(/Schedule — Template A/)).toBeVisible()
    await expect.element(screen.getByRole('link', { name: /Manage settings/i })).toBeVisible()
    await expect.element(screen.getByText(/Scheduling available/)).toBeVisible()
    await expect.element(screen.getByText(/Importer v2.3/)).toBeVisible()
  })

  test('shows gating message when not approved', async () => {
    const screen = render(
      <AppProvider i18n={en}>
        <ImportSchedulePage
          initialTemplateName="Template B"
          initialState={ImportState.NEEDS_SETTINGS}
          initialSchedule={{ enabled: false, freq: 'none', at: '09:00', nextRunAt: undefined }}
        />
      </AppProvider>,
    )

    await expect.element(screen.getByText(/Schedule — Template B/)).toBeVisible()
    await expect.element(screen.getByText(/Enable after a published run/)).toBeVisible()
  })
})
