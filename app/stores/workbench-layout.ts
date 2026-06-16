import { useStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { z } from 'zod'
import { getWorkbenchWidgetMetadata, workbenchWidgetKeys, workbenchWidgetMetadata, type WorkbenchWidgetKey } from '~/utils/workbench-widget-meta'

const layoutStorageKey = 'hdx:web:workbench-layout:v1'
const minGridSize = 1
const maxGridSize = 8
const minGap = 2
const maxGap = 24

const workbenchWidgetKeySchema = z.enum(workbenchWidgetKeys as [WorkbenchWidgetKey, ...WorkbenchWidgetKey[]])

export const workbenchLayoutWidgetSchema = z.object({
  id: z.string().min(1),
  key: workbenchWidgetKeySchema,
  order: z.number().int().nonnegative(),
  colSpan: z.number().int().min(1).max(maxGridSize),
  rowSpan: z.number().int().min(1).max(maxGridSize)
})

export const workbenchLayoutSchema = z.object({
  version: z.literal(1),
  rows: z.number().int().min(minGridSize).max(maxGridSize),
  columns: z.number().int().min(minGridSize).max(maxGridSize),
  gap: z.number().int().min(minGap).max(maxGap),
  widgets: z.array(workbenchLayoutWidgetSchema).min(1).max(24)
})

export type WorkbenchLayoutWidget = z.infer<typeof workbenchLayoutWidgetSchema>
export type WorkbenchLayout = z.infer<typeof workbenchLayoutSchema>

export interface PlacedWorkbenchWidget extends WorkbenchLayoutWidget {
  row: number
  column: number
}

export interface WorkbenchLayoutSummary {
  rows: number
  columns: number
  gap: number
  widgets: number
  placed: number
  occupiedCells: number
}

export const defaultWorkbenchLayout = createDefaultWorkbenchLayout()

export const useWorkbenchLayoutStore = defineStore('workbench-layout', () => {
  const storedLayout = useStorage<WorkbenchLayout>(
    layoutStorageKey,
    cloneLayout(defaultWorkbenchLayout),
    undefined,
    {
      deep: true,
      mergeDefaults: false,
      serializer: {
        read: readStoredLayout,
        write: value => JSON.stringify(normalizeLayout(value))
      }
    }
  )

  const editing = ref(false)
  const draft = ref<WorkbenchLayout>(cloneLayout(storedLayout.value))
  const draggedWidgetId = ref<string | null>(null)
  const dropTargetWidgetId = ref<string | null>(null)
  const resizingWidgetId = ref<string | null>(null)

  const layout = computed(() => editing.value ? draft.value : storedLayout.value)
  const previewLayout = computed(() => {
    if (!editing.value || !draggedWidgetId.value || !dropTargetWidgetId.value || draggedWidgetId.value === dropTargetWidgetId.value) {
      return layout.value
    }

    return normalizeLayout({
      ...layout.value,
      widgets: reorderLayoutWidgets(layout.value.widgets, draggedWidgetId.value, dropTargetWidgetId.value)
    })
  })
  const rows = computed(() => layout.value.rows)
  const columns = computed(() => layout.value.columns)
  const gap = computed(() => layout.value.gap)
  const widgets = computed(() => sortedWidgets(layout.value.widgets))
  const placedWidgets = computed(() => placeWorkbenchWidgets(previewLayout.value))
  const draggedPlacedWidget = computed(() => placedWidgets.value.find(widget => widget.id === draggedWidgetId.value) ?? null)
  const occupiedCells = computed(() => placedWidgets.value.reduce((total, widget) => total + widget.colSpan * widget.rowSpan, 0))
  const totalCells = computed(() => rows.value * columns.value)
  const emptyCellCount = computed(() => Math.max(totalCells.value - occupiedCells.value, 0))
  const summary = computed<WorkbenchLayoutSummary>(() => ({
    rows: rows.value,
    columns: columns.value,
    gap: gap.value,
    widgets: widgets.value.length,
    placed: placedWidgets.value.length,
    occupiedCells: occupiedCells.value
  }))

  function startEditing() {
    draft.value = cloneLayout(storedLayout.value)
    draggedWidgetId.value = null
    dropTargetWidgetId.value = null
    resizingWidgetId.value = null
    editing.value = true
  }

  function cancelEditing() {
    draft.value = cloneLayout(storedLayout.value)
    draggedWidgetId.value = null
    dropTargetWidgetId.value = null
    resizingWidgetId.value = null
    editing.value = false
  }

  function saveEditing() {
    storedLayout.value = normalizeLayout(draft.value)
    draft.value = cloneLayout(storedLayout.value)
    draggedWidgetId.value = null
    dropTargetWidgetId.value = null
    resizingWidgetId.value = null
    editing.value = false
  }

  function resetLayout() {
    draft.value = cloneLayout(defaultWorkbenchLayout)
    draggedWidgetId.value = null
    dropTargetWidgetId.value = null
    resizingWidgetId.value = null
  }

  function setRows(value: number) {
    updateDraftLayout({ rows: clampInteger(value, minGridSize, maxGridSize) })
  }

  function setColumns(value: number) {
    updateDraftLayout({ columns: clampInteger(value, minGridSize, maxGridSize) })
  }

  function setGap(value: number) {
    updateDraftLayout({ gap: clampInteger(value, minGap, maxGap) })
  }

  function addWidget(key?: WorkbenchWidgetKey) {
    const widgetKey = key ?? findFirstAvailableWidgetKey(draft.value.widgets) ?? 'quick-links'
    const definition = getWorkbenchWidgetMetadata(widgetKey)

    if (!definition) {
      return
    }

    draft.value = normalizeLayout({
      ...draft.value,
      widgets: [
        ...draft.value.widgets,
        {
          id: createWidgetId(widgetKey),
          key: widgetKey,
          order: draft.value.widgets.length,
          colSpan: definition.defaultLayout.colSpan,
          rowSpan: definition.defaultLayout.rowSpan
        }
      ]
    })
  }

  function removeWidget(widgetId: string) {
    draft.value = normalizeLayout({
      ...draft.value,
      widgets: draft.value.widgets.filter(widget => widget.id !== widgetId)
    })
  }

  function updateWidgetSpan(widgetId: string, patch: Partial<Pick<WorkbenchLayoutWidget, 'colSpan' | 'rowSpan'>>) {
    const nextLayout = normalizeLayout({
      ...draft.value,
      widgets: draft.value.widgets.map((widget) => {
        if (widget.id !== widgetId) {
          return widget
        }

        return {
          ...widget,
          ...patch
        }
      })
    })

    if (!canPlaceAllWidgets(nextLayout)) {
      return
    }

    draft.value = nextLayout
  }

  function beginDrag(widgetId: string) {
    if (!editing.value) {
      return
    }

    draggedWidgetId.value = widgetId
    dropTargetWidgetId.value = null
  }

  function markDropTarget(widgetId: string | null) {
    if (!editing.value) {
      return
    }

    dropTargetWidgetId.value = widgetId
  }

  function previewDragOverWidget(targetWidgetId: string | null) {
    if (!editing.value) {
      return
    }

    const sourceWidgetId = draggedWidgetId.value

    if (!sourceWidgetId || !targetWidgetId || sourceWidgetId === targetWidgetId) {
      dropTargetWidgetId.value = null
      return
    }

    if (dropTargetWidgetId.value === targetWidgetId) {
      return
    }

    dropTargetWidgetId.value = targetWidgetId
  }

  function dropOnWidget(targetWidgetId: string) {
    const sourceWidgetId = draggedWidgetId.value

    if (!sourceWidgetId || sourceWidgetId === targetWidgetId) {
      endDrag()
      return
    }

    reorderWidgets(sourceWidgetId, targetWidgetId)

    endDrag()
  }

  function dropOnMarkedTarget() {
    const targetWidgetId = dropTargetWidgetId.value

    if (!targetWidgetId) {
      endDrag()
      return
    }

    dropOnWidget(targetWidgetId)
  }

  function endDrag() {
    draggedWidgetId.value = null
    dropTargetWidgetId.value = null
  }

  function beginResize(widgetId: string) {
    if (!editing.value) {
      return
    }

    resizingWidgetId.value = widgetId
    endDrag()
  }

  function endResize() {
    resizingWidgetId.value = null
  }

  function reorderWidgets(sourceWidgetId: string, targetWidgetId: string) {
    draft.value = normalizeLayout({
      ...draft.value,
      widgets: reorderLayoutWidgets(draft.value.widgets, sourceWidgetId, targetWidgetId)
    })
  }

  function moveWidget(widgetId: string, direction: -1 | 1) {
    const orderedWidgets = sortedWidgets(draft.value.widgets)
    const currentIndex = orderedWidgets.findIndex(widget => widget.id === widgetId)
    const targetIndex = currentIndex + direction

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedWidgets.length) {
      return
    }

    const [movedWidget] = orderedWidgets.splice(currentIndex, 1)

    if (!movedWidget) {
      return
    }

    orderedWidgets.splice(targetIndex, 0, movedWidget)
    draft.value = normalizeLayout({
      ...draft.value,
      widgets: orderedWidgets.map((widget, index) => ({
        ...widget,
        order: index
      }))
    })
  }

  function updateDraftLayout(patch: Partial<Pick<WorkbenchLayout, 'rows' | 'columns' | 'gap'>>) {
    draft.value = normalizeLayout({
      ...draft.value,
      ...patch
    })
  }

  return {
    editing,
    draggedWidgetId,
    dropTargetWidgetId,
    resizingWidgetId,
    layout,
    previewLayout,
    rows,
    columns,
    gap,
    widgets,
    placedWidgets,
    draggedPlacedWidget,
    occupiedCells,
    totalCells,
    emptyCellCount,
    summary,
    startEditing,
    cancelEditing,
    saveEditing,
    resetLayout,
    setRows,
    setColumns,
    setGap,
    addWidget,
    removeWidget,
    updateWidgetSpan,
    beginDrag,
    markDropTarget,
    previewDragOverWidget,
    dropOnWidget,
    dropOnMarkedTarget,
    endDrag,
    beginResize,
    endResize,
    reorderWidgets,
    moveWidget
  }
})

export function createDefaultWorkbenchLayout(): WorkbenchLayout {
  return normalizeLayout({
    version: 1,
    rows: 4,
    columns: 4,
    gap: 12,
    widgets: workbenchWidgetMetadata.map((definition, index) => ({
      id: `default-${definition.key}`,
      key: definition.key,
      order: index,
      colSpan: definition.defaultLayout.colSpan,
      rowSpan: definition.defaultLayout.rowSpan
    }))
  })
}

export function readStoredLayout(value: string): WorkbenchLayout {
  if (!value) {
    return cloneLayout(defaultWorkbenchLayout)
  }

  try {
    return normalizeLayout(JSON.parse(value))
  } catch {
    return cloneLayout(defaultWorkbenchLayout)
  }
}

export function normalizeLayout(value: unknown): WorkbenchLayout {
  const parsed = workbenchLayoutSchema.safeParse(value)

  if (!parsed.success) {
    return cloneLayout(defaultWorkbenchLayout)
  }

  const rows = clampInteger(parsed.data.rows, minGridSize, maxGridSize)
  const columns = clampInteger(parsed.data.columns, minGridSize, maxGridSize)
  const normalizedWidgets = sortedWidgets(parsed.data.widgets)
    .map((widget, index) => ({
      ...widget,
      order: index,
      colSpan: clampInteger(widget.colSpan, 1, columns),
      rowSpan: clampInteger(widget.rowSpan, 1, rows)
    }))

  return {
    version: 1,
    rows,
    columns,
    gap: clampInteger(parsed.data.gap, minGap, maxGap),
    widgets: normalizedWidgets
  }
}

export function placeWorkbenchWidgets(layout: WorkbenchLayout): PlacedWorkbenchWidget[] {
  const normalizedLayout = normalizeLayout(layout)
  const occupied = Array.from({ length: normalizedLayout.rows }, () => Array.from({ length: normalizedLayout.columns }, () => false))
  const placedWidgets: PlacedWorkbenchWidget[] = []

  for (const widget of sortedWidgets(normalizedLayout.widgets)) {
    const colSpan = clampInteger(widget.colSpan, 1, normalizedLayout.columns)
    const rowSpan = clampInteger(widget.rowSpan, 1, normalizedLayout.rows)
    const position = findWidgetPosition(occupied, colSpan, rowSpan)

    if (!position) {
      continue
    }

    for (let row = position.row; row < position.row + rowSpan; row += 1) {
      const occupiedRow = occupied[row]

      if (!occupiedRow) {
        continue
      }

      for (let column = position.column; column < position.column + colSpan; column += 1) {
        occupiedRow[column] = true
      }
    }

    placedWidgets.push({
      ...widget,
      colSpan,
      rowSpan,
      row: position.row,
      column: position.column
    })
  }

  return placedWidgets
}

export function reorderLayoutWidgets(widgets: WorkbenchLayoutWidget[], sourceWidgetId: string, targetWidgetId: string) {
  const orderedWidgets = sortedWidgets(widgets)
  const sourceIndex = orderedWidgets.findIndex(widget => widget.id === sourceWidgetId)
  const targetIndex = orderedWidgets.findIndex(widget => widget.id === targetWidgetId)

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return orderedWidgets
  }

  const [sourceWidget] = orderedWidgets.splice(sourceIndex, 1)

  if (!sourceWidget) {
    return orderedWidgets
  }

  orderedWidgets.splice(targetIndex, 0, sourceWidget)

  return orderedWidgets.map((widget, index) => ({
    ...widget,
    order: index
  }))
}

function findWidgetPosition(occupied: boolean[][], colSpan: number, rowSpan: number) {
  for (let row = 0; row <= occupied.length - rowSpan; row += 1) {
    const occupiedRow = occupied[row]

    if (!occupiedRow) {
      continue
    }

    for (let column = 0; column <= occupiedRow.length - colSpan; column += 1) {
      if (canPlaceWidget(occupied, row, column, colSpan, rowSpan)) {
        return { row, column }
      }
    }
  }

  return null
}

function canPlaceWidget(occupied: boolean[][], startRow: number, startColumn: number, colSpan: number, rowSpan: number) {
  for (let row = startRow; row < startRow + rowSpan; row += 1) {
    for (let column = startColumn; column < startColumn + colSpan; column += 1) {
      if (occupied[row]?.[column] !== false) {
        return false
      }
    }
  }

  return true
}

function canPlaceAllWidgets(layout: WorkbenchLayout) {
  const normalizedLayout = normalizeLayout(layout)
  return placeWorkbenchWidgets(normalizedLayout).length === normalizedLayout.widgets.length
}

function sortedWidgets(widgets: WorkbenchLayoutWidget[]) {
  return [...widgets].sort((left, right) => left.order - right.order)
}

function cloneLayout(layout: WorkbenchLayout): WorkbenchLayout {
  return {
    ...layout,
    widgets: layout.widgets.map(widget => ({ ...widget }))
  }
}

function clampInteger(value: number, min: number, max: number) {
  const integer = Number.isFinite(value) ? Math.trunc(value) : min
  return Math.min(Math.max(integer, min), max)
}

function findFirstAvailableWidgetKey(widgets: WorkbenchLayoutWidget[]) {
  const usedKeys = new Set(widgets.map(widget => widget.key))
  return workbenchWidgetKeys.find(key => !usedKeys.has(key)) ?? null
}

function createWidgetId(key: WorkbenchWidgetKey) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${key}-${crypto.randomUUID()}`
  }

  return `${key}-${Date.now().toString(36)}`
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkbenchLayoutStore, import.meta.hot))
}
