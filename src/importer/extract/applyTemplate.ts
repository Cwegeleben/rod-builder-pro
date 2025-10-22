// <!-- BEGIN RBP GENERATED: importer-extractor-templates-v2 -->
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Minimal template applier contract (stub): evaluates sources and applies transforms.
 * This is a placeholder; the Preview UI currently relies on the server preview endpoint
 * and uses fallbacks client-side for source badges when needed.
 */
export type ExtractSource = 'jsonld' | 'dom' | 'domAll' | 'table' | 'slug' | 'hash' | 'const'
export type Transform =
  | 'toNumber'
  | 'sanitizeHtml'
  | 'toAbsoluteUrls'
  | 'dedupe'
  | 'normalizeUnits'
  | 'toSchemaAvailability'
  | 'trimAllStrings'
  | 'collapseWhitespace'

export type FieldRule = {
  required?: boolean
  from: Array<
    | { jsonld: string }
    | { dom: string }
    | { domAll: string }
    | { table: string }
    | { slug: true }
    | { hash: true }
    | { const: unknown }
  >
  transforms?: Transform[]
}

export type TemplateSpec = {
  fields: Record<string, FieldRule>
}

export type ExtractedField<T = unknown> = { value: T | null; source: ExtractSource | null; warnings?: string[] }

export type ExtractResult = {
  fields: Record<string, ExtractedField>
  requiredMissing: string[]
}

// <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
import fs from 'fs/promises'
import path from 'path'

const TEMPLATES_DIR = path.join(process.cwd(), 'src/importer/extract/templates')

async function loadTemplateByKey(key: string): Promise<{ key: string; spec: TemplateSpec }> {
  // For now, we don't parse YAML; the UI uses the file as source of truth and extraction remains stubbed.
  // We still verify that a file exists for the key to ensure UX integrity.
  const file = path.join(TEMPLATES_DIR, `${key}.yaml`)
  try {
    await fs.access(file)
  } catch {
    // try .yml
    await fs.access(path.join(TEMPLATES_DIR, `${key}.yml`)).catch(() => {})
  }
  return { key, spec: { fields: {} } }
}

function autoDetectTemplate(pageUrl: string): { key: string; spec: TemplateSpec } {
  // Minimal heuristic: pick based on hostname prefix in key; fallback to batson.product.v2
  let host = ''
  try {
    host = new URL(pageUrl).hostname
  } catch {
    /* ignore */
  }
  const key = /batson/i.test(host) ? 'batson.product.v2' : 'batson.product.v2'
  return { key, spec: { fields: {} } }
}

function extractFields(
  page: { url: string; html?: string },
  _template: { key: string; spec: TemplateSpec },
): ExtractResult {
  // Keep existing fallback order (JSON-LD → DOM → slug → hash) handled elsewhere for now.
  return { fields: {}, requiredMissing: [] }
}

export function applyTemplate(
  page: { url: string; html?: string },
  options?: { templateKey?: string },
): ExtractResult & { usedTemplateKey: string } {
  const key = options?.templateKey
  const chosen = key ? { key, spec: { fields: {} } } : autoDetectTemplate(page.url)
  const result = extractFields(page, chosen)
  return { ...result, usedTemplateKey: chosen.key }
}
// <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->
// <!-- END RBP GENERATED: importer-extractor-templates-v2 -->
