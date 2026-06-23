import { useStorage, useTimestamp } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useAuthStore } from './auth'
import { z } from 'zod'
import type { TimerPreferenceRecord, TimerPreferenceSaveRequest } from '~/types/hdx-api'
import { timerPreferenceSchema } from '~/types/hdx-api'
import { extractTimerPreferenceConflict, isAuthRequiredApiError } from '~/utils/api-error'
import { fetchTimerPreferences, saveTimerPreferences } from '~/utils/hdx-api-client'

export const workbenchTimerStorageKey = 'hdx:web:workbench-timer:v1'
export const defaultWorkbenchTimerPresetId = 'default-10-minutes'
export const defaultWorkbenchTimerDurationSeconds = 10 * 60
export const minWorkbenchTimerDurationSeconds = 1
export const maxWorkbenchTimerDurationSeconds = 24 * 60 * 60

export type WorkbenchTimerStatus = 'idle' | 'running' | 'paused' | 'finished'
export type WorkbenchTimerPersistenceResult = 'success' | 'failed' | 'auth-expired' | 'conflict'

export interface WorkbenchTimerPresetDefinition {
  id: string
  durationSeconds: number
  createdAt: number
}

export interface WorkbenchTimerPresetRuntime {
  remainingSeconds: number
  endsAt: number | null
  alarmedAt: number | null
}

export interface WorkbenchTimerPreset extends WorkbenchTimerPresetDefinition, WorkbenchTimerPresetRuntime {
}

interface LegacyWorkbenchTimerPreference {
  version: 1
  durationSeconds: number
  remainingSeconds: number
  endsAt: number | null
}

interface SingleTimerWorkbenchTimerPreference {
  version: 2
  presets: unknown[]
  selectedPresetId: string
  remainingSeconds: number
  endsAt: number | null
}

export interface WorkbenchTimerPreference {
  schemaVersion: 1
  version: number
  presets: WorkbenchTimerPresetDefinition[]
}

export interface WorkbenchTimerRuntimePreference {
  version: 4
  runtimes: Record<string, WorkbenchTimerPresetRuntime>
}

export interface WorkbenchTimerConflict {
  message: string
  baseVersion: number
  currentVersion: number
  updatedAt: string
  updatedByUserId: string
  serverPreference: WorkbenchTimerPreference
}

const baseWorkbenchTimerPresetSchema = z.object({
  id: z.string().trim().min(1),
  durationSeconds: z.number().int().min(minWorkbenchTimerDurationSeconds).max(maxWorkbenchTimerDurationSeconds),
  createdAt: z.number().int().nonnegative()
})

const legacyWorkbenchTimerPresetSchema = baseWorkbenchTimerPresetSchema.extend({
  remainingSeconds: z.number().int().min(0).max(maxWorkbenchTimerDurationSeconds).optional(),
  endsAt: z.number().int().positive().nullable().optional(),
  alarmedAt: z.number().int().positive().nullable().optional()
})

const workbenchTimerRuntimeSchema = z.object({
  remainingSeconds: z.number().int().min(0).max(maxWorkbenchTimerDurationSeconds),
  endsAt: z.number().int().positive().nullable(),
  alarmedAt: z.number().int().positive().nullable()
})

const workbenchTimerRuntimePreferenceSchema = z.object({
  version: z.literal(4),
  runtimes: z.record(z.string().min(1), workbenchTimerRuntimeSchema)
})

const legacyWorkbenchTimerPreferenceSchema = z.object({
  version: z.literal(1),
  durationSeconds: z.number().int().min(minWorkbenchTimerDurationSeconds).max(maxWorkbenchTimerDurationSeconds),
  remainingSeconds: z.number().int().min(0).max(maxWorkbenchTimerDurationSeconds),
  endsAt: z.number().int().positive().nullable().default(null)
})

const singleTimerWorkbenchTimerPreferenceSchema = z.object({
  version: z.literal(2),
  presets: z.array(z.unknown()),
  selectedPresetId: z.string().trim().min(1),
  remainingSeconds: z.number().int().min(0).max(maxWorkbenchTimerDurationSeconds),
  endsAt: z.number().int().positive().nullable().default(null)
})

const legacyPresetListWorkbenchTimerPreferenceSchema = z.object({
  version: z.literal(3),
  presets: z.array(z.unknown())
})

export const defaultWorkbenchTimerPreset: WorkbenchTimerPreset = {
  id: defaultWorkbenchTimerPresetId,
  durationSeconds: defaultWorkbenchTimerDurationSeconds,
  createdAt: 0,
  remainingSeconds: defaultWorkbenchTimerDurationSeconds,
  endsAt: null,
  alarmedAt: null
}

export const defaultWorkbenchTimerPreference: WorkbenchTimerPreference = {
  schemaVersion: 1,
  version: 0,
  presets: [
    {
      id: defaultWorkbenchTimerPresetId,
      durationSeconds: defaultWorkbenchTimerDurationSeconds,
      createdAt: 0
    }
  ]
}

export const emptyWorkbenchTimerPreference: WorkbenchTimerPreference = {
  schemaVersion: 1,
  version: 0,
  presets: []
}

export const defaultWorkbenchTimerRuntimePreference: WorkbenchTimerRuntimePreference = {
  version: 4,
  runtimes: {}
}

export const useWorkbenchTimerStore = defineStore('workbench-timer', () => {
  const remotePreference = ref<WorkbenchTimerPreference | null>(null)
  const runtimePreference = useStorage<WorkbenchTimerRuntimePreference>(
    workbenchTimerStorageKey,
    cloneRuntimePreference(defaultWorkbenchTimerRuntimePreference),
    undefined,
    {
      deep: true,
      mergeDefaults: false,
      serializer: {
        read: readStoredWorkbenchTimerRuntimePreference,
        write: value => JSON.stringify(normalizeWorkbenchTimerRuntimePreference(value))
      }
    }
  )
  const timestamp = useTimestamp({ interval: 1000 })
  const initialized = shallowRef(false)
  const loading = shallowRef(false)
  const saving = shallowRef(false)
  const errorKey = shallowRef<string | null>(null)
  const timerConflict = ref<WorkbenchTimerConflict | null>(null)

  const preference = computed(() => remotePreference.value ?? emptyWorkbenchTimerPreference)
  const presets = computed(() => preference.value.presets.map(preset => mergePresetRuntime(preset, runtimePreference.value.runtimes[preset.id])))
  const dueAlarmPresets = computed(() => presets.value.filter(preset => isPresetAlarmDue(preset, timestamp.value)))
  const runningPresetCount = computed(() => presets.value.filter(preset => getPresetStatus(preset, timestamp.value) === 'running').length)
  const hasRunningPresets = computed(() => runningPresetCount.value > 0)
  const unavailable = computed(() => initialized.value && !remotePreference.value)

  async function ensurePreferencesLoaded() {
    if (initialized.value || loading.value) {
      return remotePreference.value ? 'success' satisfies WorkbenchTimerPersistenceResult : 'failed' satisfies WorkbenchTimerPersistenceResult
    }

    return await loadPreferences()
  }

  async function loadPreferences() {
    const auth = useAuthStore()

    loading.value = true
    errorKey.value = null
    timerConflict.value = null

    try {
      remotePreference.value = normalizeWorkbenchTimerPreference(await fetchTimerPreferences())
      return 'success' satisfies WorkbenchTimerPersistenceResult
    } catch (error) {
      remotePreference.value = null

      if (isAuthRequiredApiError(error)) {
        auth.markSessionExpired()
        return 'auth-expired' satisfies WorkbenchTimerPersistenceResult
      }

      errorKey.value = 'workbench.timer.loadFailed'
      return 'failed' satisfies WorkbenchTimerPersistenceResult
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  function getPresetById(id: string) {
    return presets.value.find(preset => preset.id === id) ?? null
  }

  function getPresetStatusById(id: string) {
    const preset = getPresetById(id)

    return preset ? getPresetStatus(preset, timestamp.value) : 'idle'
  }

  function getPresetRemainingSecondsById(id: string) {
    const preset = getPresetById(id)

    return preset ? getPresetRemainingSeconds(preset, timestamp.value) : 0
  }

  function getPresetElapsedSecondsById(id: string) {
    const preset = getPresetById(id)

    if (!preset) {
      return 0
    }

    return Math.max(preset.durationSeconds - getPresetRemainingSeconds(preset, timestamp.value), 0)
  }

  function getPresetProgressPercentById(id: string) {
    const preset = getPresetById(id)

    if (!preset || preset.durationSeconds <= 0) {
      return 0
    }

    return Math.round((getPresetElapsedSecondsById(id) / preset.durationSeconds) * 100)
  }

  function getPresetRemainingLabelById(id: string) {
    return formatWorkbenchTimerSeconds(getPresetRemainingSecondsById(id))
  }

  function canRemovePreset(id: string) {
    const preset = getPresetById(id)

    return presets.value.length > 1
      && Boolean(preset)
      && getPresetStatusById(id) !== 'running'
  }

  async function addPresetSeconds(seconds: number | null | undefined) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
      return null
    }

    const loaded = await ensurePreferencesLoaded()

    if (loaded !== 'success' || !remotePreference.value) {
      return null
    }

    const durationSeconds = normalizeDurationSeconds(seconds)
    const existingPreset = presets.value.find(preset => preset.durationSeconds === durationSeconds)

    if (existingPreset) {
      return existingPreset
    }

    const preset = createPresetDefinition(durationSeconds, createPresetId(durationSeconds), Date.now())
    const nextPreference = normalizeInternalPreference({
      ...remotePreference.value,
      presets: [
        ...remotePreference.value.presets,
        preset
      ]
    })
    const result = await savePreference(nextPreference)

    return result === 'success' ? getPresetById(preset.id) : null
  }

  async function addPresetMinutes(minutes: number | null | undefined) {
    return await addPresetSeconds(typeof minutes === 'number' ? minutes * 60 : minutes)
  }

  async function removePreset(id: string) {
    if (!canRemovePreset(id) || !remotePreference.value) {
      return false
    }

    const nextPresets = remotePreference.value.presets.filter(preset => preset.id !== id)

    if (nextPresets.length === remotePreference.value.presets.length || nextPresets.length === 0) {
      return false
    }

    const result = await savePreference(normalizeInternalPreference({
      ...remotePreference.value,
      presets: nextPresets
    }))

    if (result !== 'success') {
      return false
    }

    removePresetRuntime(id)
    return true
  }

  function startPreset(id: string) {
    const preset = getPresetById(id)

    if (!preset) {
      return false
    }

    const secondsToRun = getPresetRemainingSeconds(preset, timestamp.value) > 0
      ? getPresetRemainingSeconds(preset, timestamp.value)
      : preset.durationSeconds

    return updatePresetRuntime(id, preset.durationSeconds, () => ({
      remainingSeconds: secondsToRun,
      endsAt: Date.now() + secondsToRun * 1000,
      alarmedAt: null
    }))
  }

  function pausePreset(id: string) {
    const preset = getPresetById(id)

    if (!preset || getPresetStatusById(id) !== 'running') {
      return false
    }

    return updatePresetRuntime(id, preset.durationSeconds, () => ({
      remainingSeconds: getPresetRemainingSeconds(preset, timestamp.value),
      endsAt: null,
      alarmedAt: preset.alarmedAt
    }))
  }

  function resetPreset(id: string) {
    const preset = getPresetById(id)

    if (!preset) {
      return false
    }

    return updatePresetRuntime(id, preset.durationSeconds, () => createDefaultRuntime(preset.durationSeconds))
  }

  function togglePreset(id: string) {
    return getPresetStatusById(id) === 'running'
      ? pausePreset(id)
      : startPreset(id)
  }

  function acknowledgePresetAlarm(id: string, endsAt: number) {
    const preset = getPresetById(id)

    if (!preset || preset.endsAt !== endsAt) {
      return false
    }

    return updatePresetRuntime(id, preset.durationSeconds, () => ({
      remainingSeconds: getPresetRemainingSeconds(preset, timestamp.value),
      endsAt: preset.endsAt,
      alarmedAt: endsAt
    }))
  }

  function updatePresetRuntime(
    id: string,
    durationSeconds: number,
    updater: (runtime: WorkbenchTimerPresetRuntime) => WorkbenchTimerPresetRuntime
  ) {
    const currentRuntime = runtimePreference.value.runtimes[id] ?? createDefaultRuntime(durationSeconds)
    const nextRuntime = normalizeRuntime(updater(currentRuntime), durationSeconds)

    runtimePreference.value = normalizeWorkbenchTimerRuntimePreference({
      version: 4,
      runtimes: {
        ...runtimePreference.value.runtimes,
        [id]: nextRuntime
      }
    })

    return true
  }

  function removePresetRuntime(id: string) {
    runtimePreference.value = normalizeWorkbenchTimerRuntimePreference({
      version: 4,
      runtimes: Object.fromEntries(Object.entries(runtimePreference.value.runtimes)
        .filter(([runtimeId]) => runtimeId !== id))
    })
  }

  async function savePreference(nextPreference: WorkbenchTimerPreference) {
    const auth = useAuthStore()

    saving.value = true
    errorKey.value = null
    timerConflict.value = null

    try {
      remotePreference.value = normalizeWorkbenchTimerPreference(await saveTimerPreferences(toTimerPreferenceSaveRequest(nextPreference)))
      return 'success' satisfies WorkbenchTimerPersistenceResult
    } catch (error) {
      if (isAuthRequiredApiError(error)) {
        remotePreference.value = null
        auth.markSessionExpired()
        return 'auth-expired' satisfies WorkbenchTimerPersistenceResult
      }

      const conflict = extractTimerPreferenceConflict(error)

      if (conflict) {
        timerConflict.value = {
          message: conflict.message,
          baseVersion: conflict.baseVersion,
          currentVersion: conflict.currentVersion,
          updatedAt: conflict.updatedAt,
          updatedByUserId: conflict.updatedByUserId,
          serverPreference: normalizeWorkbenchTimerPreference(conflict.serverPreference)
        }
        remotePreference.value = clonePreference(timerConflict.value.serverPreference)
        errorKey.value = 'workbench.timer.conflict'
        return 'conflict' satisfies WorkbenchTimerPersistenceResult
      }

      errorKey.value = 'workbench.timer.saveFailed'
      return 'failed' satisfies WorkbenchTimerPersistenceResult
    } finally {
      saving.value = false
    }
  }

  function resetState() {
    remotePreference.value = null
    initialized.value = false
    loading.value = false
    saving.value = false
    errorKey.value = null
    timerConflict.value = null
  }

  return {
    dueAlarmPresets,
    errorKey,
    hasRunningPresets,
    initialized,
    loading,
    preference,
    presets,
    runningPresetCount,
    runtimePreference,
    saving,
    timerConflict,
    unavailable,
    acknowledgePresetAlarm,
    addPresetMinutes,
    addPresetSeconds,
    canRemovePreset,
    ensurePreferencesLoaded,
    getPresetById,
    getPresetElapsedSecondsById,
    getPresetProgressPercentById,
    getPresetRemainingLabelById,
    getPresetRemainingSecondsById,
    getPresetStatusById,
    loadPreferences,
    pausePreset,
    removePreset,
    resetPreset,
    resetState,
    startPreset,
    togglePreset
  }
})

export function readStoredWorkbenchTimerRuntimePreference(value: string): WorkbenchTimerRuntimePreference {
  if (!value) {
    return cloneRuntimePreference(defaultWorkbenchTimerRuntimePreference)
  }

  try {
    return normalizeWorkbenchTimerRuntimePreference(JSON.parse(value))
  } catch {
    return cloneRuntimePreference(defaultWorkbenchTimerRuntimePreference)
  }
}

export function normalizeWorkbenchTimerRuntimePreference(value: unknown): WorkbenchTimerRuntimePreference {
  const parsed = workbenchTimerRuntimePreferenceSchema.safeParse(value)

  if (parsed.success) {
    return {
      version: 4,
      runtimes: normalizeRuntimeMap(parsed.data.runtimes)
    }
  }

  const presetListParsed = legacyPresetListWorkbenchTimerPreferenceSchema.safeParse(value)

  if (presetListParsed.success) {
    return migrateLegacyPresetListPreference(presetListParsed.data)
  }

  const singleTimerParsed = singleTimerWorkbenchTimerPreferenceSchema.safeParse(value)

  if (singleTimerParsed.success) {
    return migrateSingleTimerPreference(singleTimerParsed.data)
  }

  const legacyParsed = legacyWorkbenchTimerPreferenceSchema.safeParse(value)

  if (legacyParsed.success) {
    return migrateLegacyPreference(legacyParsed.data)
  }

  return cloneRuntimePreference(defaultWorkbenchTimerRuntimePreference)
}

export function normalizeWorkbenchTimerPreference(value: unknown): WorkbenchTimerPreference {
  const parsed = timerPreferenceSchema.safeParse(value)

  if (!parsed.success) {
    return clonePreference(defaultWorkbenchTimerPreference)
  }

  return normalizeTimerPreferenceRecord(parsed.data)
}

export function getPresetRemainingSeconds(preset: WorkbenchTimerPreset, timestamp: number) {
  if (preset.endsAt === null) {
    return clampInteger(preset.remainingSeconds, 0, preset.durationSeconds)
  }

  return clampInteger(Math.ceil((preset.endsAt - timestamp) / 1000), 0, preset.durationSeconds)
}

export function getPresetStatus(preset: WorkbenchTimerPreset, timestamp: number): WorkbenchTimerStatus {
  const remainingSeconds = getPresetRemainingSeconds(preset, timestamp)

  if (remainingSeconds <= 0) {
    return 'finished'
  }

  if (preset.endsAt !== null) {
    return 'running'
  }

  if (remainingSeconds < preset.durationSeconds) {
    return 'paused'
  }

  return 'idle'
}

export function formatWorkbenchTimerSeconds(totalSeconds: number) {
  const seconds = clampInteger(totalSeconds, 0, maxWorkbenchTimerDurationSeconds)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60
  const paddedSeconds = remainingSeconds.toString().padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${paddedSeconds}`
  }

  return `${minutes}:${paddedSeconds}`
}

function normalizeTimerPreferenceRecord(record: TimerPreferenceRecord): WorkbenchTimerPreference {
  return normalizeInternalPreference({
    schemaVersion: 1,
    version: record.version,
    presets: record.presets.map(preset => createPresetDefinition(
      preset.durationSeconds,
      preset.id,
      Date.parse(preset.createdAt)
    ))
  })
}

function normalizeInternalPreference(preference: WorkbenchTimerPreference): WorkbenchTimerPreference {
  const presets: WorkbenchTimerPresetDefinition[] = []
  const seenIds = new Set<string>()
  const seenDurations = new Set<number>()

  for (const preset of preference.presets) {
    if (seenIds.has(preset.id)) {
      continue
    }

    const durationSeconds = normalizeDurationSeconds(preset.durationSeconds)

    if (seenDurations.has(durationSeconds)) {
      continue
    }

    presets.push(createPresetDefinition(durationSeconds, preset.id, preset.createdAt))
    seenIds.add(preset.id)
    seenDurations.add(durationSeconds)
  }

  return {
    schemaVersion: 1,
    version: clampInteger(preference.version, 0, Number.MAX_SAFE_INTEGER),
    presets: presets.length > 0 ? presets : clonePreference(defaultWorkbenchTimerPreference).presets
  }
}

function toTimerPreferenceSaveRequest(preference: WorkbenchTimerPreference): TimerPreferenceSaveRequest {
  return {
    schemaVersion: 1,
    version: preference.version,
    presets: preference.presets.map((preset, index) => ({
      id: preset.id,
      order: index,
      durationSeconds: preset.durationSeconds
    }))
  }
}

function migrateLegacyPresetListPreference(preference: z.infer<typeof legacyPresetListWorkbenchTimerPreferenceSchema>): WorkbenchTimerRuntimePreference {
  return {
    version: 4,
    runtimes: normalizeRuntimeMap(Object.fromEntries(normalizeLegacyPresets(preference.presets).map(preset => [
      preset.id,
      pickPresetRuntime(preset)
    ])))
  }
}

function migrateSingleTimerPreference(preference: SingleTimerWorkbenchTimerPreference): WorkbenchTimerRuntimePreference {
  const presets = normalizeLegacyBasePresets(preference.presets)
  const fallbackPreset = presets[0] ?? clonePreset(defaultWorkbenchTimerPreset)
  const selectedPreset = presets.find(preset => preset.id === preference.selectedPresetId) ?? fallbackPreset

  return {
    version: 4,
    runtimes: normalizeRuntimeMap({
      [selectedPreset.id]: normalizeRuntime({
        remainingSeconds: preference.remainingSeconds,
        endsAt: preference.endsAt,
        alarmedAt: null
      }, selectedPreset.durationSeconds)
    })
  }
}

function migrateLegacyPreference(preference: LegacyWorkbenchTimerPreference): WorkbenchTimerRuntimePreference {
  const durationSeconds = normalizeDurationSeconds(preference.durationSeconds)
  const presetId = durationSeconds === defaultWorkbenchTimerDurationSeconds
    ? defaultWorkbenchTimerPresetId
    : `migrated-${durationSeconds}-seconds`

  return {
    version: 4,
    runtimes: normalizeRuntimeMap({
      [presetId]: normalizeRuntime({
        remainingSeconds: preference.remainingSeconds,
        endsAt: preference.endsAt,
        alarmedAt: null
      }, durationSeconds)
    })
  }
}

function normalizeLegacyPresets(value: unknown[]) {
  const presets: WorkbenchTimerPreset[] = []
  const seenIds = new Set<string>()

  for (const item of value) {
    const parsed = legacyWorkbenchTimerPresetSchema.safeParse(item)

    if (!parsed.success || seenIds.has(parsed.data.id)) {
      continue
    }

    const preset = normalizeLegacyPreset(parsed.data)

    presets.push(preset)
    seenIds.add(preset.id)
  }

  return presets.length > 0 ? presets : [clonePreset(defaultWorkbenchTimerPreset)]
}

function normalizeLegacyBasePresets(value: unknown[]) {
  const presets: WorkbenchTimerPreset[] = []
  const seenIds = new Set<string>()

  for (const item of value) {
    const parsed = baseWorkbenchTimerPresetSchema.safeParse(item)

    if (!parsed.success || seenIds.has(parsed.data.id)) {
      continue
    }

    const preset = mergePresetRuntime(
      createPresetDefinition(parsed.data.durationSeconds, parsed.data.id, parsed.data.createdAt),
      null
    )

    presets.push(preset)
    seenIds.add(preset.id)
  }

  return presets.length > 0 ? presets : [clonePreset(defaultWorkbenchTimerPreset)]
}

function normalizeLegacyPreset(value: z.infer<typeof legacyWorkbenchTimerPresetSchema>): WorkbenchTimerPreset {
  const definition = createPresetDefinition(value.durationSeconds, value.id, value.createdAt)

  return {
    ...definition,
    ...normalizeRuntime({
      remainingSeconds: value.remainingSeconds ?? definition.durationSeconds,
      endsAt: value.endsAt ?? null,
      alarmedAt: value.alarmedAt ?? null
    }, definition.durationSeconds)
  }
}

function mergePresetRuntime(definition: WorkbenchTimerPresetDefinition, runtime: WorkbenchTimerPresetRuntime | null | undefined): WorkbenchTimerPreset {
  return {
    ...definition,
    ...normalizeRuntime(runtime ?? createDefaultRuntime(definition.durationSeconds), definition.durationSeconds)
  }
}

function createPresetDefinition(
  durationSeconds: number,
  id = durationSeconds === defaultWorkbenchTimerDurationSeconds ? defaultWorkbenchTimerPresetId : `migrated-${durationSeconds}-seconds`,
  createdAt = 0
): WorkbenchTimerPresetDefinition {
  return {
    id,
    durationSeconds: normalizeDurationSeconds(durationSeconds),
    createdAt: clampInteger(createdAt, 0, Number.MAX_SAFE_INTEGER)
  }
}

function createDefaultRuntime(durationSeconds: number): WorkbenchTimerPresetRuntime {
  const normalizedDurationSeconds = normalizeDurationSeconds(durationSeconds)

  return {
    remainingSeconds: normalizedDurationSeconds,
    endsAt: null,
    alarmedAt: null
  }
}

function normalizeRuntime(value: WorkbenchTimerPresetRuntime, durationSeconds: number): WorkbenchTimerPresetRuntime {
  const normalizedDurationSeconds = normalizeDurationSeconds(durationSeconds)
  const endsAt = value.endsAt ?? null

  return {
    remainingSeconds: clampInteger(value.remainingSeconds, 0, normalizedDurationSeconds),
    endsAt,
    alarmedAt: endsAt === null ? null : value.alarmedAt ?? null
  }
}

function normalizeRuntimeMap(value: Record<string, WorkbenchTimerPresetRuntime>) {
  const runtimes: Record<string, WorkbenchTimerPresetRuntime> = {}

  for (const [id, runtime] of Object.entries(value)) {
    if (!id.trim()) {
      continue
    }

    runtimes[id] = normalizeRuntime(runtime, maxWorkbenchTimerDurationSeconds)
  }

  return runtimes
}

function pickPresetRuntime(preset: WorkbenchTimerPreset): WorkbenchTimerPresetRuntime {
  return {
    remainingSeconds: preset.remainingSeconds,
    endsAt: preset.endsAt,
    alarmedAt: preset.alarmedAt
  }
}

function clonePreference(preference: WorkbenchTimerPreference): WorkbenchTimerPreference {
  return {
    ...preference,
    presets: preference.presets.map(preset => ({ ...preset }))
  }
}

function cloneRuntimePreference(preference: WorkbenchTimerRuntimePreference): WorkbenchTimerRuntimePreference {
  return {
    version: 4,
    runtimes: Object.fromEntries(Object.entries(preference.runtimes).map(([id, runtime]) => [id, { ...runtime }]))
  }
}

function clonePreset(preset: WorkbenchTimerPreset): WorkbenchTimerPreset {
  return { ...preset }
}

function createPresetId(durationSeconds: number) {
  return `timer-${durationSeconds}-${Date.now().toString(36)}`
}

function isPresetAlarmDue(preset: WorkbenchTimerPreset, timestamp: number) {
  return preset.endsAt !== null
    && preset.alarmedAt !== preset.endsAt
    && getPresetStatus(preset, timestamp) === 'finished'
}

function normalizeDurationSeconds(value: number) {
  return clampInteger(value, minWorkbenchTimerDurationSeconds, maxWorkbenchTimerDurationSeconds)
}

function clampInteger(value: number, min: number, max: number) {
  const integer = Number.isFinite(value) ? Math.trunc(value) : min
  return Math.min(Math.max(integer, min), max)
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkbenchTimerStore, import.meta.hot))
}
