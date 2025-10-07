/// <reference types="vite/client" />
/// <reference types="@remix-run/node" />

interface ImportMetaEnv {
  readonly VITE_DISABLE_BEACON_SUPPRESS?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
