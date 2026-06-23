import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { fetchAuthenticatedBackend } from '../../server/utils/authenticated-backend-fetch'

const responseSchema = z.object({
  ok: z.boolean()
})

describe('authenticated backend fetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses bearer token in remote mode', async () => {
    stubRuntimeConfig()
    vi.stubGlobal('useSession', async () => ({
      id: 'session-id',
      data: {
        accessToken: 'access-token',
        accessTokenExpiresAt: new Date(Date.now() + 120_000).toISOString(),
        refreshToken: 'refresh-token',
        refreshTokenExpiresAt: '2026-06-13T10:00:00Z',
        sid: 'session-id',
        user: {
          id: 1,
          displayName: '用户'
        },
        roles: ['ADMIN'],
        permissions: ['tool:read']
      },
      update: vi.fn(),
      clear: vi.fn()
    }))
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('$fetch', fetchMock)

    await fetchAuthenticatedBackend({} as never, '/api/v1/tools', responseSchema)

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:18080/api/v1/tools', expect.objectContaining({
      headers: expect.objectContaining({
        authorization: 'Bearer access-token'
      })
    }))
  })

  it('uses local token in all-in-one mode without bearer token', async () => {
    stubRuntimeConfig({
      backendLocalTokenHeader: 'X-HDX-Local-Token',
      backendLocalToken: 'local-token'
    })
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('$fetch', fetchMock)

    await fetchAuthenticatedBackend({} as never, '/api/v1/tools', responseSchema)

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:18080/api/v1/tools', expect.objectContaining({
      headers: expect.objectContaining({
        'X-HDX-Local-Token': 'local-token'
      })
    }))
    expect(fetchMock.mock.calls[0]?.[1]?.headers).not.toHaveProperty('authorization')
  })

  it('refreshes once and retries when backend rejects an access token', async () => {
    stubRuntimeConfig()
    let storedSessionData = createSessionData()
    const sessionManager = {
      id: 'session-id',
      get data() {
        return storedSessionData
      },
      update: vi.fn(async (nextData: typeof storedSessionData) => {
        storedSessionData = nextData
        return sessionManager
      }),
      clear: vi.fn()
    }
    vi.stubGlobal('useSession', async () => sessionManager)
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(createFetchError(401))
      .mockResolvedValueOnce(createTokenResponse())
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('$fetch', fetchMock)

    await expect(fetchAuthenticatedBackend({ context: {} } as never, '/api/v1/tools', responseSchema)).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:18080/api/v1/tools', expect.objectContaining({
      headers: expect.objectContaining({
        authorization: 'Bearer access-token'
      })
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:18082/api/auth/refresh', expect.objectContaining({
      body: {
        refreshToken: 'refresh-token'
      }
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://localhost:18080/api/v1/tools', expect.objectContaining({
      headers: expect.objectContaining({
        authorization: 'Bearer new-access-token'
      })
    }))
  })

  it('clears the web session cookie when backend auth-required cannot be recovered by refresh', async () => {
    stubRuntimeConfig()
    const event = { context: {} }
    const clearSessionMock = vi.fn()
    const deleteCookieMock = vi.fn()
    vi.stubGlobal('useSession', async () => ({
      id: 'session-id',
      data: createSessionData(),
      update: vi.fn(),
      clear: clearSessionMock
    }))
    vi.stubGlobal('deleteCookie', deleteCookieMock)
    vi.stubGlobal('$fetch', vi.fn()
      .mockRejectedValueOnce(createFetchError(401))
      .mockRejectedValueOnce(createFetchError(401)))

    await expect(fetchAuthenticatedBackend(event as never, '/api/v1/tools', responseSchema)).rejects.toMatchObject({
      code: 'auth-required',
      statusCode: 401
    })

    expect(clearSessionMock).toHaveBeenCalledTimes(1)
    expect(deleteCookieMock).toHaveBeenCalledWith(event, 'hdx_web_session', expect.objectContaining({
      path: '/',
      sameSite: 'lax',
      secure: false
    }))
    expect(event.context.hdxAuthSessionInvalidated).toBe(true)
  })

  it('passes through workbench layout conflicts with the server layout payload', async () => {
    stubRuntimeConfig()
    vi.stubGlobal('useSession', async () => ({
      id: 'session-id',
      data: createSessionData(),
      update: vi.fn(),
      clear: vi.fn()
    }))
    vi.stubGlobal('$fetch', vi.fn()
      .mockRejectedValueOnce({
        statusCode: 409,
        data: createWorkbenchLayoutConflictPayload()
      }))

    await expect(fetchAuthenticatedBackend({ context: {} } as never, '/api/v1/workbench/layout', responseSchema, {
      method: 'PUT',
      body: {}
    })).rejects.toMatchObject({
      statusCode: 409,
      data: expect.objectContaining({
        code: 'WORKBENCH_LAYOUT_CONFLICT',
        serverLayout: expect.objectContaining({
          version: 2
        })
      })
    })
  })
})

function createSessionData() {
  return {
    accessToken: 'access-token',
    accessTokenExpiresAt: new Date(Date.now() + 120_000).toISOString(),
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
}

function createTokenResponse() {
  return {
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
}

function createFetchError(statusCode: number) {
  return {
    statusCode,
    data: {
      code: 'AUTH_REQUIRED',
      message: '登录已过期，请重新登录。'
    }
  }
}

function createWorkbenchLayoutConflictPayload() {
  return {
    code: 'WORKBENCH_LAYOUT_CONFLICT',
    message: '工作台布局已在其他位置更新，请处理冲突。',
    resourceType: 'workbenchLayout',
    baseVersion: 1,
    currentVersion: 2,
    updatedAt: '2026-06-23T12:00:00Z',
    updatedByUserId: 'USER:2',
    serverLayout: {
      schemaVersion: 1,
      version: 2,
      rows: 4,
      columns: 4,
      gap: 12,
      widgets: []
    }
  }
}

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
