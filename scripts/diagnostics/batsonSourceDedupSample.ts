import { prisma } from '../../app/db.server'

function canonicalizeDetailUrl(href: string): string | null {
  try {
    const u = new URL(href)
    u.hash = ''
    u.searchParams.delete('variant')
    u.searchParams.delete('Variant')
    return u.toString()
  } catch {
    return null
  }
}

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw)
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

async function main() {
  const supplierSlug = process.env.SUPPLIER_ID || process.env.SUPPLIER || process.env.SLUG || 'batson-guides-tops'
  const limit = Math.max(1, Math.min(20, Number(process.env.LIMIT || '5')))

  let supplierId = supplierSlug
  try {
    const row = await prisma.supplier.findFirst({ where: { slug: supplierSlug } })
    if (row?.id) supplierId = row.id
  } catch {
    /* ignore */
  }

  const sources = await prisma.productSource.findMany({
    where: { supplierId },
    select: { url: true, externalId: true, lastSeenAt: true },
    orderBy: { lastSeenAt: 'desc' },
    take: 2000,
  })

  const groups = new Map<
    string,
    {
      canonicalUrl: string
      urls: string[]
      externalIds: string[]
    }
  >()
  for (const row of sources) {
    const normalized = normalizeUrl(row.url)
    if (!normalized) continue
    const canonical = canonicalizeDetailUrl(normalized)
    if (!canonical) continue
    let bucket = groups.get(canonical)
    if (!bucket) {
      bucket = { canonicalUrl: canonical, urls: [], externalIds: [] }
      groups.set(canonical, bucket)
    }
    bucket.urls.push(normalized)
    if (row.externalId) bucket.externalIds.push(row.externalId)
  }

  const samples = Array.from(groups.values())
    .map(group => {
      const externalIds = Array.from(new Set(group.externalIds.filter(Boolean)))
      return {
        canonicalUrl: group.canonicalUrl,
        rawSources: group.urls.length,
        sampleSources: group.urls.slice(0, 6),
        linkedExternalIds: externalIds,
      }
    })
    .filter(group => group.rawSources >= 4)
    .sort((a, b) => b.rawSources - a.rawSources)
    .slice(0, limit)

  console.log(
    JSON.stringify(
      {
        supplier: supplierSlug,
        inspectedSources: sources.length,
        dedupedSampleCount: samples.length,
        samples,
      },
      null,
      2,
    ),
  )
}

main()
  .catch(err => {
    console.error('[batsonSourceDedupSample] failed', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {})
  })
