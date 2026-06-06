import { BoundaryError } from '~~/app/utils/api-error'
import { getBackendConfig } from './backend-config'

const CSRF_TOKEN_PATTERN = /^[a-f0-9]{64}$/
type HdxEvent = Parameters<typeof getCookie>[0]

export function isValidCsrfToken(token: unknown): token is string {
  return typeof token === 'string' && CSRF_TOKEN_PATTERN.test(token)
}

export function isValidCsrfPair(cookieToken: unknown, headerToken: unknown) {
  return isValidCsrfToken(cookieToken) && cookieToken === headerToken
}

export function createCsrfToken(cryptoProvider = globalThis.crypto) {
  if (!cryptoProvider?.getRandomValues) {
    throw new BoundaryError('invalid-config', 'Web 随机数生成器不可用。', 500)
  }

  const bytes = new Uint8Array(32)
  cryptoProvider.getRandomValues(bytes)
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

export function getOrCreateCsrfToken(event: HdxEvent) {
  const config = getBackendConfig(event)
  const existingToken = getCookie(event, config.authCsrfCookieName)

  if (isValidCsrfToken(existingToken)) {
    setCsrfCookie(event, existingToken)
    return existingToken
  }

  const token = createCsrfToken()
  setCsrfCookie(event, token)
  return token
}

function setCsrfCookie(event: HdxEvent, token: string) {
  const config = getBackendConfig(event)
  setCookie(event, config.authCsrfCookieName, token, {
    httpOnly: false,
    maxAge: config.authSessionMaxAgeSeconds,
    path: '/',
    sameSite: 'lax',
    secure: config.authCookieSecure
  })
}

export function assertCsrfToken(event: HdxEvent) {
  const config = getBackendConfig(event)
  const cookieToken = getCookie(event, config.authCsrfCookieName)
  const headerToken = getHeader(event, config.authCsrfHeaderName)

  if (!isValidCsrfPair(cookieToken, headerToken)) {
    throw new BoundaryError('csrf-invalid', '请求校验失败，请刷新页面后重试。', 403)
  }
}
