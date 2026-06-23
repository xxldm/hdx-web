import { useStorage, useTimestamp } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed } from 'vue'
import { z } from 'zod'

export const workbenchTimerStorageKey = 'hdx:web:workbench-timer:v1'
export const defaultWorkbenchTimerPresetId = 'default-10-minutes'
export const defaultWorkbenchTimerDurationSeconds = 10 * 60
export const minWorkbenchTimerDurationSeconds = 1
export const maxWorkbenchTimerDurationSeconds = 24 * 60 * 60

export type WorkbenchTimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface WorkbenchTimerPreset {
  id: string
  durationSeconds: number
  createdAt: number
  remainingSeconds: number
  endsAt: number | null
  alarmedAt: number | null
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
  version: 3
  presets: WorkbenchTimerPreset[]
}

const baseWorkbenchTimerPresetSchema = z.object({
  id: z.string().trim().min(1),
  durationSeconds: z.number().int().min(minWorkbenchTimerDurationSeconds).max(maxWorkbenchTimerDurationSeconds),
  createdAt: z.number().int().nonnegative()
})

const workbenchTimerPresetSchema = baseWorkbenchTimerPresetSchema.extend({
  remainingSeconds: z.number().int().min(0).max(maxWorkbenchTimerDurationSeconds).optional(),
  endsAt: z.number().int().positive().nullable().optional(),
  alarmedAt: z.number().int().positive().nullable().optional()
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

const workbenchTimerPreferenceSchema = z.object({
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
  version: 3,
  presets: [clonePreset(defaultWorkbenchTimerPreset)]
}

export const useWorkbenchTimerStore = defineStore('workbench-timer', () => {
  const preference = useStorage<WorkbenchTimerPreference>(
    workbenchTimerStorageKey,
    clonePreference(defaultWorkbenchTimerPreference),
    undefined,
    {
      deep: true,
      mergeDefaults: false,
      serializer: {
        read: readStoredWorkbenchTimerPreference,
        write: value => JSON.stringify(normalizeWorkbenchTimerPreference(value))
      }
    }
  )
  const timestamp = useTimestamp({ interval: 1000 })

  const presets = computed(() => preference.value.presets)
  const dueAlarmPresets = computed(() => presets.value.filter(preset => isPresetAlarmDue(preset, timestamp.value)))
  const runningPresetCount = computed(() => presets.value.filter(preset => getPresetStatus(preset, timestamp.value) === 'running').length)
  const hasRunningPresets = computed(() => runningPresetCount.value > 0)

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

  function addPresetSeconds(seconds: number | null | undefined) {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
      return null
    }

    const durationSeconds = normalizeDurationSeconds(seconds)
    const existingPreset = presets.value.find(preset => preset.durationSeconds === durationSeconds)

    if (existingPreset) {
      return existingPreset
    }

    const preset = createStoredPreset(durationSeconds, createPresetId(durationSeconds), Date.now())

    preference.value = normalizeWorkbenchTimerPreference({
      version: 3,
      presets: [
        ...presets.value,
        preset
      ]
    })

    return preset
  }

  function addPresetMinutes(minutes: number | null | undefined) {
    return addPresetSeconds(typeof minutes === 'number' ? minutes * 60 : minutes)
  }

  function removePreset(id: string) {
    if (!canRemovePreset(id)) {
      return false
    }

    const nextPresets = presets.value.filter(preset => preset.id !== id)

    if (nextPresets.length === presets.value.length || nextPresets.length === 0) {
      return false
    }

    preference.value = normalizeWorkbenchTimerPreference({
      version: 3,
      presets: nextPresets
    })

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

    return updatePreset(id, current => ({
      ...current,
      remainingSeconds: secondsToRun,
      endsAt: Date.now() + secondsToRun * 1000,
      alarmedAt: null
    }))
  }

  function pausePreset(id: string) {
    if (getPresetStatusById(id) !== 'running') {
      return false
    }

    return updatePreset(id, current => ({
      ...current,
      remainingSeconds: getPresetRemainingSeconds(current, timestamp.value),
      endsAt: null
    }))
  }

  function resetPreset(id: string) {
    return updatePreset(id, current => ({
      ...current,
      remainingSeconds: current.durationSeconds,
      endsAt: null,
      alarmedAt: null
    }))
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

    return updatePreset(id, current => ({
      ...current,
      alarmedAt: endsAt
    }))
  }

  function updatePreset(id: string, updater: (preset: WorkbenchTimerPreset) => WorkbenchTimerPreset) {
    let changed = false
    const nextPresets = presets.value.map((preset) => {
      if (preset.id !== id) {
        return preset
      }

      changed = true
      return normalizePreset(updater(preset))
    })

    if (!changed) {
      return false
    }

    preference.value = normalizeWorkbenchTimerPreference({
      version: 3,
      presets: nextPresets
    })

    return true
  }

  return {
    dueAlarmPresets,
    hasRunningPresets,
    preference,
    presets,
    runningPresetCount,
    acknowledgePresetAlarm,
    addPresetMinutes,
    addPresetSeconds,
    canRemovePreset,
    getPresetById,
    getPresetElapsedSecondsById,
    getPresetProgressPercentById,
    getPresetRemainingLabelById,
    getPresetRemainingSecondsById,
    getPresetStatusById,
    pausePreset,
    removePreset,
    resetPreset,
    startPreset,
    togglePreset
  }
})

export function readStoredWorkbenchTimerPreference(value: string): WorkbenchTimerPreference {
  if (!value) {
    return clonePreference(defaultWorkbenchTimerPreference)
  }

  try {
    return normalizeWorkbenchTimerPreference(JSON.parse(value))
  } catch {
    return clonePreference(defaultWorkbenchTimerPreference)
  }
}

export function normalizeWorkbenchTimerPreference(value: unknown): WorkbenchTimerPreference {
  const parsed = workbenchTimerPreferenceSchema.safeParse(value)

  if (parsed.success) {
    return normalizeCurrentPreference(parsed.data)
  }

  const singleTimerParsed = singleTimerWorkbenchTimerPreferenceSchema.safeParse(value)

  if (singleTimerParsed.success) {
    return migrateSingleTimerPreference(singleTimerParsed.data)
  }

  const legacyParsed = legacyWorkbenchTimerPreferenceSchema.safeParse(value)

  if (legacyParsed.success) {
    return migrateLegacyPreference(legacyParsed.data)
  }

  return clonePreference(defaultWorkbenchTimerPreference)
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

function normalizeCurrentPreference(preference: z.infer<typeof workbenchTimerPreferenceSchema>): WorkbenchTimerPreference {
  return {
    version: 3,
    presets: normalizePresets(preference.presets)
  }
}

function migrateSingleTimerPreference(preference: SingleTimerWorkbenchTimerPreference): WorkbenchTimerPreference {
  const presets = normalizeLegacyPresets(preference.presets)
  const fallbackPreset = presets[0] ?? clonePreset(defaultWorkbenchTimerPreset)
  const selectedPreset = presets.find(preset => preset.id === preference.selectedPresetId) ?? fallbackPreset

  return {
    version: 3,
    presets: presets.map((preset) => {
      if (preset.id !== selectedPreset.id) {
        return preset
      }

      return createStoredPreset(
        preset.durationSeconds,
        preset.id,
        preset.createdAt,
        {
          remainingSeconds: preference.remainingSeconds,
          endsAt: preference.endsAt,
          alarmedAt: null
        }
      )
    })
  }
}

function migrateLegacyPreference(preference: LegacyWorkbenchTimerPreference): WorkbenchTimerPreference {
  const durationSeconds = normalizeDurationSeconds(preference.durationSeconds)

  return {
    version: 3,
    presets: [
      createStoredPreset(
        durationSeconds,
        durationSeconds === defaultWorkbenchTimerDurationSeconds ? defaultWorkbenchTimerPresetId : `migrated-${durationSeconds}-seconds`,
        0,
        {
          remainingSeconds: preference.remainingSeconds,
          endsAt: preference.endsAt,
          alarmedAt: null
        }
      )
    ]
  }
}

function normalizePresets(value: unknown[]) {
  const presets: WorkbenchTimerPreset[] = []
  const seenIds = new Set<string>()

  for (const item of value) {
    const parsed = workbenchTimerPresetSchema.safeParse(item)

    if (!parsed.success || seenIds.has(parsed.data.id)) {
      continue
    }

    const preset = normalizePreset(parsed.data)

    presets.push(preset)
    seenIds.add(preset.id)
  }

  return presets.length > 0 ? presets : [clonePreset(defaultWorkbenchTimerPreset)]
}

function normalizeLegacyPresets(value: unknown[]) {
  const presets: WorkbenchTimerPreset[] = []
  const seenIds = new Set<string>()

  for (const item of value) {
    const parsed = baseWorkbenchTimerPresetSchema.safeParse(item)

    if (!parsed.success || seenIds.has(parsed.data.id)) {
      continue
    }

    const preset = createStoredPreset(
      parsed.data.durationSeconds,
      parsed.data.id,
      parsed.data.createdAt
    )

    presets.push(preset)
    seenIds.add(preset.id)
  }

  return presets.length > 0 ? presets : [clonePreset(defaultWorkbenchTimerPreset)]
}

function normalizePreset(value: z.infer<typeof workbenchTimerPresetSchema>): WorkbenchTimerPreset {
  const durationSeconds = normalizeDurationSeconds(value.durationSeconds)
  const endsAt = value.endsAt ?? null
  const alarmedAt = endsAt === null ? null : value.alarmedAt ?? null

  return {
    id: value.id,
    durationSeconds,
    createdAt: clampInteger(value.createdAt, 0, Number.MAX_SAFE_INTEGER),
    remainingSeconds: clampInteger(value.remainingSeconds ?? durationSeconds, 0, durationSeconds),
    endsAt,
    alarmedAt
  }
}

function createStoredPreset(
  durationSeconds: number,
  id = durationSeconds === defaultWorkbenchTimerDurationSeconds ? defaultWorkbenchTimerPresetId : `migrated-${durationSeconds}-seconds`,
  createdAt = 0,
  runtime: Partial<Pick<WorkbenchTimerPreset, 'remainingSeconds' | 'endsAt' | 'alarmedAt'>> = {}
): WorkbenchTimerPreset {
  const normalizedDurationSeconds = normalizeDurationSeconds(durationSeconds)

  return normalizePreset({
    id,
    durationSeconds: normalizedDurationSeconds,
    createdAt: clampInteger(createdAt, 0, Number.MAX_SAFE_INTEGER),
    remainingSeconds: runtime.remainingSeconds ?? normalizedDurationSeconds,
    endsAt: runtime.endsAt ?? null,
    alarmedAt: runtime.alarmedAt ?? null
  })
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

function clonePreference(preference: WorkbenchTimerPreference): WorkbenchTimerPreference {
  return {
    ...preference,
    presets: preference.presets.map(clonePreset)
  }
}

function clonePreset(preset: WorkbenchTimerPreset): WorkbenchTimerPreset {
  return { ...preset }
}

function clampInteger(value: number, min: number, max: number) {
  const integer = Number.isFinite(value) ? Math.trunc(value) : min
  return Math.min(Math.max(integer, min), max)
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkbenchTimerStore, import.meta.hot))
}
