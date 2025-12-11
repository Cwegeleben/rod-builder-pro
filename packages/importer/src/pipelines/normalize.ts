// <!-- BEGIN RBP GENERATED: importer-normalize-diff-v1 -->
import { normalizeTipTop } from '../lib/tipTop'
export type NormResult = { partType: string; specs: Record<string, unknown> }

export function normalize(rec: {
  title: string
  partType: string
  rawSpecs: Record<string, unknown>
  description?: string
}): NormResult {
  const specs: Record<string, unknown> = { ...rec.rawSpecs }

  // Example: "7'6" → 90 inches
  const len = rec.title.match(/(\d)'\s?(\d{1,2})/)
  if (len) specs.length_in = Number(len[1]) * 12 + Number(len[2])

  // Power code in title
  const pwr = rec.title.toUpperCase().match(/\b(UL|L|ML|M|MH|H|XH|XXH)\b/)
  if (pwr) specs.power = pwr[1]

  // Action hint (XF/F/MF/M/SF/etc.)
  const act = rec.title.toUpperCase().match(/\b(XF|F|MF|M|S|SF)\b/)
  if (act) specs.action = act[1]

  // Guide / Tip Top specific extraction heuristics from raw specs or title
  if (rec.partType === 'guide' || rec.partType === 'tip_top') {
    // Ring size: prefer explicit numeric or #number tokens
    const ringRaw = String(specs.ring_size || specs.RING_SIZE || '').trim()
    if (!ringRaw) {
      const m = rec.title.match(/\br(?:ing)?\s?(size)?\s?(\d{1,2})\b/i) || rec.title.match(/#(\d{1,2})/) || null
      if (m) specs.ring_size = Number(m[m.length - 1])
    } else if (/^\d{1,2}$/.test(ringRaw)) {
      specs.ring_size = Number(ringRaw)
    }
    // Tube size (tip top): look for 3.5, 4.5 etc with mm or ambiguous units
    const tubeRaw = String(specs.tube_size || specs.TUBE_SIZE || '').trim()
    if (!tubeRaw) {
      const mt = rec.title.match(/\b(\d{1,2}(?:\.\d)?)\s*(mm|tube)\b/i)
      if (mt) specs.tube_size = parseFloat(mt[1])
    } else if (/^\d{1,2}(?:\.\d)?$/.test(tubeRaw)) {
      specs.tube_size = parseFloat(tubeRaw)
    }
    // Frame material / finish: attempt mapping from common tokens
    const matTokens = rec.title.toLowerCase().split(/[^a-z]+/)
    const MATERIALS = ['titanium', 'stainless', 'ss', 'alps', 'forecast']
    const FINISHES = ['black', 'polished', 'blue', 'chrome', 'ti-chrome']
    const foundMat = MATERIALS.find(m => matTokens.includes(m))
    if (foundMat && !specs.frame_material) specs.frame_material = foundMat
    const foundFinish = FINISHES.find(f => matTokens.includes(f.replace(/[^a-z]/g, '')))
    if (foundFinish && !specs.finish) specs.finish = foundFinish
    // Kit detection: presence of 'kit' and multiple sizes in title
    if (/\bkit\b/i.test(rec.title)) specs.is_kit = true

    if (rec.partType === 'tip_top') {
      const raw = rec.rawSpecs || {}
      const tipTop = normalizeTipTop({
        sku:
          (typeof raw.code === 'string' && raw.code) ||
          (typeof raw.externalId === 'string' && raw.externalId) ||
          (typeof raw.sku === 'string' && raw.sku) ||
          undefined,
        title: rec.title,
        description: rec.description,
        series: typeof raw.series === 'string' ? raw.series : undefined,
        frameMaterial: specs.frame_material as string | undefined,
        ringMaterial: specs.ring_material as string | undefined,
        tubeSize: specs.tube_size,
        ringSize: specs.ring_size,
      })
      specs.tipTop = {
        type: tipTop.type,
        frameMaterialLong: tipTop.frameMaterialLong,
        ringMaterialLong: tipTop.ringMaterialLong,
        tubeSizeNormalized: tipTop.tubeSizeNormalized,
        ringSizeNormalized: tipTop.ringSizeNormalized,
        title: tipTop.title,
      }
      if (tipTop.tubeSizeNormalized != null) specs.tube_size = tipTop.tubeSizeNormalized
      if (tipTop.ringSizeNormalized != null) specs.ring_size = tipTop.ringSizeNormalized
      if (tipTop.frameMaterialCode) specs.frame_material = tipTop.frameMaterialCode
      if (tipTop.ringMaterialCode) specs.ring_material = tipTop.ringMaterialCode
    }
  }

  return { partType: rec.partType, specs }
}
// <!-- END RBP GENERATED: importer-normalize-diff-v1 -->
