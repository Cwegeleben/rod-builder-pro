import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { AppProvider } from '@shopify/polaris'
// Polaris i18n for tests
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON module resolution for vitest
import en from '@shopify/polaris/locales/en.json'
import RecentRunsTable from '../RecentRunsTable'

const mkResp = (json: unknown, ok = true) =>
  ({
    ok,
    status: ok ? 200 : 500,
    json: async () => json,
  }) as Response

describe('RecentRunsTable (browser integration)', () => {
  const now = new Date().toISOString()
  const logs = [
    { at: now, templateId: 'tplA', runId: 'run-ready-1', type: 'prepare:consistency', payload: { diffCount: 5 } },
    { at: now, templateId: 'tplB', runId: 'run-pub-1', type: 'prepare:consistency', payload: { diffCount: 3 } },
  ]

  beforeEach(() => {
    vi.useFakeTimers()
    // Mock fetch calls used by component
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/importer/logs')) return mkResp({ logs })
        if (url.includes('/api/importer/runs/run-ready-1/status')) return mkResp({ status: 'staged', startedAt: now })
        if (url.includes('/api/importer/runs/run-pub-1/status')) return mkResp({ status: 'published', startedAt: now })
        return mkResp({}, false)
      }),
    )
  })

  test('renders statuses and actions', async () => {
    const screen = render(
      <AppProvider i18n={en}>
        <RecentRunsTable />
      </AppProvider>,
    )

    // Let initial fetch resolve
    await vi.advanceTimersByTimeAsync(0)

    // Expect the two template badges to be present
    await expect.element(screen.getByText('tplA')).toBeVisible()
    await expect.element(screen.getByText('tplB')).toBeVisible()

    // Friendly status badges
    await expect.element(screen.getByText('Ready')).toBeVisible()
    await expect.element(screen.getByText('Published')).toBeVisible()

    // Schedule button should be visible for the published row
    await expect.element(screen.getByRole('button', { name: 'Schedule' })).toBeVisible()
  })
})
