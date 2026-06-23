import type { z } from 'zod'
import { backendApiErrorResponseSchema, workbenchLayoutConflictResponseSchema } from '~~/app/types/hdx-api'
import { BoundaryError, PassthroughApiError } from '~~/app/utils/api-error'
import { getBackendConfig } from './backend-config'

type BackendFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT'
  body?: Record<string, unknown>
  query?: Record<string, string | number | boolean | null | undefined>
  bearerToken?: string
}

export async function fetchBackend<T>(
  event: Parameters<typeof getBackendConfig>[0],
  path: string,
  schema: z.ZodType<T>,
  options: BackendFetchOptions = {}
): Promise<T> {
  const config = getBackendConfig(event)
  return await fetchHdxService(event, config.backendBaseUrl, path, schema, options, true)
}

export async function fetchAuthService<T>(
  event: Parameters<typeof getBackendConfig>[0],
  path: string,
  schema: z.ZodType<T>,
  options: BackendFetchOptions = {}
): Promise<T> {
  const config = getBackendConfig(event)
  return await fetchHdxService(event, config.authBaseUrl, path, schema, options, false)
}

async function fetchHdxService<T>(
  event: Parameters<typeof getBackendConfig>[0],
  baseUrl: string,
  path: string,
  schema: z.ZodType<T>,
  options: BackendFetchOptions,
  includeLocalToken: boolean
): Promise<T> {
  const config = getBackendConfig(event)
  const headers: Record<string, string> = {
    accept: 'application/json'
  }

  if (includeLocalToken && config.backendLocalTokenHeader && config.backendLocalToken) {
    headers[config.backendLocalTokenHeader] = config.backendLocalToken
  }

  if (options.bearerToken) {
    headers.authorization = `Bearer ${options.bearerToken}`
  }

  const url = new URL(path, baseUrl)

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  try {
    const response = await $fetch<unknown>(url.toString(), {
      method: options.method ?? 'GET',
      body: options.body,
      headers
    })
    const parsed = schema.safeParse(response)

    if (!parsed.success) {
      throw new BoundaryError('invalid-response', '后端响应格式无效。', 502)
    }

    return parsed.data
  } catch (error) {
    if (error instanceof BoundaryError) {
      throw error
    }

    const fetchError = normalizeFetchError(error)

    if (fetchError) {
      if (fetchError.statusCode === 400) {
        throw new BoundaryError(
          'invalid-input',
          fetchError.message ?? '请求格式无效。',
          400,
          fetchError.code
        )
      }

      if (fetchError.statusCode === 409) {
        const parsedConflict = workbenchLayoutConflictResponseSchema.safeParse(fetchError.data)

        if (parsedConflict.success) {
          throw new PassthroughApiError(409, parsedConflict.data, parsedConflict.data.message)
        }

        throw new BoundaryError(
          'upstream-failed',
          fetchError.message ?? '请求发生冲突，请刷新后重试。',
          409,
          fetchError.code
        )
      }

      if (fetchError.statusCode === 401) {
        throw new BoundaryError(
          'auth-required',
          fetchError.message ?? '登录已过期，请重新登录。',
          401,
          fetchError.code
        )
      }

      if (fetchError.statusCode === 403) {
        throw new BoundaryError(
          'auth-required',
          fetchError.message ?? '当前账号无权执行该操作。',
          403,
          fetchError.code
        )
      }

      if (fetchError.statusCode === 429) {
        throw new BoundaryError(
          'upstream-failed',
          fetchError.message ?? '请求过于频繁，请稍后重试。',
          429,
          fetchError.code
        )
      }

      if (fetchError.statusCode === 503) {
        throw new BoundaryError(
          'upstream-failed',
          fetchError.message ?? '后端服务暂时不可用。',
          503,
          fetchError.code
        )
      }
    }

    throw new BoundaryError('upstream-failed', '后端服务暂时不可用。', 502)
  }
}

function normalizeFetchError(error: unknown): { statusCode: number, message?: string, code?: string, data?: unknown } | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  const record = error as {
    statusCode?: unknown
    status?: unknown
    statusMessage?: unknown
    data?: unknown
  }
  const statusCode = typeof record.statusCode === 'number'
    ? record.statusCode
    : typeof record.status === 'number'
      ? record.status
      : undefined

  if (!statusCode) {
    return null
  }

  const data = record.data
  const parsedError = backendApiErrorResponseSchema.safeParse(data)
  const message = parsedError.success
    ? parsedError.data.message
    : typeof record.statusMessage === 'string'
      ? record.statusMessage
      : undefined
  const code = parsedError.success ? parsedError.data.code : undefined

  return { statusCode, message, code, data }
}
