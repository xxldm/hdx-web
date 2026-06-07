import { runtimeInfoSchema } from '~~/app/types/hdx-api'
import { createBoundaryH3Error } from '~~/app/utils/api-error'
import { fetchBackend } from '~~/server/utils/backend-fetch'

export default defineEventHandler(async (event) => {
  try {
    return await fetchBackend(event, '/api/v1/runtime', runtimeInfoSchema)
  } catch (error) {
    throw createBoundaryH3Error(error)
  }
})
