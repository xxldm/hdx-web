import { describe, expect, it } from 'vitest'
import {
  backendAuthTokenResponseSchema,
  webAuthLoginRequestSchema,
  webAuthPublicSessionSchema
} from '../../app/types/hdx-auth'
import { createToolRequestSchema, runtimeInfoSchema, toolRecordsSchema } from '../../app/types/hdx-api'

describe('hdx api schemas', () => {
  it('parses runtime info responses', () => {
    expect(runtimeInfoSchema.parse({
      application: 'hdx-core-service',
      topology: 'core-service',
      javaVersion: '25.0.3',
      nativeImage: false
    })).toEqual({
      application: 'hdx-core-service',
      topology: 'core-service',
      javaVersion: '25.0.3',
      nativeImage: false
    })
  })

  it('rejects invalid tool request input', () => {
    expect(createToolRequestSchema.safeParse({
      toolKey: '',
      displayName: '工具'
    }).success).toBe(false)
  })

  it('parses tool record arrays', () => {
    expect(toolRecordsSchema.parse([
      {
        id: 1,
        toolKey: 'demo',
        displayName: 'Demo',
        description: null,
        enabled: true,
        createdAt: '2026-05-26T00:00:00Z',
        updatedAt: '2026-05-26T00:00:00Z'
      }
    ])).toHaveLength(1)
  })

  it('parses auth token responses without exposing tokens in public session', () => {
    const tokenResponse = backendAuthTokenResponseSchema.parse({
      tokenType: 'Bearer',
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
    })

    expect(tokenResponse.refreshToken).toBe('refresh-token')
    expect(webAuthPublicSessionSchema.parse({
      authenticated: true,
      csrfToken: 'a'.repeat(64),
      accessTokenExpiresAt: tokenResponse.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokenResponse.refreshTokenExpiresAt,
      sid: tokenResponse.sid,
      user: tokenResponse.user,
      roles: tokenResponse.roles,
      permissions: tokenResponse.permissions
    })).not.toHaveProperty('refreshToken')
  })

  it('validates web login input', () => {
    expect(webAuthLoginRequestSchema.parse({
      identifier: ' Alice ',
      password: 'correct-password'
    })).toEqual({
      identifier: 'Alice',
      password: 'correct-password'
    })

    expect(webAuthLoginRequestSchema.safeParse({
      identifier: '',
      password: ''
    }).success).toBe(false)
  })
})
