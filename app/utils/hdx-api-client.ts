import type { CreateToolRequest, RuntimeInfo, ToolRecord } from '~/types/hdx-api'
import type { WebAuthLoginRequest, WebAuthPublicSession } from '~/types/hdx-auth'
import type {
  DesktopOnlineConfig,
  DesktopOnlineConfigState,
  DesktopOnlineConnectionCheckResult
} from '~/types/desktop-online'

type TauriInternals = {
  invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
}

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: TauriInternals
}

export async function fetchAuthSession(): Promise<unknown> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return await invoke<WebAuthPublicSession>('hdx_auth_session')
  }

  return await $fetch<unknown>('/api/hdx/v1/auth/session', {
    credentials: 'same-origin'
  })
}

export async function loginWithPassword(
  input: WebAuthLoginRequest,
  csrfToken: string
): Promise<unknown> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return await invoke<WebAuthPublicSession>('hdx_auth_login', { input })
  }

  return await $fetch<unknown>('/api/hdx/v1/auth/login', {
    method: 'POST',
    body: input,
    credentials: 'same-origin',
    headers: {
      'X-HDX-CSRF': csrfToken
    }
  })
}

export async function logoutSession(csrfToken: string): Promise<unknown> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return await invoke<WebAuthPublicSession>('hdx_auth_logout')
  }

  return await $fetch<unknown>('/api/hdx/v1/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'X-HDX-CSRF': csrfToken
    }
  })
}

export async function fetchRuntimeInfo(): Promise<unknown> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return await invoke<RuntimeInfo>('hdx_runtime_info')
  }

  return await $fetch<unknown>('/api/hdx/v1/runtime')
}

export async function fetchTools(): Promise<unknown> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return await invoke<ToolRecord[]>('hdx_tools_list')
  }

  return await $fetch<unknown>('/api/hdx/v1/tools')
}

export async function createTool(input: CreateToolRequest): Promise<unknown> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return await invoke<ToolRecord>('hdx_tools_create', { input })
  }

  return await $fetch<unknown>('/api/hdx/v1/tools', {
    method: 'POST',
    body: input
  })
}

export async function fetchDesktopOnlineConfig(): Promise<unknown> {
  const invoke = getTauriInvoke()

  if (!invoke) {
    return null
  }

  return await invoke<DesktopOnlineConfigState>('hdx_online_config_get')
}

export async function saveDesktopOnlineConfig(input: DesktopOnlineConfig): Promise<unknown> {
  const invoke = requireTauriInvoke()

  return await invoke<DesktopOnlineConfigState>('hdx_online_config_save', { input })
}

export async function checkDesktopOnlineConnection(input: DesktopOnlineConfig): Promise<unknown> {
  const invoke = requireTauriInvoke()

  return await invoke<DesktopOnlineConnectionCheckResult>('hdx_online_connection_check', { input })
}

function getTauriInvoke() {
  if (!import.meta.client || typeof window === 'undefined') {
    return null
  }

  const tauri = (window as TauriWindow).__TAURI_INTERNALS__

  if (typeof tauri?.invoke !== 'function') {
    return null
  }

  return tauri.invoke.bind(tauri)
}

function requireTauriInvoke() {
  const invoke = getTauriInvoke()

  if (!invoke) {
    throw new Error('当前环境不是 HDX Desktop。')
  }

  return invoke
}
