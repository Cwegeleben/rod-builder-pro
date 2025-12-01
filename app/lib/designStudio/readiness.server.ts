import type { Prisma } from '@prisma/client'
import type { DesignStudioAnnotation } from './annotations.server'

export type DesignStudioBlockingReasonCode =
  | 'missing_part_type'
  | 'missing_family'
  | 'missing_role'
  | 'missing_compatibility'
  | 'missing_blank_length'
  | 'missing_blank_power'
  | 'missing_price'
  | 'missing_availability'
  | 'missing_imagery'
  | 'missing_hash'

export type DesignStudioBlockingReason = {
  code: DesignStudioBlockingReasonCode
  message: string
}

export type DesignStudioReadinessInput = {
  designPartType?: string | null
  annotation: DesignStudioAnnotation
  priceMsrp?: number | null
  priceWholesale?: number | null
  availability?: string | null
  images?: Prisma.InputJsonValue | null | undefined
}

const REASON_MESSAGES: Record<DesignStudioBlockingReasonCode, string> = {
  missing_part_type: 'Missing canonical part type',
  missing_family: 'Missing family alignment',
  missing_role: 'Missing role classification',
  missing_compatibility: 'Missing compatibility metadata',
  missing_blank_length: 'Blank length is required',
  missing_blank_power: 'Blank power is required',
  missing_price: 'At least one price (MSRP or wholesale) is required',
  missing_availability: 'Availability is required',
  missing_imagery: 'At least one image is required',
  missing_hash: 'Design Studio hash is missing',
}

function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function countImages(images: Prisma.InputJsonValue | null | undefined): number {
  if (!images) return 0
  if (Array.isArray(images)) {
    return images.filter(img => typeof img === 'string' && img.trim().length > 0).length
  }
  if (typeof images === 'object') {
    const maybeArr = (images as Record<string, unknown>).images
    if (Array.isArray(maybeArr)) {
      return maybeArr.filter(img => typeof img === 'string' && img.trim().length > 0).length
    }
  }
  return 0
}

export function evaluateDesignStudioReadiness(input: DesignStudioReadinessInput): {
  ready: boolean
  reasons: DesignStudioBlockingReason[]
  imageCount: number
} {
  const reasons: DesignStudioBlockingReason[] = []
  const hasPartType = typeof input.designPartType === 'string' && input.designPartType.trim().length > 0
  if (!hasPartType) reasons.push({ code: 'missing_part_type', message: REASON_MESSAGES.missing_part_type })

  if (!input.annotation.family) {
    reasons.push({ code: 'missing_family', message: REASON_MESSAGES.missing_family })
  }

  if (!input.annotation.role) {
    reasons.push({ code: 'missing_role', message: REASON_MESSAGES.missing_role })
  }

  const compat = input.annotation.compatibility || { categories: [] }
  const hasCategories = Array.isArray(compat.categories) && compat.categories.length > 0
  if (!hasCategories) {
    reasons.push({ code: 'missing_compatibility', message: REASON_MESSAGES.missing_compatibility })
  }

  if (input.annotation.role === 'blank') {
    if (!coerceNumber(compat.lengthIn)) {
      reasons.push({ code: 'missing_blank_length', message: REASON_MESSAGES.missing_blank_length })
    }
    if (!compat.power || String(compat.power).trim().length === 0) {
      reasons.push({ code: 'missing_blank_power', message: REASON_MESSAGES.missing_blank_power })
    }
  }

  const hasPrice = coerceNumber(input.priceMsrp) !== null || coerceNumber(input.priceWholesale) !== null
  if (!hasPrice) {
    reasons.push({ code: 'missing_price', message: REASON_MESSAGES.missing_price })
  }

  if (!input.availability || !input.availability.trim()) {
    reasons.push({ code: 'missing_availability', message: REASON_MESSAGES.missing_availability })
  }

  const imageCount = countImages(input.images)
  if (imageCount === 0) {
    reasons.push({ code: 'missing_imagery', message: REASON_MESSAGES.missing_imagery })
  }

  if (!input.annotation.hash) {
    reasons.push({ code: 'missing_hash', message: REASON_MESSAGES.missing_hash })
  }

  return { ready: reasons.length === 0, reasons, imageCount }
}

export function formatBlockingReasons(reasons: DesignStudioBlockingReason[]): string | null {
  if (!reasons.length) return null
  return reasons.map(r => r.message).join('; ')
}
