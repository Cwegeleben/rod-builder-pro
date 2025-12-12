import type { DesignStorefrontOption, DesignStorefrontPartRole } from './storefront.mock'

export type DesignStudioCompatibility = {
  lengthIn?: number | null
  power?: string | null
  action?: string | null
  finish?: string | null
  rodPieces?: number | null
  categories?: string[]
  itemLengthIn?: number | null
  insideDiameterIn?: number | null
  insideDiameterMm?: number | null
  outsideDiameterIn?: number | null
  outsideDiameterMm?: number | null
  frontODIn?: number | null
  rearODIn?: number | null
  gripPosition?: string | null
  profileShape?: string | null
  seatSize?: string | null
  seatOrientation?: string | null
  hardwareFinish?: string | null
  bodyOutsideDiameterIn?: number | null
  buttDiameterIn?: number | null
  buttDiameterMm?: number | null
  tipDiameterIn?: number | null
  tipDiameterMm?: number | null
  capStyle?: string | null
  endCapDepthIn?: number | null
  isGimbal?: boolean | null
  mountInterface?: string | null
  tubeSizeMm?: number | null
  tubeSizeIn?: number | null
  ringSize?: number | null
  heightIn?: number | null
  plating?: string | null
  pattern?: string | null
}

export type DesignStorefrontCompatibilityContext = {
  blank?: DesignStudioCompatibility | null
}

export type CompatibilityIssue =
  | { code: 'missing-blank' }
  | { code: 'missing-option' }
  | { code: 'missing-measurement'; field: string }
  | { code: 'butt-od-too-large'; blankDiameterIn: number; candidateInsideIn: number }
  | { code: 'tip-od-too-large'; blankTipMm: number; candidateTubeMm: number }
  | { code: 'no-compatible-options'; role: DesignStorefrontPartRole }
  | { code: 'selection-incompatible'; role: DesignStorefrontPartRole; optionId?: string | null }

export type CompatibilityEvaluation = {
  compatible: boolean
  issues: CompatibilityIssue[]
}

export type CompatibilityRejection = {
  optionId: string
  productId?: string | null
  issues: CompatibilityIssue[]
}

const BUTT_FIT_ROLES: DesignStorefrontPartRole[] = [
  'handle',
  'rear_grip',
  'fore_grip',
  'reel_seat',
  'butt_cap',
  'component',
  'accessory',
  'winding_check',
  'decal',
]

const TIP_FIT_ROLES: DesignStorefrontPartRole[] = ['guide_tip', 'tip_top']

const BUTT_TOLERANCE_IN = 0
const TIP_TOLERANCE_MM = 0.05

export function normalizeDesignStudioCompatibility(value: unknown): DesignStudioCompatibility {
  const record = asRecord(value) ?? {}
  return {
    lengthIn: toNumber(record.lengthIn),
    power: toString(record.power),
    action: toString(record.action),
    finish: toString(record.finish),
    rodPieces: toNumber(record.rodPieces),
    categories: normalizeArray(record.categories),
    itemLengthIn: toNumber(record.itemLengthIn),
    insideDiameterIn: toNumber(record.insideDiameterIn),
    insideDiameterMm: toNumber(record.insideDiameterMm),
    outsideDiameterIn: toNumber(record.outsideDiameterIn),
    outsideDiameterMm: toNumber(record.outsideDiameterMm),
    frontODIn: toNumber(record.frontODIn),
    rearODIn: toNumber(record.rearODIn),
    gripPosition: toString(record.gripPosition),
    profileShape: toString(record.profileShape),
    seatSize: toString(record.seatSize),
    seatOrientation: toString(record.seatOrientation),
    hardwareFinish: toString(record.hardwareFinish),
    bodyOutsideDiameterIn: toNumber(record.bodyOutsideDiameterIn),
    buttDiameterIn: toNumber(record.buttDiameterIn),
    buttDiameterMm: toNumber(record.buttDiameterMm),
    tipDiameterIn: toNumber(record.tipDiameterIn),
    tipDiameterMm: toNumber(record.tipDiameterMm),
    capStyle: toString(record.capStyle),
    endCapDepthIn: toNumber(record.endCapDepthIn),
    isGimbal: typeof record.isGimbal === 'boolean' ? record.isGimbal : null,
    mountInterface: toString(record.mountInterface),
    tubeSizeMm: toNumber(record.tubeSizeMm || record.tubeSize),
    tubeSizeIn: toNumber(record.tubeSizeIn),
    ringSize: toNumber(record.ringSize),
    heightIn: toNumber(record.heightIn),
    plating: toString(record.plating),
    pattern: toString(record.pattern),
  }
}

export function augmentCompatibilityFromAttributes({
  role,
  base,
  attributes,
}: {
  role: DesignStorefrontPartRole
  base: DesignStudioCompatibility
  attributes?: unknown
}): DesignStudioCompatibility {
  const record = asRecord(attributes)
  if (!record) return base
  const next: DesignStudioCompatibility = { ...base }

  assignIfEmpty(next, 'itemLengthIn', record, ['itemLengthIn'])
  assignIfEmpty(next, 'insideDiameterIn', record, ['insideDiameterIn', 'boreDiameterIn'])
  assignIfEmpty(next, 'outsideDiameterIn', record, ['outsideDiameterIn'])
  assignIfEmpty(next, 'frontODIn', record, ['frontODIn'])
  assignIfEmpty(next, 'rearODIn', record, ['rearODIn'])
  assignIfEmpty(next, 'heightIn', record, ['heightIn'])
  assignIfEmpty(next, 'capStyle', record, ['capStyle'])
  assignIfEmpty(next, 'mountInterface', record, ['mountInterface', 'hardwareInterface'])
  assignIfEmpty(next, 'endCapDepthIn', record, ['endCapDepthIn'])
  assignIfEmpty(next, 'plating', record, ['plating'])
  assignIfEmpty(next, 'pattern', record, ['pattern'])
  assignIfEmpty(next, 'seatSize', record, ['seatSize'])
  assignIfEmpty(next, 'seatOrientation', record, ['seatOrientation'])
  assignIfEmpty(next, 'hardwareFinish', record, ['hardwareFinish'])
  assignIfEmpty(next, 'bodyOutsideDiameterIn', record, ['bodyOutsideDiameterIn'])
  assignIfEmpty(next, 'tubeSizeMm', record, ['tubeSizeMm'])
  assignIfEmpty(next, 'tubeSizeIn', record, ['tubeSizeIn'])
  assignIfEmpty(next, 'ringSize', record, ['ringSize'])

  if (!next.gripPosition) {
    next.gripPosition = toString(record.gripPosition)
  }
  if (!next.profileShape) {
    next.profileShape = toString(record.profileShape)
  }

  if (role === 'blank') {
    assignIfEmpty(next, 'buttDiameterMm', record, ['buttOD_mm'])
    assignIfEmpty(next, 'tipDiameterMm', record, ['tipOD_mm'])
    assignIfEmpty(next, 'buttDiameterIn', record, ['buttODIn', 'buttOD_in'])
    assignIfEmpty(next, 'tipDiameterIn', record, ['tipODIn', 'tipOD_in'])
  }

  if (!next.buttDiameterIn && next.buttDiameterMm) {
    next.buttDiameterIn = mmToInches(next.buttDiameterMm)
  }
  if (!next.tipDiameterMm && next.tipDiameterIn) {
    next.tipDiameterMm = inchesToMm(next.tipDiameterIn)
  }
  if (!next.tipDiameterIn && next.tipDiameterMm) {
    next.tipDiameterIn = mmToInches(next.tipDiameterMm)
  }

  return next
}

export function buildCompatibilityContextFromSelections(
  selections: Partial<Record<DesignStorefrontPartRole, DesignStorefrontOption | null>>,
): DesignStorefrontCompatibilityContext | null {
  const blank = selections.blank
  if (!blank || !blank.compatibility) return null
  return { blank: blank.compatibility }
}

export function serializeCompatibilityContext(context: DesignStorefrontCompatibilityContext | null): string | null {
  if (!context || !context.blank) return null
  try {
    return JSON.stringify(context)
  } catch {
    return null
  }
}

export function parseCompatibilityContext(raw: string | null): DesignStorefrontCompatibilityContext | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as DesignStorefrontCompatibilityContext
    if (parsed && typeof parsed === 'object') {
      return {
        blank: parsed.blank ? normalizeDesignStudioCompatibility(parsed.blank) : null,
      }
    }
  } catch {
    return null
  }
  return null
}

export function evaluateOptionCompatibility(
  option: Pick<DesignStorefrontOption, 'id' | 'role' | 'compatibility'>,
  context: DesignStorefrontCompatibilityContext | null,
): CompatibilityEvaluation {
  if (!context?.blank) {
    return { compatible: true, issues: [] }
  }
  if (!option.compatibility) {
    return { compatible: true, issues: [{ code: 'missing-option' }] }
  }
  if (BUTT_FIT_ROLES.includes(option.role)) {
    return evaluateButtFit(context.blank, option.compatibility)
  }
  if (TIP_FIT_ROLES.includes(option.role)) {
    return evaluateTipFit(context.blank, option.compatibility)
  }
  return { compatible: true, issues: [] }
}

export function filterOptionsByCompatibility(
  options: DesignStorefrontOption[],
  role: DesignStorefrontPartRole,
  context: DesignStorefrontCompatibilityContext | null,
): { allowed: DesignStorefrontOption[]; rejected: CompatibilityRejection[]; issues: CompatibilityIssue[] } {
  if (!context?.blank) {
    return { allowed: options, rejected: [], issues: [] }
  }
  const rejected: CompatibilityRejection[] = []
  const issues: CompatibilityIssue[] = []
  const allowed = options.filter(option => {
    const evaluation = evaluateOptionCompatibility(option, context)
    if (!evaluation.compatible) {
      rejected.push({ optionId: option.id, productId: option.productId, issues: evaluation.issues })
      return false
    }
    return true
  })
  if (!allowed.length && options.length) {
    issues.push({ code: 'no-compatible-options', role })
  }
  return { allowed, rejected, issues }
}

function evaluateButtFit(
  blank: DesignStudioCompatibility,
  candidate: DesignStudioCompatibility,
): CompatibilityEvaluation {
  const blankDiameter = firstNumber([blank.buttDiameterIn, mmToInches(blank.buttDiameterMm)])
  if (!blankDiameter) {
    return { compatible: true, issues: [{ code: 'missing-measurement', field: 'blank.buttDiameter' }] }
  }
  const candidateInside = firstNumber([candidate.insideDiameterIn, mmToInches(candidate.insideDiameterMm)])
  if (!candidateInside) {
    return { compatible: true, issues: [{ code: 'missing-measurement', field: 'option.insideDiameter' }] }
  }
  const clearance = candidateInside - blankDiameter
  if (clearance < -BUTT_TOLERANCE_IN) {
    return {
      compatible: false,
      issues: [
        { code: 'butt-od-too-large', blankDiameterIn: round(blankDiameter), candidateInsideIn: round(candidateInside) },
      ],
    }
  }
  return { compatible: true, issues: [] }
}

function evaluateTipFit(
  blank: DesignStudioCompatibility,
  candidate: DesignStudioCompatibility,
): CompatibilityEvaluation {
  const blankTip = firstNumber([blank.tipDiameterMm, inchesToMm(blank.tipDiameterIn)])
  if (!blankTip) {
    return { compatible: true, issues: [{ code: 'missing-measurement', field: 'blank.tipDiameter' }] }
  }
  const candidateTube = firstNumber([candidate.tubeSizeMm, inchesToMm(candidate.tubeSizeIn)])
  if (!candidateTube) {
    return { compatible: true, issues: [{ code: 'missing-measurement', field: 'option.tubeSize' }] }
  }
  if (candidateTube + TIP_TOLERANCE_MM < blankTip) {
    return {
      compatible: false,
      issues: [{ code: 'tip-od-too-large', blankTipMm: round(blankTip), candidateTubeMm: round(candidateTube) }],
    }
  }
  return { compatible: true, issues: [] }
}

function assignIfEmpty(
  target: DesignStudioCompatibility,
  key: keyof DesignStudioCompatibility,
  source: Record<string, unknown> | null,
  candidates: string[],
) {
  if (!source) return
  if (target[key] != null) return
  for (const candidate of candidates) {
    if (!(candidate in source)) continue
    const value = source[candidate]
    const numeric = toNumber(value)
    if (numeric != null) {
      ;(target as Record<string, unknown>)[key] = numeric
      return
    }
    const text = toString(value)
    if (text) {
      ;(target as Record<string, unknown>)[key] = text
      return
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(entry => (typeof entry === 'string' ? entry.trim() : '')).filter(Boolean)
}

function mmToInches(value: number | null | undefined): number | null {
  if (!value || !Number.isFinite(value)) return null
  return value / 25.4
}

function inchesToMm(value: number | null | undefined): number | null {
  if (!value || !Number.isFinite(value)) return null
  return value * 25.4
}

function firstNumber(values: Array<number | null | undefined>): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }
  return null
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function describeCompatibilityIssue(issue: CompatibilityIssue): string {
  switch (issue.code) {
    case 'missing-blank':
      return 'Select a blank to unlock compatibility filtering.'
    case 'missing-option':
      return 'This part is missing compatibility data and was not evaluated.'
    case 'missing-measurement':
      return `Missing compatibility measurement: ${issue.field}`
    case 'butt-od-too-large':
      return `Blank butt diameter ${issue.blankDiameterIn}" exceeds the part's inner diameter ${issue.candidateInsideIn}".`
    case 'tip-od-too-large':
      return `Blank tip diameter ${issue.blankTipMm} mm exceeds the tip top's tube ${issue.candidateTubeMm} mm.`
    case 'no-compatible-options':
      return 'No compatible options were found for this role.'
    case 'selection-incompatible':
      return 'The previously selected option is no longer compatible with the chosen blank.'
    default:
      return 'Compatibility issue detected.'
  }
}
