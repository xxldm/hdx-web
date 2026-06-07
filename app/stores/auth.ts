import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { WebAuthLoginRequest, WebAuthPublicSession } from '~/types/hdx-auth'
import { webAuthLoginRequestSchema, webAuthPublicSessionSchema } from '~/types/hdx-auth'

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
      const response = await $fetch<unknown>('/api/hdx/v1/auth/session')
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
      const currentSession = session.value ?? await loadSession()
      const response = await $fetch<unknown>('/api/hdx/v1/auth/login', {
        method: 'POST',
        body: payload,
        headers: {
          'X-HDX-CSRF': currentSession?.csrfToken ?? csrfToken.value
        }
      })
      session.value = webAuthPublicSessionSchema.parse(response)
      initialized.value = true
      return session.value
    } catch {
      errorKey.value = 'auth.loginFailed'
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
      const response = await $fetch<unknown>('/api/hdx/v1/auth/logout', {
        method: 'POST',
        headers: {
          'X-HDX-CSRF': currentCsrfToken
        }
      })
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
