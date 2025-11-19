// Structured error & blocker codes for importer delete operations
export const DELETE_ERROR_CODES = {
  NOT_FOUND: 'not_found',
  BLOCKED: 'blocked',
  UNKNOWN: 'unknown',
} as const

export const BLOCKER_CODES = {
  ACTIVE_PREPARE: 'active_prepare',
  PUBLISH_IN_PROGRESS: 'publish_in_progress',
} as const

export type DeleteErrorCode = (typeof DELETE_ERROR_CODES)[keyof typeof DELETE_ERROR_CODES]
export type BlockerCode = (typeof BLOCKER_CODES)[keyof typeof BLOCKER_CODES]
