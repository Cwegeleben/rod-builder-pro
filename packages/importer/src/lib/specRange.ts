// Small helpers to format range strings for specs with minimal reformatting.
// Goal: preserve fractions and original numbers, normalize dash and unit suffix.

function hasUnitAtEnd(s: string, unit: 'lbs' | 'oz'): boolean {
  const re = unit === 'lbs' ? /(lb|lbs)\.?\s*$/i : /(oz)\.?\s*$/i
  return re.test(s)
}

function normalizeUnitSuffix(s: string, unit: 'lbs' | 'oz'): string {
  // Remove a trailing period in unit and normalize plurals (lb/lbs. -> lbs, oz./oz -> oz)
  if (unit === 'lbs') return s.replace(/(lb|lbs)\.?\s*$/i, 'lbs')
  return s.replace(/(oz)\.?\s*$/i, 'oz')
}

export function formatRangeString(raw: string, unit: 'lbs' | 'oz'): string {
  if (!raw) return ''
  // Normalize unicode dashes and collapse surrounding whitespace
  let s = String(raw)
    .trim()
    .replace(/[–—]+/g, '-')
    .replace(/\s*-\s*/g, '-')
  // Collapse excessive whitespace
  s = s.replace(/\s+/g, ' ')
  // Strip stray trailing punctuation before units
  s = s.replace(/\.(?=\s|$)/g, '')
  // Ensure a unit suffix at the end; if present, normalize it
  if (hasUnitAtEnd(s, unit)) s = normalizeUnitSuffix(s, unit)
  else s = `${s} ${unit}`
  return s.trim()
}

export function formatLineLbRangeString(raw: string): string {
  return formatRangeString(raw, 'lbs')
}

export function formatLureOzRangeString(raw: string): string {
  return formatRangeString(raw, 'oz')
}
