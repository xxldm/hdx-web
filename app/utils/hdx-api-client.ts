import type { CreateToolRequest, RuntimeInfo, ToolRecord } from '~/types/hdx-api'
import { runtimeInfoSchema, toolRecordSchema, toolRecordsSchema } from '~/types/hdx-api'
import type { WebAuthLoginRequest, WebAuthPublicSession } from '~/types/hdx-auth'
import { webAuthPublicSessionSchema } from '~/types/hdx-auth'
import type {
  DesktopOnlineConfig,
  DesktopOnlineConfigState,
  DesktopOnlineConnectionCheckResult
} from '~/types/desktop-online'
import {
  desktopOnlineConfigStateSchema,
  desktopOnlineConnectionCheckResultSchema
} from '~/types/desktop-online'

type TauriInternals = {
  invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
}

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: TauriInternals
}

export async function fetchAuthSession(): Promise<WebAuthPublicSession> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(webAuthPublicSessionSchema, await invoke<unknown>('hdx_auth_session'))
  }

  return parseApiResponse(webAuthPublicSessionSchema, await $fetch<unknown>('/api/hdx/v1/auth/session', {
    credentials: 'same-origin'
  }))
}

export async function loginWithPassword(
  input: WebAuthLoginRequest,
  csrfToken: string
): Promise<WebAuthPublicSession> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(webAuthPublicSessionSchema, await invoke<unknown>('hdx_auth_login', { input }))
  }

  return parseApiResponse(webAuthPublicSessionSchema, await $fetch<unknown>('/api/hdx/v1/auth/login', {
    method: 'POST',
    body: input,
    credentials: 'same-origin',
    headers: {
      'X-HDX-CSRF': csrfToken
    }
  }))
}

export async function logoutSession(csrfToken: string): Promise<WebAuthPublicSession> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(webAuthPublicSessionSchema, await invoke<unknown>('hdx_auth_logout'))
  }

  return parseApiResponse(webAuthPublicSessionSchema, await $fetch<unknown>('/api/hdx/v1/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'X-HDX-CSRF': csrfToken
    }
  }))
}

export async function fetchRuntimeInfo(): Promise<RuntimeInfo> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(runtimeInfoSchema, await invoke<unknown>('hdx_runtime_info'))
  }

  return parseApiResponse(runtimeInfoSchema, await $fetch<unknown>('/api/hdx/v1/runtime'))
}

export async function fetchTools(): Promise<ToolRecord[]> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(toolRecordsSchema, await invoke<unknown>('hdx_tools_list'))
  }

  return parseApiResponse(toolRecordsSchema, await $fetch<unknown>('/api/hdx/v1/tools'))
}

export async function createTool(input: CreateToolRequest): Promise<ToolRecord> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(toolRecordSchema, await invoke<unknown>('hdx_tools_create', { input }))
  }

  return parseApiResponse(toolRecordSchema, await $fetch<unknown>('/api/hdx/v1/tools', {
    method: 'POST',
    body: input
  }))
}

export async function fetchDesktopOnlineConfig(): Promise<DesktopOnlineConfigState | null> {
  const invoke = getTauriInvoke()

  if (!invoke) {
    return null
  }

  return parseApiResponse(desktopOnlineConfigStateSchema, await invoke<unknown>('hdx_online_config_get'))
}

export async function saveDesktopOnlineConfig(input: DesktopOnlineConfig): Promise<DesktopOnlineConfigState> {
  const invoke = requireTauriInvoke()

  return parseApiResponse(desktopOnlineConfigStateSchema, await invoke<unknown>('hdx_online_config_save', { input }))
}

export async function checkDesktopOnlineConnection(input: DesktopOnlineConfig): Promise<DesktopOnlineConnectionCheckResult> {
  const invoke = requireTauriInvoke()

  return parseApiResponse(
    desktopOnlineConnectionCheckResultSchema,
    await invoke<unknown>('hdx_online_connection_check', { input })
  )
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

function parseApiResponse<T>(schema: { parse: (value: unknown) => T }, value: unknown): T {
  return schema.parse(value)
}
