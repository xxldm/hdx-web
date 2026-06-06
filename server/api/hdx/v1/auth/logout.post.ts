import { z } from 'zod'
import { normalizeBoundaryError } from '~~/app/utils/api-error'
import { assertCsrfToken } from '~~/server/utils/auth-csrf'
import { clearAuthSession, getPublicAuthSession, readAuthSessionData } from '~~/server/utils/auth-session'
import { fetchAuthService } from '~~/server/utils/backend-fetch'

const logoutResponseSchema = z.unknown().optional()

export default defineEventHandler(async (event) => {
  try {
    assertCsrfToken(event)

    const sessionData = await readAuthSessionData(event)

    if (sessionData) {
      await tryLogoutBackend(event, sessionData.refreshToken)
    }

    await clearAuthSession(event)

    return await getPublicAuthSession(event)
  } catch (error) {
    const boundaryError = normalizeBoundaryError(error)

    throw createError({
      statusCode: boundaryError.statusCode,
      statusMessage: boundaryError.message
    })
  }
})

async function tryLogoutBackend(event: Parameters<typeof readAuthSessionData>[0], refreshToken: string) {
  try {
    await fetchAuthService(event, '/api/auth/logout', logoutResponseSchema, {
      method: 'POST',
      body: {
        refreshToken
      }
    })
  } catch {
    // 本地 Web session 必须清理；后端登出失败只影响服务端 sid 撤销是否已写入。
  }
}
