import { describe, expect, it } from 'vitest'
import { createLoginRedirectTarget } from '../../app/utils/auth-redirect'

describe('auth redirect helpers', () => {
  it('creates a login redirect target for internal routes', () => {
    expect(createLoginRedirectTarget('/settings?tab=account')).toEqual({
      path: '/login',
      query: {
        redirect: '/settings?tab=account'
      }
    })
  })

  it('sanitizes external redirect targets', () => {
    expect(createLoginRedirectTarget('https://example.com')).toEqual({
      path: '/login',
      query: {
        redirect: '/'
      }
    })
  })

})
