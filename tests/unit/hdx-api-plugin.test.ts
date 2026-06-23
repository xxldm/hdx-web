import { afterEach, describe, expect, it, vi } from 'vitest'

describe('hdx api plugin', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('redirects once when a business API returns auth-required', async () => {
    let resolveRedirect: (() => void) | null = null
    const redirectDone = new Promise<void>((resolve) => {
      resolveRedirect = resolve
    })
    const navigateToMock = vi.fn(() => redirectDone)
    const { options, auth } = await runPlugin({
      route: {
        path: '/',
        fullPath: '/?widget=timer'
      },
      navigateToMock
    })

    const firstRedirect = options.onResponseError?.({
      request: '/workbench/layout',
      response: {
        status: 401,
        _data: {
          code: 'auth-required'
        }
      }
    } as never)
    await options.onResponseError?.({
      request: '/runtime',
      response: {
        status: 401,
        _data: {
          code: 'auth-required'
        }
      }
    } as never)

    expect(auth.markSessionExpired).toHaveBeenCalledTimes(2)
    expect(navigateToMock).toHaveBeenCalledTimes(1)
    expect(navigateToMock).toHaveBeenCalledWith({
      path: '/login',
      query: {
        redirect: '/?widget=timer'
      }
    }, {
      replace: true
    })

    resolveRedirect?.()
    await firstRedirect
  })

  it('does not redirect login failures that reuse auth-required boundary code', async () => {
    const { options, auth, navigateToMock } = await runPlugin({
      route: {
        path: '/login',
        fullPath: '/login'
      }
    })

    await options.onResponseError?.({
      request: '/auth/login',
      response: {
        status: 401,
        _data: {
          code: 'auth-required',
          upstreamCode: 'AUTH_INVALID_CREDENTIALS'
        }
      }
    } as never)

    expect(auth.markSessionExpired).not.toHaveBeenCalled()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('ignores non auth-required API errors', async () => {
    const { options, auth, navigateToMock } = await runPlugin({
      route: {
        path: '/',
        fullPath: '/'
      }
    })

    await options.onResponseError?.({
      request: '/workbench/layout',
      response: {
        status: 502,
        _data: {
          code: 'upstream-failed'
        }
      }
    } as never)

    expect(auth.markSessionExpired).not.toHaveBeenCalled()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('does not start route redirects during server rendering', async () => {
    vi.stubGlobal('defineNuxtPlugin', (handler: unknown) => handler)
    vi.stubGlobal('$fetch', {
      create: vi.fn()
    })
    vi.stubGlobal('useAuthStore', vi.fn())
    vi.stubGlobal('useRoute', vi.fn())
    vi.stubGlobal('useRequestHeaders', vi.fn())
    const { shouldStartAuthRequiredRedirect } = await import('../../app/plugins/hdx-api.client')

    expect(shouldStartAuthRequiredRedirect({
      routePath: '/login',
      redirectingToLogin: false
    })).toBe(false)
  })

  it('clears the outer SSR response session cookie when a business API returns auth-required', async () => {
    const { options, auth, clearSessionMock, deleteCookieMock, event } = await runServerPlugin()

    await options.onResponseError?.({
      request: '/workbench/layout',
      response: {
        status: 401,
        _data: {
          code: 'auth-required'
        }
      }
    } as never)

    expect(auth.markSessionExpired).toHaveBeenCalledTimes(1)
    expect(clearSessionMock).toHaveBeenCalledTimes(1)
    expect(deleteCookieMock).toHaveBeenCalledWith(event, 'hdx_web_session', expect.objectContaining({
      path: '/',
      sameSite: 'lax',
      secure: false
    }))
    expect(event.context.hdxAuthSessionInvalidated).toBe(true)
  })
})

async function runPlugin(options: {
  route: { path: string, fullPath: string }
  navigateToMock?: ReturnType<typeof vi.fn>
}) {
  vi.resetModules()

  const hdxApi = vi.fn()
  const fetchCreateMock = vi.fn(() => hdxApi)
  const auth = {
    markSessionExpired: vi.fn()
  }
  const navigateToMock = options.navigateToMock ?? vi.fn()
  const runWithContextMock = vi.fn((callback: () => unknown) => callback())

  vi.stubGlobal('defineNuxtPlugin', (handler: unknown) => handler)
  vi.stubGlobal('$fetch', {
    create: fetchCreateMock
  })
  vi.stubGlobal('useAuthStore', vi.fn(() => auth))
  vi.stubGlobal('useRoute', () => options.route)
  vi.stubGlobal('useRequestHeaders', () => ({}))
  vi.stubGlobal('navigateTo', navigateToMock)

  const nuxtApp = {
    $pinia: 'pinia',
    runWithContext: runWithContextMock
  }
  const plugin = (await import('../../app/plugins/hdx-api.client')).default as (app: typeof nuxtApp) => { provide: { hdxApi: typeof hdxApi } }
  const result = plugin(nuxtApp)

  return {
    options: fetchCreateMock.mock.calls[0]?.[0] as {
      onResponseError?: (context: never) => Promise<void>
    },
    hdxApi: result.provide.hdxApi,
    auth,
    navigateToMock,
    runWithContextMock
  }
}

async function runServerPlugin() {
  vi.resetModules()

  const hdxApi = vi.fn()
  const fetchCreateMock = vi.fn(() => hdxApi)
  const auth = {
    markSessionExpired: vi.fn()
  }
  const event = {
    context: {}
  }
  const clearSessionMock = vi.fn()
  const deleteCookieMock = vi.fn()

  vi.stubGlobal('defineNuxtPlugin', (handler: unknown) => handler)
  vi.stubGlobal('$fetch', {
    create: fetchCreateMock
  })
  vi.stubGlobal('useAuthStore', vi.fn(() => auth))
  vi.stubGlobal('useRequestHeaders', () => ({
    cookie: 'hdx_web_session=expired'
  }))
  vi.stubGlobal('useRequestEvent', () => event)
  vi.stubGlobal('useRuntimeConfig', () => ({
    backendBaseUrl: 'http://localhost:18080',
    authBaseUrl: 'http://localhost:18082',
    authSessionCookieName: 'hdx_web_session',
    authSessionSecret: 'test-only-auth-session-secret-change-me-32',
    authCsrfCookieName: 'hdx_csrf',
    authCsrfHeaderName: 'X-HDX-CSRF',
    authCookieSecure: false,
    authSessionMaxAgeSeconds: 604800,
    authRefreshSkewSeconds: 60
  }))
  vi.stubGlobal('useSession', async () => ({
    id: 'session-id',
    data: {},
    update: vi.fn(),
    clear: clearSessionMock
  }))
  vi.stubGlobal('deleteCookie', deleteCookieMock)

  const nuxtApp = {
    $pinia: 'pinia'
  }
  const plugin = (await import('../../app/plugins/hdx-api.server')).default as (app: typeof nuxtApp) => { provide: { hdxApi: typeof hdxApi } }
  const result = plugin(nuxtApp)

  return {
    options: fetchCreateMock.mock.calls[0]?.[0] as {
      onResponseError?: (context: never) => Promise<void>
    },
    hdxApi: result.provide.hdxApi,
    auth,
    clearSessionMock,
    deleteCookieMock,
    event
  }
}
