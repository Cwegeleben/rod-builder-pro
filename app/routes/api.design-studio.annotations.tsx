import type { ActionFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import crypto from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db.server'
import { authenticate } from '../shopify.server'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import { deriveDesignStudioAnnotations, type DesignStudioAnnotation } from '../lib/designStudio/annotations.server'
import { recordDesignStudioAudit } from '../lib/designStudio/audit.server'

const DEFAULT_COMPATIBILITY = {
  lengthIn: null,
  power: null,
  action: null,
  finish: null,
  rodPieces: null,
  categories: [] as string[],
}

type ProductWithRelations = NonNullable<awaitedReturn<ReturnType<typeof loadProduct>>>

type DesignStudioActionResponse = {
  ok: boolean
  productId: string
  ready?: boolean
  coverageNotes?: string | null
  message?: string
}

export async function action({ request }: ActionFunctionArgs) {
  if (process.env.PRODUCT_DB_ENABLED !== '1') {
    return json({ ok: false, productId: '', message: 'PRODUCT_DB_DISABLED' }, { status: 400 })
  }
  await authenticate.admin(request)
  const access = await getDesignStudioAccess(request)
  if (!access.enabled) {
    return json({ ok: false, productId: '', message: 'DESIGN_STUDIO_DISABLED' }, { status: 403 })
  }
  const form = await request.formData()
  const intent = String(form.get('intent') || '')
  const productId = String(form.get('productId') || '')
  if (!intent || !productId) {
    return json({ ok: false, productId, message: 'MISSING_PARAMS' }, { status: 400 })
  }

  const product = await loadProduct(productId)
  if (!product) {
    return json({ ok: false, productId, message: 'PRODUCT_NOT_FOUND' }, { status: 404 })
  }

  switch (intent) {
    case 'set-ready': {
      const readyValue = form.get('ready')
      if (readyValue === null) {
        return json({ ok: false, productId, message: 'MISSING_READY_VALUE' }, { status: 400 })
      }
      const ready = readyValue === '1' || readyValue === 'true'
      await prisma.product.update({
        where: { id: productId },
        data: {
          designStudioReady: ready,
          designStudioLastTouchedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      product.designStudioReady = ready
      await recordDesignStudioAudit({
        productId,
        productVersionId: product.latestVersionId,
        ds: buildAuditSnapshot(product),
        source: 'admin:set-ready',
      })
      return json<DesignStudioActionResponse>({ ok: true, productId, ready })
    }
    case 'update-notes': {
      const rawNotes = form.get('coverageNotes')
      if (rawNotes === null) {
        return json({ ok: false, productId, message: 'MISSING_NOTES' }, { status: 400 })
      }
      const coverageNotes = normalizeNote(rawNotes)
      await prisma.product.update({
        where: { id: productId },
        data: {
          designStudioCoverageNotes: coverageNotes,
          designStudioLastTouchedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      product.designStudioCoverageNotes = coverageNotes ?? null
      await recordDesignStudioAudit({
        productId,
        productVersionId: product.latestVersionId,
        ds: buildAuditSnapshot(product),
        source: 'admin:update-notes',
      })
      return json<DesignStudioActionResponse>({ ok: true, productId, coverageNotes })
    }
    case 'recalc-compatibility': {
      if (!product.latestVersion) {
        return json({ ok: false, productId, message: 'NO_VERSION' }, { status: 400 })
      }
      const ds = deriveDesignStudioAnnotations({
        supplierKey: product.supplier?.slug || product.supplier?.name || product.supplierId,
        partType: product.type || product.latestVersion.designStudioRole,
        title: product.title,
        rawSpecs: jsonValueToRecord(product.latestVersion.rawSpecs),
        normSpecs: jsonValueToRecord(product.latestVersion.normSpecs),
      })
      await prisma.$transaction([
        prisma.product.update({
          where: { id: productId },
          data: {
            designStudioReady: ds.ready,
            designStudioFamily: ds.family ?? null,
            designStudioCoverageNotes: ds.coverageNotes ?? null,
            designStudioLastTouchedAt: new Date(),
            updatedAt: new Date(),
          },
        }),
        prisma.productVersion.update({
          where: { id: product.latestVersion.id },
          data: {
            designStudioRole: ds.role,
            designStudioSeries: ds.series ?? null,
            designStudioCompatibility: ds.compatibility as Prisma.InputJsonValue,
            designStudioSourceQuality: 'admin:recalc',
            designStudioHash: ds.hash,
          },
        }),
      ])
      await recordDesignStudioAudit({
        productId,
        productVersionId: product.latestVersion.id,
        ds,
        source: 'admin:recalc',
      })
      return json<DesignStudioActionResponse>({
        ok: true,
        productId,
        ready: ds.ready,
        coverageNotes: ds.coverageNotes ?? null,
      })
    }
    default:
      return json({ ok: false, productId, message: 'UNKNOWN_INTENT' }, { status: 400 })
  }
}

async function loadProduct(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: {
      latestVersion: true,
      supplier: { select: { slug: true, name: true } },
    },
  })
}

type awaitedReturn<T> = T extends Promise<infer R> ? R : T

function buildAuditSnapshot(product: ProductWithRelations): DesignStudioAnnotation {
  const compatibility = normalizeCompatibility(product.latestVersion?.designStudioCompatibility ?? null)
  return {
    ready: product.designStudioReady ?? false,
    family: product.designStudioFamily ?? undefined,
    series: product.latestVersion?.designStudioSeries ?? undefined,
    role: product.latestVersion?.designStudioRole ?? 'component',
    coverageNotes: product.designStudioCoverageNotes ?? undefined,
    sourceQuality: product.latestVersion?.designStudioSourceQuality ?? undefined,
    compatibility,
    hash: product.latestVersion?.designStudioHash || `admin-${crypto.randomUUID()}`,
  }
}

function normalizeCompatibility(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_COMPATIBILITY }
  const record = value as Record<string, unknown>
  return {
    lengthIn: normalNumber(record.lengthIn),
    power: normalString(record.power),
    action: normalString(record.action),
    finish: normalString(record.finish),
    rodPieces: normalNumber(record.rodPieces),
    categories: Array.isArray(record.categories)
      ? record.categories.filter((item): item is string => typeof item === 'string')
      : [],
  }
}

function normalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

function normalString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  return null
}

function jsonValueToRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function normalizeNote(value: FormDataEntryValue): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text ? text : null
}
