import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../app/stores/auth'

const anonymousSession = {
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
}

const userSession = {
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
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('loads public session', async () => {
    vi.stubGlobal('$fetch', vi.fn(async () => userSession))
    const store = useAuthStore()

    await store.loadSession()

    expect(store.authenticated).toBe(true)
    expect(store.displayName).toBe('用户')
    expect(store.initialized).toBe(true)
  })

  it('logs in with a freshly loaded csrf header and stores session', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/session')) {
        return anonymousSession
      }

      return userSession
    })
    vi.stubGlobal('$fetch', fetchMock)
    const store = useAuthStore()
    store.session = {
      ...anonymousSession,
      csrfToken: 'c'.repeat(64)
    }

    await store.login({
      identifier: 'admin',
      password: 'password'
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/hdx/v1/auth/session', expect.objectContaining({
      credentials: 'same-origin'
    }))
    expect(fetchMock).toHaveBeenCalledWith('/api/hdx/v1/auth/login', expect.objectContaining({
      credentials: 'same-origin',
      headers: {
        'X-HDX-CSRF': anonymousSession.csrfToken
      }
    }))
    expect(store.authenticated).toBe(true)
  })

  it('reports csrf failure separately from credential failure', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/session')) {
        return anonymousSession
      }

      throw {
        statusCode: 403
      }
    })
    vi.stubGlobal('$fetch', fetchMock)
    const store = useAuthStore()

    await expect(store.login({
      identifier: 'admin',
      password: 'password'
    })).rejects.toThrow('登录失败。')

    expect(store.errorKey).toBe('auth.csrfFailed')
  })

  it('clears local state when logout fails', async () => {
    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/session')) {
        return userSession
      }

      throw new Error('offline')
    }))
    const store = useAuthStore()
    await store.loadSession()

    await store.logout()

    expect(store.authenticated).toBe(false)
    expect(store.errorKey).toBe('auth.logoutFailed')
  })
})
