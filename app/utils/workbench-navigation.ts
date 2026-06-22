import type { WorkbenchWidgetKey } from '~/utils/workbench-widget-meta'

export type WorkbenchNavigationGroupKey = 'toolbox' | 'space'
export type WorkbenchNavigationItemId = 'home' | 'timer' | 'settings'

export interface WorkbenchNavigationGroup {
  key: WorkbenchNavigationGroupKey
  titleKey: string
}

export interface WorkbenchNavigationItem {
  id: WorkbenchNavigationItemId
  groupKey: WorkbenchNavigationGroupKey
  titleKey: string
  descriptionKey: string
  icon: string
  to?: string
  widgetKey?: WorkbenchWidgetKey
  pinnable?: boolean
  defaultPinned?: boolean
  disabled?: boolean
}

export const workbenchNavigationGroups: readonly WorkbenchNavigationGroup[] = [
  {
    key: 'toolbox',
    titleKey: 'workbench.navigation.groups.toolbox'
  },
  {
    key: 'space',
    titleKey: 'workbench.navigation.groups.space'
  }
] as const

export const workbenchNavigationItems: readonly WorkbenchNavigationItem[] = [
  {
    id: 'home',
    groupKey: 'toolbox',
    titleKey: 'workbench.navigation.items.home.title',
    descriptionKey: 'workbench.navigation.items.home.description',
    icon: 'i-lucide-house',
    to: '/'
  },
  {
    id: 'timer',
    groupKey: 'toolbox',
    titleKey: 'workbench.widgets.timer.title',
    descriptionKey: 'workbench.widgets.timer.description',
    icon: 'i-lucide-timer',
    widgetKey: 'timer',
    pinnable: true,
    defaultPinned: true
  },
  {
    id: 'settings',
    groupKey: 'space',
    titleKey: 'workbench.navigation.items.settings.title',
    descriptionKey: 'workbench.navigation.items.settings.description',
    icon: 'i-lucide-settings',
    to: '/settings'
  }
] as const

export const workbenchNavigationItemIds = workbenchNavigationItems.map(item => item.id)
export const defaultPinnedWorkbenchNavigationItemIds = workbenchNavigationItems
  .filter(item => item.defaultPinned)
  .map(item => item.id)

const workbenchNavigationItemsById = workbenchNavigationItems.reduce<Record<WorkbenchNavigationItemId, WorkbenchNavigationItem>>((itemsById, item) => {
  itemsById[item.id] = item
  return itemsById
}, {} as Record<WorkbenchNavigationItemId, WorkbenchNavigationItem>)

export function getWorkbenchNavigationItem(id: string) {
  return workbenchNavigationItemsById[id as WorkbenchNavigationItemId] ?? null
}

export function isWorkbenchNavigationItemId(id: string): id is WorkbenchNavigationItemId {
  return workbenchNavigationItemIds.includes(id as WorkbenchNavigationItemId)
}

export function isWorkbenchNavigationItemActive(item: WorkbenchNavigationItem, currentPath: string) {
  return Boolean(item.to && normalizeNavigationPath(item.to) === normalizeNavigationPath(currentPath))
}

function normalizeNavigationPath(path: string) {
  return path === '' ? '/' : path.replace(/\/+$/, '') || '/'
}
