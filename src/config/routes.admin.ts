/* <!-- BEGIN RBP GENERATED: admin-link-manifest-selftest-v1 --> */
export const ROUTES = {
  runsIndex: '/app/admin/import/runs',
  runDetail: (id: string | number) => `/app/admin/import/runs/${id}`,
  newRun: '/app/admin/import/new',
  editRun: (id: string | number) => `/app/admin/import/${id}/edit`,
  previewIndex: '/app/admin/import/preview',
  previewForRun: (id: string | number) => `/app/admin/import/preview/${id}`,
  settingsIndex: '/app/admin/import/settings',
  productsIndex: '/app/products',
  templatesIndex: '/app/products/templates',
} as const

export const REDIRECTS: Array<{ from: string; to: string | ((q: URLSearchParams) => string) }> = [
  { from: '/app/imports', to: ROUTES.runsIndex },
  { from: '/app/imports/123', to: () => ROUTES.runDetail(123) },
]

export const REQUIRED_QUERY_PARAMS = ['shop', 'host', 'embedded'] as const
/* <!-- END RBP GENERATED: admin-link-manifest-selftest-v1 --> */
