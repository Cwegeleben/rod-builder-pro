import compression from 'compression'
import express from 'express'
import morgan from 'morgan'
import { installGlobals } from '@remix-run/node'
import { createRequestHandler } from '@remix-run/express'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { withShopifyCors } from './shopify-cors.js'

const BUILD_PATH = fileURLToPath(new URL('../build/server/index.js', import.meta.url))
const build = await import(BUILD_PATH)
installGlobals({ nativeFetch: build.future?.v3_singleFetch })

const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'
const MODE = process.env.NODE_ENV ?? 'production'
const publicPath = build.publicPath ?? '/build/'
const assetsDir = build.assetsBuildDirectory ?? path.resolve(process.cwd(), 'build/client')

const app = express()
app.disable('x-powered-by')
app.use(compression())
console.log(`[rbp-app] serving static assets from ${publicPath} -> ${assetsDir}`)

app.use(publicPath, withShopifyCors, express.static(assetsDir, { immutable: true, maxAge: '1y' }))
app.use(express.static('public', { maxAge: '1h' }))
app.use(morgan('tiny'))

const requestHandler = createRequestHandler({ build, mode: MODE })
app.all('*', (req, res, next) => {
  withShopifyCors(req, res, () => requestHandler(req, res, next))
})

const server = app.listen(PORT, HOST, () => {
  console.log(`[rbp-app] listening on http://${HOST}:${PORT}`)
})

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => server.close(() => process.exit(0)))
}
