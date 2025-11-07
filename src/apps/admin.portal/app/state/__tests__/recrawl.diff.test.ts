import { describe, it, expect } from 'vitest'
import { importerActions, importerAdapters, ImportState } from '../../state/importerMachine'

function seed(templateId: string, urls: string[], published?: Array<{ key: string; hash: string }>) {
  return importerAdapters.saveImportConfig(templateId, {
    state: ImportState.APPROVED,
    productUrls: urls,
    publishedSnapshot: published,
  })
}

function hashOf(item: unknown) {
  return importerAdapters.itemHash(item)
}

describe('recrawl diff + delta publish', () => {
  it('publishes only changes when data differs', async () => {
    const tpl = 'TPL-A'
    const items = ['https://x/a', 'https://x/b']
    await seed(tpl, items, [
      { key: 'https://x/a', hash: hashOf({ title: 'Draft for https://x/a', url: 'https://x/a' }) },
      { key: 'https://x/b', hash: 'OLD' }, // will differ
    ])
    await importerActions.recrawlRunNow(tpl)
    const cfg = await importerAdapters.getImportConfig(tpl)
    expect(cfg.counts?.updated || 0).toBeGreaterThan(0)
    expect(typeof cfg.lastRunAt).toBe('string')
  })

  it('skips publish when nothing changed', async () => {
    const tpl = 'TPL-B'
    const items = ['https://x/a']
    await seed(tpl, items, [
      { key: 'https://x/a', hash: hashOf({ title: 'Draft for https://x/a', url: 'https://x/a' }) },
    ])
    await importerActions.recrawlRunNow(tpl)
    const cfg = await importerAdapters.getImportConfig(tpl)
    expect(cfg.counts?.updated || 0).toBe(0)
  })
})
