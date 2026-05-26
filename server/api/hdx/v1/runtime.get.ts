import { runtimeInfoSchema } from '~~/app/types/hdx-api'
import { normalizeBoundaryError } from '~~/app/utils/api-error'
import { fetchBackend } from '~~/server/utils/backend-fetch'

export default defineEventHandler(async (event) => {
  try {
    return await fetchBackend(event, '/api/v1/runtime', runtimeInfoSchema)
  } catch (error) {
    const boundaryError = normalizeBoundaryError(error)

    throw createError({
      statusCode: boundaryError.statusCode,
      statusMessage: boundaryError.message
    })
  }
})
