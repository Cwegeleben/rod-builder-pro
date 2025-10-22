// <!-- BEGIN RBP GENERATED: importer-templates-integration-v2-1 -->
import fs from 'fs/promises'
import path from 'path'

export type ImporterTemplate = {
  key: string
  name: string
  site?: string
  pageType?: string
  version?: string
  isDefault?: boolean
}

const TEMPLATES_DIR = path.join(process.cwd(), 'src/importer/extract/templates')

function deriveMetaFromKey(key: string): Pick<ImporterTemplate, 'site' | 'pageType' | 'version'> {
  // Heuristic: key shape like "batson.product.v2" → site=batson, pageType=product, version=v2
  const parts = key.split('.')
  const site = parts[0] || undefined
  const pageType = parts[1] || undefined
  const version = parts[2] || undefined
  return { site, pageType, version }
}

async function readTemplateName(filePath: string): Promise<string | null> {
  try {
    const txt = await fs.readFile(filePath, 'utf8')
    const m = txt.match(/^#\s*Template:\s*(.+)$/m)
    if (m) return m[1].trim()
    return null
  } catch {
    return null
  }
}

export async function listTemplates(): Promise<ImporterTemplate[]> {
  const defKey = process.env.IMPORTER_DEFAULT_TEMPLATE_KEY || ''
  try {
    const files = await fs.readdir(TEMPLATES_DIR)
    const yamls = files.filter(f => /\.ya?ml$/i.test(f))
    const out: ImporterTemplate[] = []
    for (const f of yamls) {
      const key = f.replace(/\.(ya?ml)$/i, '')
      const full = path.join(TEMPLATES_DIR, f)
      const name = (await readTemplateName(full)) || key
      const meta = deriveMetaFromKey(key)
      out.push({ key, name, ...meta, isDefault: defKey ? key === defKey : yamls.length === 1 })
    }
    // Stable sort by name
    out.sort((a, b) => a.name.localeCompare(b.name))
    return out
  } catch {
    return []
  }
}
// <!-- END RBP GENERATED: importer-templates-integration-v2-1 -->
