import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BackendAuthTokenResponse, WebAuthSessionData } from '../../app/types/hdx-auth'
import {
  getPublicAuthSession,
  refreshAuthSession,
  refreshAuthSessionIfNeeded,
  saveAuthSession,
  shouldRefreshAccessToken,
  toLocalAdminPublicAuthSession,
  toPublicAuthSession
} from '../../server/utils/auth-session'

const sessionData: WebAuthSessionData = {
  accessToken: 'access-token',
  accessTokenExpiresAt: '2026-06-06T10:15:00Z',
  refreshToken: 'refresh-token',
  refreshTokenExpiresAt: '2026-06-13T10:00:00Z',
  sid: 'session-id',
  user: {
    id: 1,
    displayName: '用户'
  },
  roles: ['ADMIN'],
  permissions: ['tool:read']
}

const tokenResponse: BackendAuthTokenResponse = {
  tokenType: 'Bearer',
  accessToken: 'new-access-token',
  accessTokenExpiresAt: '2026-06-06T10:20:00Z',
  refreshToken: 'new-refresh-token',
  refreshTokenExpiresAt: '2026-06-13T10:05:00Z',
  sid: 'session-id',
  user: {
    id: 1,
    displayName: '用户'
  },
  roles: ['ADMIN'],
  permissions: ['tool:read']
}

describe('auth session projection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns an anonymous public session without tokens', () => {
    expect(toPublicAuthSession(null, 'a'.repeat(64))).toEqual({
      authenticated: false,
      csrfToken: 'a'.repeat(64),
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      sid: null,
      actorType: null,
      subject: null,
      user: null,
      roles: [],
      permissions: []
    })
  })

  it('projects token session data to public session without secrets', () => {
    const publicSession = toPublicAuthSession(sessionData, 'b'.repeat(64))

    expect(publicSession).toEqual({
      authenticated: true,
      csrfToken: 'b'.repeat(64),
      accessTokenExpiresAt: '2026-06-06T10:15:00Z',
      refreshTokenExpiresAt: '2026-06-13T10:00:00Z',
      sid: 'session-id',
      actorType: 'USER',
      subject: 'USER:1',
      user: {
        id: 1,
        displayName: '用户'
      },
      roles: ['ADMIN'],
      permissions: ['tool:read']
    })
    expect(publicSession).not.toHaveProperty('accessToken')
    expect(publicSession).not.toHaveProperty('refreshToken')
  })

  it('projects all-in-one local admin public session', () => {
    expect(toLocalAdminPublicAuthSession('c'.repeat(64))).toEqual({
      authenticated: true,
      csrfToken: 'c'.repeat(64),
      accessTokenExpiresAt: null,
      refreshTokenExpiresAt: null,
      sid: 'local-admin',
      actorType: 'LOCAL_ADMIN',
      subject: 'local-admin',
      user: {
        id: 0,
        displayName: '用户'
      },
      roles: ['ADMIN'],
      permissions: ['*']
    })
  })

  it('refreshes access token only when it is close to expiry', () => {
    expect(shouldRefreshAccessToken(
      sessionData,
      Date.parse('2026-06-06T10:13:30Z'),
      60
    )).toBe(false)
    expect(shouldRefreshAccessToken(
      sessionData,
      Date.parse('2026-06-06T10:14:30Z'),
      60
    )).toBe(true)
  })

  it('saves backend token response into encrypted cookie session data', async () => {
    stubRuntimeConfig()
    const update = vi.fn()
    vi.stubGlobal('useSession', async () => ({
      id: 'session-id',
      data: {},
      update,
      clear: vi.fn()
    }))

    await saveAuthSession({} as never, tokenResponse)

    expect(update).toHaveBeenCalledWith({
      accessToken: 'new-access-token',
      accessTokenExpiresAt: '2026-06-06T10:20:00Z',
      refreshToken: 'new-refresh-token',
      refreshTokenExpiresAt: '2026-06-13T10:05:00Z',
      sid: 'session-id',
      user: {
        id: 1,
        displayName: '用户'
      },
      roles: ['ADMIN'],
      permissions: ['tool:read']
    })
  })

  it('returns local admin session when all-in-one token is configured', async () => {
    stubRuntimeConfig({
      backendLocalTokenHeader: 'X-HDX-Local-Token',
      backendLocalToken: 'local-token'
    })
    vi.stubGlobal('getCookie', vi.fn(() => undefined))
    vi.stubGlobal('setCookie', vi.fn())

    const publicSession = await getPublicAuthSession({} as never)

    expect(publicSession.actorType).toBe('LOCAL_ADMIN')
    expect(publicSession.authenticated).toBe(true)
  })

  it('refreshes backend token and replaces session data', async () => {
    stubRuntimeConfig()
    let storedSessionData: WebAuthSessionData = sessionData
    const sessionManager = {
      id: 'session-id',
      get data() {
        return storedSessionData
      },
      update: vi.fn(async (nextData: WebAuthSessionData) => {
        storedSessionData = nextData
        return sessionManager
      }),
      clear: vi.fn()
    }
    const fetchMock = vi.fn(async () => tokenResponse)
    vi.stubGlobal('useSession', async () => sessionManager)
    vi.stubGlobal('$fetch', fetchMock)

    const refreshed = await refreshAuthSession({} as never)

    expect(refreshed.refreshToken).toBe('new-refresh-token')
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:18082/api/auth/refresh', expect.objectContaining({
      body: {
        refreshToken: 'refresh-token'
      },
      method: 'POST'
    }))
    expect(storedSessionData.refreshToken).toBe('new-refresh-token')
  })

  it('keeps session data when access token is still fresh', async () => {
    stubRuntimeConfig()
    const freshSessionData: WebAuthSessionData = {
      ...sessionData,
      accessTokenExpiresAt: new Date(Date.now() + 120_000).toISOString()
    }
    const fetchMock = vi.fn()
    vi.stubGlobal('useSession', async () => ({
      id: 'session-id',
      data: freshSessionData,
      update: vi.fn(),
      clear: vi.fn()
    }))
    vi.stubGlobal('$fetch', fetchMock)

    const result = await refreshAuthSessionIfNeeded({} as never)

    expect(result?.accessToken).toBe('access-token')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes session data when access token is close to expiry', async () => {
    stubRuntimeConfig()
    let storedSessionData: WebAuthSessionData = {
      ...sessionData,
      accessTokenExpiresAt: new Date(Date.now() + 30_000).toISOString()
    }
    const sessionManager = {
      id: 'session-id',
      get data() {
        return storedSessionData
      },
      update: vi.fn(async (nextData: WebAuthSessionData) => {
        storedSessionData = nextData
        return sessionManager
      }),
      clear: vi.fn()
    }
    vi.stubGlobal('useSession', async () => sessionManager)
    vi.stubGlobal('$fetch', vi.fn(async () => tokenResponse))

    const result = await refreshAuthSessionIfNeeded({} as never)

    expect(result?.refreshToken).toBe('new-refresh-token')
    expect(storedSessionData.refreshToken).toBe('new-refresh-token')
  })
})

function stubRuntimeConfig(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal('useRuntimeConfig', () => ({
    backendBaseUrl: 'http://localhost:18080',
    authBaseUrl: 'http://localhost:18082',
    authSessionCookieName: 'hdx_web_session',
    authSessionSecret: 'test-only-auth-session-secret-change-me-32',
    authCsrfCookieName: 'hdx_csrf',
    authCsrfHeaderName: 'X-HDX-CSRF',
    authCookieSecure: false,
    authSessionMaxAgeSeconds: 604800,
    authRefreshSkewSeconds: 60,
    ...overrides
  }))
}
