// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
// Flip /app/imports to render the new Imports hub UI (admin portal),
// instead of redirecting to legacy /app/admin/import/runs.
// Note: This composes the new UI directly to avoid route churn and keeps
// App Bridge/embedded context intact.

import ImportsHome from '../../src/apps/admin.portal/app/routes/app.imports._index'

export default function ImportsIndex() {
  return <ImportsHome />
}
// <!-- END RBP GENERATED: importer-v2-3 -->
