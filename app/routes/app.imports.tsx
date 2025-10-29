// <!-- BEGIN RBP GENERATED: importer-v2-3 -->
// Flip /app/imports to render the new Imports hub UI (admin portal),
// instead of redirecting to legacy /app/admin/import/runs.
// Note: This composes the new UI directly to avoid route churn and keeps
// App Bridge/embedded context intact.

import ImportsHome from '../../src/apps/admin.portal/app/routes/app.imports._index'
import { useLocation } from '@remix-run/react'

export default function ImportsIndex() {
  const location = useLocation()
  return <ImportsHome search={location.search} />
}
// <!-- END RBP GENERATED: importer-v2-3 -->
