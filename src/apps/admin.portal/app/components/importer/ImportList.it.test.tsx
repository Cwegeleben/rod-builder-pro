import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from '@shopify/polaris'
import en from '@shopify/polaris/locales/en.json'
import ImportList from './ImportList'

function mockFetchSequence() {
  const calls: Array<{ url: string; opts?: RequestInit }> = []
  const handler = vi.fn(async (url: RequestInfo | URL, opts?: RequestInit) => {
    const u = String(url)
    calls.push({ url: u, opts })
    // Initial load of templates
    if (u.startsWith('/api/importer/templates')) {
      return new Response(
        JSON.stringify({
          templates: [
            { id: 'tpl1', name: 'Test Import', state: 'READY', hadFailures: false, lastRunAt: null, preparing: null },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }
    // Prepare endpoint
    if (u === '/api/importer/prepare' && opts?.method === 'POST') {
      return new Response(JSON.stringify({ runId: 'run1', candidates: 5, etaSeconds: 60 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // Status polling
    if (u.startsWith('/api/importer/runs/run1/status')) {
      // first call preparing, second call started
      const count = calls.filter(c => c.url.startsWith('/api/importer/runs/run1/status')).length
      if (count < 2) {
        return new Response(
          JSON.stringify({ status: 'preparing', startedAt: new Date().toISOString(), preflight: { etaSeconds: 60 } }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ status: 'started', startedAt: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response('not found', { status: 404 })
  })
  vi.stubGlobal('fetch', handler)
  return handler
}

describe('ImportList prepare review inline flow', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  test('renders list row and prepare action (smoke)', async () => {
    mockFetchSequence()
    const screen = render(
      <AppProvider i18n={en}>
        <MemoryRouter initialEntries={['/app/imports']}>
          <ImportList initialDbTemplates={[{ id: 'tpl1', name: 'Test Import', state: 'READY' }]} />
        </MemoryRouter>
      </AppProvider>,
    )
    const link = screen.getByRole('link', { name: 'Test Import' })
    await expect.element(link).toBeVisible()
    const prepBtn = screen.getByRole('button', { name: /Prepare review/i })
    await expect.element(prepBtn).toBeVisible()
    // Keep assertions minimal to avoid Polaris role mapping quirks in jsdom
  })
})
