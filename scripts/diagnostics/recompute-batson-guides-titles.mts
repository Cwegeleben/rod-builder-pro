#!/usr/bin/env tsx

import { prisma } from '../../app/db.server'
import { buildBatsonTitle } from '../../packages/importer/src/lib/titleBuild/batson'

type TargetMode = 'product' | 'staging'

function parseArgs(): { supplier: string; target: TargetMode } {
  const argv = process.argv.slice(2)
  let supplier = 'batson-guides-tops'
  let target: TargetMode = 'product'
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--supplier' && argv[i + 1]) {
      supplier = argv[++i]
    } else if (arg === '--staging') {
      target = 'staging'
    } else if (arg === '--product') {
      target = 'product'
    }
  }
  return { supplier, target }
}

async function main() {
  const { supplier, target } = parseArgs()

  const supplierRow = await prisma.supplier.findFirst({ where: { slug: supplier } })
  if (!supplierRow) {
    console.error(JSON.stringify({ error: 'supplier-missing', supplier }))
    process.exit(1)
  }
  const supplierId = supplierRow.id

  if (target === 'staging') {
    const parts = await prisma.partStaging.findMany({
      where: {
        supplierId,
        partType: { in: ['Guide', 'Guide Kit', 'Tip Top'] },
      },
    })

    const result = await recomputeTitles(
      parts.map(p => ({
        id: p.id,
        externalId: p.externalId,
        title: p.title,
        type: p.partType,
        rawSpecs: p.rawSpecs as unknown as Record<string, unknown>,
        normSpecs: p.normSpecs as unknown as Record<string, unknown>,
      })),
      async (id, title) => {
        await prisma.partStaging.update({ where: { id }, data: { title } })
      },
    )

    console.log(
      JSON.stringify(
        {
          supplierSlug: supplier,
          target,
          total: parts.length,
          updated: result.updated,
          samples: result.samples,
        },
        null,
        2,
      ),
    )
    return
  }

  const products = await prisma.product.findMany({
    where: {
      supplierId,
      type: { in: ['Guide', 'Guide Kit', 'Tip Top'] },
    },
    include: {
      latestVersion: {
        select: {
          rawSpecs: true,
          normSpecs: true,
        },
      },
    },
  })

  const result = await recomputeTitles(
    products.map(p => ({
      id: p.id,
      externalId: p.sku,
      title: p.title,
      type: p.type || undefined,
      rawSpecs: (p.latestVersion?.rawSpecs as Record<string, unknown>) || {},
      normSpecs: (p.latestVersion?.normSpecs as Record<string, unknown>) || {},
    })),
    async (id, title) => {
      await prisma.product.update({ where: { id }, data: { title } })
    },
  )

  console.log(
    JSON.stringify(
      {
        supplierSlug: supplier,
        target,
        total: products.length,
        updated: result.updated,
        samples: result.samples,
      },
      null,
      2,
    ),
  )
}

type TitleRecord = {
  id: string
  externalId: string
  title: string
  type?: string
  rawSpecs: Record<string, unknown>
  normSpecs: Record<string, unknown>
}

async function recomputeTitles(
  rows: TitleRecord[],
  updateTitle: (id: string, title: string) => Promise<void>,
) {
  let updated = 0
  const samples: Array<{ externalId: string; before: string; after: string }> = []

  for (const row of rows) {
    const combinedSpecs = { ...row.rawSpecs, ...row.normSpecs }
    const ringSize = combinedSpecs.ring_size
    const tubeSize = combinedSpecs.tube_size
    const frameMaterial = combinedSpecs.frame_material ?? combinedSpecs.frame
    const finish = combinedSpecs.finish ?? combinedSpecs.color
    const classification = combinedSpecs.classification
    const isKit = row.type === 'Guide Kit' || classification === 'guide-kit'

    const newTitle = buildBatsonTitle({
      title: row.title,
      rawSpecs: {
        ...combinedSpecs,
        ring_size: ringSize,
        tube_size: tubeSize,
        frame_material: frameMaterial,
        finish,
        is_kit: isKit,
        externalId: row.externalId,
        code: row.externalId,
        original_title: combinedSpecs.original_title || row.title,
      },
    })

    if (newTitle && newTitle !== row.title) {
      await updateTitle(row.id, newTitle)
      if (samples.length < 10) samples.push({ externalId: row.externalId, before: row.title, after: newTitle })
      updated++
    }
  }

  return { updated, samples }
}

main().catch(e => {
  console.error(JSON.stringify({ error: e.message }))
  process.exit(1)
})
