/// <reference types="vite/client" />
/// <reference types="@remix-run/node" />

interface ImportMetaEnv {
  readonly VITE_DISABLE_BEACON_SUPPRESS?: string
  readonly VITE_REMOTE_TEMPLATES?: string
  // Comma or space separated list of HQ shop domains or bare prefixes
  readonly HQ_SHOPS?: string
  // Optional regex string to test normalized bare shop against, e.g. "^rbp-.*-dev$"
  readonly HQ_SHOPS_REGEX?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
