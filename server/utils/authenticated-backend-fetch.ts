import type { z } from 'zod'
import { fetchBackend } from './backend-fetch'
import { requireBackendAccessToken } from './auth-session'

type AuthenticatedBackendFetchOptions = {
  method?: 'GET' | 'POST'
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

  return await fetchBackend(event, path, schema, {
    ...options,
    bearerToken
  })
}
