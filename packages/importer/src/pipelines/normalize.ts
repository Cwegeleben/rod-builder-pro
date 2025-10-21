// <!-- BEGIN RBP GENERATED: importer-normalize-diff-v1 -->
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

  return { partType: rec.partType, specs }
}
// <!-- END RBP GENERATED: importer-normalize-diff-v1 -->
