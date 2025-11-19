import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ActionFunctionArgs } from '@remix-run/node'

vi.mock('../../app/lib/access.server', () => ({ requireHqShopOr404: vi.fn(async () => {}) }))
vi.mock('../../app/services/importer/orchestrator.server', () => ({
  startNextQueuedForTemplate: vi.fn(async () => {}),
}))

vi.mock('../../app/db.server', () => {
  const prisma = {
    importTemplate: {
      findMany: vi.fn(async () => []),
      update: vi.fn(async () => ({})),
    },
    importRun: {
      findUnique: vi.fn(async () => null),
    },
    importLog: {
      create: vi.fn(async () => ({})),
    },
  }
  return { prisma }
})

import { action } from '../../app/routes/api.importer.maintenance.cleanup'
import { prisma } from '../../app/db.server'
import { startNextQueuedForTemplate } from '../../app/services/importer/orchestrator.server'

describe('POST /api/importer/maintenance/cleanup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('clears slots that point to terminal or missing runs and promotes next', async () => {
    // Arrange: two templates, one with terminal run, one with missing run
    // @ts-expect-error test-shape
    prisma.importTemplate.findMany.mockResolvedValueOnce([
      { id: 'tpl-a', preparingRunId: 'run-a' },
      { id: 'tpl-b', preparingRunId: 'run-b' },
    ])
    // @ts-expect-error test-shape
    prisma.importRun.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      const { where } = args
      if (where.id === 'run-a') return { id: 'run-a', status: 'staged' } // terminal
      if (where.id === 'run-b') return null // missing
      return null
    })

    const req = new Request('http://localhost/api/importer/maintenance/cleanup', {
      method: 'POST',
      headers: { 'x-hq-override': '1' },
    })
    const res = await action({ request: req } as unknown as ActionFunctionArgs)
    expect(res.status).toBe(200)
    const payload = (await res.json()) as { ok?: boolean; cleared?: number; inspected?: number }
    expect(payload.ok).toBe(true)
    expect(payload.inspected).toBe(2)
    expect(payload.cleared).toBe(2)
    expect(prisma.importTemplate.update).toHaveBeenCalledTimes(2)
    expect(prisma.importLog.create).toHaveBeenCalledTimes(2)
    expect(startNextQueuedForTemplate).toHaveBeenCalledWith('tpl-a')
    expect(startNextQueuedForTemplate).toHaveBeenCalledWith('tpl-b')
  })
})
