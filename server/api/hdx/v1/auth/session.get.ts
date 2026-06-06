import { normalizeBoundaryError } from '~~/app/utils/api-error'
import { getPublicAuthSession, refreshAuthSessionIfNeeded } from '~~/server/utils/auth-session'

export default defineEventHandler(async (event) => {
  try {
    await refreshAuthSessionIfNeeded(event)
    return await getPublicAuthSession(event)
  } catch (error) {
    const boundaryError = normalizeBoundaryError(error)

    throw createError({
      statusCode: boundaryError.statusCode,
      statusMessage: boundaryError.message
    })
  }
})
