import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { WebAuthLoginRequest, WebAuthPublicSession } from '~/types/hdx-auth'
import { webAuthLoginRequestSchema, webAuthPublicSessionSchema } from '~/types/hdx-auth'
import { fetchAuthSession, loginWithPassword, logoutSession } from '~/utils/hdx-api-client'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<WebAuthPublicSession | null>(null)
  const loading = ref(false)
  const loginLoading = ref(false)
  const errorKey = ref<string | null>(null)
  const initialized = ref(false)

  const authenticated = computed(() => session.value?.authenticated === true)
  const displayName = computed(() => session.value?.user?.displayName ?? '用户')
  const csrfToken = computed(() => session.value?.csrfToken ?? '')
  const isLocalAdmin = computed(() => session.value?.actorType === 'LOCAL_ADMIN')

  async function loadSession() {
    loading.value = true
    errorKey.value = null

    try {
      const response = await fetchAuthSession()
      session.value = webAuthPublicSessionSchema.parse(response)
      initialized.value = true
      return session.value
    } catch {
      session.value = null
      initialized.value = true
      errorKey.value = 'auth.sessionFailed'
      return null
    } finally {
      loading.value = false
    }
  }

  async function login(input: WebAuthLoginRequest) {
    const payload = webAuthLoginRequestSchema.parse(input)
    loginLoading.value = true
    errorKey.value = null

    try {
      const currentSession = await loadSession()

      if (!currentSession?.csrfToken) {
        errorKey.value = 'auth.sessionFailed'
        throw new Error('登录状态暂时无法确认。')
      }

      const response = await loginWithPassword(payload, currentSession.csrfToken)
      session.value = webAuthPublicSessionSchema.parse(response)
      initialized.value = true
      return session.value
    } catch (error) {
      errorKey.value = resolveAuthErrorKey(error, errorKey.value ?? 'auth.loginFailed')
      throw new Error('登录失败。')
    } finally {
      loginLoading.value = false
    }
  }

  async function logout() {
    const currentCsrfToken = csrfToken.value
    loading.value = true
    errorKey.value = null

    try {
      const response = await logoutSession(currentCsrfToken)
      session.value = webAuthPublicSessionSchema.parse(response)
      initialized.value = true
      return session.value
    } catch {
      session.value = null
      initialized.value = true
      errorKey.value = 'auth.logoutFailed'
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    session,
    loading,
    loginLoading,
    errorKey,
    initialized,
    authenticated,
    displayName,
    csrfToken,
    isLocalAdmin,
    loadSession,
    login,
    logout
  }
})

function resolveAuthErrorKey(error: unknown, fallback: string) {
  const upstreamCode = extractUpstreamCode(error)

  if (upstreamCode && upstreamCode in authErrorKeyByUpstreamCode) {
    return authErrorKeyByUpstreamCode[upstreamCode as keyof typeof authErrorKeyByUpstreamCode]
  }

  if (extractFetchStatus(error) === 403) {
    return 'auth.csrfFailed'
  }

  return fallback
}

const authErrorKeyByUpstreamCode = {
  AUTH_INVALID_CREDENTIALS: 'auth.errors.AUTH_INVALID_CREDENTIALS',
  AUTH_LOGIN_COOLDOWN: 'auth.errors.AUTH_LOGIN_COOLDOWN',
  AUTH_REQUEST_INVALID: 'auth.errors.AUTH_REQUEST_INVALID',
  AUTH_REVOCATION_UNAVAILABLE: 'auth.errors.AUTH_REVOCATION_UNAVAILABLE'
} as const

function extractUpstreamCode(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null
  }

  const record = error as {
    data?: {
      upstreamCode?: unknown
      code?: unknown
      data?: {
        upstreamCode?: unknown
        code?: unknown
      }
    }
  }

  if (typeof record.data?.upstreamCode === 'string') {
    return record.data.upstreamCode
  }

  if (typeof record.data?.data?.upstreamCode === 'string') {
    return record.data.data.upstreamCode
  }

  if (typeof record.data?.code === 'string' && record.data.code.startsWith('AUTH_')) {
    return record.data.code
  }

  if (typeof record.data?.data?.code === 'string' && record.data.data.code.startsWith('AUTH_')) {
    return record.data.data.code
  }

  return null
}

function extractFetchStatus(error: unknown) {
  if (!error || typeof error !== 'object') {
    return null
  }

  const record = error as {
    status?: unknown
    statusCode?: unknown
    data?: {
      status?: unknown
      statusCode?: unknown
    }
  }

  if (typeof record.statusCode === 'number') {
    return record.statusCode
  }

  if (typeof record.status === 'number') {
    return record.status
  }

  if (typeof record.data?.statusCode === 'number') {
    return record.data.statusCode
  }

  if (typeof record.data?.status === 'number') {
    return record.data.status
  }

  return null
}
