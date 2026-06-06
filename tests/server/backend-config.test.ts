import { describe, expect, it, vi } from 'vitest'
import { getBackendConfig } from '../../server/utils/backend-config'

describe('backend config boundary', () => {
  it('parses private backend config', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      backendBaseUrl: 'http://localhost:18080',
      authBaseUrl: 'http://localhost:18082',
      backendLocalTokenHeader: 'X-HDX-Local-Token',
      backendLocalToken: 'local-token',
      authSessionCookieName: 'hdx_web_session',
      authSessionSecret: 'test-only-auth-session-secret-change-me-32',
      authCsrfCookieName: 'hdx_csrf',
      authCsrfHeaderName: 'X-HDX-CSRF',
      authCookieSecure: false,
      authSessionMaxAgeSeconds: 604800,
      authRefreshSkewSeconds: 60,
      public: {
        appName: 'HDX'
      }
    }))

    expect(getBackendConfig({} as never)).toEqual({
      backendBaseUrl: 'http://localhost:18080',
      authBaseUrl: 'http://localhost:18082',
      backendLocalTokenHeader: 'X-HDX-Local-Token',
      backendLocalToken: 'local-token',
      authSessionCookieName: 'hdx_web_session',
      authSessionSecret: 'test-only-auth-session-secret-change-me-32',
      authCsrfCookieName: 'hdx_csrf',
      authCsrfHeaderName: 'X-HDX-CSRF',
      authCookieSecure: false,
      authSessionMaxAgeSeconds: 604800,
      authRefreshSkewSeconds: 60
    })
  })

  it('rejects invalid backend config', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      backendBaseUrl: 'not-a-url',
      authBaseUrl: 'http://localhost:18082'
    }))

    expect(() => getBackendConfig({} as never)).toThrow('Web 服务配置无效。')
  })

  it('rejects weak auth session secret', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      backendBaseUrl: 'http://localhost:18080',
      authBaseUrl: 'http://localhost:18082',
      authSessionCookieName: 'hdx_web_session',
      authSessionSecret: 'short',
      authCsrfCookieName: 'hdx_csrf',
      authCsrfHeaderName: 'X-HDX-CSRF',
      authCookieSecure: false,
      authSessionMaxAgeSeconds: 604800,
      authRefreshSkewSeconds: 60
    }))

    expect(() => getBackendConfig({} as never)).toThrow('Web 服务配置无效。')
  })
})
