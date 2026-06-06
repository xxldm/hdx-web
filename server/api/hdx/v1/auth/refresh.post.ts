import { normalizeBoundaryError } from '~~/app/utils/api-error'
import { assertCsrfToken } from '~~/server/utils/auth-csrf'
import { getPublicAuthSession, refreshAuthSession } from '~~/server/utils/auth-session'

export default defineEventHandler(async (event) => {
  try {
    assertCsrfToken(event)
    await refreshAuthSession(event)

    return await getPublicAuthSession(event)
  } catch (error) {
    const boundaryError = normalizeBoundaryError(error)

    throw createError({
      statusCode: boundaryError.statusCode,
      statusMessage: boundaryError.message
    })
  }
})
