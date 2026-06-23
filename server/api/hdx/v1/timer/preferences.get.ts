import { timerPreferenceSchema } from '~~/app/types/hdx-api'
import { createBoundaryH3Error } from '~~/app/utils/api-error'
import { fetchAuthenticatedBackend } from '~~/server/utils/authenticated-backend-fetch'

export default defineEventHandler(async (event) => {
  try {
    return await fetchAuthenticatedBackend(event, '/api/v1/timer/preferences', timerPreferenceSchema)
  } catch (error) {
    throw createBoundaryH3Error(error)
  }
})
