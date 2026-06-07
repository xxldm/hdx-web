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
