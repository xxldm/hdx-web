import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  maxPinnedWorkbenchNavigationItems,
  readStoredWorkbenchNavigationPreference,
  useWorkbenchNavigationStore,
  workbenchNavigationStorageKey
} from '../../app/stores/workbench-navigation'

describe('workbench navigation store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('falls back to default pinned items when stored data is invalid', () => {
    const preference = readStoredWorkbenchNavigationPreference('{bad json')

    expect(preference.pinnedItemIds).toEqual(['timer'])
  })

  it('filters stale placeholder, unknown, duplicate, and non-pinnable menu ids', () => {
    const preference = readStoredWorkbenchNavigationPreference(JSON.stringify({
      version: 1,
      pinnedItemIds: ['quick-links', 'timer', 'date-countdown', 'unknown', 'timer', 'home', 'settings', 'runtime']
    }))

    expect(preference.pinnedItemIds).toEqual(['timer', 'date-countdown'])
  })

  it('toggles pinned menu items and persists the preference', async () => {
    const store = useWorkbenchNavigationStore()

    store.unpinItem('timer')
    await nextTick()

    expect(store.pinnedItemIds).toEqual([])
    expect(readStoredWorkbenchNavigationPreference(localStorage.getItem(workbenchNavigationStorageKey) ?? '').pinnedItemIds).toEqual([])

    store.pinItem('timer')
    await nextTick()

    expect(store.pinnedItemIds).toEqual(['timer'])
    expect(readStoredWorkbenchNavigationPreference(localStorage.getItem(workbenchNavigationStorageKey) ?? '').pinnedItemIds).toEqual(['timer'])

    store.pinItem('date-countdown')
    await nextTick()

    expect(store.pinnedItemIds).toEqual(['timer', 'date-countdown'])
  })

  it('does not pin non-pinnable menu items', () => {
    const store = useWorkbenchNavigationStore()

    store.pinItem('settings')

    expect(store.pinnedItemIds.length).toBeLessThanOrEqual(maxPinnedWorkbenchNavigationItems)
    expect(store.pinnedItemIds).toEqual(['timer'])
    expect(store.canPinItem('settings')).toBe(false)
  })
})
