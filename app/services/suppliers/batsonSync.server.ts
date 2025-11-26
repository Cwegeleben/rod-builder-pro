import { randomUUID } from 'node:crypto'
import { execa } from 'execa'
import type { Prisma, SupplierSyncState } from '@prisma/client'
import { prisma } from '../../db.server'
import { enc, dec } from '../crypto.server'
import { extractBatsonDetailMeta } from '../../server/importer/preview/parsers/batsonAttributeGrid'

const BATSON_STATE_SLUG = 'batson'
const BATSON_SUPPLIER_SLUGS = [
  'batson-rod-blanks',
  'batson-reel-seats',
  'batson-guides-tops',
  'batson-grips',
  'batson-end-caps-gimbals',
  'batson-trim-pieces',
]
const DETAIL_ACCEPT_HEADER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15'
const DEFAULT_VALIDATION_URL =
  'https://batsonenterprises.com/reel-seats/gt-trigger-reel-seat-hood-black-gt-trigger-reel-seat-hood-black'
const COOKIE_MAX_AGE_HOURS = Number(process.env.BATSON_COOKIE_MAX_AGE_HOURS || '72')
const COOKIE_MAX_AGE_MS = Math.max(1, COOKIE_MAX_AGE_HOURS) * 60 * 60 * 1000

type ExecaResultError = Error & { stdout?: string }

export type BatsonRunStatus = 'idle' | 'queued' | 'running' | 'failed' | 'success'

export type BatsonCurrentRunSnapshot = {
  status: BatsonRunStatus
  startedAt?: string | null
  finishedAt?: string | null
}

export type BatsonLastRunSnapshot = {
  startedAt?: string | null
  finishedAt?: string | null
  durationMs?: number | null
  summary?: Prisma.JsonValue | null
}

type BatsonRunJson = BatsonCurrentRunSnapshot & {
  durationMs?: number | null
  summary?: Prisma.JsonValue | null
}

const DEFAULT_CURRENT_RUN: BatsonCurrentRunSnapshot = { status: 'idle', startedAt: null, finishedAt: null }
const DEFAULT_LAST_RUN: BatsonLastRunSnapshot = { startedAt: null, finishedAt: null, durationMs: null, summary: null }

function coerceCurrentRun(input: Prisma.JsonValue | null | undefined): BatsonCurrentRunSnapshot {
  if (!input || typeof input !== 'object') return { ...DEFAULT_CURRENT_RUN }
  const value = input as Record<string, unknown>
  const status = isValidRunStatus(value.status) ? (value.status as BatsonRunStatus) : 'idle'
  const startedAt = typeof value.startedAt === 'string' ? value.startedAt : null
  const finishedAt = typeof value.finishedAt === 'string' ? value.finishedAt : null
  return { status, startedAt, finishedAt }
}

function coerceLastRun(
  input: Prisma.JsonValue | null | undefined,
  summaryFallback: Prisma.JsonValue | null | undefined,
): BatsonLastRunSnapshot {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_LAST_RUN, summary: summaryFallback ?? null }
  }
  const value = input as Record<string, unknown>
  const startedAt = typeof value.startedAt === 'string' ? value.startedAt : null
  const finishedAt = typeof value.finishedAt === 'string' ? value.finishedAt : null
  const durationMs = typeof value.durationMs === 'number' ? value.durationMs : null
  const summary = (value.summary as Prisma.JsonValue | undefined) ?? summaryFallback ?? null
  return { startedAt, finishedAt, durationMs, summary }
}

function isValidRunStatus(status: unknown): status is BatsonRunStatus {
  return status === 'idle' || status === 'queued' || status === 'running' || status === 'failed' || status === 'success'
}

function buildCurrentRun(partial: BatsonRunJson): BatsonCurrentRunSnapshot {
  return {
    status: partial.status,
    startedAt: partial.startedAt ?? null,
    finishedAt: partial.finishedAt ?? null,
  }
}

function buildLastRun(partial: BatsonRunJson): BatsonLastRunSnapshot {
  return {
    startedAt: partial.startedAt ?? null,
    finishedAt: partial.finishedAt ?? null,
    durationMs: typeof partial.durationMs === 'number' ? partial.durationMs : null,
    summary: partial.summary ?? null,
  }
}

export type BatsonSyncSnapshot = {
  supplierSlug: string
  authStatus: 'missing' | 'pending' | 'valid' | 'invalid' | 'expired'
  authMessage?: string | null
  authCookieSetAt?: string | null
  authCookieValidatedAt?: string | null
  lastSyncStatus?: string | null
  lastSyncAt?: string | null
  lastSyncJobId?: string | null
  lastSyncSummary?: Record<string, unknown> | null
  lastSyncError?: string | null
  currentRun: BatsonCurrentRunSnapshot
  lastRun: BatsonLastRunSnapshot
}

export class BatsonSyncError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'BatsonSyncError'
  }
}

async function ensureState(): Promise<SupplierSyncState> {
  const existing = await prisma.supplierSyncState.findUnique({ where: { supplierSlug: BATSON_STATE_SLUG } })
  if (existing) return existing
  return prisma.supplierSyncState.create({ data: { supplierSlug: BATSON_STATE_SLUG } })
}

export function deriveCookieStatus(
  state: SupplierSyncState | null,
  now = new Date(),
): 'missing' | 'pending' | 'valid' | 'invalid' | 'expired' {
  if (!state || !state.authCookieEnc) return 'missing'
  const normalized = (state.authStatus || '').toLowerCase()
  if (normalized === 'missing') return 'missing'
  if (normalized && normalized !== 'valid' && normalized !== 'pending') return 'invalid'
  if (!state.authCookieValidatedAt) return 'pending'
  const age = now.getTime() - state.authCookieValidatedAt.getTime()
  if (age > COOKIE_MAX_AGE_MS) return 'expired'
  return state.authStatus === 'valid' ? 'valid' : 'pending'
}

export async function getBatsonSyncState(): Promise<BatsonSyncSnapshot> {
  const state = await ensureState()
  return {
    supplierSlug: state.supplierSlug,
    authStatus: deriveCookieStatus(state),
    authMessage: state.authMessage,
    authCookieSetAt: state.authCookieSetAt?.toISOString() ?? null,
    authCookieValidatedAt: state.authCookieValidatedAt?.toISOString() ?? null,
    lastSyncStatus: state.lastSyncStatus,
    lastSyncAt: state.lastSyncAt?.toISOString() ?? null,
    lastSyncJobId: state.lastSyncJobId ?? null,
    lastSyncSummary: (state.lastSyncSummary as Record<string, unknown> | null) ?? null,
    lastSyncError: state.lastSyncError ?? null,
    currentRun: coerceCurrentRun(state.currentSyncRun),
    lastRun: coerceLastRun(state.lastSyncRun, state.lastSyncSummary),
  }
}

const sanitizeCookie = (input: string): string => input.replace(/^cookie:/i, '').trim()

export async function saveBatsonAuthCookie(cookie: string, updatedBy?: string) {
  const trimmed = sanitizeCookie(cookie)
  if (!trimmed) throw new BatsonSyncError('missing-cookie', 'Cookie header required')
  const encrypted = enc(trimmed)
  const now = new Date()
  await prisma.supplierSyncState.update({
    where: { supplierSlug: BATSON_STATE_SLUG },
    data: {
      authCookieEnc: encrypted,
      authCookieSetAt: now,
      authCookieSetBy: updatedBy || null,
      authCookieValidatedAt: null,
      authStatus: 'pending',
      authMessage: 'Validating cookie…',
    },
  })
  return validateBatsonAuthCookie({ cookieOverride: trimmed })
}

export async function validateBatsonAuthCookie(options?: { cookieOverride?: string }) {
  const state = await ensureState()
  const cookie = options?.cookieOverride ?? (state.authCookieEnc ? dec(state.authCookieEnc) : '')
  if (!cookie) {
    await prisma.supplierSyncState.update({
      where: { supplierSlug: BATSON_STATE_SLUG },
      data: { authStatus: 'missing', authMessage: 'No cookie stored', authCookieValidatedAt: null },
    })
    throw new BatsonSyncError('missing-cookie', 'Add a Batson cookie before validating')
  }
  const result = await testWholesaleCookie(cookie)
  const data: Prisma.SupplierSyncStateUpdateInput = {
    authCookieValidatedAt: result.ok ? new Date() : null,
    authStatus: result.ok ? 'valid' : (result.code ?? 'invalid'),
    authMessage: result.message,
  }
  await prisma.supplierSyncState.update({ where: { supplierSlug: BATSON_STATE_SLUG }, data })
  return { ...result, state: await getBatsonSyncState() }
}

async function testWholesaleCookie(cookie: string) {
  const url = process.env.BATSON_VALIDATION_URL || DEFAULT_VALIDATION_URL
  const headers: Record<string, string> = { Accept: DETAIL_ACCEPT_HEADER, 'User-Agent': USER_AGENT, Cookie: cookie }
  let html = ''
  try {
    const response = await fetch(url, { headers, redirect: 'follow' })
    if (!response.ok) {
      return { ok: false as const, code: 'http-error', message: `HTTP ${response.status} while validating cookie` }
    }
    html = await response.text()
  } catch (err) {
    return { ok: false as const, code: 'fetch-error', message: (err as Error)?.message || 'Failed to reach Batson' }
  }
  if (!html) return { ok: false as const, code: 'empty-html', message: 'Empty response loading Batson detail page' }
  const detail = extractBatsonDetailMeta(html)
  const wholesale = detail.priceWholesale ?? null
  const msrp = detail.msrp ?? null
  if (wholesale == null || wholesale <= 0) {
    return { ok: false as const, code: 'no-wholesale', message: 'Wholesale price not detected in response' }
  }
  if (msrp != null && Math.abs(msrp - wholesale) < 0.01) {
    return {
      ok: false as const,
      code: 'same-as-msrp',
      message: 'Wholesale equals MSRP; make sure you are logged in as a dealer',
    }
  }
  return {
    ok: true as const,
    message: `Wholesale detected (${wholesale.toFixed(2)} vs MSRP ${msrp?.toFixed(2) ?? 'n/a'})`,
    wholesale,
    msrp,
  }
}

async function requireFreshCookie(): Promise<{ cookie: string; state: SupplierSyncState }> {
  const state = await ensureState()
  const status = deriveCookieStatus(state)
  if (status === 'missing') throw new BatsonSyncError('missing-cookie', 'Upload the Batson cookie first')
  if (status === 'pending') throw new BatsonSyncError('pending-cookie', 'Validate the Batson cookie before syncing')
  if (status === 'expired') throw new BatsonSyncError('expired-cookie', 'Cookie expired — update it to sync')
  if (status !== 'valid') throw new BatsonSyncError('invalid-cookie', state.authMessage || 'Cookie invalid')
  const cookie = state.authCookieEnc ? dec(state.authCookieEnc) : ''
  if (!cookie) throw new BatsonSyncError('missing-cookie', 'Stored cookie missing — update auth cookie again')
  return { cookie, state }
}

export async function enqueueBatsonSync(startedBy?: string) {
  const { cookie } = await requireFreshCookie()
  const jobId = randomUUID()
  const startedAt = new Date()
  const startedAtIso = startedAt.toISOString()
  await prisma.supplierSyncState.update({
    where: { supplierSlug: BATSON_STATE_SLUG },
    data: {
      lastSyncJobId: jobId,
      lastSyncAt: startedAt,
      lastSyncStatus: 'running',
      lastSyncError: null,
      lastSyncSummary: buildSyncSummary({
        jobId,
        startedBy: startedBy || null,
        startedAt: startedAt.toISOString(),
        suppliers: BATSON_SUPPLIER_SLUGS.map(slug => ({ slug, status: 'queued' })),
      }),
      currentSyncRun: buildCurrentRun({ status: 'running', startedAt: startedAtIso }),
    },
  })
  void runBatsonSyncJob({ cookie, jobId, startedBy, jobStartedAt: startedAt }).catch(async err => {
    const finishedAt = new Date()
    const finishedIso = finishedAt.toISOString()
    const durationMs = finishedAt.getTime() - startedAt.getTime()
    await prisma.supplierSyncState.update({
      where: { supplierSlug: BATSON_STATE_SLUG },
      data: {
        lastSyncStatus: 'error',
        lastSyncError: (err as Error)?.message || 'sync-failed',
        lastSyncSummary: buildSyncSummary({
          jobId,
          startedBy: startedBy || null,
          finishedAt: finishedIso,
          suppliers: [],
        }),
        currentSyncRun: buildCurrentRun({ status: 'failed', startedAt: startedAtIso, finishedAt: finishedIso }),
        lastSyncRun: buildLastRun({
          status: 'failed',
          startedAt: startedAtIso,
          finishedAt: finishedIso,
          durationMs,
          summary: null,
        }),
      },
    })
  })
  return { jobId }
}

async function runBatsonSyncJob({
  cookie,
  jobId,
  startedBy,
  jobStartedAt,
}: {
  cookie: string
  jobId: string
  startedBy?: string
  jobStartedAt: Date
}) {
  const summaries: SupplierSummaryInput[] = []
  let overallOk = true
  for (const slug of BATSON_SUPPLIER_SLUGS) {
    const result = await runIngestForSlug(slug, cookie)
    const status = extractSummaryString(result.summary, 'status')
    summaries.push({
      slug,
      status,
      ok: result.ok,
      durationMs: result.durationMs,
      error: result.error || null,
      summary: result.summary ? coerceJsonValue(result.summary) : null,
    })
    if (!result.ok) overallOk = false
  }
  const finishedAt = new Date()
  const finishedIso = finishedAt.toISOString()
  const startedAtIso = jobStartedAt.toISOString()
  const durationMs = finishedAt.getTime() - jobStartedAt.getTime()
  const summary = buildSyncSummary({
    jobId,
    startedBy: startedBy || null,
    startedAt: startedAtIso,
    finishedAt: finishedIso,
    suppliers: summaries,
  })
  await prisma.supplierSyncState.update({
    where: { supplierSlug: BATSON_STATE_SLUG },
    data: {
      lastSyncStatus: overallOk ? 'success' : 'error',
      lastSyncError: overallOk ? null : summaries.find(item => item.ok === false)?.error?.toString() || 'sync-failed',
      lastSyncSummary: summary,
      currentSyncRun: buildCurrentRun({
        status: overallOk ? 'success' : 'failed',
        startedAt: startedAtIso,
        finishedAt: finishedIso,
      }),
      lastSyncRun: buildLastRun({
        status: overallOk ? 'success' : 'failed',
        startedAt: startedAtIso,
        finishedAt: finishedIso,
        durationMs,
        summary,
      }),
    },
  })
}

async function runIngestForSlug(slug: string, cookie: string) {
  const started = Date.now()
  const env = {
    ...process.env,
    BATSON_AUTH_COOKIE: cookie,
    SUPPLIER_ID: slug,
  }
  try {
    const result = await execa('npx', ['tsx', 'scripts/preflight/ingestSeeds.ts', `--site-id=${slug}`], {
      cwd: process.cwd(),
      env: { ...env, SITE_ID: slug },
    })
    const summary = parseScriptSummary(result.stdout)
    return { ok: true as const, summary, durationMs: Date.now() - started, error: null as string | null }
  } catch (err) {
    const error = (err as Error)?.message || 'ingest-failed'
    const stdout = extractStdout(err)
    const summary = parseScriptSummary(stdout)
    return { ok: false as const, summary, durationMs: Date.now() - started, error }
  }
}

function parseScriptSummary(output: string | undefined): Record<string, unknown> | null {
  if (!output) return null
  const trimmed = output.trim()
  const lastBrace = trimmed.lastIndexOf('{')
  if (lastBrace === -1) return null
  const candidate = trimmed.slice(lastBrace)
  try {
    const parsed = JSON.parse(candidate)
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>
  } catch {
    return null
  }
  return null
}

function extractStdout(error: unknown): string {
  if (typeof error === 'object' && error && 'stdout' in error) {
    const stdout = (error as ExecaResultError).stdout
    return typeof stdout === 'string' ? stdout : ''
  }
  return ''
}

type SupplierSummaryInput = {
  slug: string
  status?: string | null
  ok?: boolean
  durationMs?: number
  error?: string | null
  summary?: Prisma.JsonValue | null
}

function buildSyncSummary(input: {
  jobId: string
  startedBy: string | null
  startedAt?: string
  finishedAt?: string
  suppliers: SupplierSummaryInput[]
}): Prisma.JsonObject {
  return {
    jobId: input.jobId,
    startedBy: input.startedBy,
    startedAt: input.startedAt ?? null,
    finishedAt: input.finishedAt ?? null,
    suppliers: input.suppliers.map(item => ({
      slug: item.slug,
      status: item.status ?? null,
      ok: typeof item.ok === 'boolean' ? item.ok : null,
      durationMs: typeof item.durationMs === 'number' ? item.durationMs : null,
      error: item.error ?? null,
      summary: item.summary ?? null,
    })),
  }
}

function coerceJsonValue(value: unknown): Prisma.JsonValue {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => coerceJsonValue(item)) as Prisma.JsonArray
  }
  if (typeof value === 'object') {
    const out: Prisma.JsonObject = {}
    for (const [key, val] of Object.entries(value)) {
      out[key] = coerceJsonValue(val)
    }
    return out
  }
  return String(value)
}

function extractSummaryString(summary: Record<string, unknown> | null, key: string): string | undefined {
  if (!summary) return undefined
  const value = summary[key]
  return typeof value === 'string' ? value : undefined
}
