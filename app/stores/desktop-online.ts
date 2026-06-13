import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import {
  desktopOnlineConfigSchema,
  desktopOnlineConfigStateSchema,
  desktopOnlineConnectionCheckResultSchema,
  type DesktopOnlineConfigState,
  type DesktopOnlineConnectionCheckResult
} from '~/types/desktop-online'
import {
  checkDesktopOnlineConnection,
  fetchDesktopOnlineConfig,
  saveDesktopOnlineConfig
} from '~/utils/hdx-api-client'

export const useDesktopOnlineStore = defineStore('desktopOnline', () => {
  const available = ref(false)
  const configured = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const checking = ref(false)
  const errorMessage = ref<string | null>(null)
  const statusMessage = ref<string | null>(null)
  const checkResult = ref<DesktopOnlineConnectionCheckResult | null>(null)
  const form = reactive({
    authBaseUrl: '',
    gatewayBaseUrl: '',
    requestTimeoutSeconds: 10
  })

  async function loadConfig() {
    loading.value = true
    errorMessage.value = null

    try {
      const response = await fetchDesktopOnlineConfig()
      if (response === null) {
        available.value = false
        configured.value = false
        statusMessage.value = null
        return null
      }

      const state = desktopOnlineConfigStateSchema.parse(response)
      applyState(state)
      return state
    } catch (error) {
      available.value = false
      configured.value = false
      errorMessage.value = formatDesktopOnlineError(error)
      return null
    } finally {
      loading.value = false
    }
  }

  async function saveConfig() {
    saving.value = true
    errorMessage.value = null

    try {
      const payload = parseForm()
      const response = await saveDesktopOnlineConfig(payload)
      const state = desktopOnlineConfigStateSchema.parse(response)
      applyState(state)
      statusMessage.value = state.message
      return state
    } catch (error) {
      errorMessage.value = formatDesktopOnlineError(error)
      throw error
    } finally {
      saving.value = false
    }
  }

  async function checkConnection() {
    checking.value = true
    errorMessage.value = null
    checkResult.value = null

    try {
      const payload = parseForm()
      const response = await checkDesktopOnlineConnection(payload)
      const result = desktopOnlineConnectionCheckResultSchema.parse(response)
      checkResult.value = result
      statusMessage.value = result.ok ? 'Desktop Online 远端连接正常。' : 'Desktop Online 远端连接检查未通过。'
      return result
    } catch (error) {
      errorMessage.value = formatDesktopOnlineError(error)
      throw error
    } finally {
      checking.value = false
    }
  }

  function parseForm() {
    const parsed = desktopOnlineConfigSchema.safeParse({
      authBaseUrl: form.authBaseUrl,
      gatewayBaseUrl: form.gatewayBaseUrl,
      requestTimeoutSeconds: Number(form.requestTimeoutSeconds)
    })

    if (!parsed.success) {
      throw new Error('远端服务配置无效，请检查 URL 和超时秒数。')
    }

    return parsed.data
  }

  function applyState(state: DesktopOnlineConfigState) {
    available.value = state.available
    configured.value = state.configured
    statusMessage.value = state.message

    if (state.config) {
      form.authBaseUrl = state.config.authBaseUrl
      form.gatewayBaseUrl = state.config.gatewayBaseUrl
      form.requestTimeoutSeconds = state.config.requestTimeoutSeconds
    }
  }

  return {
    available,
    configured,
    loading,
    saving,
    checking,
    errorMessage,
    statusMessage,
    checkResult,
    form,
    loadConfig,
    saveConfig,
    checkConnection
  }
})

function formatDesktopOnlineError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
