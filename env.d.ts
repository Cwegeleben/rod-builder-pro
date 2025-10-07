/// <reference types="vite/client" />
/// <reference types="@remix-run/node" />

interface ImportMetaEnv {
  readonly VITE_DISABLE_BEACON_SUPPRESS?: string
  readonly VITE_REMOTE_TEMPLATES?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
