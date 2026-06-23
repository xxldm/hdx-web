import { holidayAdminRecordSchema, holidayUpdateSchema } from '~~/app/types/hdx-api'
import { BoundaryError, createBoundaryH3Error } from '~~/app/utils/api-error'
import { fetchAuthenticatedBackend } from '~~/server/utils/authenticated-backend-fetch'

export default defineEventHandler(async (event) => {
  try {
    const id = parseHolidayId(getRouterParam(event, 'id'))
    const body = await readBody(event)
    const parsed = holidayUpdateSchema.safeParse(body)

    if (!parsed.success) {
      throw new BoundaryError('invalid-input', '节日格式无效。', 400)
    }

    return await fetchAuthenticatedBackend(event, `/api/v1/admin/holidays/${id}`, holidayAdminRecordSchema, {
      method: 'PUT',
      body: parsed.data
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
