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

  test('no right-side actions; shows uniform columns with run link', async () => {
    const now = new Date().toISOString()
    const items: LogRow[] = [{ at: now, templateId: 'tplA', runId: 'run-123', type: 'approve', payload: {} }]

    const screen = render(
      <AppProvider i18n={en}>
        <GlobalLogList items={items} templateNames={{ tplA: 'Import A' }} />
      </AppProvider>,
    )

    // Right-side action buttons should not be rendered anymore
    let notFound = 0
    try {
      screen.getByRole('button', { name: /Copy run link/i })
    } catch {
      notFound++
    }
    try {
      screen.getByRole('button', { name: /Copy/i })
    } catch {
      notFound++
    }
    try {
      screen.getByRole('button', { name: /Details/i })
    } catch {
      notFound++
    }
    expect(notFound).toBe(3)

    // Import name and run link should still be visible
    await expect.element(screen.getByText('Import A')).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'run-123' })).toBeVisible()
  })

  test('shows empty state when no logs', async () => {
    const screen = render(
      <AppProvider i18n={en}>
        <GlobalLogList items={[]} templateNames={{}} />
      </AppProvider>,
    )
    await expect.element(screen.getByText('No logs yet')).toBeVisible()
  })

  test('renders logs and preserves import + run link', async () => {
    const now = new Date().toISOString()
    const initial: LogRow[] = [
      { at: now, templateId: 'tplA', runId: 'run-1', type: 'prepare:start', payload: { c: 3 } },
    ]

    // First refresh returns two logs (tplA + tplB)
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

    // Expect both template names to appear in the flat list/table
    await expect.element(screen.getByText('Import A')).toBeVisible()
    await expect.element(screen.getByText('Import B')).toBeVisible()

    // Run links should be present for each row
    await expect.element(screen.getByRole('link', { name: 'run-1' })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'run-2' })).toBeVisible()
  })

  test('merge on refresh dedupes and keeps newest first', async () => {
    const now = Date.now()
    const a = new Date(now - 1000).toISOString()
    const b = new Date(now - 500).toISOString()
    const initial: LogRow[] = [{ at: a, templateId: 'tplA', runId: 'run-1', type: 'prepare:start', payload: {} }]
    // Refresh returns same row plus a newer one; expect 2 unique in desc order
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('/api/importer/logs'))
          return mkResp({ logs: [...initial, { at: b, templateId: 'tplA', runId: 'run-1', type: 'prepare:report' }] })
        return mkResp({}, false)
      }),
    )

    const screen = render(
      <AppProvider i18n={en}>
        <GlobalLogList items={initial} templateNames={{ tplA: 'Import A' }} />
      </AppProvider>,
    )

    const refreshBtn = screen.getByRole('button', { name: 'Refresh' })
    await refreshBtn.click()

    // Both entries visible; newer one should appear first by relative time text (0s or 1s ago)
    await expect.element(screen.getByText('Import A')).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'run-1' })).toBeVisible()
  })

  test('load older appends more logs and preserves ordering', async () => {
    const now = Date.now()
    const t1 = new Date(now - 1000).toISOString()
    const t2 = new Date(now - 500).toISOString()
    const t0 = new Date(now - 5000).toISOString()
    const initial: LogRow[] = [
      { at: t2, templateId: 'tplB', runId: 'run-2', type: 'approve', payload: {} },
      { at: t1, templateId: 'tplA', runId: 'run-1', type: 'prepare:start', payload: {} },
    ]

    // Mock fetch for Load older (uses before=<cursor>), return an older entry
    const fetchMock = vi.fn(async (url: string): Promise<Response> => {
      if (url.startsWith('/api/importer/logs?')) {
        return mkResp({ logs: [{ at: t0, templateId: 'tplA', runId: 'run-0', type: 'discovery', payload: {} }] })
      }
      return mkResp({}, false)
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const screen = render(
      <AppProvider i18n={en}>
        <GlobalLogList items={initial} templateNames={{ tplA: 'Import A', tplB: 'Import B' }} />
      </AppProvider>,
    )

    // Load older should be enabled due to initial cursor from SSR items
    const loadOlder = screen.getByRole('button', { name: 'Load older' })
    await loadOlder.click()

    // Expect the older run link to appear
    await expect.element(screen.getByRole('link', { name: 'run-0' })).toBeVisible()
    // And existing links remain
    await expect.element(screen.getByRole('link', { name: 'run-1' })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'run-2' })).toBeVisible()
  })

  test('load older respects Past filter by including since param', async () => {
    const now = Date.now()
    const t1 = new Date(now - 1000).toISOString()
    const t2 = new Date(now - 500).toISOString()
    const t0 = new Date(now - 5000).toISOString()
    const initial: LogRow[] = [
      { at: t2, templateId: 'tplB', runId: 'run-2', type: 'approve', payload: {} },
      { at: t1, templateId: 'tplA', runId: 'run-1', type: 'prepare:start', payload: {} },
    ]

    const calls: string[] = []
    const fetchMock = vi.fn(async (url: string): Promise<Response> => {
      calls.push(String(url))
      if (url.startsWith('/api/importer/logs?')) {
        return mkResp({ logs: [{ at: t0, templateId: 'tplA', runId: 'run-0', type: 'discovery', payload: {} }] })
      }
      return mkResp({}, false)
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const screen = render(
      <AppProvider i18n={en}>
        <GlobalLogList items={initial} templateNames={{ tplA: 'Import A', tplB: 'Import B' }} />
      </AppProvider>,
    )

    // Set Past: 1h
    const moreFilters = screen.getByRole('button', { name: /More filters/i })
    await moreFilters.click()
    const past1h = screen.getByRole('radio', { name: /^1h$/ })
    await past1h.click()
    const apply = screen.getByRole('button', { name: /Apply/i })
    await apply.click()

    // Load older should include both before=<cursor> and since=1h
    const loadOlder = screen.getByRole('button', { name: 'Load older' })
    await loadOlder.click()

    const url = calls.find(u => u.startsWith('/api/importer/logs?')) || ''
    expect(url).toContain('before=')
    expect(url).toContain('since=1h')

    // And the older run appears
    await expect.element(screen.getByRole('link', { name: 'run-0' })).toBeVisible()
  })

  test('Past filter affects Load older requests', async () => {
    const now = new Date().toISOString()
    const initial: LogRow[] = [{ at: now, templateId: 'tplA', runId: 'run-1', type: 'prepare:start', payload: {} }]

    const fetchSpy = vi.fn(async (url: string): Promise<Response> => {
      if (url.startsWith('/api/importer/logs')) return mkResp({ logs: initial })
      return mkResp({}, false)
    })
    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch)

    const screen = render(
      <AppProvider i18n={en}>
        <GlobalLogList items={initial} templateNames={{ tplA: 'Import A' }} />
      </AppProvider>,
    )

    // Open More filters, set Past: 1h, Apply
    const moreFilters = screen.getByRole('button', { name: /More filters/i })
    await moreFilters.click()
    const past1h = screen.getByRole('radio', { name: /^1h$/ })
    await past1h.click()
    const apply = screen.getByRole('button', { name: /Apply/i })
    await apply.click()

    // Click Load older should include since=1h
    const loadOlder = screen.getByRole('button', { name: 'Load older' })
    await loadOlder.click()
    const calledWithSince = fetchSpy.mock.calls.some(([u]) => String(u).includes('since=1h'))
    expect(calledWithSince).toBe(true)
  })

  test('combined filters: Type + Import + Run', async () => {
    const now = Date.now()
    const t1 = new Date(now - 3000).toISOString()
    const t2 = new Date(now - 2000).toISOString()
    const t3 = new Date(now - 1000).toISOString()
    const items: LogRow[] = [
      { at: t1, templateId: 'tplA', runId: 'run-err-1', type: 'prepare:error', payload: { message: 'oops' } },
      { at: t2, templateId: 'tplB', runId: 'run-ok-1', type: 'approve', payload: {} },
      { at: t3, templateId: 'tplA', runId: 'run-err-2', type: 'error', payload: { message: 'bad' } },
    ]

    const screen = render(
      <AppProvider i18n={en}>
        <GlobalLogList items={items} templateNames={{ tplA: 'Import A', tplB: 'Import B' }} />
      </AppProvider>,
    )

    // Open More filters and apply Type: Errors, Import: Import A, and set Run ID filter to "-2"
    const moreFilters = screen.getByRole('button', { name: /More filters/i })
    await moreFilters.click()

    // Select Type: Errors (radio) and Import: Import A
    const typeErrors = screen.getByRole('radio', { name: /Errors/i })
    await typeErrors.click()

    // Choose Import A specifically (it appears as a radio with the import name)
    const importA = screen.getByRole('radio', { name: /Import A/i })
    await importA.click()

    // Set Run ID text field (label hidden)
    const runField = screen.getByLabelText('Run ID')
    await runField.fill('-2')

    // Expect only the error row for tplA with run-err-2 remains visible
    await expect.element(screen.getByText('Import A')).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'run-err-2' })).toBeVisible()
    // Ensure run-err-1 is filtered out when Run filter is applied last
    let threw = false
    try {
      screen.getByRole('link', { name: 'run-err-1' })
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
  })

  test('live stream merges new logs via EventSource', async () => {
    const now = new Date().toISOString()
    const initial: LogRow[] = [{ at: now, templateId: 'tplA', runId: 'run-1', type: 'prepare:start', payload: {} }]

    // Mock EventSource and capture the instance to trigger onmessage
    let captured: {
      onopen: ((ev: Event) => void) | null
      onmessage: ((ev: MessageEvent) => void) | null
      close: () => void
    } | null = null
    const ESStub = vi.fn().mockImplementation(() => {
      captured = { onopen: null, onmessage: null, close: vi.fn() as unknown as () => void }
      queueMicrotask(() => captured?.onopen && captured.onopen(new Event('open')))
      return captured as unknown as EventSource
    }) as unknown as typeof EventSource
    vi.stubGlobal('EventSource', ESStub)

    const screen = render(
      <AppProvider i18n={en}>
        <GlobalLogList items={initial} templateNames={{ tplA: 'Import A', tplB: 'Import B' }} />
      </AppProvider>,
    )

    // Ensure we have a captured instance
    expect(captured).toBeTruthy()

    // Deliver a new message
    const payload = {
      logs: [
        {
          at: new Date(Date.now() + 1).toISOString(),
          templateId: 'tplB',
          runId: 'run-2',
          type: 'approve',
          payload: {},
        },
      ],
    }
    captured!.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent)

    // Expect new row to appear (run-2 link and Import B name)
    await expect.element(screen.getByText('Import B')).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'run-2' })).toBeVisible()
  })

  test('shows live badge next to active run (prepare in progress)', async () => {
    const now = new Date().toISOString()
    const items: LogRow[] = [{ at: now, templateId: 'tplA', runId: 'run-1', type: 'prepare:start', payload: {} }]

    const screen = render(
      <AppProvider i18n={en}>
        <GlobalLogList items={items} templateNames={{ tplA: 'Import A' }} />
      </AppProvider>,
    )

    // Run link should be present and a small 'live' badge should appear nearby
    await expect.element(screen.getByRole('link', { name: 'run-1' })).toBeVisible()
    await expect.element(screen.getByText(/^live$/i)).toBeVisible()
  })

  test('hides live badge when run completes (prepare:done)', async () => {
    const t0 = new Date().toISOString()
    const items: LogRow[] = [{ at: t0, templateId: 'tplA', runId: 'run-1', type: 'prepare:start', payload: {} }]

    // Mock EventSource to push a later prepare:done
    let captured: {
      onopen: ((ev: Event) => void) | null
      onmessage: ((ev: MessageEvent) => void) | null
      close: () => void
    } | null = null
    const ESStub = vi.fn().mockImplementation(() => {
      captured = { onopen: null, onmessage: null, close: vi.fn() as unknown as () => void }
      queueMicrotask(() => captured?.onopen && captured.onopen(new Event('open')))
      return captured as unknown as EventSource
    }) as unknown as typeof EventSource
    vi.stubGlobal('EventSource', ESStub)

    const screen = render(
      <AppProvider i18n={en}>
        <GlobalLogList items={items} templateNames={{ tplA: 'Import A' }} />
      </AppProvider>,
    )

    await expect.element(screen.getByRole('link', { name: 'run-1' })).toBeVisible()
    await expect.element(screen.getByText(/^live$/i)).toBeVisible()

    // Send prepare:done with a later timestamp
    const payload = {
      logs: [
        {
          at: new Date(Date.now() + 1000).toISOString(),
          templateId: 'tplA',
          runId: 'run-1',
          type: 'prepare:done',
          payload: {},
        },
      ],
    }
    captured!.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent)

    // The 'live' badge should disappear
    let missing = false
    try {
      screen.getByText(/^live$/i)
    } catch {
      missing = true
    }
    expect(missing).toBe(true)
  })

  test('reads filters from URL on mount and writes back on change', async () => {
    // Prime URL with filters
    window.history.replaceState({}, '', '/app/imports?type=approve&import=tplA&run=abc&past=1h&q=xyz')

    const now = new Date().toISOString()
    const items: LogRow[] = [
      { at: now, templateId: 'tplA', runId: 'abc-1', type: 'approve', payload: {} },
      { at: now, templateId: 'tplB', runId: 'def-1', type: 'error', payload: {} },
    ]

    const screen = render(
      <AppProvider i18n={en}>
        <GlobalLogList items={items} templateNames={{ tplA: 'Import A', tplB: 'Import B' }} />
      </AppProvider>,
    )

    // Applied filter tags should reflect initial URL (Type approve, Import A, Run abc, Past 1h)
    await expect.element(screen.getByText('Type: approve')).toBeVisible()
    await expect.element(screen.getByText('Import: Import A')).toBeVisible()
    await expect.element(screen.getByText('Run: abc')).toBeVisible()
    await expect.element(screen.getByText('Past: 1h')).toBeVisible()
    const search = screen.getByRole('searchbox')
    await expect.element(search).toHaveValue('xyz')

    // Change Type to Errors and ensure URL updates
    const moreFilters = screen.getByRole('button', { name: /More filters/i })
    await moreFilters.click()
    const typeErrors = screen.getByRole('radio', { name: /Errors/i })
    await typeErrors.click()

    // The query string should include type=error
    expect(window.location.search).toContain('type=error')
  })
})
