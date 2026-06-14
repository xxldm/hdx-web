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

export function normalizeBoundaryError(error: unknown) {
  if (error instanceof BoundaryError) {
    return error
  }

  return new BoundaryError('upstream-failed', '请求暂时无法完成，请稍后重试。', 502)
}

export function createBoundaryH3Error(error: unknown) {
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
