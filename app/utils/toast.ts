// <!-- BEGIN RBP GENERATED: admin-hq-importer-ux-v2 -->
/** App Bridge toast helpers with safe fallbacks. */
export const toast = {
  success(msg: string) {
    try {
      const w = window as unknown as { shopifyToast?: { success?: (m: string) => void } }
      if (w.shopifyToast?.success) return w.shopifyToast.success(msg)
    } catch {
      // ignore
    }
    console.log(`[toast:success] ${msg}`)
  },
  info(msg: string) {
    try {
      const w = window as unknown as { shopifyToast?: { info?: (m: string) => void } }
      if (w.shopifyToast?.info) return w.shopifyToast.info(msg)
    } catch {
      // ignore
    }
    console.log(`[toast:info] ${msg}`)
  },
  error(msg: string) {
    try {
      const w = window as unknown as { shopifyToast?: { error?: (m: string) => void } }
      if (w.shopifyToast?.error) return w.shopifyToast.error(msg)
    } catch {
      // ignore
    }
    console.error(`[toast:error] ${msg}`)
  },
}
// <!-- END RBP GENERATED: admin-hq-importer-ux-v2 -->
