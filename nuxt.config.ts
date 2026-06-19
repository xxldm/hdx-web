import { createThemePreferenceHeadScript } from './app/utils/theme-runtime'
import { z } from 'zod'

const serverConfigSchema = z.object({
  backendBaseUrl: z.string().url(),
  authBaseUrl: z.string().url(),
  backendLocalTokenHeader: z.string().min(1).optional(),
  backendLocalToken: z.string().min(1).optional(),
  authSessionCookieName: z.string().min(1),
  authSessionSecret: z.string().min(32),
  authCsrfCookieName: z.string().min(1),
  authCsrfHeaderName: z.string().min(1),
  authCookieSecure: z.boolean(),
  authSessionMaxAgeSeconds: z.number().int().positive(),
  authRefreshSkewSeconds: z.number().int().nonnegative()
})

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === '') {
    return fallback
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function parseInteger(value: string | undefined, fallback: number) {
  if (value === undefined || value === '') {
    return fallback
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}

const parsedServerConfig = serverConfigSchema.parse({
  backendBaseUrl: process.env.NUXT_BACKEND_BASE_URL ?? process.env.HDX_BACKEND_BASE_URL ?? 'http://localhost:18080',
  authBaseUrl: process.env.NUXT_AUTH_BASE_URL ?? process.env.HDX_AUTH_BASE_URL ?? 'http://localhost:18082',
  backendLocalTokenHeader: process.env.NUXT_BACKEND_LOCAL_TOKEN_HEADER || undefined,
  backendLocalToken: process.env.NUXT_BACKEND_LOCAL_TOKEN || undefined,
  authSessionCookieName: process.env.NUXT_AUTH_SESSION_COOKIE_NAME || 'hdx_web_session',
  authSessionSecret: process.env.NUXT_AUTH_SESSION_SECRET || 'dev-only-hdx-auth-session-secret-change-me-32',
  authCsrfCookieName: process.env.NUXT_AUTH_CSRF_COOKIE_NAME || 'hdx_csrf',
  authCsrfHeaderName: process.env.NUXT_AUTH_CSRF_HEADER_NAME || 'X-HDX-CSRF',
  authCookieSecure: parseBoolean(process.env.NUXT_AUTH_COOKIE_SECURE, process.env.NODE_ENV === 'production'),
  authSessionMaxAgeSeconds: parseInteger(process.env.NUXT_AUTH_SESSION_MAX_AGE_SECONDS, 60 * 60 * 24 * 7),
  authRefreshSkewSeconds: parseInteger(process.env.NUXT_AUTH_REFRESH_SKEW_SECONDS, 60)
})
const isDesktopStaticBuild = process.env.HDX_WEB_BUILD_TARGET === 'desktop-static'
const desktopStaticOutputDirectory = '.output-desktop-static'
const themePreferenceHeadScript = createThemePreferenceHeadScript()

export default defineNuxtConfig({
  compatibilityDate: '2026-05-26',
  ssr: !isDesktopStaticBuild,
  devtools: { enabled: true },
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@pinia/nuxt'
  ],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: {
        lang: 'zh-CN'
      },
      title: 'HDX',
      meta: [
        { name: 'description', content: 'HDX 工具箱 Web 工作台' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ],
      script: [
        {
          innerHTML: themePreferenceHeadScript,
          tagPosition: 'head'
        }
      ]
    }
  },
  runtimeConfig: {
    backendBaseUrl: parsedServerConfig.backendBaseUrl,
    authBaseUrl: parsedServerConfig.authBaseUrl,
    backendLocalTokenHeader: parsedServerConfig.backendLocalTokenHeader,
    backendLocalToken: parsedServerConfig.backendLocalToken,
    authSessionCookieName: parsedServerConfig.authSessionCookieName,
    authSessionSecret: parsedServerConfig.authSessionSecret,
    authCsrfCookieName: parsedServerConfig.authCsrfCookieName,
    authCsrfHeaderName: parsedServerConfig.authCsrfHeaderName,
    authCookieSecure: parsedServerConfig.authCookieSecure,
    authSessionMaxAgeSeconds: parsedServerConfig.authSessionMaxAgeSeconds,
    authRefreshSkewSeconds: parsedServerConfig.authRefreshSkewSeconds,
    public: {
      appName: 'HDX',
      hdxClientTransport: isDesktopStaticBuild ? 'tauri' : 'auto'
    }
  },
  nitro: isDesktopStaticBuild
    ? {
        preset: 'static',
        output: {
          dir: desktopStaticOutputDirectory
        }
      }
    : undefined,
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'zh-CN',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'hdx_locale',
      redirectOn: 'no prefix',
      alwaysRedirect: false,
      fallbackLocale: 'zh-CN'
    },
    locales: [
      { code: 'zh-CN', name: '简体中文', file: 'zh-CN.json' },
      { code: 'en-US', name: 'English', file: 'en-US.json' }
    ],
    langDir: 'locales'
  },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    storage: 'localStorage',
    storageKey: 'hdx-color-mode'
  },
  ui: {
    theme: {
      colors: ['primary', 'secondary', 'success', 'warning', 'error', 'neutral']
    }
  },
  typescript: {
    strict: true,
    typeCheck: true
  },
  sourcemap: {
    client: false,
    server: true
  }
})
