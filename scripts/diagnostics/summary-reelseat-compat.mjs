#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

function get(obj, path, def) {
  try {
    const parts = path.split('.')
    let cur = obj
    for (const p of parts) {
      if (cur == null) return def
      cur = cur[p]
    }
    return cur == null ? def : cur
  } catch {
    return def
  }
}

;(async () => {
  const products = await prisma.product.findMany({
    where: { type: 'Reel Seat' },
    select: { sku: true, title: true, latestVersion: { select: { normSpecs: true } } },
  })
  const total = products.length
  const byClass = new Map()
  let requires = 0
  let hasKey = 0
  const keySet = new Set()
  const sample = []

  for (const p of products) {
    const ns = (p.latestVersion?.normSpecs ?? {})
    const cls = String(get(ns, 'classification', '') || '')
    byClass.set(cls, (byClass.get(cls) || 0) + 1)
    const req = Boolean(get(ns, 'requiresCompanion', false))
    if (req) requires++
    const key = String(get(ns, 'interfaceKey', '') || '')
    if (key) {
      hasKey++
      keySet.add(key)
    }
    if (sample.length < 10) sample.push({ sku: p.sku, classification: cls, interfaceKey: key })
  }

  console.log('total', total)
  console.log('byClassification', Array.from(byClass.entries()).sort((a,b)=>b[1]-a[1]))
  console.log('requiresCompanion_true', requires)
  console.log('interfaceKey', { withKey: hasKey, distinctKeys: keySet.size })
  console.log('sample', sample)
  await prisma.$disconnect()
})().catch(e => { console.error(e); process.exit(1) })
