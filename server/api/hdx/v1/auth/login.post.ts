import {
  backendAuthTokenResponseSchema,
  webAuthLoginRequestSchema
} from '~~/app/types/hdx-auth'
import { BoundaryError, createBoundaryH3Error } from '~~/app/utils/api-error'
import { assertCsrfToken } from '~~/server/utils/auth-csrf'
import { fetchAuthService } from '~~/server/utils/backend-fetch'
import { getPublicAuthSession, saveAuthSession } from '~~/server/utils/auth-session'

export default defineEventHandler(async (event) => {
  try {
    assertCsrfToken(event)

    const body = await readBody(event)
    const parsed = webAuthLoginRequestSchema.safeParse(body)

    if (!parsed.success) {
      throw new BoundaryError('invalid-input', '登录信息格式无效。', 400)
    }

    const tokenResponse = await fetchAuthService(event, '/api/auth/login', backendAuthTokenResponseSchema, {
      method: 'POST',
      body: {
        ...parsed.data,
        clientType: 'WEB'
      }
    })
    await saveAuthSession(event, tokenResponse)

    return await getPublicAuthSession(event)
  } catch (error) {
    throw createBoundaryH3Error(error)
  }
})
