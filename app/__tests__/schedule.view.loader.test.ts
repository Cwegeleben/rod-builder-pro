import { describe, test, expect, vi, beforeEach } from 'vitest'
import type { LoaderFunctionArgs } from '@remix-run/node'

// Mock prisma with spies
const mockFindUnique = vi.fn()
const mockLogCreate = vi.fn()
vi.mock('../db.server', () => ({
  prisma: {
    importTemplate: { findUnique: mockFindUnique },
    importLog: { create: mockLogCreate },
  },
}))

// Minimal template fixture
const baseTemplate = {
  id: 'tpl-1',
  name: 'Import One',
  state: 'APPROVED',
  importConfig: { schedule: { enabled: true, freq: 'daily', at: '07:30', nextRunAt: '2025-11-08T07:30:00.000Z' } },
}

async function invoke(params: Partial<LoaderFunctionArgs>) {
  const mod = await import('../routes/app.imports.$templateId.schedule')
  const loader = mod.loader as (args: LoaderFunctionArgs) => Promise<Response>
  return loader({
    params: { templateId: 'tpl-1', ...(params.params || {}) },
    request: new Request('http://localhost/app/imports/tpl-1/schedule', {
      headers: { 'user-agent': 'vitest-test' },
    }),
    context: {},
  } as LoaderFunctionArgs)
}

describe('Schedule page loader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockFindUnique.mockResolvedValue(baseTemplate)
    mockLogCreate.mockResolvedValue({ id: 'log-1' })
  })

  test('emits schedule:view log with expected payload fields', async () => {
    const res = await invoke({})
    expect(res.ok).toBe(true)
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'tpl-1' },
      select: { id: true, name: true, state: true, importConfig: true },
    })
    expect(mockLogCreate).toHaveBeenCalledTimes(1)
    const call = mockLogCreate.mock.calls[0][0]
    expect(call.data.type).toBe('schedule:view')
    expect(call.data.templateId).toBe('tpl-1')
    expect(call.data.runId).toMatch(/^schedule-\d+/)
    // Basic payload shape assertions
    expect(call.data.payload).toMatchObject({
      state: 'APPROVED',
      enabled: true,
      freq: 'daily',
      at: '07:30',
      nextRunAt: '2025-11-08T07:30:00.000Z',
    })
    // UA is best effort
    // ua is optional; narrow payload type for assertion
    const payload = call.data.payload as { ua?: string }
    expect(payload.ua).toBe('vitest-test')
  })

  test('handles missing template', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    const res = await invoke({ params: { templateId: 'nope' } })
    expect(res.status).toBe(404)
    // Should not log when template missing
    expect(mockLogCreate).not.toHaveBeenCalled()
  })
})
