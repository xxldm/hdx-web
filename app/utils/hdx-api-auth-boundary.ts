import { isAuthRequiredApiError } from './api-error'

export function shouldHandleAuthRequiredHdxApiResponse(request: unknown, response: { status?: number, _data?: unknown }) {
  const requestPath = normalizeHdxApiRequestPath(request)

  return !requestPath.startsWith('/auth/')
    && isAuthRequiredApiError({
      status: response.status,
      data: response._data
    })
}

function normalizeHdxApiRequestPath(request: unknown) {
  const requestText = stringifyRequest(request)

  if (!requestText) {
    return ''
  }

  const pathname = extractPathname(requestText)
  const withoutBasePath = pathname.startsWith('/api/hdx/v1')
    ? pathname.slice('/api/hdx/v1'.length)
    : pathname

  return withoutBasePath.startsWith('/') ? withoutBasePath : `/${withoutBasePath}`
}

function stringifyRequest(request: unknown) {
  if (typeof request === 'string') {
    return request
  }

  if (request && typeof request === 'object' && 'url' in request && typeof request.url === 'string') {
    return request.url
  }

  return ''
}

function extractPathname(value: string) {
  try {
    return new URL(value).pathname
  } catch {
    return value.split('?')[0] ?? value
  }
}
