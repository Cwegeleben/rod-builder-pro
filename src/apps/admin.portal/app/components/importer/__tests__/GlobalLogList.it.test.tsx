import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { AppProvider } from '@shopify/polaris'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON module resolution for vitest
import en from '@shopify/polaris/locales/en.json'
import GlobalLogList from '../GlobalLogList'

type LogRow = { at: string; templateId: string; runId: string; type: string; payload?: unknown }

const mkResp = (json: unknown, ok = true) =>
  ({
    ok,
    status: ok ? 200 : 500,
    json: async () => json,
  }) as Response

describe('GlobalLogList (browser integration)', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  test('shows empty state when no logs', async () => {
    const screen = render(
      <AppProvider i18n={en}>
        <GlobalLogList items={[]} templateNames={{}} />
      </AppProvider>,
    )
    await expect.element(screen.getByText('No logs yet')).toBeVisible()
  })

  test('refresh loads logs and groups by template', async () => {
    const now = new Date().toISOString()
    const initial: LogRow[] = [
      { at: now, templateId: 'tplA', runId: 'run-1', type: 'prepare:start', payload: { c: 3 } },
    ]

    // First refresh returns two groups (tplA + tplB)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/importer/logs'))
          return mkResp({ logs: [...initial, { at: now, templateId: 'tplB', runId: 'run-2', type: 'approve' }] })
        return mkResp({}, false)
      }),
    )

    const screen = render(
      <AppProvider i18n={en}>
        <GlobalLogList items={initial} templateNames={{ tplA: 'Import A', tplB: 'Import B' }} />
      </AppProvider>,
    )

    // Click Refresh
    const refreshBtn = screen.getByRole('button', { name: 'Refresh' })
    await refreshBtn.click()

    // Expect both template headers to appear
    await expect.element(screen.getByText(/template Import A/)).toBeVisible()
    await expect.element(screen.getByText(/template Import B/)).toBeVisible()
  })
})
