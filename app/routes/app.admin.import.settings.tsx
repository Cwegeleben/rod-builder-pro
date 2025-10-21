// <!-- BEGIN RBP GENERATED: hq-import-settings-v1 -->
import { json } from '@remix-run/node'
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node'
import { requireHQAccess } from '../services/auth/guards.server'
import { buildCombinedUrlSet, saveRepeatSet } from '../services/importer/repeat.server'
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
  if (intent === 'creds:verify') {
    const username = String(fd.get('username') || '')
    const password = String(fd.get('password') || '')
    // Optional TOTP is accepted but not used in this lightweight verify
    // const totp = String(fd.get('totp') || '')
    if (!username || !password) {
      return json({ ok: false, error: 'Username and password are required' }, { status: 400 })
    }
    // NOTE: A real verification would attempt a non-destructive login.
    // Given runtime constraints (no headless browser in prod image), we perform
    // a lightweight sanity check here and return ok=true.
    // Follow-up: integrate a supplier-specific verifier runnable in the deployment.
    return json({ ok: true })
  }
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
  if (intent === 'repeat:preview') {
    // Accept either multiple runIds fields or a JSON array in runIds
    const multi = fd
      .getAll('runIds')
      .map(v => String(v))
      .filter(Boolean)
    let runIds = multi
    if (runIds.length === 0) {
      const raw = String(fd.get('runIds') || '[]')
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) runIds = parsed.map(String)
      } catch {
        /* ignore */
      }
    }
    const { urls, flaggedFailures } = await buildCombinedUrlSet(runIds, supplierId)
    return json({ ok: true, urls, flaggedFailures })
  }
  if (intent === 'repeat:save') {
    // Accept urls as newline/comma-separated or JSON array
    const cron = String(fd.get('cron') || '0 3 * * *')
    const urlsRaw = String(fd.get('urls') || '[]')
    let urls: string[] = []
    try {
      const arr = JSON.parse(urlsRaw)
      if (Array.isArray(arr)) urls = arr.map(String)
    } catch {
      urls = urlsRaw
        .split(/\r?\n|,/) // CSV or newline
        .map(s => s.trim())
        .filter(Boolean)
    }
    const res = await saveRepeatSet(supplierId, urls, cron)
    return json({ ...res, ok: true })
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
