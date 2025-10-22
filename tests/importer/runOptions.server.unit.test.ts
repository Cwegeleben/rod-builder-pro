import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../packages/importer/src/crawlers/batsonCrawler', () => ({
  crawlBatson: vi.fn(async () => 0),
}))

vi.mock('../../packages/importer/src/seeds/sources', () => ({
  fetchActiveSources: vi.fn(async () => []),
  upsertProductSource: vi.fn(async () => {}),
}))

vi.mock('../../app/db.server', () => ({
  prisma: {
    importDiff: {
      deleteMany: vi.fn(async () => {}),
      count: vi.fn(async () => 0),
      createMany: vi.fn(async () => {}),
      findMany: vi.fn(async () => []),
    },
    importRun: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'new-run-id' })),
      update: vi.fn(async () => ({})),
    },
    partStaging: {
      findMany: vi.fn(async () => []),
      upsert: vi.fn(async () => ({})),
    },
    $queryRawUnsafe: vi.fn(async () => []),
  },
}))

import { parseRunOptions, startImportFromOptions } from '../../app/services/importer/runOptions.server'
import { crawlBatson } from '../../packages/importer/src/crawlers/batsonCrawler'

describe('runOptions.server', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parseRunOptions reads templateKey and URLs', () => {
    const fd = new FormData()
    fd.set('includeSeeds', 'on')
    fd.set('skipSuccessful', '')
    fd.set('notes', 'hello')
    fd.set('manualUrls', 'https://example.com/a, https://example.com/b')
    fd.set('templateKey', 'batson.product.v2')
    const opts = parseRunOptions(fd)
    expect(opts.includeSeeds).toBe(true)
    expect(opts.skipSuccessful).toBe(false)
    expect(opts.notes).toBe('hello')
    expect(opts.manualUrls).toEqual(['https://example.com/a', 'https://example.com/b'])
    expect(opts.templateKey).toBe('batson.product.v2')
  })

  it('startImportFromOptions passes templateKey to crawlBatson', async () => {
    const options = {
      mode: 'price_avail' as const,
      includeSeeds: false,
      manualUrls: ['https://batsonenterprises.com/products/foo'],
      skipSuccessful: false,
      notes: '',
      templateKey: 'batson.product.v2',
    }
    const runId = await startImportFromOptions(options, 'run-123')
    expect(runId).toBe('run-123')
    expect(vi.mocked(crawlBatson)).toHaveBeenCalled()
    const call = vi.mocked(crawlBatson).mock.calls[0]
    expect(call[0]).toEqual(['https://batsonenterprises.com/products/foo'])
    expect(call[1]).toEqual(expect.objectContaining({ templateKey: 'batson.product.v2' }))
  })
})
