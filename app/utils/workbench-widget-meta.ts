export type WorkbenchWidgetKey = 'quick-links' | 'tool-catalog' | 'notes' | 'runtime'

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
}

export const workbenchWidgetMetadata = [
  {
    key: 'quick-links',
    titleKey: 'workbench.widgets.quickLinks.title',
    descriptionKey: 'workbench.widgets.quickLinks.description',
    icon: 'lucide:sparkles',
    accentClass: 'from-cyan-300/70 via-sky-300/50 to-indigo-300/60 dark:from-cyan-300/30 dark:via-sky-400/20 dark:to-indigo-400/25',
    defaultLayout: {
      colSpan: 2,
      rowSpan: 1
    }
  },
  {
    key: 'tool-catalog',
    titleKey: 'workbench.widgets.toolCatalog.title',
    descriptionKey: 'workbench.widgets.toolCatalog.description',
    icon: 'lucide:boxes',
    accentClass: 'from-emerald-300/70 via-teal-300/45 to-cyan-300/55 dark:from-emerald-300/24 dark:via-teal-300/20 dark:to-cyan-400/22',
    defaultLayout: {
      colSpan: 2,
      rowSpan: 2
    }
  },
  {
    key: 'notes',
    titleKey: 'workbench.widgets.notes.title',
    descriptionKey: 'workbench.widgets.notes.description',
    icon: 'lucide:notebook-pen',
    accentClass: 'from-fuchsia-300/65 via-rose-300/45 to-amber-200/55 dark:from-fuchsia-300/22 dark:via-rose-300/20 dark:to-amber-300/18',
    defaultLayout: {
      colSpan: 1,
      rowSpan: 2
    }
  },
  {
    key: 'runtime',
    titleKey: 'workbench.widgets.runtime.title',
    descriptionKey: 'workbench.widgets.runtime.description',
    icon: 'lucide:activity',
    accentClass: 'from-blue-300/65 via-violet-300/45 to-slate-200/65 dark:from-blue-300/22 dark:via-violet-300/18 dark:to-white/10',
    defaultLayout: {
      colSpan: 1,
      rowSpan: 1
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
