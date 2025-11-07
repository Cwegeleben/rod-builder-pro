import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from '@shopify/polaris'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON module resolution for vitest
import en from '@shopify/polaris/locales/en.json'
import ImportList from './ImportList'

function mockFetch() {
  const handler = vi.fn(async (url: RequestInfo | URL, opts?: RequestInit) => {
    const u = String(url)
    if (u.startsWith('/api/importer/templates')) {
      return new Response(
        JSON.stringify({
          templates: [
            {
              id: 'tpl1',
              name: 'Sched Import',
              state: 'APPROVED',
              hadFailures: false,
              lastRunAt: null,
              preparing: null,
              hasSeeds: true,
              hasStaged: true,
              queuedCount: 0,
              lastRunId: null,
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }
    if (u === '/api/importer/schedule' && opts?.method === 'POST') {
      return new Response(
        JSON.stringify({
          ok: true,
          state: 'SCHEDULED',
          schedule: { enabled: true, nextRunAt: new Date().toISOString() },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }
    return new Response('not found', { status: 404 })
  })
  vi.stubGlobal('fetch', handler)
  return handler
}

describe('ImportList inline schedule toggle', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  test('enables schedule and shows toast', async () => {
    mockFetch()
    const screen = render(
      <AppProvider i18n={en}>
        <MemoryRouter initialEntries={['/app/imports']}>
          <ImportList initialDbTemplates={[{ id: 'tpl1', name: 'Sched Import', state: 'APPROVED' }]} />
        </MemoryRouter>
      </AppProvider>,
    )

    const enableBtn = Array.from(document.querySelectorAll('button')).find(b =>
      /Enable schedule/i.test(b.textContent || ''),
    ) as HTMLButtonElement | undefined
    expect(enableBtn).toBeTruthy()
    // Click to enable schedule
    enableBtn!.click()

    // Expect toast and button label change
    await expect.element(screen.getByText('Schedule enabled')).toBeVisible()
    const disableBtn = Array.from(document.querySelectorAll('button')).find(b =>
      /Disable schedule/i.test(b.textContent || ''),
    )
    expect(disableBtn).toBeTruthy()
  })
})
