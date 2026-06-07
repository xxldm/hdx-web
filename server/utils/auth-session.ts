import type {
  BackendAuthUser,
  BackendAuthTokenResponse,
  WebAuthPublicSession,
  WebAuthSessionData
} from '~~/app/types/hdx-auth'
import {
  backendAuthTokenResponseSchema,
  webAuthSessionDataSchema
} from '~~/app/types/hdx-auth'
import { BoundaryError } from '~~/app/utils/api-error'
import { fetchAuthService } from './backend-fetch'
import { getBackendConfig, isAllInOneBackendConfig } from './backend-config'
import { getOrCreateCsrfToken } from './auth-csrf'

type HdxEvent = Parameters<typeof getCookie>[0]
const LOCAL_ADMIN_USER_ID = 0
const LOCAL_ADMIN_SUBJECT = 'local-admin'
const LOCAL_ADMIN_DISPLAY_NAME = '用户'
const LOCAL_ADMIN_SESSION_ID = 'local-admin'

export function isAllInOneRequest(event: HdxEvent) {
  return isAllInOneBackendConfig(getBackendConfig(event))
}

export function toPublicAuthSession(
  data: WebAuthSessionData | null,
  csrfToken: string
): WebAuthPublicSession {
  if (!data) {
    return {
      authenticated: false,
      csrfToken,
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      sid: null,
      actorType: null,
      subject: null,
      user: null,
      roles: [],
      permissions: []
    }
  }

  return {
    authenticated: true,
    csrfToken,
    accessTokenExpiresAt: data.accessTokenExpiresAt,
    refreshTokenExpiresAt: data.refreshTokenExpiresAt,
    sid: data.sid,
    actorType: 'USER',
    subject: `USER:${data.user.id}`,
    user: data.user,
    roles: data.roles,
    permissions: data.permissions
  }
}

export function toLocalAdminPublicAuthSession(csrfToken: string): WebAuthPublicSession {
  const user: BackendAuthUser = {
    id: LOCAL_ADMIN_USER_ID,
    displayName: LOCAL_ADMIN_DISPLAY_NAME
  }

  return {
    authenticated: true,
    csrfToken,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    sid: LOCAL_ADMIN_SESSION_ID,
    actorType: 'LOCAL_ADMIN',
    subject: LOCAL_ADMIN_SUBJECT,
    user,
    roles: ['ADMIN'],
    permissions: ['*']
  }
}

export function shouldRefreshAccessToken(
  data: WebAuthSessionData,
  nowMs: number,
  refreshSkewSeconds: number
) {
  const expiresAtMs = Date.parse(data.accessTokenExpiresAt)

  if (Number.isNaN(expiresAtMs)) {
    return true
  }

  return expiresAtMs - nowMs <= refreshSkewSeconds * 1000
}

export async function getPublicAuthSession(event: HdxEvent) {
  const csrfToken = getOrCreateCsrfToken(event)

  if (isAllInOneRequest(event)) {
    return toLocalAdminPublicAuthSession(csrfToken)
  }

  const data = await readAuthSessionData(event)
  return toPublicAuthSession(data, csrfToken)
}

export async function readAuthSessionData(event: HdxEvent): Promise<WebAuthSessionData | null> {
  const session = await getAuthSessionManager(event)
  const parsed = webAuthSessionDataSchema.safeParse(session.data)

  if (!parsed.success) {
    return null
  }

  return parsed.data
}

export async function saveAuthSession(event: HdxEvent, tokenResponse: BackendAuthTokenResponse) {
  const session = await getAuthSessionManager(event)
  await session.update(toSessionData(tokenResponse))
}

export async function clearAuthSession(event: HdxEvent) {
  const config = getBackendConfig(event)
  const session = await getAuthSessionManager(event)
  await session.clear()
  deleteCookie(event, config.authSessionCookieName, {
    path: '/',
    sameSite: 'lax',
    secure: config.authCookieSecure
  })
}

export async function refreshAuthSession(event: HdxEvent) {
  if (isAllInOneRequest(event)) {
    throw new BoundaryError('invalid-input', '本机模式不需要刷新登录态。', 400)
  }

  const data = await readAuthSessionData(event)

  if (!data) {
    throw new BoundaryError('auth-required', '登录已过期，请重新登录。', 401)
  }

  try {
    const tokenResponse = await fetchAuthService(event, '/api/auth/refresh', backendAuthTokenResponseSchema, {
      method: 'POST',
      body: {
        refreshToken: data.refreshToken
      }
    })
    await saveAuthSession(event, tokenResponse)
    return tokenResponse
  } catch (error) {
    if (error instanceof BoundaryError && error.statusCode === 401) {
      await clearAuthSession(event)
    }

    throw error
  }
}

export async function refreshAuthSessionIfNeeded(event: HdxEvent) {
  if (isAllInOneRequest(event)) {
    return null
  }

  const config = getBackendConfig(event)
  const data = await readAuthSessionData(event)

  if (!data) {
    return null
  }

  if (!shouldRefreshAccessToken(data, Date.now(), config.authRefreshSkewSeconds)) {
    return data
  }

  try {
    const tokenResponse = await refreshAuthSession(event)
    return toSessionData(tokenResponse)
  } catch (error) {
    if (error instanceof BoundaryError && error.statusCode === 401) {
      return null
    }

    throw error
  }
}

export async function requireBackendAccessToken(event: HdxEvent) {
  if (isAllInOneRequest(event)) {
    return null
  }

  const config = getBackendConfig(event)
  const data = await readAuthSessionData(event)

  if (!data) {
    throw new BoundaryError('auth-required', '请先登录。', 401)
  }

  if (!shouldRefreshAccessToken(data, Date.now(), config.authRefreshSkewSeconds)) {
    return data.accessToken
  }

  const tokenResponse = await refreshAuthSession(event)
  return tokenResponse.accessToken
}

function toSessionData(tokenResponse: BackendAuthTokenResponse): WebAuthSessionData {
  return {
    accessToken: tokenResponse.accessToken,
    accessTokenExpiresAt: tokenResponse.accessTokenExpiresAt,
    refreshToken: tokenResponse.refreshToken,
    refreshTokenExpiresAt: tokenResponse.refreshTokenExpiresAt,
    sid: tokenResponse.sid,
    user: tokenResponse.user,
    roles: tokenResponse.roles,
    permissions: tokenResponse.permissions
  }
}

async function getAuthSessionManager(event: HdxEvent) {
  const config = getBackendConfig(event)
  return await useSession<WebAuthSessionData>(event, {
    cookie: {
      httpOnly: true,
      maxAge: config.authSessionMaxAgeSeconds,
      path: '/',
      sameSite: 'lax',
      secure: config.authCookieSecure
    },
    name: config.authSessionCookieName,
    password: config.authSessionSecret,
    sessionHeader: false
  })
}
