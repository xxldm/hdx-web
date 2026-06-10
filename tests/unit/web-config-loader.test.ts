import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  EXAMPLE_AUTH_SESSION_SECRET,
  loadWebConfig,
  validateWebEnvironment
} from '../../scripts/web-config-loader.mjs'

const tempDirectories: string[] = []

function createTempDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hdx-web-config-'))
  tempDirectories.push(directory)
  return directory
}

function writeConfig(directory: string, content: string, fileName = 'config.yml') {
  fs.writeFileSync(path.join(directory, fileName), content, 'utf8')
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true })
  }
})

describe('web config loader', () => {
  it('maps yaml config to Nuxt and Nitro environment variables', () => {
    const directory = createTempDirectory()

    writeConfig(directory, `
server:
  host: 127.0.0.1
  port: 3100
backend:
  gatewayBaseUrl: http://localhost:18080
  authBaseUrl: http://localhost:18082
auth:
  sessionSecret: test-only-auth-session-secret-change-me-32
  cookieSecure: false
  sessionCookieName: hdx_session
  csrfCookieName: hdx_csrf_test
  csrfHeaderName: X-CSRF-Test
  sessionMaxAgeSeconds: 120
  refreshSkewSeconds: 10
`)

    const result = loadWebConfig({
      rootDirectory: directory,
      env: {},
      nodeEnv: 'development'
    })

    expect(result.env).toMatchObject({
      NODE_ENV: 'development',
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: '3100',
      NUXT_BACKEND_BASE_URL: 'http://localhost:18080',
      NUXT_AUTH_BASE_URL: 'http://localhost:18082',
      NUXT_AUTH_SESSION_SECRET: 'test-only-auth-session-secret-change-me-32',
      NUXT_AUTH_COOKIE_SECURE: 'false',
      NUXT_AUTH_SESSION_COOKIE_NAME: 'hdx_session',
      NUXT_AUTH_CSRF_COOKIE_NAME: 'hdx_csrf_test',
      NUXT_AUTH_CSRF_HEADER_NAME: 'X-CSRF-Test',
      NUXT_AUTH_SESSION_MAX_AGE_SECONDS: '120',
      NUXT_AUTH_REFRESH_SKEW_SECONDS: '10'
    })
  })

  it('keeps external environment variables above config values', () => {
    const directory = createTempDirectory()

    writeConfig(directory, `
backend:
  gatewayBaseUrl: http://from-config.example.com
auth:
  sessionSecret: test-only-auth-session-secret-change-me-32
`)

    const result = loadWebConfig({
      rootDirectory: directory,
      env: {
        NUXT_BACKEND_BASE_URL: 'https://from-env.example.com'
      },
      nodeEnv: 'development'
    })

    expect(result.env.NUXT_BACKEND_BASE_URL).toBe('https://from-env.example.com')
  })

  it('allows missing config file and uses defaults', () => {
    const directory = createTempDirectory()

    const result = loadWebConfig({
      rootDirectory: directory,
      env: {},
      nodeEnv: 'development'
    })

    expect(result.configExists).toBe(false)
    expect(result.env.NUXT_BACKEND_BASE_URL).toBe('http://localhost:18080')
    expect(result.env.NITRO_PORT).toBe('3000')
  })

  it('rejects example secret in strict production mode', () => {
    expect(() => validateWebEnvironment({
      NODE_ENV: 'production',
      NITRO_PORT: '3000',
      NUXT_BACKEND_BASE_URL: 'http://localhost:18080',
      NUXT_AUTH_BASE_URL: 'http://localhost:18082',
      NUXT_AUTH_COOKIE_SECURE: 'true',
      NUXT_AUTH_SESSION_MAX_AGE_SECONDS: '604800',
      NUXT_AUTH_REFRESH_SKEW_SECONDS: '60',
      NUXT_AUTH_SESSION_SECRET: EXAMPLE_AUTH_SESSION_SECRET
    }, { strictProductionSecret: true })).toThrow('生产环境不能使用示例 auth.sessionSecret')
  })

  it('requires local backend token header and token as a pair', () => {
    expect(() => validateWebEnvironment({
      NODE_ENV: 'development',
      NITRO_PORT: '3000',
      NUXT_BACKEND_BASE_URL: 'http://localhost:18080',
      NUXT_AUTH_BASE_URL: 'http://localhost:18082',
      NUXT_AUTH_COOKIE_SECURE: 'false',
      NUXT_AUTH_SESSION_MAX_AGE_SECONDS: '604800',
      NUXT_AUTH_REFRESH_SKEW_SECONDS: '60',
      NUXT_AUTH_SESSION_SECRET: 'test-only-auth-session-secret-change-me-32',
      NUXT_BACKEND_LOCAL_TOKEN_HEADER: 'X-HDX-Local-Token'
    })).toThrow('localBackend.tokenHeader 和 localBackend.token')
  })
})
