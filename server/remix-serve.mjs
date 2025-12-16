import compression from 'compression'
import express from 'express'
import morgan from 'morgan'
import { installGlobals } from '@remix-run/node'
import { createRequestHandler } from '@remix-run/express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withShopifyCors } from './shopify-cors.js'

const BUILD_PATH = fileURLToPath(new URL('../build/server/index.js', import.meta.url))
const build = await import(BUILD_PATH)
installGlobals({ nativeFetch: build.future?.v3_singleFetch })

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'
const MODE = process.env.NODE_ENV ?? 'production'
const publicPath = build.publicPath ?? '/build/'
const assetsDir = build.assetsBuildDirectory ?? path.resolve(process.cwd(), 'build/client')
const { prefix: assetPrefix, directory: assetDirectory } = deriveAssetMount(publicPath, build.entry?.module, assetsDir)

const app = express()
app.disable('x-powered-by')
app.use(compression())
console.log(`[rbp-app] serving static assets from ${assetPrefix} -> ${assetDirectory}`)

app.use(assetPrefix, withShopifyCors, express.static(assetDirectory, { immutable: true, maxAge: '1y' }))
app.use(express.static('public', { maxAge: '1h' }))
app.use(morgan('tiny'))

const requestHandler = createRequestHandler({ build, mode: MODE })
app.all('*', (req, res, next) => requestHandler(req, res, next))

const server = app.listen(PORT, HOST, () => {
  console.log(`[rbp-app] listening on http://${HOST}:${PORT}`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => server.close(() => process.exit(0)))
}

function deriveAssetMount(publicPathValue, entryModule, assetsRoot) {
  const manifestSpecifier = findManifestEntrySpecifier(assetsRoot)
  const prefix = deriveAssetPrefix(publicPathValue, entryModule, manifestSpecifier)
  const relativeDir = inferAssetRelativeDir(entryModule) ?? inferAssetRelativeDir(manifestSpecifier)
  const candidateDir = relativeDir ? path.join(assetsRoot, relativeDir) : null
  const directory = candidateDir && directoryExists(candidateDir) ? candidateDir : assetsRoot
  return { prefix, directory }
}

function deriveAssetPrefix(publicPathValue, ...specifierCandidates) {
  const normalized = normalizePrefix(publicPathValue)
  if (normalized && normalized !== '/') return normalized
  for (const specifier of specifierCandidates) {
    const derived = derivePrefixFromSpecifier(specifier)
    if (derived && derived !== '/') {
      return derived
    }
  }
  return '/build'
}

function derivePrefixFromSpecifier(specifier) {
  if (typeof specifier !== 'string' || !specifier.length) return ''
  try {
    const prefix = path.posix.dirname(new URL(specifier, 'https://rbp-app.local').pathname)
    const normalizedEntry = normalizePrefix(prefix)
    if (normalizedEntry) return normalizedEntry
  } catch {
    const normalizedEntry = normalizePrefix(path.posix.dirname(specifier))
    if (normalizedEntry) return normalizedEntry
  }
  return ''
}

function normalizePrefix(value) {
  if (!value) return ''
  let out = value
  try {
    out = new URL(value, 'https://rbp-app.local').pathname
  } catch {
    out = value
  }
  if (!out.startsWith('/')) out = `/${out}`
  if (out.length > 1 && out.endsWith('/')) {
    out = out.slice(0, -1)
  }
  return out
}

function inferAssetRelativeDir(entryModule) {
  if (typeof entryModule !== 'string' || !entryModule.length) return null
  const dir = extractDirFromPath(attemptToPathname(entryModule))
  return dir ?? null
}

function attemptToPathname(value) {
  try {
    return new URL(value, 'https://rbp-app.local').pathname
  } catch {
    return value
  }
}

function extractDirFromPath(pathname) {
  if (!pathname) return null
  const normalized = pathname.startsWith('/') ? pathname.slice(1) : pathname
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length <= 1) return null
  parts.pop()
  return parts.shift() ?? null
}

function directoryExists(candidate) {
  try {
    return fs.statSync(candidate).isDirectory()
  } catch {
    return false
  }
}

function findManifestEntrySpecifier(assetsRoot) {
  const manifestPath = locateManifestFile(assetsRoot)
  if (!manifestPath) return null
  try {
    const manifestContents = fs.readFileSync(manifestPath, 'utf8')
    const manifestJson = extractManifestJson(manifestContents)
    return manifestJson?.entry?.module ?? null
  } catch {
    return null
  }
}

function locateManifestFile(assetsRoot) {
  const candidateDirs = [assetsRoot, path.join(assetsRoot, 'assets')]
  for (const dir of candidateDirs) {
    if (!directoryExists(dir)) continue
    try {
      const entries = fs.readdirSync(dir)
      const manifestName = entries.find(name => name.startsWith('manifest-') && name.endsWith('.js'))
      if (manifestName) {
        return path.join(dir, manifestName)
      }
    } catch {
      // Ignore directories we cannot read
    }
  }
  return null
}

function extractManifestJson(contents) {
  if (!contents) return null
  const start = contents.indexOf('{')
  const end = contents.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(contents.slice(start, end + 1))
  } catch {
    return null
  }
}
