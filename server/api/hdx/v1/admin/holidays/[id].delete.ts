import { holidayAdminRecordSchema, holidayDeleteQuerySchema } from '~~/app/types/hdx-api'
import { BoundaryError, createBoundaryH3Error } from '~~/app/utils/api-error'
import { fetchAuthenticatedBackend } from '~~/server/utils/authenticated-backend-fetch'

export default defineEventHandler(async (event) => {
  try {
    const id = parseHolidayId(getRouterParam(event, 'id'))
    const parsed = holidayDeleteQuerySchema.safeParse(getQuery(event))

    if (!parsed.success) {
      throw new BoundaryError('invalid-input', '节日版本无效。', 400)
    }

    return await fetchAuthenticatedBackend(event, `/api/v1/admin/holidays/${id}`, holidayAdminRecordSchema, {
      method: 'DELETE',
      query: {
        version: parsed.data.version
      }
    })
  } catch (error) {
    throw createBoundaryH3Error(error)
  }
})

function parseHolidayId(value: string | undefined) {
  const id = Number(value)

  if (!Number.isInteger(id) || id <= 0) {
    throw new BoundaryError('invalid-input', '节日 ID 无效。', 400)
  }

  return id
}
