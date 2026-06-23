import { afterEach, describe, expect, it, vi } from 'vitest'

interface AuthRoute {
  path: string
  fullPath: string
  query: Record<string, unknown>
}

interface AuthStoreStub {
  initialized: boolean
  authenticated: boolean
  errorKey: string | null
  loadSession: ReturnType<typeof vi.fn>
}

describe('auth route middleware', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('redirects anonymous users to login with the original target', async () => {
    const auth = createAuthStoreStub({ initialized: false, authenticated: false })
    const { middleware, navigateToMock, useAuthStoreMock } = await loadAuthMiddleware(auth)

    await middleware({
      path: '/',
      fullPath: '/?tab=tools',
      query: {}
    })

    expect(auth.loadSession).toHaveBeenCalledTimes(1)
    expect(useAuthStoreMock).toHaveBeenCalledWith('pinia')
    expect(navigateToMock).toHaveBeenCalledWith({
      path: '/login',
      query: {
        redirect: '/?tab=tools'
      }
    })
  })

  it('allows anonymous users to stay on login', async () => {
    const auth = createAuthStoreStub({ initialized: true, authenticated: false })
    const { middleware, navigateToMock } = await loadAuthMiddleware(auth)

    await middleware({
      path: '/login',
      fullPath: '/login?redirect=/',
      query: {
        redirect: '/'
      }
    })

    expect(auth.loadSession).not.toHaveBeenCalled()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('redirects authenticated users away from login', async () => {
    const auth = createAuthStoreStub({ initialized: true, authenticated: true })
    const { middleware, navigateToMock } = await loadAuthMiddleware(auth)

    await middleware({
      path: '/login',
      fullPath: '/login?redirect=/settings',
      query: {
        redirect: '/settings'
      }
    })

    expect(navigateToMock).toHaveBeenCalledWith('/settings')
  })

  it('keeps users on login when the current client session was marked expired', async () => {
    const auth = createAuthStoreStub({
      initialized: true,
      authenticated: true,
      errorKey: 'auth.sessionExpired'
    })
    const { middleware, navigateToMock } = await loadAuthMiddleware(auth)

    await middleware({
      path: '/login',
      fullPath: '/login?redirect=/',
      query: {
        redirect: '/'
      }
    })

    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('sanitizes external login redirect targets', async () => {
    const auth = createAuthStoreStub({ initialized: true, authenticated: true })
    const { middleware, navigateToMock } = await loadAuthMiddleware(auth)

    await middleware({
      path: '/login',
      fullPath: '/login?redirect=https://example.com',
      query: {
        redirect: 'https://example.com'
      }
    })

    expect(navigateToMock).toHaveBeenCalledWith('/')
  })
})

function createAuthStoreStub(options: Pick<AuthStoreStub, 'initialized' | 'authenticated'> & Partial<Pick<AuthStoreStub, 'errorKey'>>): AuthStoreStub {
  return {
    ...options,
    errorKey: options.errorKey ?? null,
    loadSession: vi.fn(async () => null)
  }
}

async function loadAuthMiddleware(auth: AuthStoreStub) {
  vi.resetModules()

  const navigateToMock = vi.fn((target: unknown) => target)
  const useAuthStoreMock = vi.fn(() => auth)

  vi.stubGlobal('defineNuxtRouteMiddleware', (handler: unknown) => handler)
  vi.stubGlobal('useNuxtApp', () => ({ $pinia: 'pinia' }))
  vi.stubGlobal('useAuthStore', useAuthStoreMock)
  vi.stubGlobal('navigateTo', navigateToMock)

  const middleware = (await import('../../app/middleware/auth.global')).default as (to: AuthRoute) => Promise<unknown>

  return {
    middleware,
    navigateToMock,
    useAuthStoreMock
  }
}
