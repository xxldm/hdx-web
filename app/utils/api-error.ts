import {
  timerPreferenceConflictResponseSchema,
  userPreferenceConflictResponseSchema,
  workbenchLayoutConflictResponseSchema,
  type TimerPreferenceConflictResponse,
  type UserPreferenceConflictResponse,
  type WorkbenchLayoutConflictResponse
} from '../types/hdx-api'

export type BoundaryErrorCode =
  | 'auth-required'
  | 'csrf-invalid'
  | 'invalid-config'
  | 'invalid-input'
  | 'invalid-response'
  | 'upstream-failed'

export class BoundaryError extends Error {
  constructor(
    public readonly code: BoundaryErrorCode,
    message: string,
    public readonly statusCode = 500,
    public readonly upstreamCode?: string
  ) {
    super(message)
    this.name = 'BoundaryError'
  }
}

export class PassthroughApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly data: Record<string, unknown>,
    message: string
  ) {
    super(message)
    this.name = 'PassthroughApiError'
  }
}

export function normalizeBoundaryError(error: unknown) {
  if (error instanceof BoundaryError) {
    return error
  }

  return new BoundaryError('upstream-failed', '请求暂时无法完成，请稍后重试。', 502)
}

export function createBoundaryH3Error(error: unknown) {
  if (error instanceof PassthroughApiError) {
    return createError({
      statusCode: error.statusCode,
      message: error.message,
      data: error.data
    })
  }

  const boundaryError = normalizeBoundaryError(error)

  return createError({
    statusCode: boundaryError.statusCode,
    message: boundaryError.message,
    data: {
      code: boundaryError.code,
      upstreamCode: boundaryError.upstreamCode
    }
  })
}

export function isAuthRequiredApiError(error: unknown) {
  const status = extractFetchStatus(error)

  return extractBoundaryErrorCode(error) === 'auth-required'
    && (status === 401 || status === 403)
}

export function extractWorkbenchLayoutConflict(error: unknown): WorkbenchLayoutConflictResponse | null {
  const candidates = extractApiPayloadCandidates(error)

  for (const candidate of candidates) {
    const parsed = workbenchLayoutConflictResponseSchema.safeParse(candidate)

    if (parsed.success) {
      return parsed.data
    }
  }

  return null
}

export function isWorkbenchLayoutConflictApiError(error: unknown) {
  return extractFetchStatus(error) === 409 && Boolean(extractWorkbenchLayoutConflict(error))
}

export function extractTimerPreferenceConflict(error: unknown): TimerPreferenceConflictResponse | null {
  const candidates = extractApiPayloadCandidates(error)

  for (const candidate of candidates) {
    const parsed = timerPreferenceConflictResponseSchema.safeParse(candidate)

    if (parsed.success) {
      return parsed.data
    }
  }

  return null
}

export function isTimerPreferenceConflictApiError(error: unknown) {
  return extractFetchStatus(error) === 409 && Boolean(extractTimerPreferenceConflict(error))
}

export function extractUserPreferenceConflict(error: unknown): UserPreferenceConflictResponse | null {
  const candidates = extractApiPayloadCandidates(error)

  for (const candidate of candidates) {
    const parsed = userPreferenceConflictResponseSchema.safeParse(candidate)

    if (parsed.success) {
      return parsed.data
    }
  }

  return null
}

export function isUserPreferenceConflictApiError(error: unknown) {
  return extractFetchStatus(error) === 409 && Boolean(extractUserPreferenceConflict(error))
}

export function extractBoundaryErrorCode(error: unknown): BoundaryErrorCode | null {
  const code = extractNestedString(error, ['data', 'code'])
    ?? extractNestedString(error, ['data', 'data', 'code'])

  return isBoundaryErrorCode(code) ? code : null
}

export function extractFetchStatus(error: unknown) {
  const statusCode = extractNestedNumber(error, ['statusCode'])
    ?? extractNestedNumber(error, ['status'])
    ?? extractNestedNumber(error, ['data', 'statusCode'])
    ?? extractNestedNumber(error, ['data', 'status'])

  return statusCode
}

function isBoundaryErrorCode(value: string | null): value is BoundaryErrorCode {
  return value === 'auth-required'
    || value === 'csrf-invalid'
    || value === 'invalid-config'
    || value === 'invalid-input'
    || value === 'invalid-response'
    || value === 'upstream-failed'
}

function extractApiPayloadCandidates(error: unknown) {
  return [
    extractNestedValue(error, ['data']),
    extractNestedValue(error, ['data', 'data']),
    extractNestedValue(error, ['data', 'upstreamData'])
  ]
}

function extractNestedString(value: unknown, path: string[]) {
  const nestedValue = extractNestedValue(value, path)

  return typeof nestedValue === 'string' ? nestedValue : null
}

function extractNestedNumber(value: unknown, path: string[]) {
  const nestedValue = extractNestedValue(value, path)

  return typeof nestedValue === 'number' ? nestedValue : null
}

function extractNestedValue(value: unknown, path: string[]) {
  let currentValue = value

  for (const key of path) {
    if (!currentValue || typeof currentValue !== 'object') {
      return null
    }

    currentValue = (currentValue as Record<string, unknown>)[key]
  }

  return currentValue
}
