#!/usr/bin/env tsx
/*
  Tag Batson/ALPS/Forecast reel-seat-related products with:
   - classification: reel-seat-complete | reel-seat-body | reel-seat-hood | reel-seat-kit | reel-seat-hardware
   - requiresCompanion (boolean) and requiredCompanionKind on body-only seats
   - interfaceKey: brand|family|size (lowercased) for compatibility matching
  Notes:
   - ADD-only: merges into latestVersion.normSpecs JSON without removing existing fields
*/
// Ensure DATABASE_URL points to a local SQLite file if not provided BEFORE loading Prisma client
import path from 'node:path'
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.resolve(process.cwd(), 'prisma/dev.sqlite')}`
  console.log('[tag-reelseat-compat] using local DB at', process.env.DATABASE_URL)
}
// Defer prisma import until after env is set (dynamic import inside main)
import type { Prisma } from '@prisma/client'
import { parseBrandShort, inferReelSeatFamily, normalizeSizeLabel } from '../../app/server/importer/products/batsonTitle'

function safeJson<T>(v: unknown, fallback: T): T {
  try {
    if (typeof v === 'string') return JSON.parse(v) as T
    return (v as T) ?? fallback
  } catch {
    return fallback
  }
}

function pickLatestUrl(urls: Array<{ url: string; lastSeenAt: Date | string }>): string | undefined {
  if (!Array.isArray(urls) || urls.length === 0) return undefined
  const sorted = [...urls].sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
  return sorted[0]?.url
}

function deriveBrand(code: string, slug: string | undefined, series: string | undefined, brandRaw?: string | null): string {
  const s = series || ''
  if (/\bforecast\b/i.test(s) || /\bforecast\b/i.test(String(slug))) return 'Forecast'
  if (/\balps\b/i.test(s) || /^[A-Z]*AIP/.test(code) || /^DALT/.test(code) || /\balps\b/i.test(String(slug))) return 'Alps'
  return parseBrandShort(brandRaw) || 'Batson'
}

function classifyFromSignals(args: { slug?: string; title?: string; hardwareKind?: string | null; insertOnly?: boolean }): {
  classification: 'reel-seat-complete' | 'reel-seat-body' | 'reel-seat-hood' | 'reel-seat-kit' | 'reel-seat-hardware'
  requiresCompanion: boolean
  requiredCompanionKind?: 'reel-seat-hood'
} {
  const slug = (args.slug || '').toLowerCase()
  const title = (args.title || '').toLowerCase()
  const isHood = args.hardwareKind === 'Reel Seat Hood' || /(^|[^a-z])hood([^a-z]|$)/i.test(slug) || /\bhood\b/i.test(title)
  const isKit = /\bkit\b|\bassembly\b/.test(slug) || /\bkit\b|\bassembly\b/.test(title)
  const withHood = /(with|w[/_\s]?)[-\s]?hood/i.test(title) || /(with-hood|w-hood|w\/hood)/.test(slug)
  let classification: 'reel-seat-complete' | 'reel-seat-body' | 'reel-seat-hood' | 'reel-seat-kit' | 'reel-seat-hardware'
  if (isHood) classification = 'reel-seat-hood'
  else if (args.hardwareKind && !isHood) classification = 'reel-seat-hardware'
  else if (args.insertOnly) classification = 'reel-seat-hardware'
  else if (isKit || withHood) classification = 'reel-seat-complete'
  else classification = 'reel-seat-body'
  const requiresCompanion = classification === 'reel-seat-body'
  return { classification, requiresCompanion, requiredCompanionKind: requiresCompanion ? 'reel-seat-hood' : undefined }
}

async function main() {
  // Load prisma only now to ensure env is set
  const { prisma } = await import('../../app/db.server')
  console.log('[tag-reelseat-compat] scanning products...')
  const products = await prisma.product.findMany({
    where: { type: 'Reel Seat' },
    select: { id: true, sku: true, title: true, supplierId: true, latestVersionId: true },
  })
  let updated = 0
  for (const p of products) {
    if (!p.latestVersionId) continue
    const ver = await prisma.productVersion.findUnique({ where: { id: p.latestVersionId }, select: { id: true, normSpecs: true, rawSpecs: true, sourceSnapshot: true, description: true, images: true, priceMsrp: true, priceWholesale: true, availability: true, fetchedAt: true } })
    if (!ver) continue
  const norm = safeJson<Record<string, unknown>>(ver.normSpecs as unknown, {})
  const sources = safeJson<Array<{ url: string; externalId?: string | null; source?: string | null; notes?: string | null }>>(ver.sourceSnapshot as unknown, [])
    const url = pickLatestUrl(sources.map(s => ({ url: s.url, lastSeenAt: ver.fetchedAt || new Date() })))

    // Derive fields
    const series = (norm.series as string) || (norm.familyName as string) || ''
    const brand = deriveBrand(p.sku, url, series, norm.brand as string | undefined)
    const fam = inferReelSeatFamily({ brand, code: p.sku, slug: url, series, pageTitle: p.title }).family || undefined
    const sizeLabel = (norm.size_label as string) || (norm.size as string) || ''
    const sizeFromSku = (() => {
      const m = String(p.sku || '').toUpperCase().match(/^[A-Z]+(\d{1,2})/)
      return m?.[1] || ''
    })()
    const sizeDigits = (sizeLabel || sizeFromSku).replace(/[^0-9]/g, '')
    const size = sizeDigits || undefined
    const interfaceKey = brand && fam && size ? `${brand}|${fam}|${size}`.toLowerCase() : undefined
    const hardwareKind = (norm.hardwareKind as string) || undefined
    const insertOnly = Boolean(norm.isInsertOnly)
    const { classification, requiresCompanion, requiredCompanionKind } = classifyFromSignals({ slug: url, title: p.title, hardwareKind, insertOnly })

    const merged = {
      ...norm,
      brand: brand || norm.brand,
      familyName: fam || norm.familyName,
      size_label: normalizeSizeLabel((size as string) || (norm.size_label as string | null | undefined)) || (norm.size_label as string | undefined),
      classification,
      requiresCompanion,
      requiredCompanionKind,
      interfaceKey: interfaceKey || norm.interfaceKey,
    }

    // Only update if anything changed
    const before = JSON.stringify(norm)
    const after = JSON.stringify(merged)
    if (before === after) continue

    await prisma.productVersion.update({ where: { id: ver.id }, data: { normSpecs: merged as unknown as Prisma.InputJsonValue } })
    updated++
    if (updated % 25 === 0) console.log(`[tag-reelseat-compat] updated ${updated} so far...`)
  }
  console.log(`[tag-reelseat-compat] done. updated: ${updated}, scanned: ${products.length}`)
}

main()
  .catch(err => {
    console.error('[tag-reelseat-compat] failed', err)
    process.exitCode = 1
  })
