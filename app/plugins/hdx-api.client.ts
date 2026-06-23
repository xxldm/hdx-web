import type { Pinia } from 'pinia'
import { createLoginRedirectTarget } from '~/utils/auth-redirect'
import { shouldHandleAuthRequiredHdxApiResponse } from '~/utils/hdx-api-auth-boundary'

type HdxApiFetch = typeof $fetch

declare module '#app' {
  interface NuxtApp {
    $hdxApi: HdxApiFetch
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $hdxApi: HdxApiFetch
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const auth = useAuthStore(nuxtApp.$pinia as Pinia)
  const route = useRoute()
  let redirectingToLogin = false

  const hdxApi = $fetch.create({
    baseURL: '/api/hdx/v1',
    credentials: 'same-origin',
    async onResponseError({ request, response }) {
      if (!shouldHandleAuthRequiredHdxApiResponse(request, response)) {
        return
      }

      auth.markSessionExpired()

      if (!shouldStartAuthRequiredRedirect({
        routePath: route.path,
        redirectingToLogin
      })) {
        return
      }

      redirectingToLogin = true

      try {
        await nuxtApp.runWithContext(() => navigateTo(createLoginRedirectTarget(route.fullPath), { replace: true }))
      } finally {
        redirectingToLogin = false
      }
    }
  })

  return {
    provide: {
      hdxApi
    }
  }
})

export function shouldStartAuthRequiredRedirect(options: {
  routePath: string
  redirectingToLogin: boolean
}) {
  return options.routePath !== '/login'
    && !options.redirectingToLogin
}
