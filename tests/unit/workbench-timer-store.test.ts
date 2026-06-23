import { setActivePinia, createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultWorkbenchTimerDurationSeconds,
  defaultWorkbenchTimerPreference,
  defaultWorkbenchTimerPresetId,
  formatWorkbenchTimerSeconds,
  getPresetRemainingSeconds,
  readStoredWorkbenchTimerPreference,
  useWorkbenchTimerStore,
  workbenchTimerStorageKey
} from '../../app/stores/workbench-timer'

describe('workbench timer store', () => {
  const baseTime = new Date('2026-06-22T10:00:00.000Z')

  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(baseTime)
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('falls back to the default timer preference when stored data is invalid', () => {
    expect(readStoredWorkbenchTimerPreference('{bad json')).toEqual(defaultWorkbenchTimerPreference)
  })

  it('starts with one default 10 minute preset', () => {
    const store = useWorkbenchTimerStore()

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

  it('adds fixed presets and avoids duplicate durations without resetting running timers', () => {
    const store = useWorkbenchTimerStore()

    store.startPreset(defaultWorkbenchTimerPresetId)
    const addedPreset = store.addPresetSeconds(12)

    expect(addedPreset).toMatchObject({
      durationSeconds: 12,
      createdAt: baseTime.getTime(),
      remainingSeconds: 12,
      endsAt: null,
      alarmedAt: null
    })
    expect(store.presets).toHaveLength(2)
    expect(store.getPresetStatusById(defaultWorkbenchTimerPresetId)).toBe('running')

    const duplicatePreset = store.addPresetSeconds(12)

    expect(duplicatePreset?.id).toBe(addedPreset?.id)
    expect(store.presets).toHaveLength(2)
  })

  it('removes presets but keeps at least one timer duration available', () => {
    const store = useWorkbenchTimerStore()
    const addedPreset = store.addPresetSeconds(55)

    expect(addedPreset).not.toBeNull()
    expect(store.removePreset(defaultWorkbenchTimerPresetId)).toBe(true)
    expect(store.presets).toHaveLength(1)
    expect(store.removePreset(addedPreset?.id ?? '')).toBe(false)
    expect(store.presets).toHaveLength(1)
  })

  it('does not remove a preset while that preset is running', () => {
    const store = useWorkbenchTimerStore()
    const addedPreset = store.addPresetSeconds(55)

    expect(addedPreset).not.toBeNull()

    store.startPreset(addedPreset?.id ?? '')

    expect(store.removePreset(addedPreset?.id ?? '')).toBe(false)
    expect(store.removePreset(defaultWorkbenchTimerPresetId)).toBe(true)
    expect(store.presets).toHaveLength(1)
  })

  it('runs multiple presets at the same time and pauses only the selected preset', () => {
    const store = useWorkbenchTimerStore()
    const addedPreset = store.addPresetSeconds(12)

    expect(addedPreset).not.toBeNull()

    store.startPreset(defaultWorkbenchTimerPresetId)
    store.startPreset(addedPreset?.id ?? '')

    expect(store.runningPresetCount).toBe(2)
    expect(store.preference.presets.find(preset => preset.id === defaultWorkbenchTimerPresetId)?.endsAt)
      .toBe(baseTime.getTime() + defaultWorkbenchTimerDurationSeconds * 1000)
    expect(store.preference.presets.find(preset => preset.id === addedPreset?.id)?.endsAt)
      .toBe(baseTime.getTime() + 12 * 1000)

    vi.advanceTimersByTime(3000)

    expect(store.getPresetRemainingSecondsById(defaultWorkbenchTimerPresetId)).toBe(defaultWorkbenchTimerDurationSeconds - 3)
    expect(store.getPresetRemainingSecondsById(addedPreset?.id ?? '')).toBe(9)

    store.pausePreset(addedPreset?.id ?? '')

    expect(store.getPresetStatusById(defaultWorkbenchTimerPresetId)).toBe('running')
    expect(store.getPresetStatusById(addedPreset?.id ?? '')).toBe('paused')
    expect(store.getPresetRemainingSecondsById(addedPreset?.id ?? '')).toBe(9)
    expect(store.runningPresetCount).toBe(1)
  })

  it('keeps background time by deriving remaining seconds from each persisted endsAt', () => {
    localStorage.setItem(workbenchTimerStorageKey, JSON.stringify({
      version: 3,
      presets: [
        {
          id: defaultWorkbenchTimerPresetId,
          durationSeconds: defaultWorkbenchTimerDurationSeconds,
          createdAt: 0,
          remainingSeconds: defaultWorkbenchTimerDurationSeconds,
          endsAt: baseTime.getTime() + defaultWorkbenchTimerDurationSeconds * 1000,
          alarmedAt: null
        }
      ]
    }))
    vi.setSystemTime(baseTime.getTime() + 2 * 60 * 1000)

    const store = useWorkbenchTimerStore()

    expect(store.getPresetRemainingSecondsById(defaultWorkbenchTimerPresetId)).toBe(8 * 60)
    expect(store.getPresetStatusById(defaultWorkbenchTimerPresetId)).toBe('running')
  })

  it('migrates v2 single-selected storage into per-preset runtime state', () => {
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

    const store = useWorkbenchTimerStore()

    expect(store.preference).toMatchObject({
      version: 3,
      presets: [
        {
          id: defaultWorkbenchTimerPresetId,
          durationSeconds: defaultWorkbenchTimerDurationSeconds,
          remainingSeconds: defaultWorkbenchTimerDurationSeconds,
          endsAt: null
        },
        {
          id: 'timer-55',
          durationSeconds: 55,
          remainingSeconds: 20,
          endsAt: null
        }
      ]
    })
    expect(store.getPresetStatusById('timer-55')).toBe('paused')
  })

  it('migrates legacy single-duration storage into one preset', () => {
    localStorage.setItem(workbenchTimerStorageKey, JSON.stringify({
      version: 1,
      durationSeconds: 25 * 60,
      remainingSeconds: 20 * 60,
      endsAt: null
    }))

    const store = useWorkbenchTimerStore()

    expect(store.preference).toMatchObject({
      version: 3,
      presets: [
        {
          id: 'migrated-1500-seconds',
          durationSeconds: 25 * 60,
          createdAt: 0,
          remainingSeconds: 20 * 60,
          endsAt: null,
          alarmedAt: null
        }
      ]
    })
    expect(store.getPresetRemainingSecondsById('migrated-1500-seconds')).toBe(20 * 60)
    expect(store.getPresetStatusById('migrated-1500-seconds')).toBe('paused')
  })

  it('clamps an expired timer to zero and exposes one alarm event until acknowledged', () => {
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
      version: 3,
      presets: [preset]
    }))
    vi.setSystemTime(baseTime.getTime() + 5000)

    const store = useWorkbenchTimerStore()

    expect(store.getPresetRemainingSecondsById(defaultWorkbenchTimerPresetId)).toBe(0)
    expect(store.getPresetStatusById(defaultWorkbenchTimerPresetId)).toBe('finished')
    expect(store.dueAlarmPresets.map(item => item.id)).toEqual([defaultWorkbenchTimerPresetId])

    expect(store.acknowledgePresetAlarm(defaultWorkbenchTimerPresetId, baseTime.getTime() + 1000)).toBe(true)
    expect(store.dueAlarmPresets).toEqual([])
  })

  it('formats short and long timer labels', () => {
    expect(formatWorkbenchTimerSeconds(600)).toBe('10:00')
    expect(formatWorkbenchTimerSeconds(65)).toBe('1:05')
    expect(formatWorkbenchTimerSeconds(3661)).toBe('1:01:01')
  })
})
