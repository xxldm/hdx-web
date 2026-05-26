import { createToolRequestSchema, toolRecordSchema } from '~~/app/types/hdx-api'
import { BoundaryError, normalizeBoundaryError } from '~~/app/utils/api-error'
import { fetchBackend } from '~~/server/utils/backend-fetch'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const parsed = createToolRequestSchema.safeParse(body)

    if (!parsed.success) {
      throw new BoundaryError('invalid-input', '工具信息格式无效。', 400)
    }

    return await fetchBackend(event, '/api/v1/tools', toolRecordSchema, {
      method: 'POST',
      body: parsed.data
    })
  } catch (error) {
    const boundaryError = normalizeBoundaryError(error)

    throw createError({
      statusCode: boundaryError.statusCode,
      statusMessage: boundaryError.message
    })
  }
})
