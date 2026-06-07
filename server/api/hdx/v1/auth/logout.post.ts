import { z } from 'zod'
import { createBoundaryH3Error } from '~~/app/utils/api-error'
import { assertCsrfToken, getOrCreateCsrfToken } from '~~/server/utils/auth-csrf'
import {
  clearAuthSession,
  getPublicAuthSession,
  isAllInOneRequest,
  readAuthSessionData,
  toPublicAuthSession
} from '~~/server/utils/auth-session'
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

    if (!isAllInOneRequest(event)) {
      return toPublicAuthSession(null, getOrCreateCsrfToken(event))
    }

    return await getPublicAuthSession(event)
  } catch (error) {
    throw createBoundaryH3Error(error)
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
