import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ActionFunctionArgs } from '@remix-run/node'

vi.mock('../../app/lib/access.server', () => ({ isHqShop: vi.fn(async () => true) }))
vi.mock('../../app/services/importer/orchestrator.server', () => ({ kickTemplate: vi.fn(async () => {}) }))

vi.mock('../../app/db.server', () => {
  const prisma = {
    importRun: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
    importTemplate: {
      findUnique: vi.fn(async () => null),
      update: vi.fn(async () => ({})),
    },
    importLog: {
      create: vi.fn(async () => ({})),
    },
  }
  return { prisma }
})

import { action } from '../../app/routes/api.importer.runs.$runId.cancel'
import { prisma } from '../../app/db.server'
import { kickTemplate } from '../../app/services/importer/orchestrator.server'

describe('POST /api/importer/runs/:runId/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks cancelRequested, clears slot when owned, logs, and kicks promotion', async () => {
    // Arrange DB snapshots
    // @ts-expect-error test-shape
    prisma.importRun.findUnique.mockResolvedValueOnce({
      id: 'run-1',
      status: 'started',
      summary: { options: { templateId: 'tpl-1' } },
    })
    // @ts-expect-error test-shape
    prisma.importTemplate.findUnique.mockResolvedValueOnce({ id: 'tpl-1', preparingRunId: 'run-1' })

    const req = new Request('http://localhost/api/importer/runs/run-1/cancel', {
      method: 'POST',
      headers: { 'x-hq-override': '1' },
    })

    // Act
    const res = await action({ request: req, params: { runId: 'run-1' } } as unknown as ActionFunctionArgs)
    expect(res.status).toBe(200)
    const body = (await res.json()) as
      | { error: string }
      | { ok: boolean; alreadyTerminal: boolean; clearedSlot: boolean }
    if ('error' in body) throw new Error(`unexpected error: ${body.error}`)
    expect(body.ok).toBe(true)
    expect(body.alreadyTerminal).toBe(false)
    expect(body.clearedSlot).toBe(true)

    // Assert side effects
    expect(prisma.importRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({ summary: expect.any(Object) }),
      }),
    )
    expect(prisma.importTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'tpl-1' }, data: { preparingRunId: null } }),
    )
    expect(prisma.importLog.create).toHaveBeenCalled()
    expect(kickTemplate).toHaveBeenCalledWith('tpl-1')
  })

  it('is idempotent on terminal runs and still clears slot', async () => {
    // @ts-expect-error test-shape
    prisma.importRun.findUnique.mockResolvedValueOnce({
      id: 'run-2',
      status: 'staged',
      summary: { options: { templateId: 'tpl-2' } },
    })
    // @ts-expect-error test-shape
    prisma.importTemplate.findUnique.mockResolvedValueOnce({ id: 'tpl-2', preparingRunId: 'run-2' })
    const req = new Request('http://localhost/api/importer/runs/run-2/cancel', {
      method: 'POST',
      headers: { 'x-hq-override': '1' },
    })
    const res = await action({ request: req, params: { runId: 'run-2' } } as unknown as ActionFunctionArgs)
    expect(res.status).toBe(200)
    const body = (await res.json()) as
      | { error: string }
      | { ok: boolean; alreadyTerminal: boolean; clearedSlot: boolean }
    if ('error' in body) throw new Error(`unexpected error: ${body.error}`)
    expect(body.ok).toBe(true)
    expect(body.alreadyTerminal).toBe(true)
    expect(body.clearedSlot).toBe(true)
  })
})
