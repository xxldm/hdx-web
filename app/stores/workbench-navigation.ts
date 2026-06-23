import { useStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed } from 'vue'
import { z } from 'zod'
import {
  defaultPinnedWorkbenchNavigationItemIds,
  getWorkbenchNavigationItem,
  isWorkbenchNavigationItemId,
  type WorkbenchNavigationItemId
} from '~/utils/workbench-navigation'

export const workbenchNavigationStorageKey = 'hdx:web:workbench-navigation:v1'
export const maxPinnedWorkbenchNavigationItems = 6

export interface WorkbenchNavigationPreference {
  version: 1
  pinnedItemIds: WorkbenchNavigationItemId[]
}

const workbenchNavigationPreferenceSchema = z.object({
  version: z.literal(1),
  pinnedItemIds: z.array(z.string().min(1)).max(maxPinnedWorkbenchNavigationItems * 2).default([])
})

export const defaultWorkbenchNavigationPreference: WorkbenchNavigationPreference = {
  version: 1,
  pinnedItemIds: [...defaultPinnedWorkbenchNavigationItemIds]
}

export const useWorkbenchNavigationStore = defineStore('workbench-navigation', () => {
  const preference = useStorage<WorkbenchNavigationPreference>(
    workbenchNavigationStorageKey,
    clonePreference(defaultWorkbenchNavigationPreference),
    undefined,
    {
      deep: true,
      mergeDefaults: false,
      serializer: {
        read: readStoredWorkbenchNavigationPreference,
        write: value => JSON.stringify(normalizeWorkbenchNavigationPreference(value))
      }
    }
  )

  const pinnedItemIds = computed(() => normalizePinnedItemIds(preference.value.pinnedItemIds))
  const pinnedItems = computed(() => pinnedItemIds.value
    .map(itemId => getWorkbenchNavigationItem(itemId))
    .filter(item => Boolean(item)))

  function isPinnedItem(itemId: string) {
    return pinnedItemIds.value.includes(itemId as WorkbenchNavigationItemId)
  }

  function canPinItem(itemId: string) {
    const item = getWorkbenchNavigationItem(itemId)

    if (!item?.pinnable || item.disabled) {
      return false
    }

    return isPinnedItem(itemId) || pinnedItemIds.value.length < maxPinnedWorkbenchNavigationItems
  }

  function pinItem(itemId: string) {
    if (!canPinItem(itemId) || isPinnedItem(itemId) || !isWorkbenchNavigationItemId(itemId)) {
      return
    }

    preference.value = normalizeWorkbenchNavigationPreference({
      ...preference.value,
      pinnedItemIds: [...pinnedItemIds.value, itemId]
    })
  }

  function unpinItem(itemId: string) {
    preference.value = normalizeWorkbenchNavigationPreference({
      ...preference.value,
      pinnedItemIds: pinnedItemIds.value.filter(pinnedItemId => pinnedItemId !== itemId)
    })
  }

  function togglePinnedItem(itemId: string) {
    if (isPinnedItem(itemId)) {
      unpinItem(itemId)
      return
    }

    pinItem(itemId)
  }

  function setPinnedItems(itemIds: readonly string[]) {
    preference.value = normalizeWorkbenchNavigationPreference({
      version: 1,
      pinnedItemIds: [...itemIds]
    })
  }

  function resetPinnedItems() {
    preference.value = clonePreference(defaultWorkbenchNavigationPreference)
  }

  return {
    canPinItem,
    isPinnedItem,
    maxPinnedWorkbenchNavigationItems,
    pinnedItemIds,
    pinnedItems,
    preference,
    pinItem,
    resetPinnedItems,
    setPinnedItems,
    togglePinnedItem,
    unpinItem
  }
})

export function readStoredWorkbenchNavigationPreference(value: string): WorkbenchNavigationPreference {
  if (!value) {
    return clonePreference(defaultWorkbenchNavigationPreference)
  }

  try {
    return normalizeWorkbenchNavigationPreference(JSON.parse(value))
  } catch {
    return clonePreference(defaultWorkbenchNavigationPreference)
  }
}

export function normalizeWorkbenchNavigationPreference(value: unknown): WorkbenchNavigationPreference {
  const parsed = workbenchNavigationPreferenceSchema.safeParse(value)

  if (!parsed.success) {
    return clonePreference(defaultWorkbenchNavigationPreference)
  }

  return {
    version: 1,
    pinnedItemIds: normalizePinnedItemIds(parsed.data.pinnedItemIds)
  }
}

function normalizePinnedItemIds(itemIds: readonly string[]) {
  const seenItemIds = new Set<WorkbenchNavigationItemId>()
  const normalizedItemIds: WorkbenchNavigationItemId[] = []

  for (const itemId of itemIds) {
    if (!isWorkbenchNavigationItemId(itemId) || seenItemIds.has(itemId)) {
      continue
    }

    const item = getWorkbenchNavigationItem(itemId)

    if (!item?.pinnable || item.disabled) {
      continue
    }

    normalizedItemIds.push(itemId)
    seenItemIds.add(itemId)

    if (normalizedItemIds.length >= maxPinnedWorkbenchNavigationItems) {
      break
    }
  }

  return normalizedItemIds
}

function clonePreference(preference: WorkbenchNavigationPreference): WorkbenchNavigationPreference {
  return {
    ...preference,
    pinnedItemIds: [...preference.pinnedItemIds]
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkbenchNavigationStore, import.meta.hot))
}
