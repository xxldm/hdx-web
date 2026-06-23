import type { Pinia } from 'pinia'
import { invalidateWebAuthSession } from '~~/server/utils/auth-session'
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
  const ssrRequestHeaders = useRequestHeaders(['cookie'])
  const ssrRequestEvent = useRequestEvent()

  const hdxApi = $fetch.create({
    baseURL: '/api/hdx/v1',
    credentials: 'same-origin',
    onRequest({ options }) {
      if (!ssrRequestHeaders.cookie) {
        return
      }

      const headers = new Headers(options.headers)
      headers.set('cookie', ssrRequestHeaders.cookie)
      options.headers = headers
    },
    async onResponseError({ request, response }) {
      if (!shouldHandleAuthRequiredHdxApiResponse(request, response)) {
        return
      }

      auth.markSessionExpired()

      if (ssrRequestEvent) {
        await invalidateWebAuthSession(ssrRequestEvent)
      }
    }
  })

  return {
    provide: {
      hdxApi
    }
  }
})
