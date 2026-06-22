import { useStorage, useTimestamp } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed } from 'vue'
import { z } from 'zod'

export const workbenchTimerStorageKey = 'hdx:web:workbench-timer:v1'
export const defaultWorkbenchTimerDurationSeconds = 10 * 60
export const minWorkbenchTimerDurationSeconds = 60
export const maxWorkbenchTimerDurationSeconds = 24 * 60 * 60

export type WorkbenchTimerStatus = 'idle' | 'running' | 'paused' | 'finished'

export interface WorkbenchTimerPreference {
  version: 1
  durationSeconds: number
  remainingSeconds: number
  endsAt: number | null
}

const workbenchTimerPreferenceSchema = z.object({
  version: z.literal(1),
  durationSeconds: z.number().int().min(minWorkbenchTimerDurationSeconds).max(maxWorkbenchTimerDurationSeconds),
  remainingSeconds: z.number().int().min(0).max(maxWorkbenchTimerDurationSeconds),
  endsAt: z.number().int().positive().nullable().default(null)
})

export const defaultWorkbenchTimerPreference: WorkbenchTimerPreference = {
  version: 1,
  durationSeconds: defaultWorkbenchTimerDurationSeconds,
  remainingSeconds: defaultWorkbenchTimerDurationSeconds,
  endsAt: null
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

  const durationSeconds = computed(() => preference.value.durationSeconds)
  const durationMinutes = computed(() => Math.max(Math.round(durationSeconds.value / 60), 1))
  const remainingSeconds = computed(() => getRemainingSeconds(preference.value, timestamp.value))
  const elapsedSeconds = computed(() => Math.max(durationSeconds.value - remainingSeconds.value, 0))
  const progressPercent = computed(() => {
    if (durationSeconds.value <= 0) {
      return 0
    }

    return Math.round((elapsedSeconds.value / durationSeconds.value) * 100)
  })
  const status = computed<WorkbenchTimerStatus>(() => {
    if (remainingSeconds.value <= 0) {
      return 'finished'
    }

    if (preference.value.endsAt !== null) {
      return 'running'
    }

    if (remainingSeconds.value < durationSeconds.value) {
      return 'paused'
    }

    return 'idle'
  })
  const running = computed(() => status.value === 'running')
  const paused = computed(() => status.value === 'paused')
  const finished = computed(() => status.value === 'finished')
  const remainingLabel = computed(() => formatWorkbenchTimerSeconds(remainingSeconds.value))

  function setDurationMinutes(minutes: number | null | undefined) {
    const nextDurationSeconds = normalizeDurationSeconds(typeof minutes === 'number' ? minutes * 60 : defaultWorkbenchTimerDurationSeconds)

    preference.value = {
      version: 1,
      durationSeconds: nextDurationSeconds,
      remainingSeconds: nextDurationSeconds,
      endsAt: null
    }
  }

  function start() {
    const secondsToRun = remainingSeconds.value > 0 ? remainingSeconds.value : durationSeconds.value

    preference.value = normalizeWorkbenchTimerPreference({
      ...preference.value,
      remainingSeconds: secondsToRun,
      endsAt: Date.now() + secondsToRun * 1000
    })
  }

  function pause() {
    if (!running.value) {
      return
    }

    preference.value = normalizeWorkbenchTimerPreference({
      ...preference.value,
      remainingSeconds: remainingSeconds.value,
      endsAt: null
    })
  }

  function reset() {
    preference.value = {
      version: 1,
      durationSeconds: durationSeconds.value,
      remainingSeconds: durationSeconds.value,
      endsAt: null
    }
  }

  return {
    durationMinutes,
    durationSeconds,
    elapsedSeconds,
    finished,
    paused,
    preference,
    progressPercent,
    remainingLabel,
    remainingSeconds,
    running,
    status,
    pause,
    reset,
    setDurationMinutes,
    start
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

  if (!parsed.success) {
    return clonePreference(defaultWorkbenchTimerPreference)
  }

  const durationSeconds = normalizeDurationSeconds(parsed.data.durationSeconds)

  return {
    version: 1,
    durationSeconds,
    remainingSeconds: clampInteger(parsed.data.remainingSeconds, 0, durationSeconds),
    endsAt: parsed.data.endsAt
  }
}

export function getRemainingSeconds(preference: WorkbenchTimerPreference, timestamp: number) {
  if (preference.endsAt === null) {
    return clampInteger(preference.remainingSeconds, 0, preference.durationSeconds)
  }

  return clampInteger(Math.ceil((preference.endsAt - timestamp) / 1000), 0, preference.durationSeconds)
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

function normalizeDurationSeconds(value: number) {
  return clampInteger(value, minWorkbenchTimerDurationSeconds, maxWorkbenchTimerDurationSeconds)
}

function clonePreference(preference: WorkbenchTimerPreference): WorkbenchTimerPreference {
  return { ...preference }
}

function clampInteger(value: number, min: number, max: number) {
  const integer = Number.isFinite(value) ? Math.trunc(value) : min
  return Math.min(Math.max(integer, min), max)
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkbenchTimerStore, import.meta.hot))
}
