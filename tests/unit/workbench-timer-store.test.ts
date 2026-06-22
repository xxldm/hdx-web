import { setActivePinia, createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultWorkbenchTimerDurationSeconds,
  defaultWorkbenchTimerPreference,
  formatWorkbenchTimerSeconds,
  getRemainingSeconds,
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

  it('starts with a 10 minute duration by default', () => {
    const store = useWorkbenchTimerStore()

    expect(store.durationSeconds).toBe(defaultWorkbenchTimerDurationSeconds)
    expect(store.durationMinutes).toBe(10)
    expect(store.remainingSeconds).toBe(defaultWorkbenchTimerDurationSeconds)
    expect(store.status).toBe('idle')
  })

  it('starts, counts down from endsAt, and can pause', () => {
    const store = useWorkbenchTimerStore()

    store.start()

    expect(store.preference.endsAt).toBe(baseTime.getTime() + defaultWorkbenchTimerDurationSeconds * 1000)
    expect(store.status).toBe('running')

    vi.advanceTimersByTime(3000)

    expect(store.remainingSeconds).toBe(defaultWorkbenchTimerDurationSeconds - 3)

    store.pause()

    expect(store.preference.endsAt).toBeNull()
    expect(store.remainingSeconds).toBe(defaultWorkbenchTimerDurationSeconds - 3)
    expect(store.status).toBe('paused')
  })

  it('keeps background time by deriving remaining seconds from persisted endsAt', () => {
    localStorage.setItem(workbenchTimerStorageKey, JSON.stringify({
      version: 1,
      durationSeconds: defaultWorkbenchTimerDurationSeconds,
      remainingSeconds: defaultWorkbenchTimerDurationSeconds,
      endsAt: baseTime.getTime() + defaultWorkbenchTimerDurationSeconds * 1000
    }))
    vi.setSystemTime(baseTime.getTime() + 2 * 60 * 1000)

    const store = useWorkbenchTimerStore()

    expect(store.remainingSeconds).toBe(8 * 60)
    expect(store.status).toBe('running')
  })

  it('clamps an expired timer to zero instead of going negative', () => {
    const preference = {
      version: 1 as const,
      durationSeconds: defaultWorkbenchTimerDurationSeconds,
      remainingSeconds: defaultWorkbenchTimerDurationSeconds,
      endsAt: baseTime.getTime() + 1000
    }

    expect(getRemainingSeconds(preference, baseTime.getTime() + 5000)).toBe(0)

    localStorage.setItem(workbenchTimerStorageKey, JSON.stringify(preference))
    vi.setSystemTime(baseTime.getTime() + 5000)

    const store = useWorkbenchTimerStore()

    expect(store.remainingSeconds).toBe(0)
    expect(store.status).toBe('finished')
    expect(store.running).toBe(false)
  })

  it('updates custom duration in minutes and resets remaining time', () => {
    const store = useWorkbenchTimerStore()

    store.setDurationMinutes(25)

    expect(store.durationSeconds).toBe(25 * 60)
    expect(store.remainingSeconds).toBe(25 * 60)
    expect(store.status).toBe('idle')
  })

  it('formats short and long timer labels', () => {
    expect(formatWorkbenchTimerSeconds(600)).toBe('10:00')
    expect(formatWorkbenchTimerSeconds(65)).toBe('1:05')
    expect(formatWorkbenchTimerSeconds(3661)).toBe('1:01:01')
  })
})
