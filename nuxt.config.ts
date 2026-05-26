import { z } from 'zod'

const serverConfigSchema = z.object({
  backendBaseUrl: z.string().url(),
  backendLocalTokenHeader: z.string().min(1).optional(),
  backendLocalToken: z.string().min(1).optional()
})

const parsedServerConfig = serverConfigSchema.parse({
  backendBaseUrl: process.env.NUXT_BACKEND_BASE_URL ?? 'http://localhost:18080',
  backendLocalTokenHeader: process.env.NUXT_BACKEND_LOCAL_TOKEN_HEADER || undefined,
  backendLocalToken: process.env.NUXT_BACKEND_LOCAL_TOKEN || undefined
})

export default defineNuxtConfig({
  compatibilityDate: '2026-05-26',
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
      ]
    }
  },
  runtimeConfig: {
    backendBaseUrl: parsedServerConfig.backendBaseUrl,
    backendLocalTokenHeader: parsedServerConfig.backendLocalTokenHeader,
    backendLocalToken: parsedServerConfig.backendLocalToken,
    public: {
      appName: 'HDX'
    }
  },
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
  }
})
