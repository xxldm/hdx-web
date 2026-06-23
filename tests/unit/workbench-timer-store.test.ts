import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TimerPreferenceRecord, TimerPreferenceSaveRequest } from '../../app/types/hdx-api'
import {
  defaultWorkbenchTimerDurationSeconds,
  defaultWorkbenchTimerPresetId,
  defaultWorkbenchTimerRuntimePreference,
  formatWorkbenchTimerSeconds,
  getPresetRemainingSeconds,
  readStoredWorkbenchTimerRuntimePreference,
  useWorkbenchTimerStore,
  workbenchTimerStorageKey
} from '../../app/stores/workbench-timer'
import { fetchTimerPreferences, saveTimerPreferences } from '../../app/utils/hdx-api-client'

vi.mock('../../app/utils/hdx-api-client', () => ({
  fetchTimerPreferences: vi.fn(),
  saveTimerPreferences: vi.fn()
}))

describe('workbench timer store', () => {
  const baseTime = new Date('2026-06-22T10:00:00.000Z')
  const fetchTimerPreferencesMock = vi.mocked(fetchTimerPreferences)
  const saveTimerPreferencesMock = vi.mocked(saveTimerPreferences)

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(baseTime)
    vi.clearAllMocks()
    fetchTimerPreferencesMock.mockResolvedValue(defaultTimerPreferenceRecord())
    saveTimerPreferencesMock.mockImplementation(async input => savedTimerPreferenceRecord(input))
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('falls back to empty runtime state when stored data is invalid', () => {
    expect(readStoredWorkbenchTimerRuntimePreference('{bad json')).toEqual(defaultWorkbenchTimerRuntimePreference)
  })

  it('loads one default 10 minute preset from the backend', async () => {
    const store = useWorkbenchTimerStore()

    expect(store.presets).toEqual([])

    await store.loadPreferences()

    expect(store.presets).toEqual([
      {
        id: defaultWorkbenchTimerPresetId,
        durationSeconds: defaultWorkbenchTimerDurationSeconds,
        createdAt: 0,
        remainingSeconds: defaultWorkbenchTimerDurationSeconds,
        endsAt: null,
        alarmedAt: null
      }
    ])
    expect(store.getPresetRemainingSecondsById(defaultWorkbenchTimerPresetId)).toBe(defaultWorkbenchTimerDurationSeconds)
    expect(store.getPresetStatusById(defaultWorkbenchTimerPresetId)).toBe('idle')
    expect(store.runningPresetCount).toBe(0)
  })

  it('adds fixed presets through the backend and avoids duplicate durations without resetting running timers', async () => {
    const store = useWorkbenchTimerStore()

    await store.loadPreferences()
    store.startPreset(defaultWorkbenchTimerPresetId)
    const addedPreset = await store.addPresetSeconds(12)

    expect(addedPreset).toMatchObject({
      durationSeconds: 12,
      remainingSeconds: 12,
      endsAt: null,
      alarmedAt: null
    })
    expect(saveTimerPreferencesMock).toHaveBeenCalledWith({
      schemaVersion: 1,
      version: 0,
      presets: [
        {
          id: defaultWorkbenchTimerPresetId,
          order: 0,
          durationSeconds: defaultWorkbenchTimerDurationSeconds
        },
        {
          id: expect.stringMatching(/^timer-12-/),
          order: 1,
          durationSeconds: 12
        }
      ]
    })
    expect(store.presets).toHaveLength(2)
    expect(store.getPresetStatusById(defaultWorkbenchTimerPresetId)).toBe('running')

    const duplicatePreset = await store.addPresetSeconds(12)

    expect(duplicatePreset?.id).toBe(addedPreset?.id)
    expect(store.presets).toHaveLength(2)
    expect(saveTimerPreferencesMock).toHaveBeenCalledTimes(1)
  })

  it('removes presets through the backend but keeps at least one timer duration available', async () => {
    fetchTimerPreferencesMock.mockResolvedValueOnce(defaultTimerPreferenceRecord(1, [
      presetRecord(defaultWorkbenchTimerPresetId, 0, defaultWorkbenchTimerDurationSeconds),
      presetRecord('timer-55', 1, 55)
    ]))
    const store = useWorkbenchTimerStore()

    await store.loadPreferences()

    expect(await store.removePreset(defaultWorkbenchTimerPresetId)).toBe(true)
    expect(store.presets).toHaveLength(1)
    expect(await store.removePreset('timer-55')).toBe(false)
    expect(store.presets).toHaveLength(1)
  })

  it('does not remove a preset while that preset is running', async () => {
    fetchTimerPreferencesMock.mockResolvedValueOnce(defaultTimerPreferenceRecord(1, [
      presetRecord(defaultWorkbenchTimerPresetId, 0, defaultWorkbenchTimerDurationSeconds),
      presetRecord('timer-55', 1, 55)
    ]))
    const store = useWorkbenchTimerStore()

    await store.loadPreferences()
    store.startPreset('timer-55')

    expect(await store.removePreset('timer-55')).toBe(false)
    expect(await store.removePreset(defaultWorkbenchTimerPresetId)).toBe(true)
    expect(store.presets).toHaveLength(1)
  })

  it('runs multiple presets at the same time and pauses only the selected preset', async () => {
    fetchTimerPreferencesMock.mockResolvedValueOnce(defaultTimerPreferenceRecord(1, [
      presetRecord(defaultWorkbenchTimerPresetId, 0, defaultWorkbenchTimerDurationSeconds),
      presetRecord('timer-12', 1, 12)
    ]))
    const store = useWorkbenchTimerStore()

    await store.loadPreferences()
    store.startPreset(defaultWorkbenchTimerPresetId)
    store.startPreset('timer-12')

    expect(store.runningPresetCount).toBe(2)
    expect(store.runtimePreference.runtimes[defaultWorkbenchTimerPresetId]?.endsAt)
      .toBe(baseTime.getTime() + defaultWorkbenchTimerDurationSeconds * 1000)
    expect(store.runtimePreference.runtimes['timer-12']?.endsAt)
      .toBe(baseTime.getTime() + 12 * 1000)

    vi.advanceTimersByTime(3000)

    expect(store.getPresetRemainingSecondsById(defaultWorkbenchTimerPresetId)).toBe(defaultWorkbenchTimerDurationSeconds - 3)
    expect(store.getPresetRemainingSecondsById('timer-12')).toBe(9)

    store.pausePreset('timer-12')

    expect(store.getPresetStatusById(defaultWorkbenchTimerPresetId)).toBe('running')
    expect(store.getPresetStatusById('timer-12')).toBe('paused')
    expect(store.getPresetRemainingSecondsById('timer-12')).toBe(9)
    expect(store.runningPresetCount).toBe(1)
  })

  it('keeps background time by deriving remaining seconds from local runtime endsAt', async () => {
    localStorage.setItem(workbenchTimerStorageKey, JSON.stringify({
      version: 4,
      runtimes: {
        [defaultWorkbenchTimerPresetId]: {
          remainingSeconds: defaultWorkbenchTimerDurationSeconds,
          endsAt: baseTime.getTime() + defaultWorkbenchTimerDurationSeconds * 1000,
          alarmedAt: null
        }
      }
    }))
    vi.setSystemTime(baseTime.getTime() + 2 * 60 * 1000)
    const store = useWorkbenchTimerStore()

    await store.loadPreferences()

    expect(store.getPresetRemainingSecondsById(defaultWorkbenchTimerPresetId)).toBe(8 * 60)
    expect(store.getPresetStatusById(defaultWorkbenchTimerPresetId)).toBe('running')
  })

  it('migrates v2 single-selected storage into per-preset runtime state', async () => {
    localStorage.setItem(workbenchTimerStorageKey, JSON.stringify({
      version: 2,
      presets: [
        {
          id: defaultWorkbenchTimerPresetId,
          durationSeconds: defaultWorkbenchTimerDurationSeconds,
          createdAt: 0
        },
        {
          id: 'timer-55',
          durationSeconds: 55,
          createdAt: 10
        }
      ],
      selectedPresetId: 'timer-55',
      remainingSeconds: 20,
      endsAt: null
    }))
    fetchTimerPreferencesMock.mockResolvedValueOnce(defaultTimerPreferenceRecord(1, [
      presetRecord(defaultWorkbenchTimerPresetId, 0, defaultWorkbenchTimerDurationSeconds),
      presetRecord('timer-55', 1, 55)
    ]))
    const store = useWorkbenchTimerStore()

    await store.loadPreferences()

    expect(store.runtimePreference).toMatchObject({
      version: 4,
      runtimes: {
        'timer-55': {
          remainingSeconds: 20,
          endsAt: null,
          alarmedAt: null
        }
      }
    })
    expect(store.getPresetStatusById('timer-55')).toBe('paused')
  })

  it('migrates legacy single-duration storage into runtime state', () => {
    const migratedRuntime = readStoredWorkbenchTimerRuntimePreference(JSON.stringify({
      version: 1,
      durationSeconds: 25 * 60,
      remainingSeconds: 20 * 60,
      endsAt: null
    }))

    expect(migratedRuntime).toMatchObject({
      version: 4,
      runtimes: {
        'migrated-1500-seconds': {
          remainingSeconds: 20 * 60,
          endsAt: null,
          alarmedAt: null
        }
      }
    })
  })

  it('clamps an expired timer to zero and exposes one alarm event until acknowledged', async () => {
    const preset = {
      id: defaultWorkbenchTimerPresetId,
      durationSeconds: defaultWorkbenchTimerDurationSeconds,
      createdAt: 0,
      remainingSeconds: defaultWorkbenchTimerDurationSeconds,
      endsAt: baseTime.getTime() + 1000,
      alarmedAt: null
    }

    expect(getPresetRemainingSeconds(preset, baseTime.getTime() + 5000)).toBe(0)

    localStorage.setItem(workbenchTimerStorageKey, JSON.stringify({
      version: 4,
      runtimes: {
        [defaultWorkbenchTimerPresetId]: {
          remainingSeconds: preset.remainingSeconds,
          endsAt: preset.endsAt,
          alarmedAt: preset.alarmedAt
        }
      }
    }))
    vi.setSystemTime(baseTime.getTime() + 5000)
    const store = useWorkbenchTimerStore()

    await store.loadPreferences()

    expect(store.getPresetRemainingSecondsById(defaultWorkbenchTimerPresetId)).toBe(0)
    expect(store.getPresetStatusById(defaultWorkbenchTimerPresetId)).toBe('finished')
    expect(store.dueAlarmPresets.map(item => item.id)).toEqual([defaultWorkbenchTimerPresetId])

    expect(store.acknowledgePresetAlarm(defaultWorkbenchTimerPresetId, baseTime.getTime() + 1000)).toBe(true)
    expect(store.dueAlarmPresets).toEqual([])
  })

  it('keeps server preference when saving hits a version conflict', async () => {
    const serverPreference = defaultTimerPreferenceRecord(2, [
      presetRecord('timer-60', 0, 60)
    ])
    saveTimerPreferencesMock.mockRejectedValueOnce({
      statusCode: 409,
      data: {
        code: 'TIMER_PREFERENCE_CONFLICT',
        message: '计时器预设已在其他位置更新，请处理冲突。',
        resourceType: 'timerPreferences',
        baseVersion: 1,
        currentVersion: 2,
        updatedAt: baseTime.toISOString(),
        updatedByUserId: 'USER:1',
        serverPreference
      }
    })
    fetchTimerPreferencesMock.mockResolvedValueOnce(defaultTimerPreferenceRecord(1))
    const store = useWorkbenchTimerStore()

    await store.loadPreferences()

    expect(await store.addPresetSeconds(12)).toBeNull()
    expect(store.timerConflict).toMatchObject({
      baseVersion: 1,
      currentVersion: 2
    })
    expect(store.presets.map(preset => preset.id)).toEqual(['timer-60'])
  })

  it('formats short and long timer labels', () => {
    expect(formatWorkbenchTimerSeconds(600)).toBe('10:00')
    expect(formatWorkbenchTimerSeconds(65)).toBe('1:05')
    expect(formatWorkbenchTimerSeconds(3661)).toBe('1:01:01')
  })

  function defaultTimerPreferenceRecord(
    version = 0,
    presets = [
      presetRecord(defaultWorkbenchTimerPresetId, 0, defaultWorkbenchTimerDurationSeconds, '1970-01-01T00:00:00.000Z')
    ]
  ): TimerPreferenceRecord {
    return {
      schemaVersion: 1,
      version,
      presets
    }
  }

  function presetRecord(
    id: string,
    order: number,
    durationSeconds: number,
    createdAt = baseTime.toISOString()
  ) {
    return {
      id,
      order,
      durationSeconds,
      createdAt
    }
  }

  function savedTimerPreferenceRecord(input: TimerPreferenceSaveRequest): TimerPreferenceRecord {
    return {
      schemaVersion: 1,
      version: input.version + 1,
      presets: input.presets.map(preset => ({
        ...preset,
        createdAt: preset.id === defaultWorkbenchTimerPresetId
          ? '1970-01-01T00:00:00.000Z'
          : baseTime.toISOString()
      }))
    }
  }
})
