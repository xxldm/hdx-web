import fs from 'node:fs'
import path from 'node:path'
import { parse as parseYaml } from 'yaml'

export const EXAMPLE_AUTH_SESSION_SECRET = 'please-change-this-to-a-long-random-secret'
export const DEV_AUTH_SESSION_SECRET = 'dev-only-hdx-auth-session-secret-change-me-32'

const ENV_KEYS = [
  'NODE_ENV',
  'NITRO_HOST',
  'NITRO_PORT',
  'NUXT_BACKEND_BASE_URL',
  'NUXT_AUTH_BASE_URL',
  'NUXT_AUTH_SESSION_SECRET',
  'NUXT_AUTH_COOKIE_SECURE',
  'NUXT_AUTH_SESSION_COOKIE_NAME',
  'NUXT_AUTH_CSRF_COOKIE_NAME',
  'NUXT_AUTH_CSRF_HEADER_NAME',
  'NUXT_AUTH_SESSION_MAX_AGE_SECONDS',
  'NUXT_AUTH_REFRESH_SKEW_SECONDS',
  'NUXT_BACKEND_LOCAL_TOKEN_HEADER',
  'NUXT_BACKEND_LOCAL_TOKEN'
]

function hasValue(value) {
  return value !== undefined && value !== null && String(value) !== ''
}

function toEnvValue(value) {
  if (!hasValue(value)) {
    return undefined
  }

  return String(value)
}

function setIfPresent(target, key, value) {
  const envValue = toEnvValue(value)

  if (envValue !== undefined) {
    target[key] = envValue
  }
}

function readConfigFile(configPath) {
  if (!fs.existsSync(configPath)) {
    return {}
  }

  const content = fs.readFileSync(configPath, 'utf8')
  const parsed = parseYaml(content)

  if (parsed === undefined || parsed === null) {
    return {}
  }

  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Web 配置文件必须是 YAML 对象：${configPath}`)
  }

  return parsed
}

function resolveConfigPath({ rootDirectory, explicitConfigPath, env, defaultConfigNames }) {
  const configuredPath = explicitConfigPath || env.HDX_WEB_CONFIG_FILE

  if (hasValue(configuredPath)) {
    return path.resolve(rootDirectory, configuredPath)
  }

  for (const name of defaultConfigNames) {
    const candidate = path.join(rootDirectory, name)

    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return path.join(rootDirectory, defaultConfigNames[0])
}

function configToEnvironment(config) {
  const env = {}

  setIfPresent(env, 'NITRO_HOST', config.server?.host)
  setIfPresent(env, 'NITRO_PORT', config.server?.port)
  setIfPresent(env, 'NUXT_BACKEND_BASE_URL', config.backend?.gatewayBaseUrl)
  setIfPresent(env, 'NUXT_AUTH_BASE_URL', config.backend?.authBaseUrl)
  setIfPresent(env, 'NUXT_AUTH_SESSION_SECRET', config.auth?.sessionSecret)
  setIfPresent(env, 'NUXT_AUTH_COOKIE_SECURE', config.auth?.cookieSecure)
  setIfPresent(env, 'NUXT_AUTH_SESSION_COOKIE_NAME', config.auth?.sessionCookieName)
  setIfPresent(env, 'NUXT_AUTH_CSRF_COOKIE_NAME', config.auth?.csrfCookieName)
  setIfPresent(env, 'NUXT_AUTH_CSRF_HEADER_NAME', config.auth?.csrfHeaderName)
  setIfPresent(env, 'NUXT_AUTH_SESSION_MAX_AGE_SECONDS', config.auth?.sessionMaxAgeSeconds)
  setIfPresent(env, 'NUXT_AUTH_REFRESH_SKEW_SECONDS', config.auth?.refreshSkewSeconds)
  setIfPresent(env, 'NUXT_BACKEND_LOCAL_TOKEN_HEADER', config.localBackend?.tokenHeader)
  setIfPresent(env, 'NUXT_BACKEND_LOCAL_TOKEN', config.localBackend?.token)

  return env
}

function defaultEnvironment(nodeEnv) {
  const production = nodeEnv === 'production'

  return {
    NODE_ENV: nodeEnv,
    NITRO_HOST: '0.0.0.0',
    NITRO_PORT: '3000',
    NUXT_BACKEND_BASE_URL: 'http://localhost:18080',
    NUXT_AUTH_BASE_URL: 'http://localhost:18082',
    NUXT_AUTH_SESSION_SECRET: DEV_AUTH_SESSION_SECRET,
    NUXT_AUTH_COOKIE_SECURE: production ? 'true' : 'false',
    NUXT_AUTH_SESSION_COOKIE_NAME: 'hdx_web_session',
    NUXT_AUTH_CSRF_COOKIE_NAME: 'hdx_csrf',
    NUXT_AUTH_CSRF_HEADER_NAME: 'X-HDX-CSRF',
    NUXT_AUTH_SESSION_MAX_AGE_SECONDS: '604800',
    NUXT_AUTH_REFRESH_SKEW_SECONDS: '60'
  }
}

function mergeEnvironment({ baseEnv, configEnv, processEnv }) {
  const merged = { ...baseEnv, ...configEnv }

  for (const key of ENV_KEYS) {
    if (hasValue(processEnv[key])) {
      merged[key] = String(processEnv[key])
    }
  }

  return { ...processEnv, ...merged }
}

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isIntegerInRange(value, min, max) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max
}

function validateBoolean(value) {
  return ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(String(value).toLowerCase())
}

export function validateWebEnvironment(env, { strictProductionSecret = false } = {}) {
  const errors = []

  if (!isIntegerInRange(env.NITRO_PORT, 1, 65535)) {
    errors.push('server.port / NITRO_PORT 必须是 1..65535 的整数。')
  }

  if (!isHttpUrl(env.NUXT_BACKEND_BASE_URL)) {
    errors.push('backend.gatewayBaseUrl / NUXT_BACKEND_BASE_URL 必须是 http:// 或 https:// URL。')
  }

  if (!isHttpUrl(env.NUXT_AUTH_BASE_URL)) {
    errors.push('backend.authBaseUrl / NUXT_AUTH_BASE_URL 必须是 http:// 或 https:// URL。')
  }

  if (!validateBoolean(env.NUXT_AUTH_COOKIE_SECURE)) {
    errors.push('auth.cookieSecure / NUXT_AUTH_COOKIE_SECURE 必须是布尔值。')
  }

  if (!isIntegerInRange(env.NUXT_AUTH_SESSION_MAX_AGE_SECONDS, 1, Number.MAX_SAFE_INTEGER)) {
    errors.push('auth.sessionMaxAgeSeconds / NUXT_AUTH_SESSION_MAX_AGE_SECONDS 必须大于 0。')
  }

  if (!isIntegerInRange(env.NUXT_AUTH_REFRESH_SKEW_SECONDS, 0, Number.MAX_SAFE_INTEGER)) {
    errors.push('auth.refreshSkewSeconds / NUXT_AUTH_REFRESH_SKEW_SECONDS 必须大于等于 0。')
  }

  const localTokenHeaderSet = hasValue(env.NUXT_BACKEND_LOCAL_TOKEN_HEADER)
  const localTokenSet = hasValue(env.NUXT_BACKEND_LOCAL_TOKEN)

  if (localTokenHeaderSet !== localTokenSet) {
    errors.push('localBackend.tokenHeader 和 localBackend.token 必须同时填写或同时为空。')
  }

  if (strictProductionSecret) {
    if (!hasValue(env.NUXT_AUTH_SESSION_SECRET)) {
      errors.push('生产环境必须配置 auth.sessionSecret / NUXT_AUTH_SESSION_SECRET。')
    } else if (env.NUXT_AUTH_SESSION_SECRET === EXAMPLE_AUTH_SESSION_SECRET || env.NUXT_AUTH_SESSION_SECRET === DEV_AUTH_SESSION_SECRET) {
      errors.push('生产环境不能使用示例 auth.sessionSecret。')
    } else if (String(env.NUXT_AUTH_SESSION_SECRET).length < 32) {
      errors.push('生产环境 auth.sessionSecret 长度至少 32。')
    }
  } else if (hasValue(env.NUXT_AUTH_SESSION_SECRET) && String(env.NUXT_AUTH_SESSION_SECRET).length < 32) {
    errors.push('auth.sessionSecret / NUXT_AUTH_SESSION_SECRET 长度至少 32。')
  }

  if (errors.length > 0) {
    throw new Error(`Web 运行配置无效：\n- ${errors.join('\n- ')}`)
  }
}

export function loadWebConfig({
  rootDirectory = process.cwd(),
  explicitConfigPath,
  defaultConfigNames = ['config.local.yml', 'config.yml'],
  env = process.env,
  nodeEnv = env.NODE_ENV || 'development',
  strictProductionSecret = false
} = {}) {
  const configPath = resolveConfigPath({
    rootDirectory,
    explicitConfigPath,
    env,
    defaultConfigNames
  })
  const config = fs.existsSync(configPath) ? readConfigFile(configPath) : {}
  const nextEnv = mergeEnvironment({
    baseEnv: defaultEnvironment(nodeEnv),
    configEnv: configToEnvironment(config),
    processEnv: env
  })

  validateWebEnvironment(nextEnv, { strictProductionSecret })

  return {
    config,
    configPath,
    configExists: fs.existsSync(configPath),
    env: nextEnv
  }
}

export function applyWebConfigToProcess(options = {}) {
  const result = loadWebConfig({
    env: process.env,
    ...options
  })

  for (const key of ENV_KEYS) {
    if (hasValue(result.env[key])) {
      process.env[key] = result.env[key]
    }
  }

  return result
}
