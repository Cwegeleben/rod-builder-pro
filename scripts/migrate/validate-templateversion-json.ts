#!/usr/bin/env ts-node
/**
 * Validate that all TemplateVersion.dataJson values are valid JSON strings and optionally
 * report basic stats (count, failures, sample keys). This prepares for converting
 * the column type from TEXT -> JSON in a future migration.
 */
import { PrismaClient } from '@prisma/client'

interface Failure {
  id: string
  error: string
  snippet: string
}

async function main() {
  const prisma = new PrismaClient()
  const start = Date.now()
  const rows = await prisma.templateVersion.findMany({ select: { id: true, dataJson: true } })
  const failures: Failure[] = []
  let totalKeys = 0
  let objects = 0

  for (const r of rows) {
    const raw = r.dataJson as unknown as string // currently stored as string
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        objects++
        totalKeys += Object.keys(parsed).length
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'unknown'
      failures.push({ id: r.id, error: errMsg, snippet: raw?.slice(0, 120) ?? '' })
    }
  }

  const durationMs = Date.now() - start
  const avgKeys = objects ? (totalKeys / objects).toFixed(2) : '0'

  if (failures.length === 0) {
    console.log(
      `✅ All ${rows.length} TemplateVersion rows have valid JSON (in ${durationMs}ms). Avg object keys: ${avgKeys}`,
    )
  } else {
    console.log(`❌ ${failures.length} / ${rows.length} rows failed JSON parse (in ${durationMs}ms)`)
    for (const f of failures.slice(0, 20)) {
      console.log(` - id=${f.id} error=${f.error} snippet=${JSON.stringify(f.snippet)}`)
    }
    if (failures.length > 20) console.log(`... (${failures.length - 20} more failures)`)
    process.exitCode = 1
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('Unexpected failure', e)
  process.exit(1)
})
