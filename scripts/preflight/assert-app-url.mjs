#!/usr/bin/env node
import process from 'node:process'

function isInvalid(value) {
  if (!value) return true
  return /example\.com/i.test(value)
}

const mode = process.env.NODE_ENV ?? 'production'
const appUrl = process.env.SHOPIFY_APP_URL ?? ''

if (mode === 'production' && isInvalid(appUrl)) {
  const display = appUrl || '(unset)'
  console.error(`[preflight] SHOPIFY_APP_URL is invalid in production: ${display}`)
  console.error('[preflight] Set SHOPIFY_APP_URL to the public Fly URL, e.g. https://rbp-app.fly.dev')
  process.exit(1)
}

if (!appUrl) {
  console.warn('[preflight] SHOPIFY_APP_URL not set; using request-derived origins')
} else {
  console.log(`[preflight] SHOPIFY_APP_URL=${appUrl}`)
}
