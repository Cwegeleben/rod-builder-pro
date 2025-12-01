export function shouldEnableThemeScrollRestoration(search: string | null | undefined) {
  if (!search) return true
  try {
    const normalized = search.startsWith('?') ? search : `?${search}`
    const params = new URLSearchParams(normalized)
    return params.get('rbp_theme') !== '1'
  } catch {
    // Assume scroll restoration can proceed if parsing fails.
    return true
  }
}
