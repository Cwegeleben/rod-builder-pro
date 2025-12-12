import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')
const routesDir = path.resolve(projectRoot, 'app', 'routes')
const ROUTE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mdx'])

async function main() {
  const files = await collectRouteFiles(routesDir)
  const duplicates = findDuplicates(files)

  if (duplicates.length > 0) {
    console.error('Duplicate route IDs detected:')
    for (const entry of duplicates) {
      console.error(`  ${entry.routeId}`)
      for (const filePath of entry.files) {
        console.error(`    - ${filePath}`)
      }
    }
    console.error('Resolve the duplicates above before continuing.')
    process.exitCode = 1
    return
  }

  console.log('No duplicate route IDs found.')
}

async function collectRouteFiles(dir: string): Promise<Array<{ filePath: string; routeId: string }>> {
  const entries = await readdir(dir, { withFileTypes: true })
  const results: Array<{ filePath: string; routeId: string }> = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...(await collectRouteFiles(fullPath)))
      continue
    }

    const ext = path.extname(entry.name)
    if (!ROUTE_EXTENSIONS.has(ext)) {
      continue
    }

    const relativePath = path.relative(routesDir, fullPath)
    const routeId = toRouteId(relativePath)
    results.push({ filePath: relativePath.split(path.sep).join('/'), routeId })
  }

  return results
}

function toRouteId(relativePath: string): string {
  const withoutExt = relativePath.replace(/\.[^./]+$/, '')
  return withoutExt.split(path.sep).join('/')
}

function findDuplicates(files: Array<{ filePath: string; routeId: string }>) {
  const map = new Map<string, string[]>()
  for (const { filePath, routeId } of files) {
    const existing = map.get(routeId)
    if (existing) {
      existing.push(filePath)
    } else {
      map.set(routeId, [filePath])
    }
  }

  return Array.from(map.entries())
    .filter(([, filePaths]) => filePaths.length > 1)
    .map(([routeId, filePaths]) => ({ routeId, files: filePaths }))
}

await main().catch(error => {
  console.error('Route collision check failed:', error)
  process.exit(1)
})
