import type { CreateToolRequest, RuntimeInfo, TimerPreferenceRecord, TimerPreferenceSaveRequest, ToolRecord, UserPreferenceRecord, UserPreferenceSaveRequest, WorkbenchLayoutRecord } from '~/types/hdx-api'
import { runtimeInfoSchema, timerPreferenceSchema, toolRecordSchema, toolRecordsSchema, userPreferenceSchema, workbenchLayoutSchema } from '~/types/hdx-api'
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

type HdxApiFetch = typeof $fetch
type HdxApiFetchOptions = Parameters<typeof $fetch>[1]

export async function fetchAuthSession(): Promise<WebAuthPublicSession> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(webAuthPublicSessionSchema, await invoke<unknown>('hdx_auth_session'))
  }

  return parseApiResponse(webAuthPublicSessionSchema, await fetchHdxApi<unknown>('/auth/session'))
}

export async function loginWithPassword(
  input: WebAuthLoginRequest,
  csrfToken: string
): Promise<WebAuthPublicSession> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(webAuthPublicSessionSchema, await invoke<unknown>('hdx_auth_login', { input }))
  }

  return parseApiResponse(webAuthPublicSessionSchema, await fetchHdxApi<unknown>('/auth/login', {
    method: 'POST',
    body: input,
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

  return parseApiResponse(webAuthPublicSessionSchema, await fetchHdxApi<unknown>('/auth/logout', {
    method: 'POST',
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

  return parseApiResponse(runtimeInfoSchema, await fetchHdxApi<unknown>('/runtime'))
}

export async function fetchTools(): Promise<ToolRecord[]> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(toolRecordsSchema, await invoke<unknown>('hdx_tools_list'))
  }

  return parseApiResponse(toolRecordsSchema, await fetchHdxApi<unknown>('/tools'))
}

export async function createTool(input: CreateToolRequest): Promise<ToolRecord> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(toolRecordSchema, await invoke<unknown>('hdx_tools_create', { input }))
  }

  return parseApiResponse(toolRecordSchema, await fetchHdxApi<unknown>('/tools', {
    method: 'POST',
    body: input
  }))
}

export async function fetchWorkbenchLayout(): Promise<WorkbenchLayoutRecord> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(workbenchLayoutSchema, await invoke<unknown>('hdx_workbench_layout_get'))
  }

  return parseApiResponse(workbenchLayoutSchema, await fetchHdxApi<unknown>('/workbench/layout'))
}

export async function saveWorkbenchLayout(input: WorkbenchLayoutRecord): Promise<WorkbenchLayoutRecord> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(workbenchLayoutSchema, await invoke<unknown>('hdx_workbench_layout_save', { input }))
  }

  return parseApiResponse(workbenchLayoutSchema, await fetchHdxApi<unknown>('/workbench/layout', {
    method: 'PUT',
    body: input
  }))
}

export async function fetchTimerPreferences(): Promise<TimerPreferenceRecord> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(timerPreferenceSchema, await invoke<unknown>('hdx_timer_preferences_get'))
  }

  return parseApiResponse(timerPreferenceSchema, await fetchHdxApi<unknown>('/timer/preferences'))
}

export async function saveTimerPreferences(input: TimerPreferenceSaveRequest): Promise<TimerPreferenceRecord> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(timerPreferenceSchema, await invoke<unknown>('hdx_timer_preferences_save', { input }))
  }

  return parseApiResponse(timerPreferenceSchema, await fetchHdxApi<unknown>('/timer/preferences', {
    method: 'PUT',
    body: input
  }))
}

export async function fetchUserPreferences(): Promise<UserPreferenceRecord> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(userPreferenceSchema, await invoke<unknown>('hdx_user_preferences_get'))
  }

  return parseApiResponse(userPreferenceSchema, await fetchHdxApi<unknown>('/user/preferences'))
}

export async function saveUserPreferences(input: UserPreferenceSaveRequest): Promise<UserPreferenceRecord> {
  const invoke = getTauriInvoke()

  if (invoke) {
    return parseApiResponse(userPreferenceSchema, await invoke<unknown>('hdx_user_preferences_save', { input }))
  }

  return parseApiResponse(userPreferenceSchema, await fetchHdxApi<unknown>('/user/preferences', {
    method: 'PUT',
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

function fetchHdxApi<T>(path: string, options?: HdxApiFetchOptions) {
  const client = getHdxApiClient()

  return client.fetch<T>(`${client.basePath}${path}`, {
    credentials: 'same-origin',
    ...options
  })
}

function getHdxApiClient(): { fetch: HdxApiFetch, basePath: string } {
  const nuxtApp = tryUseNuxtApp()

  if (nuxtApp?.$hdxApi) {
    return {
      fetch: nuxtApp.$hdxApi,
      basePath: ''
    }
  }

  return {
    fetch: $fetch,
    basePath: '/api/hdx/v1'
  }
}

function tryUseNuxtApp(): { $hdxApi?: HdxApiFetch } | null {
  if (typeof useNuxtApp !== 'function') {
    return null
  }

  try {
    return useNuxtApp() as { $hdxApi?: HdxApiFetch }
  } catch {
    return null
  }
}

function parseApiResponse<T>(schema: { parse: (value: unknown) => T }, value: unknown): T {
  return schema.parse(value)
}
