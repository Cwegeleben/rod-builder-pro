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

export async function applyTemplate(html: string, url: string, template: TemplateSpec): Promise<ExtractResult> {
  // Stubbed implementation: returns empty fields list; UI handles fallbacks
  return { fields: {}, requiredMissing: [] }
}
// <!-- END RBP GENERATED: importer-extractor-templates-v2 -->
