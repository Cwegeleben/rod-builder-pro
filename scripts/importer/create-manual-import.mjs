#!/usr/bin/env node
// Create a manual ImportTemplate and save provided seed URLs in settings.
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

async function main() {
  if (!process.env.DATABASE_URL) {
    const path = await import('node:path')
    process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), 'prisma/dev.sqlite')}`
    console.log(`[env] DATABASE_URL not set; using ${process.env.DATABASE_URL}`)
  }
  const prisma = new PrismaClient()
  const name = process.env.IMPORT_NAME || 'Manual Batson Crawl'
  const targetId = process.env.TARGET_ID || 'batson-rod-blanks'
  // Site descriptor kept for future validation (unused for now)
  // const site = { id: 'batson-rod-blanks', label: 'Batson — Rod Blanks', url: 'https://batsonenterprises.com/rod-blanks', siteId: 'batson-rod-blanks' }
  const seeds = (process.env.SEEDS || '').split(/\n|,/).map(s => s.trim()).filter(Boolean)
  if (seeds.length === 0) {
    console.error('No seeds provided. Set SEEDS env with newline or comma separated URLs.')
    process.exit(1)
  }
  // Minimal: create ImportTemplate row (no SpecTemplate dependency for this workflow)
  const id = randomUUID()
  await prisma.importTemplate.create({ data: { id, name, importConfig: { settings: { target: targetId, discoverSeedUrls: seeds } }, state: 'NEEDS_SETTINGS', hadFailures: false } })
  await prisma.importLog.create({ data: { templateId: id, runId: id, type: 'template:created', payload: { name } } })
  console.log(JSON.stringify({ ok: true, templateId: id, name, targetId, seeds }, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
