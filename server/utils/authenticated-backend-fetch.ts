import type { z } from 'zod'
import { BoundaryError } from '~~/app/utils/api-error'
import { fetchBackend } from './backend-fetch'
import { invalidateWebAuthSession, refreshAuthSession, requireBackendAccessToken } from './auth-session'

type AuthenticatedBackendFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: Record<string, unknown>
  query?: Record<string, string | number | boolean | null | undefined>
}

export async function fetchAuthenticatedBackend<T>(
  event: Parameters<typeof requireBackendAccessToken>[0],
  path: string,
  schema: z.ZodType<T>,
  options: AuthenticatedBackendFetchOptions = {}
): Promise<T> {
  const bearerToken = await requireBackendAccessToken(event)

  try {
    return await fetchBackend(event, path, schema, {
      ...options,
      bearerToken: bearerToken ?? undefined
    })
  } catch (error) {
    if (!bearerToken || !shouldTryRefreshAfterBackendAuthError(error)) {
      throw error
    }

    const refreshedToken = await refreshAuthSession(event)

    try {
      return await fetchBackend(event, path, schema, {
        ...options,
        bearerToken: refreshedToken.accessToken
      })
    } catch (retryError) {
      if (shouldInvalidateAfterRefreshRetryError(retryError)) {
        await invalidateWebAuthSession(event)
      }

      throw retryError
    }
  }
}

function shouldTryRefreshAfterBackendAuthError(error: unknown) {
  return error instanceof BoundaryError
    && error.code === 'auth-required'
    && error.statusCode === 401
}

function shouldInvalidateAfterRefreshRetryError(error: unknown) {
  return error instanceof BoundaryError
    && error.code === 'auth-required'
    && error.statusCode === 401
}
