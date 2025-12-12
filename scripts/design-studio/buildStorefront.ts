import { build } from 'esbuild'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const EXT_DIR = path.resolve('extensions/design-studio')
const ENTRY = path.join(EXT_DIR, 'src/storefront/entry.tsx')
const OUT_DIR = path.join(EXT_DIR, 'assets')
const MANIFEST_FILE = path.join(OUT_DIR, 'design-studio-ui.manifest.json')

async function ensureEntryExists() {
  try {
    await fs.access(ENTRY)
  } catch {
    throw new Error(`Storefront entry not found at ${ENTRY}`)
  }
}

async function cleanOldBundles() {
  const files = await fs.readdir(OUT_DIR, { withFileTypes: true })
  const stale = files
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .filter(name => /^design-studio-ui\..+\.js$/.test(name))
  await Promise.all(stale.map(file => fs.unlink(path.join(OUT_DIR, file)).catch(() => undefined)))
}

function resolveEntryOutput(metafile: import('esbuild').Metafile) {
  const outputs = Object.entries(metafile.outputs)
  const entryPath = path.resolve(ENTRY)
  const match = outputs.find(([, meta]) => meta.entryPoint && path.resolve(meta.entryPoint) === entryPath)
  if (!match) {
    throw new Error('Unable to locate storefront bundle output')
  }
  const [outputPath] = match
  return path.basename(outputPath)
}

async function writeManifest(entryFile: string) {
  const payload = {
    entry: entryFile,
    generatedAt: new Date().toISOString(),
  }
  await fs.writeFile(MANIFEST_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function run() {
  await ensureEntryExists()
  await cleanOldBundles()
  const result = await build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2019'],
    outdir: OUT_DIR,
    entryNames: 'design-studio-ui.[hash]',
    sourcemap: false,
    metafile: true,
    minify: true,
    logLevel: 'info',
    jsx: 'automatic',
    jsxImportSource: 'react',
  })
  if (!result.metafile) {
    throw new Error('esbuild missing metafile output')
  }
  const entryFile = resolveEntryOutput(result.metafile)
  await writeManifest(entryFile)
  console.log(`[design-studio] storefront bundle ready: ${entryFile}`)
}

run().catch(error => {
  console.error('[design-studio] storefront bundle failed', error)
  process.exitCode = 1
})
