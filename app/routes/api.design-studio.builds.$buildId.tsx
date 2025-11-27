import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { authenticate } from '../shopify.server'
import { getDesignStudioAccess } from '../lib/designStudio/access.server'
import {
  loadDesignBuildDetail,
  applyDesignBuildAction,
  DesignBuildActionError,
} from '../lib/designStudio/builds.server'
import type { DesignBuildActionIntent } from '../lib/designStudio/types'
import { exportDesignBuildPacket } from '../services/designStudio/exportBuild.server'

export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticate.admin(request)
  const access = await getDesignStudioAccess(request)
  if (!access.enabled || !access.shopDomain) {
    throw new Response('Not Found', { status: 404 })
  }
  const buildId = params.buildId
  if (!buildId) {
    throw new Response('Missing build id', { status: 400 })
  }
  const detail = await loadDesignBuildDetail(buildId)
  if (!detail) {
    throw new Response('Not Found', { status: 404 })
  }
  if (detail.build.shopDomain !== access.shopDomain) {
    throw new Response('Forbidden', { status: 403 })
  }
  return json(detail)
}

function isBuildActionIntent(value: string): value is DesignBuildActionIntent {
  return value === 'approve' || value === 'request_edits' || value === 'schedule'
}

function resolvePerformedBy(request: Request, session: unknown): string {
  const email = request.headers.get('x-shopify-user-email')
  if (email) return email
  const name = request.headers.get('x-shopify-user-name')
  if (name) return name
  const userId = request.headers.get('x-shopify-user-id')
  if (userId) return `shopify-user:${userId}`
  const typed = session as { shop?: string | null } | null | undefined
  if (typed?.shop) return typed.shop
  return 'design-studio-admin'
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request)
  const access = await getDesignStudioAccess(request)
  if (!access.enabled || !access.shopDomain) {
    throw new Response('Not Found', { status: 404 })
  }
  const buildId = params.buildId
  if (!buildId) {
    return json({ ok: false, error: 'Missing build id' }, { status: 400 })
  }

  const formData = await request.formData()
  const actionIntent = String(formData.get('_action') || '')
  if (actionIntent === 'export_build') {
    try {
      const result = await exportDesignBuildPacket({
        buildId,
        shopDomain: access.shopDomain,
        performedBy: resolvePerformedBy(request, session),
      })
      return json({ ok: true, detail: result.detail, export: result.exportMeta })
    } catch (error) {
      if (error instanceof DesignBuildActionError) {
        const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : 500
        return json({ ok: false, error: error.message }, { status })
      }
      console.error('Design build export failed', error)
      return json({ ok: false, error: 'Unable to export build.' }, { status: 500 })
    }
  }

  if (!isBuildActionIntent(actionIntent)) {
    return json({ ok: false, error: 'Unsupported action' }, { status: 400 })
  }

  const noteRaw = formData.get('note')
  const note = typeof noteRaw === 'string' ? noteRaw.trim() : undefined
  if (actionIntent === 'request_edits' && !note) {
    return json({ ok: false, error: 'Add a note before requesting edits.' }, { status: 400 })
  }

  try {
    const detail = await applyDesignBuildAction({
      buildId,
      shopDomain: access.shopDomain,
      action: actionIntent,
      note,
      performedBy: resolvePerformedBy(request, session),
    })
    return json({ ok: true, detail })
  } catch (error) {
    if (error instanceof DesignBuildActionError) {
      const status =
        error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'FORBIDDEN'
            ? 403
            : error.code === 'INVALID_TRANSITION'
              ? 400
              : 500
      return json({ ok: false, error: error.message }, { status })
    }
    console.error('Design build action failed', error)
    return json({ ok: false, error: 'Unable to update build.' }, { status: 500 })
  }
}
