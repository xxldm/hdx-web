import { normalizeInternalRedirect } from '~/utils/internal-redirect'

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.loadSession()
  }

  if (to.path === '/login') {
    if (auth.authenticated) {
      return navigateTo(normalizeInternalRedirect(to.query.redirect))
    }

    return
  }

  if (!auth.authenticated) {
    return navigateTo({
      path: '/login',
      query: {
        redirect: to.fullPath
      }
    })
  }
})
