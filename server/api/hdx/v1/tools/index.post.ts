import { createToolRequestSchema, toolRecordSchema } from '~~/app/types/hdx-api'
import { BoundaryError, createBoundaryH3Error } from '~~/app/utils/api-error'
import { fetchAuthenticatedBackend } from '~~/server/utils/authenticated-backend-fetch'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const parsed = createToolRequestSchema.safeParse(body)

    if (!parsed.success) {
      throw new BoundaryError('invalid-input', '工具信息格式无效。', 400)
    }

    return await fetchAuthenticatedBackend(event, '/api/v1/tools', toolRecordSchema, {
      method: 'POST',
      body: parsed.data
    })
  } catch (error) {
    throw createBoundaryH3Error(error)
  }
})
