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

  // 临时放开首页与工具箱布局调试入口；恢复认证闭环时重新启用未登录跳转。
  // if (!auth.authenticated) {
  //   return navigateTo({
  //     path: '/login',
  //     query: {
  //       redirect: to.fullPath
  //     }
  //   })
  // }
})
