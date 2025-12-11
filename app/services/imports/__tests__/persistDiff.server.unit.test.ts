import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProductDiff } from '../../../domain/imports/diffTypes'

const { createMock, createManyMock, transactionMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  createManyMock: vi.fn(),
  transactionMock: vi.fn(),
}))

vi.mock('../../../db.server', () => ({
  prisma: {
    productImportRun: { create: createMock },
    productImportRunItem: { createMany: createManyMock },
    $transaction: transactionMock,
  },
}))

import { saveImportRunDiff } from '../persistDiff.server'

const prismaTx = {
  productImportRun: { create: createMock },
  productImportRunItem: { createMany: createManyMock },
}

describe('saveImportRunDiff', () => {
  beforeEach(() => {
    createMock.mockReset().mockResolvedValue({ id: 'run_test' })
    createManyMock.mockReset().mockResolvedValue({ count: 1 })
    transactionMock
      .mockReset()
      .mockImplementation(async (callback: (tx: typeof prismaTx) => Promise<unknown>) => callback(prismaTx))
  })

  it('persists run summary and diff items', async () => {
    const diffs: ProductDiff[] = [
      {
        supplier: 'batson',
        supplierSiteId: 'batson-rod-blanks',
        productCode: 'IMMWS84MH',
        category: 'blank',
        kind: 'add',
        before: undefined,
        after: {
          category: 'blank',
          brand: 'Rainshadow',
          series: 'Immortal',
          msrp: 189.99,
          availability: 'inStock',
          designStudioReady: true,
          attributes: { power: 'MH' },
        },
      },
    ]

    const result = await saveImportRunDiff({ supplierSlug: 'batson', diffs, startedAt: new Date('2024-01-01') })

    expect(result.counts).toEqual({ adds: 1, changes: 0, deletes: 0 })
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supplierSlug: 'batson',
          totalAdds: 1,
          totalChanges: 0,
          totalDeletes: 0,
        }),
      }),
    )
    expect(createManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            runId: 'run_test',
            productCode: 'IMMWS84MH',
            kind: 'add',
            beforeSnapshot: Prisma.JsonNull,
            afterSnapshot: expect.objectContaining({ category: 'blank' }),
          }),
        ],
      }),
    )
  })
})
