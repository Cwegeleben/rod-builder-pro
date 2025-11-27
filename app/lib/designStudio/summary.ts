import type { Prisma } from '@prisma/client'

export type DesignBuildComponentEntry = {
  role?: string
  sku?: string
  title?: string
  ready?: boolean | null
  notes?: string | null
}

export type ParsedDesignBuildSummary = {
  blank?: DesignBuildComponentEntry
  components: DesignBuildComponentEntry[]
}

export function parseDesignBuildComponentSummary(value: Prisma.JsonValue | null | undefined): ParsedDesignBuildSummary {
  const parsed: ParsedDesignBuildSummary = { components: [] }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return parsed
  }
  const record = value as Record<string, unknown>
  const blank = parseComponentEntry(record.blank)
  if (blank) parsed.blank = blank
  const componentsRaw = record.components
  if (Array.isArray(componentsRaw)) {
    parsed.components = componentsRaw.map(parseComponentEntry).filter(Boolean) as DesignBuildComponentEntry[]
  }
  return parsed
}

export function stringifyDesignBuildNotes(value: Prisma.JsonValue | null | undefined): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function parseComponentEntry(entry: unknown): DesignBuildComponentEntry | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  const record = entry as Record<string, unknown>
  return {
    role: asString(record.role),
    sku: asString(record.sku),
    title: asString(record.title),
    ready: asBool(record.ready),
    notes: asString(record.notes) || asString(record.coverageNotes) || null,
  }
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value
  return undefined
}

function asBool(value: unknown): boolean | null | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  return undefined
}
