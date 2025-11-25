export function extractProductCodeFromHtml(html: string): string {
  if (!html) return ''
  const match = html.match(/product-details-code[^>]*>\s*[^<]*<span>([^<]+)<\/span>/i)
  return match && match[1] ? match[1].trim() : ''
}
