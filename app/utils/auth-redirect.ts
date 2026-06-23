import { normalizeInternalRedirect } from './internal-redirect'

export function createLoginRedirectTarget(fullPath: string) {
  return {
    path: '/login',
    query: {
      redirect: normalizeInternalRedirect(fullPath)
    }
  }
}
