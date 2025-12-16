import { PassThrough } from 'stream'
import { renderToPipeableStream } from 'react-dom/server'
import { RemixServer } from '@remix-run/react'
import { createReadableStreamFromReadable, type EntryContext } from '@remix-run/node'
import { isbot } from 'isbot'
import { addDocumentResponseHeaders } from './shopify.server'
import { resolveAbsoluteAssetPublicPath } from './utils/assetBase.server'
import { ensureShopifyCorsHeaders } from './utils/shopifyCors.server'

type MutableAssetsManifest = EntryContext['manifest'] & { publicPath?: string }

export const streamTimeout = 5000

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
) {
  addDocumentResponseHeaders(request, responseHeaders)
  ensureShopifyCorsHeaders(request, responseHeaders)
  const manifest = remixContext.manifest as MutableAssetsManifest
  manifest.publicPath = resolveAbsoluteAssetPublicPath(request, manifest.publicPath)
  ensureManifestAssetsUseAbsoluteUrls(manifest)
  const userAgent = request.headers.get('user-agent')
  const callbackName = isbot(userAgent ?? '') ? 'onAllReady' : 'onShellReady'

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(<RemixServer context={remixContext} url={request.url} />, {
      [callbackName]: () => {
        const body = new PassThrough()
        const stream = createReadableStreamFromReadable(body)

        responseHeaders.set('Content-Type', 'text/html')
        resolve(
          new Response(stream, {
            headers: responseHeaders,
            status: responseStatusCode,
          }),
        )
        pipe(body)
      },
      onShellError(error) {
        reject(error)
      },
      onError(error) {
        responseStatusCode = 500
        console.error(error)
      },
    })

    // Automatically timeout the React renderer after 6 seconds, which ensures
    // React has enough time to flush down the rejected boundary contents
    setTimeout(abort, streamTimeout + 1000)
  })
}

const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/

function ensureManifestAssetsUseAbsoluteUrls(manifest: MutableAssetsManifest) {
  const base = manifest.publicPath
  if (!base) return

  manifest.entry.module = absolutizeSpecifier(manifest.entry.module, base)
  if (Array.isArray(manifest.entry.imports)) {
    manifest.entry.imports = manifest.entry.imports.map((specifier: string) => absolutizeSpecifier(specifier, base))
  }

  Object.values(manifest.routes).forEach(route => {
    route.module = absolutizeSpecifier(route.module, base)
    if (Array.isArray(route.imports)) {
      route.imports = route.imports.map((specifier: string) => absolutizeSpecifier(specifier, base))
    }
  })

  if (manifest.url) {
    manifest.url = absolutizeSpecifier(manifest.url, base)
  }
}

function absolutizeSpecifier(value: string, base: string): string {
  if (!value || ABSOLUTE_URL_PATTERN.test(value)) return value
  try {
    return new URL(value, base).toString()
  } catch {
    return value
  }
}
