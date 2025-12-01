import { backfillDesignStorefrontProducts } from '../../app/services/designStudio/storefrontBackfill.server'
import { prisma } from '../../app/db.server'

function parseList(value: string | undefined | null) {
  return (value || '')
    .split(/[\s,]+/)
    .map(token => token.trim())
    .filter(Boolean)
}

async function resolveSupplierIds(tokens: string[]) {
  if (!tokens.length) return []
  const suppliers = await prisma.supplier.findMany({
    where: {
      OR: [{ id: { in: tokens } }, { slug: { in: tokens } }],
    },
    select: { id: true, slug: true },
  })
  const resolved: string[] = []
  const missing: string[] = []
  for (const token of tokens) {
    const match = suppliers.find(row => row.id === token || row.slug === token)
    if (match && !resolved.includes(match.id)) {
      resolved.push(match.id)
    } else if (!match) {
      missing.push(token)
    }
  }
  if (missing.length) {
    console.error('[design-studio/backfill] Unknown supplier identifiers:', missing.join(', '))
  }
  return resolved
}

async function main() {
  const supplierTokens = parseList(process.env.DESIGN_STUDIO_SUPPLIERS)
  const supplierIds = await resolveSupplierIds(supplierTokens)
  if (!supplierIds.length) {
    throw new Error('Set DESIGN_STUDIO_SUPPLIERS to one or more supplier ids or slugs (comma or space separated).')
  }

  const externalIds = parseList(process.env.DESIGN_STUDIO_SKUS)
  const includeNeedsReview = process.env.DESIGN_STUDIO_INCLUDE_REVIEW !== '0'
  const limit = Number(process.env.DESIGN_STUDIO_BACKFILL_LIMIT || '0') || undefined
  const batchSize = Number(process.env.DESIGN_STUDIO_BACKFILL_BATCH || '0') || undefined
  const templateId = process.env.DESIGN_STUDIO_TEMPLATE_ID || undefined

  const result = await backfillDesignStorefrontProducts({
    supplierIds,
    templateId: templateId ?? undefined,
    includeNeedsReview,
    externalIds: externalIds.length ? externalIds : undefined,
    limit,
    batchSize,
  })

  console.log('[design-studio/backfill] complete', result)
  await prisma.$disconnect()
}

main().catch(error => {
  console.error('[design-studio/backfill] fatal', error)
  void prisma.$disconnect()
  process.exit(1)
})
