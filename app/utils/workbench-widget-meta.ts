export type WorkbenchWidgetKey = 'timer' | 'date-countdown'
export type WorkbenchWidgetOrientation = 'auto' | 'horizontal' | 'vertical'
export type ResolvedWorkbenchWidgetOrientation = Exclude<WorkbenchWidgetOrientation, 'auto'>
export type WorkbenchWidgetModuleDataContract =
  | { scope: 'none' }
  | { scope: 'shared', endpoint: string }
export type WorkbenchWidgetModulePreferenceContract =
  | { scope: 'none' }
  | { scope: 'account', endpoint: string }
export type WorkbenchWidgetRuntimeStateContract =
  | { scope: 'none' }
  | { scope: 'device', storage: 'localStorage' }

export interface WorkbenchWidgetConstraints {
  minColSpan?: number
  maxColSpan?: number
  minRowSpan?: number
  maxRowSpan?: number
}

export interface WorkbenchWidgetMetadata {
  key: WorkbenchWidgetKey
  titleKey: string
  descriptionKey: string
  icon: string
  accentClass: string
  defaultLayout: {
    colSpan: number
    rowSpan: number
  }
  constraints?: WorkbenchWidgetConstraints
  supportedOrientations?: readonly WorkbenchWidgetOrientation[]
  data: {
    moduleData: WorkbenchWidgetModuleDataContract
    modulePreferences: WorkbenchWidgetModulePreferenceContract
    runtimeState: WorkbenchWidgetRuntimeStateContract
  }
}

export const workbenchWidgetOrientations = ['auto', 'horizontal', 'vertical'] as const satisfies readonly WorkbenchWidgetOrientation[]

export const workbenchWidgetMetadata = [
  {
    key: 'timer',
    titleKey: 'workbench.widgets.timer.title',
    descriptionKey: 'workbench.widgets.timer.description',
    icon: 'i-lucide-timer',
    accentClass: 'from-amber-200/70 via-orange-200/50 to-rose-200/55 dark:from-amber-200/24 dark:via-orange-300/18 dark:to-rose-300/20',
    defaultLayout: {
      colSpan: 1,
      rowSpan: 1
    },
    supportedOrientations: workbenchWidgetOrientations,
    data: {
      moduleData: {
        scope: 'none'
      },
      modulePreferences: {
        scope: 'account',
        endpoint: '/api/v1/timer/preferences'
      },
      runtimeState: {
        scope: 'device',
        storage: 'localStorage'
      }
    }
  },
  {
    key: 'date-countdown',
    titleKey: 'workbench.widgets.dateCountdown.title',
    descriptionKey: 'workbench.widgets.dateCountdown.description',
    icon: 'i-lucide-calendar-days',
    accentClass: 'from-sky-200/70 via-cyan-200/45 to-emerald-200/55 dark:from-sky-300/22 dark:via-cyan-300/16 dark:to-emerald-300/18',
    defaultLayout: {
      colSpan: 1,
      rowSpan: 1
    },
    supportedOrientations: workbenchWidgetOrientations,
    data: {
      moduleData: {
        scope: 'shared',
        endpoint: '/api/v1/holidays'
      },
      modulePreferences: {
        scope: 'none'
      },
      runtimeState: {
        scope: 'none'
      }
    }
  }
] as const satisfies readonly WorkbenchWidgetMetadata[]

export const workbenchWidgetMetadataByKey = workbenchWidgetMetadata.reduce<Record<WorkbenchWidgetKey, WorkbenchWidgetMetadata>>((metadataByKey, metadata) => {
  metadataByKey[metadata.key] = metadata
  return metadataByKey
}, {} as Record<WorkbenchWidgetKey, WorkbenchWidgetMetadata>)

export const workbenchWidgetKeys = workbenchWidgetMetadata.map(metadata => metadata.key)

export function getWorkbenchWidgetMetadata(key: string) {
  return workbenchWidgetMetadataByKey[key as WorkbenchWidgetKey] ?? null
}

export function constrainWorkbenchWidgetSpan(key: WorkbenchWidgetKey, colSpan: number, rowSpan: number, rows: number, columns: number) {
  const definition = getWorkbenchWidgetMetadata(key)
  const constraints = definition?.constraints
  const minColSpan = clampInteger(constraints?.minColSpan ?? 1, 1, columns)
  const maxColSpan = clampInteger(constraints?.maxColSpan ?? columns, minColSpan, columns)
  const minRowSpan = clampInteger(constraints?.minRowSpan ?? 1, 1, rows)
  const maxRowSpan = clampInteger(constraints?.maxRowSpan ?? rows, minRowSpan, rows)

  return {
    colSpan: clampInteger(colSpan, minColSpan, maxColSpan),
    rowSpan: clampInteger(rowSpan, minRowSpan, maxRowSpan)
  }
}

function clampInteger(value: number, min: number, max: number) {
  const integer = Number.isFinite(value) ? Math.trunc(value) : min

  return Math.min(Math.max(integer, min), max)
}
