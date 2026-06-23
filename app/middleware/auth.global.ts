import { createLoginRedirectTarget } from '~/utils/auth-redirect'
import { normalizeInternalRedirect } from '~/utils/internal-redirect'

export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  const auth = useAuthStore(nuxtApp.$pinia)

  if (!auth.initialized) {
    await auth.loadSession()
  }

  if (to.path === '/login') {
    if (auth.authenticated && auth.errorKey !== 'auth.sessionExpired') {
      return navigateTo(normalizeInternalRedirect(to.query.redirect))
    }

    return
  }

  if (!auth.authenticated) {
    return navigateTo(createLoginRedirectTarget(to.fullPath))
  }
})
