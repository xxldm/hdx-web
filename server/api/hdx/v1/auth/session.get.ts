import { createBoundaryH3Error } from '~~/app/utils/api-error'
import { getPublicAuthSession, refreshAuthSessionIfNeeded } from '~~/server/utils/auth-session'

export default defineEventHandler(async (event) => {
  try {
    await refreshAuthSessionIfNeeded(event)
    return await getPublicAuthSession(event)
  } catch (error) {
    throw createBoundaryH3Error(error)
  }
})
