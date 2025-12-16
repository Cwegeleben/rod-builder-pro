import type { LoaderFunctionArgs } from '@remix-run/node'
import fs from 'node:fs/promises'
import path from 'node:path'

const ASSET_DIR = path.join(process.cwd(), 'extensions/design-studio/assets')
const CONTENT_TYPES: Record<string, string> = {
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

export async function loader({ params }: LoaderFunctionArgs) {
  const assetParam = params.asset
  if (!assetParam) {
    throw new Response('Not found', { status: 404 })
  }

  if (assetParam.includes('/') || assetParam.includes('..') || assetParam.includes('\\')) {
    throw new Response('Not found', { status: 404 })
  }

  const filePath = path.join(ASSET_DIR, assetParam)
  let fileBuffer: Buffer
  try {
    fileBuffer = await fs.readFile(filePath)
  } catch (error) {
    console.error('[designStudio] missing extension asset', assetParam, error)
    throw new Response('Not found', { status: 404 })
  }

  const ext = path.extname(assetParam).toLowerCase()
  const headers = new Headers()
  headers.set('Content-Type', CONTENT_TYPES[ext] ?? 'application/octet-stream')
  if (ext === '.json') {
    headers.set('Cache-Control', 'no-store, must-revalidate')
  } else {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  }

  return new Response(fileBuffer, { headers })
}
