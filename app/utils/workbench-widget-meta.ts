export type WorkbenchWidgetKey = 'quick-links' | 'tool-catalog' | 'notes' | 'runtime'
export type WorkbenchWidgetOrientation = 'auto' | 'horizontal' | 'vertical'
export type ResolvedWorkbenchWidgetOrientation = Exclude<WorkbenchWidgetOrientation, 'auto'>

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
}

export const workbenchWidgetOrientations = ['auto', 'horizontal', 'vertical'] as const satisfies readonly WorkbenchWidgetOrientation[]

export const workbenchWidgetMetadata = [
  {
    key: 'quick-links',
    titleKey: 'workbench.widgets.quickLinks.title',
    descriptionKey: 'workbench.widgets.quickLinks.description',
    icon: 'i-lucide-sparkles',
    accentClass: 'from-cyan-300/70 via-sky-300/50 to-indigo-300/60 dark:from-cyan-300/30 dark:via-sky-400/20 dark:to-indigo-400/25',
    defaultLayout: {
      colSpan: 2,
      rowSpan: 1
    },
    supportedOrientations: workbenchWidgetOrientations
  },
  {
    key: 'tool-catalog',
    titleKey: 'workbench.widgets.toolCatalog.title',
    descriptionKey: 'workbench.widgets.toolCatalog.description',
    icon: 'i-lucide-boxes',
    accentClass: 'from-emerald-300/70 via-teal-300/45 to-cyan-300/55 dark:from-emerald-300/24 dark:via-teal-300/20 dark:to-cyan-400/22',
    defaultLayout: {
      colSpan: 2,
      rowSpan: 2
    },
    supportedOrientations: workbenchWidgetOrientations
  },
  {
    key: 'notes',
    titleKey: 'workbench.widgets.notes.title',
    descriptionKey: 'workbench.widgets.notes.description',
    icon: 'i-lucide-notebook-pen',
    accentClass: 'from-fuchsia-300/65 via-rose-300/45 to-amber-200/55 dark:from-fuchsia-300/22 dark:via-rose-300/20 dark:to-amber-300/18',
    defaultLayout: {
      colSpan: 1,
      rowSpan: 2
    },
    supportedOrientations: workbenchWidgetOrientations
  },
  {
    key: 'runtime',
    titleKey: 'workbench.widgets.runtime.title',
    descriptionKey: 'workbench.widgets.runtime.description',
    icon: 'i-lucide-activity',
    accentClass: 'from-blue-300/65 via-violet-300/45 to-slate-200/65 dark:from-blue-300/22 dark:via-violet-300/18 dark:to-white/10',
    defaultLayout: {
      colSpan: 1,
      rowSpan: 1
    },
    constraints: {
      maxColSpan: 2,
      maxRowSpan: 2
    },
    supportedOrientations: workbenchWidgetOrientations
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
