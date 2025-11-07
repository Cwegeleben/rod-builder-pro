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
            {
              id: 'tpl1',
              name: 'Test Import',
              state: 'READY',
              hadFailures: false,
              lastRunAt: null,
              preparing: null,
              hasSeeds: true,
              hasStaged: false,
              queuedCount: 0,
              lastRunId: null,
            },
          ],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }
    // No other endpoints used in this simplified smoke test
    return new Response('not found', { status: 404 })
  })
  vi.stubGlobal('fetch', handler)
  return handler
}

describe('ImportList simplified list row', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  test('renders list row and basic actions (smoke)', async () => {
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
    // No prepare button in simplified UI
    const buttons = Array.from(document.querySelectorAll('button'))
    expect(buttons.some(b => /Prepare review/i.test(b.textContent || ''))).toBe(false)
    // No schedule button for READY state
    expect(buttons.some(b => /(Schedule|Enable schedule|Disable schedule)/i.test(b.textContent || ''))).toBe(false)
  })
})
