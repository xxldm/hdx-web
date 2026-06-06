import { describe, expect, it } from 'vitest'
import {
  createCsrfToken,
  isValidCsrfPair,
  isValidCsrfToken
} from '../../server/utils/auth-csrf'

describe('auth csrf boundary', () => {
  it('creates a 64 character hex token', () => {
    const token = createCsrfToken({
      getRandomValues(bytes: Uint8Array) {
        bytes.fill(0xab)
        return bytes
      }
    } as Crypto)

    expect(token).toBe('ab'.repeat(32))
    expect(isValidCsrfToken(token)).toBe(true)
  })

  it('requires cookie and header token to match', () => {
    const token = '1'.repeat(64)

    expect(isValidCsrfPair(token, token)).toBe(true)
    expect(isValidCsrfPair(token, '2'.repeat(64))).toBe(false)
    expect(isValidCsrfPair('bad-token', 'bad-token')).toBe(false)
  })
})
