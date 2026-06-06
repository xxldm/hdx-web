import type { z } from 'zod'
import { BoundaryError } from '~~/app/utils/api-error'
import { getBackendConfig } from './backend-config'

type BackendFetchOptions = {
  method?: 'GET' | 'POST'
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
  const headers: Record<string, string> = {
    accept: 'application/json'
  }

  if (config.backendLocalTokenHeader && config.backendLocalToken) {
    headers[config.backendLocalTokenHeader] = config.backendLocalToken
  }

  if (options.bearerToken) {
    headers.authorization = `Bearer ${options.bearerToken}`
  }

  const url = new URL(path, config.backendBaseUrl)

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
        throw new BoundaryError('invalid-input', fetchError.message ?? '请求格式无效。', 400)
      }

      if (fetchError.statusCode === 401) {
        throw new BoundaryError('auth-required', fetchError.message ?? '登录已过期，请重新登录。', 401)
      }

      if (fetchError.statusCode === 403) {
        throw new BoundaryError('auth-required', fetchError.message ?? '当前账号无权执行该操作。', 403)
      }

      if (fetchError.statusCode === 503) {
        throw new BoundaryError('upstream-failed', fetchError.message ?? '后端服务暂时不可用。', 503)
      }
    }

    throw new BoundaryError('upstream-failed', '后端服务暂时不可用。', 502)
  }
}

function normalizeFetchError(error: unknown): { statusCode: number, message?: string } | null {
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
  const message = data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
    ? data.message
    : typeof record.statusMessage === 'string'
      ? record.statusMessage
      : undefined

  return { statusCode, message }
}
