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

    expect(preference.pinnedItemIds).toEqual(['quick-links', 'tool-catalog', 'notes'])
  })

  it('filters unknown, duplicate, and non-pinnable menu ids', () => {
    const preference = readStoredWorkbenchNavigationPreference(JSON.stringify({
      version: 1,
      pinnedItemIds: ['quick-links', 'unknown', 'quick-links', 'home', 'settings', 'runtime']
    }))

    expect(preference.pinnedItemIds).toEqual(['quick-links', 'runtime'])
  })

  it('toggles pinned menu items and persists the preference', async () => {
    const store = useWorkbenchNavigationStore()

    store.unpinItem('quick-links')
    store.pinItem('runtime')
    await nextTick()

    expect(store.pinnedItemIds).toEqual(['tool-catalog', 'notes', 'runtime'])
    expect(readStoredWorkbenchNavigationPreference(localStorage.getItem(workbenchNavigationStorageKey) ?? '').pinnedItemIds).toEqual(['tool-catalog', 'notes', 'runtime'])
  })

  it('does not pin more than the configured limit', () => {
    const store = useWorkbenchNavigationStore()

    store.pinItem('runtime')

    expect(store.pinnedItemIds.length).toBeLessThanOrEqual(maxPinnedWorkbenchNavigationItems)
    expect(store.canPinItem('settings')).toBe(false)
  })
})
