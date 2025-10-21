// <!-- BEGIN RBP GENERATED: hq-import-settings-v1 -->
import { json } from '@remix-run/node'
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'
import {
  listManualSeeds,
  addManualSeed,
  removeManualSeed,
  getSchedule,
  setSchedule,
  saveCredentials,
} from '../services/importer/settings.server'

export async function loader({ request }: LoaderFunctionArgs) {
  await requireHQAccess(request)
  const supplierId = 'batson'
  const [seeds, schedule] = await Promise.all([listManualSeeds(supplierId), getSchedule(supplierId)])
  return json({ seeds, schedule })
}

export async function action({ request }: ActionFunctionArgs) {
  await requireHQAccess(request)
  const supplierId = 'batson'
  const fd = await request.formData()
  const intent = String(fd.get('intent') || '')
  if (intent === 'seed:add') {
    await addManualSeed(supplierId, String(fd.get('url')), String(fd.get('label') || ''))
    return json({ ok: true })
  }
  if (intent === 'seed:remove') {
    await removeManualSeed(supplierId, String(fd.get('url')))
    return json({ ok: true })
  }
  if (intent === 'schedule:set') {
    await setSchedule(supplierId, fd.get('enabled') === 'on', String(fd.get('cron') || '0 3 * * *'))
    return json({ ok: true })
  }
  if (intent === 'creds:save') {
    await saveCredentials(
      supplierId,
      String(fd.get('username') || ''),
      String(fd.get('password') || ''),
      String(fd.get('totp') || ''),
      'hq-user',
    )
    return json({ ok: true })
  }
  return json({ ok: false }, { status: 400 })
}

export default function ImportSettingsPage() {
  // TODO: minimal UI (form) can be added later; keeping server-only plumbing for now
  return null
}
// <!-- END RBP GENERATED: hq-import-settings-v1 -->
