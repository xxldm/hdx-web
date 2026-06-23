import { describe, expect, it } from 'vitest'
import {
  backendAuthTokenResponseSchema,
  webAuthLoginRequestSchema,
  webAuthPublicSessionSchema
} from '../../app/types/hdx-auth'
import {
  desktopOnlineConfigSchema,
  desktopOnlineConnectionCheckResultSchema
} from '../../app/types/desktop-online'
import {
  backendApiErrorResponseSchema,
  createToolRequestSchema,
  runtimeInfoSchema,
  timerPreferenceSaveSchema,
  timerPreferenceSchema,
  toolRecordsSchema,
  workbenchLayoutSchema
} from '../../app/types/hdx-api'
import { normalizeInternalRedirect } from '../../app/utils/internal-redirect'

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

  it('parses workbench layout responses', () => {
    expect(workbenchLayoutSchema.parse({
      schemaVersion: 1,
      version: 1,
      rows: 4,
      columns: 4,
      gap: 12,
      widgets: [
        {
          id: 'default-timer',
          key: 'timer',
          order: 0,
          column: 0,
          row: 0,
          colSpan: 2,
          rowSpan: 1,
          chrome: 'card',
          orientation: 'auto',
          header: {
            visible: true,
            icon: true,
            title: true,
            description: true
          }
        }
      ]
    }).widgets).toHaveLength(1)
  })

  it('parses timer preference responses and save requests', () => {
    expect(timerPreferenceSchema.parse({
      schemaVersion: 1,
      version: 1,
      presets: [
        {
          id: 'default-10-minutes',
          order: 0,
          durationSeconds: 600,
          createdAt: '2026-06-23T12:00:00Z'
        }
      ]
    }).presets).toHaveLength(1)

    expect(timerPreferenceSaveSchema.parse({
      schemaVersion: 1,
      version: 1,
      presets: [
        {
          id: 'timer-60',
          order: 0,
          durationSeconds: 60
        }
      ]
    }).presets[0]?.durationSeconds).toBe(60)
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
      actorType: 'USER',
      subject: 'USER:1',
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

  it('parses backend api error responses', () => {
    expect(backendApiErrorResponseSchema.parse({
      code: 'AUTH_LOGIN_COOLDOWN',
      message: '登录失败次数过多，请稍后再试。'
    })).toEqual({
      code: 'AUTH_LOGIN_COOLDOWN',
      message: '登录失败次数过多，请稍后再试。'
    })
  })

  it('normalizes internal redirects', () => {
    expect(normalizeInternalRedirect('/tools?filter=mine')).toBe('/tools?filter=mine')
    expect(normalizeInternalRedirect('//evil.example/path')).toBe('/')
    expect(normalizeInternalRedirect('https://evil.example/path')).toBe('/')
    expect(normalizeInternalRedirect(undefined)).toBe('/')
  })

  it('validates Desktop Online config input', () => {
    expect(desktopOnlineConfigSchema.parse({
      authBaseUrl: ' https://auth.example.com ',
      gatewayBaseUrl: 'https://api.example.com',
      requestTimeoutSeconds: 10
    })).toEqual({
      authBaseUrl: 'https://auth.example.com',
      gatewayBaseUrl: 'https://api.example.com',
      requestTimeoutSeconds: 10
    })

    expect(desktopOnlineConfigSchema.safeParse({
      authBaseUrl: 'not-a-url',
      gatewayBaseUrl: 'https://api.example.com',
      requestTimeoutSeconds: 0
    }).success).toBe(false)
  })

  it('parses Desktop Online connection check results', () => {
    expect(desktopOnlineConnectionCheckResultSchema.parse({
      ok: true,
      auth: {
        ok: true,
        url: 'https://auth.example.com/actuator/health',
        statusCode: 200,
        elapsedMs: 24,
        message: '认证中心连接正常。'
      },
      gateway: {
        ok: true,
        url: 'https://api.example.com/actuator/health',
        statusCode: 200,
        elapsedMs: 31,
        message: '业务网关连接正常。'
      }
    }).ok).toBe(true)
  })
})
