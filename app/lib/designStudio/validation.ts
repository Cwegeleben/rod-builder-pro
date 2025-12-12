import type { DesignStorefrontPartRole } from './storefront.mock'

export type DesignStudioValidationSeverity = 'info' | 'warning' | 'error'

export type DesignStudioValidationEntry = {
  panelId: string
  severity: DesignStudioValidationSeverity
  code: string
  message: string
  role?: DesignStorefrontPartRole | null
  optionId?: string | null
  source?: 'options' | 'selection' | 'draft'
}

export type DesignStudioValidationState = DesignStudioValidationEntry[]

export type DesignStudioValidationTelemetryEvent = {
  type: 'zero-compatible-options' | 'incompatible-selection' | 'missing-compatibility-data'
  code?: string
  role?: DesignStorefrontPartRole | null
  optionId?: string | null
  productId?: string | null
  shopDomain?: string | null
  metadata?: Record<string, unknown>
}

export function logDesignStudioValidationEvent(event: DesignStudioValidationTelemetryEvent) {
  if (process.env.DESIGN_STUDIO_V1 !== '1') return
  const payload = {
    ...event,
    code: event.code ?? event.type,
    timestamp: new Date().toISOString(),
  }
  console.info('[designStudio][validation]', JSON.stringify(payload))
}

const SEVERITY_PRIORITY: DesignStudioValidationSeverity[] = ['error', 'warning', 'info']

export function summarizeValidationEntries(
  entries: DesignStudioValidationEntry[] | null | undefined,
): { severity: DesignStudioValidationSeverity; count: number } | null {
  if (!entries || entries.length === 0) return null
  for (const severity of SEVERITY_PRIORITY) {
    const count = entries.filter(entry => entry.severity === severity).length
    if (count > 0) {
      return { severity, count }
    }
  }
  return null
}
