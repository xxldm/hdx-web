import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { z } from 'zod'
import { fetchWorkbenchLayout, saveWorkbenchLayout } from '~/utils/hdx-api-client'
import {
  constrainWorkbenchWidgetSpan,
  getWorkbenchWidgetMetadata,
  workbenchWidgetKeys,
  workbenchWidgetOrientations,
  type WorkbenchWidgetKey,
  type WorkbenchWidgetOrientation
} from '~/utils/workbench-widget-meta'

const minGridSize = 1
const maxGridSize = 8
const minGap = 2
const maxGap = 24
const maxWidgetCount = 24
export type WorkbenchDropPlacement = 'before' | 'after'
export type WorkbenchPushDirection = 'up' | 'down' | 'left' | 'right'
export type WorkbenchWidgetChrome = 'card' | 'bare'

export interface WorkbenchWidgetHeaderPreference {
  visible: boolean
  icon: boolean
  title: boolean
  description: boolean
}

export interface WorkbenchGridPosition {
  column: number
  row: number
}

const workbenchWidgetKeySchema = z.enum(workbenchWidgetKeys as [WorkbenchWidgetKey, ...WorkbenchWidgetKey[]])
const workbenchWidgetChromeSchema = z.enum(['card', 'bare']).default('card')
const workbenchWidgetOrientationSchema = z.enum([...workbenchWidgetOrientations] as [WorkbenchWidgetOrientation, ...WorkbenchWidgetOrientation[]]).default('auto')
const workbenchWidgetHeaderSchema = z.object({
  visible: z.boolean().default(true),
  icon: z.boolean().default(true),
  title: z.boolean().default(true),
  description: z.boolean().default(true)
}).default({
  visible: true,
  icon: true,
  title: true,
  description: true
})

export const workbenchLayoutWidgetSchema = z.object({
  id: z.string().min(1),
  key: workbenchWidgetKeySchema,
  order: z.number().int().nonnegative().optional(),
  column: z.number().int().nonnegative().optional(),
  row: z.number().int().nonnegative().optional(),
  colSpan: z.number().int().min(1).max(maxGridSize),
  rowSpan: z.number().int().min(1).max(maxGridSize),
  chrome: workbenchWidgetChromeSchema,
  orientation: workbenchWidgetOrientationSchema,
  header: workbenchWidgetHeaderSchema
})

export const workbenchLayoutSchema = z.object({
  version: z.literal(1),
  rows: z.number().int().min(minGridSize).max(maxGridSize),
  columns: z.number().int().min(minGridSize).max(maxGridSize),
  gap: z.number().int().min(minGap).max(maxGap),
  widgets: z.array(workbenchLayoutWidgetSchema).max(maxWidgetCount)
})

type WorkbenchLayoutWidgetInput = z.infer<typeof workbenchLayoutWidgetSchema>
export type WorkbenchLayoutInput = z.infer<typeof workbenchLayoutSchema>

export interface WorkbenchLayoutWidget {
  id: string
  key: WorkbenchWidgetKey
  order: number
  column: number
  row: number
  colSpan: number
  rowSpan: number
  chrome: WorkbenchWidgetChrome
  orientation: WorkbenchWidgetOrientation
  header: WorkbenchWidgetHeaderPreference
}

export interface WorkbenchLayout {
  version: 1
  rows: number
  columns: number
  gap: number
  widgets: WorkbenchLayoutWidget[]
}

export type PlacedWorkbenchWidget = WorkbenchLayoutWidget

export interface WorkbenchLayoutSummary {
  rows: number
  columns: number
  gap: number
  widgets: number
  placed: number
  occupiedCells: number
}

export const defaultWorkbenchLayoutWidgetKeys = ['timer'] as const satisfies readonly WorkbenchWidgetKey[]
export const emptyWorkbenchLayout = createEmptyWorkbenchLayout()
export const defaultWorkbenchLayout = createDefaultWorkbenchLayout()

export const useWorkbenchLayoutStore = defineStore('workbench-layout', () => {
  const remoteLayout = ref<WorkbenchLayout | null>(null)
  const initialized = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const errorKey = ref<string | null>(null)
  const editing = ref(false)
  const draft = ref<WorkbenchLayout>(cloneLayout(emptyWorkbenchLayout))
  const draggedWidgetId = ref<string | null>(null)
  const dropTargetWidgetId = ref<string | null>(null)
  const dropTargetPlacement = ref<WorkbenchDropPlacement>('before')
  const dropTargetPushDirection = ref<WorkbenchPushDirection | null>(null)
  const dropTargetColumn = ref<number | null>(null)
  const dropTargetRow = ref<number | null>(null)
  const resizingWidgetId = ref<string | null>(null)

  const layout = computed(() => editing.value ? draft.value : remoteLayout.value ?? emptyWorkbenchLayout)
  const previewLayout = computed(() => {
    if (!editing.value || !draggedWidgetId.value || dropTargetColumn.value === null || dropTargetRow.value === null) {
      return layout.value
    }

    return normalizeLayout({
      ...layout.value,
      widgets: moveLayoutWidget(
        layout.value.widgets,
        layout.value.rows,
        layout.value.columns,
        draggedWidgetId.value,
        { column: dropTargetColumn.value, row: dropTargetRow.value },
        dropTargetWidgetId.value,
        dropTargetPushDirection.value
      )
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

  async function loadLayout() {
    loading.value = true
    errorKey.value = null

    try {
      remoteLayout.value = normalizeLayout(await fetchWorkbenchLayout())
      draft.value = cloneLayout(remoteLayout.value)
    } catch {
      remoteLayout.value = null
      draft.value = cloneLayout(emptyWorkbenchLayout)
      errorKey.value = 'workbench.layout.loadFailed'
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  function startEditing() {
    draft.value = cloneLayout(currentPersistedLayout())
    clearDragTarget()
    resizingWidgetId.value = null
    editing.value = true
  }

  function cancelEditing() {
    draft.value = cloneLayout(currentPersistedLayout())
    clearDragTarget()
    resizingWidgetId.value = null
    editing.value = false
  }

  async function saveEditing() {
    saving.value = true
    errorKey.value = null

    try {
      remoteLayout.value = normalizeLayout(await saveWorkbenchLayout(normalizeLayout(draft.value)))
      draft.value = cloneLayout(remoteLayout.value)
      clearDragTarget()
      resizingWidgetId.value = null
      editing.value = false
    } catch {
      errorKey.value = 'workbench.layout.saveFailed'
    } finally {
      saving.value = false
    }
  }

  function resetLayout() {
    draft.value = cloneLayout(defaultWorkbenchLayout)
    clearDragTarget()
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
    const widgetKey = key ?? findFirstAvailableWidgetKey(draft.value.widgets) ?? 'timer'
    const widget = createNewLayoutWidget(widgetKey, draft.value.widgets.length, draft.value.rows, draft.value.columns)

    if (!widget) {
      return false
    }

    const position = findFirstAvailableWidgetPosition(draft.value.widgets, draft.value.rows, draft.value.columns, widget.colSpan, widget.rowSpan)

    if (!position) {
      return false
    }

    draft.value = normalizeLayout({
      ...draft.value,
      widgets: [
        ...draft.value.widgets,
        {
          ...widget,
          column: position.column,
          row: position.row
        }
      ]
    })

    return true
  }

  function addWidgetAt(key: WorkbenchWidgetKey, position: WorkbenchGridPosition) {
    const widget = createNewLayoutWidget(key, draft.value.widgets.length, draft.value.rows, draft.value.columns)

    if (!widget || !canPlaceWidgetAt(draft.value.widgets, widget, position, draft.value.rows, draft.value.columns)) {
      return false
    }

    draft.value = normalizeLayout({
      ...draft.value,
      widgets: [
        ...draft.value.widgets,
        {
          ...widget,
          column: position.column,
          row: position.row
        }
      ]
    })

    return true
  }

  function canAddWidgetAt(key: WorkbenchWidgetKey, position: WorkbenchGridPosition) {
    const widget = createNewLayoutWidget(key, draft.value.widgets.length, draft.value.rows, draft.value.columns)

    return Boolean(widget && canPlaceWidgetAt(draft.value.widgets, widget, position, draft.value.rows, draft.value.columns))
  }

  function canUpdateWidgetKey(widgetId: string, key: WorkbenchWidgetKey) {
    const widget = draft.value.widgets.find(widget => widget.id === widgetId)
    const definition = getWorkbenchWidgetMetadata(key)

    if (!widget || !definition) {
      return false
    }

    const constrainedSpan = constrainWidgetSpan(key, definition.defaultLayout.colSpan, definition.defaultLayout.rowSpan, draft.value.rows, draft.value.columns)
    const candidateWidget = {
      ...widget,
      key,
      colSpan: constrainedSpan.colSpan,
      rowSpan: constrainedSpan.rowSpan
    }

    return canPlaceWidgetAt(
      draft.value.widgets,
      candidateWidget,
      { column: widget.column, row: widget.row },
      draft.value.rows,
      draft.value.columns,
      [widget.id]
    )
  }

  function removeWidget(widgetId: string) {
    draft.value = normalizeLayout({
      ...draft.value,
      widgets: draft.value.widgets.filter(widget => widget.id !== widgetId)
    })
  }

  function updateWidgetKey(widgetId: string, key: WorkbenchWidgetKey) {
    const definition = getWorkbenchWidgetMetadata(key)

    if (!definition || !canUpdateWidgetKey(widgetId, key)) {
      return false
    }

    draft.value = normalizeLayout({
      ...draft.value,
      widgets: draft.value.widgets.map((widget) => {
        if (widget.id !== widgetId) {
          return widget
        }

        return {
          ...widget,
          key,
          ...constrainWidgetSpan(key, definition.defaultLayout.colSpan, definition.defaultLayout.rowSpan, draft.value.rows, draft.value.columns)
        }
      })
    })

    return true
  }

  function updateWidgetSpan(widgetId: string, patch: Partial<Pick<WorkbenchLayoutWidget, 'colSpan' | 'rowSpan'>>) {
    const nextWidgets = draft.value.widgets.map((widget) => {
      if (widget.id !== widgetId) {
        return widget
      }

      const constrainedSpan = constrainWidgetSpan(widget.key, patch.colSpan ?? widget.colSpan, patch.rowSpan ?? widget.rowSpan, draft.value.rows, draft.value.columns)

      return {
        ...widget,
        colSpan: constrainedSpan.colSpan,
        rowSpan: constrainedSpan.rowSpan,
        column: clampInteger(widget.column, 0, Math.max(draft.value.columns - constrainedSpan.colSpan, 0)),
        row: clampInteger(widget.row, 0, Math.max(draft.value.rows - constrainedSpan.rowSpan, 0))
      }
    })

    if (!canPlaceAllWidgetsInGrid(nextWidgets, draft.value.rows, draft.value.columns)) {
      return
    }

    draft.value = normalizeLayout({
      ...draft.value,
      widgets: nextWidgets
    })
  }

  function updateWidgetChrome(widgetId: string, chrome: WorkbenchWidgetChrome) {
    updateWidgetPreference(widgetId, { chrome })
  }

  function updateWidgetOrientation(widgetId: string, orientation: WorkbenchWidgetOrientation) {
    updateWidgetPreference(widgetId, { orientation })
  }

  function updateWidgetHeader(widgetId: string, patch: Partial<WorkbenchWidgetHeaderPreference>) {
    const widget = draft.value.widgets.find(widget => widget.id === widgetId)

    if (!widget) {
      return
    }

    updateWidgetPreference(widgetId, {
      header: {
        ...widget.header,
        ...patch
      }
    })
  }

  function beginDrag(widgetId: string) {
    if (!editing.value) {
      return
    }

    draggedWidgetId.value = widgetId
    dropTargetWidgetId.value = null
    dropTargetPlacement.value = 'before'
    dropTargetPushDirection.value = null
    dropTargetColumn.value = null
    dropTargetRow.value = null
  }

  function markDropTarget(widgetId: string | null) {
    if (!editing.value) {
      return
    }

    previewDragOverWidget(widgetId)
  }

  function previewDragOverWidget(
    targetWidgetId: string | null,
    placement: WorkbenchDropPlacement = 'before',
    pushDirection: WorkbenchPushDirection | null = null
  ) {
    if (!editing.value || !targetWidgetId) {
      clearDropTarget()
      return
    }

    const targetWidget = layout.value.widgets.find(widget => widget.id === targetWidgetId)

    if (!targetWidget) {
      clearDropTarget()
      return
    }

    previewDragOverPosition(targetWidgetId, { column: targetWidget.column, row: targetWidget.row }, placement, pushDirection)
  }

  function previewDragOverPosition(
    targetWidgetId: string | null,
    position: WorkbenchGridPosition,
    placement: WorkbenchDropPlacement = 'before',
    pushDirection: WorkbenchPushDirection | null = null
  ) {
    if (!editing.value || !draggedWidgetId.value) {
      return
    }

    const sourceWidget = layout.value.widgets.find(widget => widget.id === draggedWidgetId.value)

    if (!sourceWidget) {
      clearDropTarget()
      return
    }

    const nextPosition = clampWidgetPosition(position, sourceWidget, layout.value.rows, layout.value.columns)

    if (
      dropTargetWidgetId.value === targetWidgetId
      && dropTargetPlacement.value === placement
      && dropTargetPushDirection.value === pushDirection
      && dropTargetColumn.value === nextPosition.column
      && dropTargetRow.value === nextPosition.row
    ) {
      return
    }

    dropTargetWidgetId.value = targetWidgetId
    dropTargetPlacement.value = placement
    dropTargetPushDirection.value = pushDirection
    dropTargetColumn.value = nextPosition.column
    dropTargetRow.value = nextPosition.row
  }

  function dropOnWidget(targetWidgetId: string, placement: WorkbenchDropPlacement = dropTargetPlacement.value) {
    const targetWidget = layout.value.widgets.find(widget => widget.id === targetWidgetId)

    if (!targetWidget) {
      endDrag()
      return
    }

    dropOnPosition({ column: targetWidget.column, row: targetWidget.row }, targetWidgetId, placement)
  }

  function dropOnPosition(
    position: WorkbenchGridPosition,
    targetWidgetId: string | null = dropTargetWidgetId.value,
    placement: WorkbenchDropPlacement = dropTargetPlacement.value,
    pushDirection: WorkbenchPushDirection | null = dropTargetPushDirection.value
  ) {
    const sourceWidgetId = draggedWidgetId.value

    if (!sourceWidgetId) {
      endDrag()
      return
    }

    draft.value = normalizeLayout({
      ...draft.value,
      widgets: moveLayoutWidget(
        draft.value.widgets,
        draft.value.rows,
        draft.value.columns,
        sourceWidgetId,
        position,
        targetWidgetId,
        pushDirection
      )
    })

    dropTargetPlacement.value = placement
    endDrag()
  }

  function dropOnMarkedTarget() {
    if (dropTargetColumn.value === null || dropTargetRow.value === null) {
      endDrag()
      return
    }

    dropOnPosition({ column: dropTargetColumn.value, row: dropTargetRow.value }, dropTargetWidgetId.value, dropTargetPlacement.value)
  }

  function endDrag() {
    clearDragTarget()
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

  function reorderWidgets(sourceWidgetId: string, targetWidgetId: string, placement: WorkbenchDropPlacement = 'before') {
    const targetWidget = draft.value.widgets.find(widget => widget.id === targetWidgetId)

    if (!targetWidget) {
      return
    }

    draft.value = normalizeLayout({
      ...draft.value,
      widgets: moveLayoutWidget(draft.value.widgets, draft.value.rows, draft.value.columns, sourceWidgetId, { column: targetWidget.column, row: targetWidget.row }, targetWidgetId)
    })

    dropTargetPlacement.value = placement
  }

  function moveWidget(widgetId: string, direction: -1 | 1) {
    const orderedWidgets = sortedWidgets(draft.value.widgets)
    const currentIndex = orderedWidgets.findIndex(widget => widget.id === widgetId)
    const targetIndex = currentIndex + direction

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedWidgets.length) {
      return
    }

    const targetWidget = orderedWidgets[targetIndex]

    if (!targetWidget) {
      return
    }

    draft.value = normalizeLayout({
      ...draft.value,
      widgets: moveLayoutWidget(draft.value.widgets, draft.value.rows, draft.value.columns, widgetId, { column: targetWidget.column, row: targetWidget.row }, targetWidget.id)
    })
  }

  function updateDraftLayout(patch: Partial<Pick<WorkbenchLayout, 'rows' | 'columns' | 'gap'>>) {
    draft.value = normalizeLayout({
      ...draft.value,
      ...patch
    })
  }

  function updateWidgetPreference(widgetId: string, patch: Partial<Pick<WorkbenchLayoutWidget, 'chrome' | 'orientation' | 'header'>>) {
    draft.value = normalizeLayout({
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
  }

  function clearDropTarget() {
    dropTargetWidgetId.value = null
    dropTargetPlacement.value = 'before'
    dropTargetPushDirection.value = null
    dropTargetColumn.value = null
    dropTargetRow.value = null
  }

  function clearDragTarget() {
    draggedWidgetId.value = null
    clearDropTarget()
  }

  function resetState() {
    remoteLayout.value = null
    initialized.value = false
    loading.value = false
    saving.value = false
    errorKey.value = null
    editing.value = false
    draft.value = cloneLayout(emptyWorkbenchLayout)
    resizingWidgetId.value = null
    clearDragTarget()
  }

  function currentPersistedLayout() {
    return remoteLayout.value ?? emptyWorkbenchLayout
  }

  return {
    initialized,
    loading,
    saving,
    errorKey,
    editing,
    draggedWidgetId,
    dropTargetWidgetId,
    dropTargetPlacement,
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
    loadLayout,
    startEditing,
    cancelEditing,
    saveEditing,
    resetLayout,
    setRows,
    setColumns,
    setGap,
    addWidget,
    addWidgetAt,
    canAddWidgetAt,
    canUpdateWidgetKey,
    removeWidget,
    updateWidgetKey,
    updateWidgetSpan,
    updateWidgetChrome,
    updateWidgetOrientation,
    updateWidgetHeader,
    beginDrag,
    markDropTarget,
    previewDragOverWidget,
    previewDragOverPosition,
    dropOnWidget,
    dropOnPosition,
    dropOnMarkedTarget,
    endDrag,
    beginResize,
    endResize,
    reorderWidgets,
    moveWidget,
    resetState
  }
})

export function createDefaultWorkbenchLayout(): WorkbenchLayout {
  return normalizeLayout({
    version: 1,
    rows: 4,
    columns: 4,
    gap: 12,
    widgets: defaultWorkbenchLayoutWidgetKeys.map((key, index) => {
      const definition = getWorkbenchWidgetMetadata(key)

      if (!definition) {
        throw new Error(`默认工具箱布局引用了未注册组件：${key}`)
      }

      return {
        id: `default-${definition.key}`,
        key: definition.key,
        order: index,
        colSpan: definition.defaultLayout.colSpan,
        rowSpan: definition.defaultLayout.rowSpan,
        chrome: 'card',
        orientation: 'auto',
        header: createDefaultWidgetHeaderPreference()
      }
    })
  })
}

export function createEmptyWorkbenchLayout(): WorkbenchLayout {
  return normalizeLayout({
    version: 1,
    rows: 4,
    columns: 4,
    gap: 12,
    widgets: []
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

  return {
    version: 1,
    rows,
    columns,
    gap: clampInteger(parsed.data.gap, minGap, maxGap),
    widgets: normalizeWidgets(parsed.data.widgets, rows, columns)
  }
}

export function placeWorkbenchWidgets(layout: WorkbenchLayout): PlacedWorkbenchWidget[] {
  return sortedWidgets(normalizeLayout(layout).widgets)
}

export function moveLayoutWidget(
  widgets: WorkbenchLayoutWidget[],
  rows: number,
  columns: number,
  sourceWidgetId: string,
  targetPosition: WorkbenchGridPosition,
  targetWidgetId: string | null = null,
  pushDirection: WorkbenchPushDirection | null = null
) {
  const orderedWidgets = sortedWidgets(widgets)
  const sourceWidget = orderedWidgets.find(widget => widget.id === sourceWidgetId)

  if (!sourceWidget) {
    return orderedWidgets
  }

  const nextPosition = clampWidgetPosition(targetPosition, sourceWidget, rows, columns)

  if (targetWidgetId && targetWidgetId !== sourceWidgetId) {
    const targetWidget = orderedWidgets.find(widget => widget.id === targetWidgetId)

    if (targetWidget) {
      if (pushDirection) {
        const pushedWidgets = pushWidgetsFromDrop(
          orderedWidgets,
          rows,
          columns,
          sourceWidget,
          targetWidget,
          nextPosition,
          pushDirection
        )

        if (pushedWidgets) {
          return normalizeWidgetOrders(pushedWidgets)
        }
      }

      const swappedWidgets = orderedWidgets.map((widget) => {
        if (widget.id === sourceWidgetId) {
          return {
            ...widget,
            column: nextPosition.column,
            row: nextPosition.row
          }
        }

        if (widget.id === targetWidgetId) {
          return {
            ...widget,
            column: sourceWidget.column,
            row: sourceWidget.row
          }
        }

        return widget
      })

      if (canPlaceAllWidgetsInGrid(swappedWidgets, rows, columns)) {
        return normalizeWidgetOrders(swappedWidgets)
      }

      const widgetsWithMovedSource = orderedWidgets
        .filter(widget => widget.id !== targetWidgetId)
        .map((widget) => {
          if (widget.id !== sourceWidgetId) {
            return widget
          }

          return {
            ...widget,
            column: nextPosition.column,
            row: nextPosition.row
          }
        })
      const displacedTargetPosition = findNearestAvailableWidgetPosition(
        widgetsWithMovedSource,
        rows,
        columns,
        targetWidget.colSpan,
        targetWidget.rowSpan,
        { column: sourceWidget.column, row: sourceWidget.row }
      )

      if (displacedTargetPosition) {
        const displacedWidgets = orderedWidgets.map((widget) => {
          if (widget.id === sourceWidgetId) {
            return {
              ...widget,
              column: nextPosition.column,
              row: nextPosition.row
            }
          }

          if (widget.id === targetWidgetId) {
            return {
              ...widget,
              column: displacedTargetPosition.column,
              row: displacedTargetPosition.row
            }
          }

          return widget
        })

        if (canPlaceAllWidgetsInGrid(displacedWidgets, rows, columns)) {
          return normalizeWidgetOrders(displacedWidgets)
        }
      }
    }
  }

  const movedWidgets = orderedWidgets.map((widget) => {
    if (widget.id !== sourceWidgetId) {
      return widget
    }

    return {
      ...widget,
      column: nextPosition.column,
      row: nextPosition.row
    }
  })

  if (!canPlaceAllWidgetsInGrid(movedWidgets, rows, columns)) {
    return orderedWidgets
  }

  return normalizeWidgetOrders(movedWidgets)
}

function normalizeWidgets(widgets: WorkbenchLayoutWidgetInput[], rows: number, columns: number) {
  const orderedWidgets = widgets
    .map((widget, index) => ({
      widget,
      index,
      order: widget.order ?? index
    }))
    .sort((left, right) => left.order - right.order || left.index - right.index)
  const normalizedWidgets: WorkbenchLayoutWidget[] = []

  for (const { widget } of orderedWidgets) {
    const constrainedSpan = constrainWidgetSpan(widget.key, widget.colSpan, widget.rowSpan, rows, columns)
    const colSpan = constrainedSpan.colSpan
    const rowSpan = constrainedSpan.rowSpan
    const preferredPosition = typeof widget.column === 'number' && typeof widget.row === 'number'
      ? {
          column: clampInteger(widget.column, 0, Math.max(columns - colSpan, 0)),
          row: clampInteger(widget.row, 0, Math.max(rows - rowSpan, 0))
        }
      : null
    const candidateWidget = {
      id: widget.id,
      key: widget.key,
      order: normalizedWidgets.length,
      column: preferredPosition?.column ?? 0,
      row: preferredPosition?.row ?? 0,
      colSpan,
      rowSpan,
      chrome: widget.chrome,
      orientation: normalizeWidgetOrientation(widget.key, widget.orientation),
      header: { ...widget.header }
    }
    const position = preferredPosition && canPlaceWidgetAt(normalizedWidgets, candidateWidget, preferredPosition, rows, columns)
      ? preferredPosition
      : findFirstAvailableWidgetPosition(normalizedWidgets, rows, columns, colSpan, rowSpan)

    if (!position) {
      continue
    }

    normalizedWidgets.push({
      ...candidateWidget,
      column: position.column,
      row: position.row
    })
  }

  return normalizeWidgetOrders(normalizedWidgets)
}

function normalizeWidgetOrders(widgets: WorkbenchLayoutWidget[]) {
  return sortedWidgets(widgets).map((widget, index) => ({
    ...widget,
    order: index
  }))
}

function findFirstAvailableWidgetPosition(widgets: WorkbenchLayoutWidget[], rows: number, columns: number, colSpan: number, rowSpan: number) {
  return findWidgetPosition(createOccupiedGrid(widgets, rows, columns), colSpan, rowSpan)
}

function findNearestAvailableWidgetPosition(
  widgets: WorkbenchLayoutWidget[],
  rows: number,
  columns: number,
  colSpan: number,
  rowSpan: number,
  preferredPosition: WorkbenchGridPosition
) {
  const occupied = createOccupiedGrid(widgets, rows, columns)
  const positions: WorkbenchGridPosition[] = []

  for (let row = 0; row <= rows - rowSpan; row += 1) {
    for (let column = 0; column <= columns - colSpan; column += 1) {
      if (canPlaceWidgetInOccupiedGrid(occupied, row, column, colSpan, rowSpan)) {
        positions.push({ row, column })
      }
    }
  }

  return positions.sort((left, right) => {
    const leftDistance = Math.abs(left.column - preferredPosition.column) + Math.abs(left.row - preferredPosition.row)
    const rightDistance = Math.abs(right.column - preferredPosition.column) + Math.abs(right.row - preferredPosition.row)

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance
    }

    if (left.row !== right.row) {
      return left.row - right.row
    }

    return left.column - right.column
  })[0] ?? null
}

function pushWidgetsFromDrop(
  widgets: WorkbenchLayoutWidget[],
  rows: number,
  columns: number,
  sourceWidget: WorkbenchLayoutWidget,
  targetWidget: WorkbenchLayoutWidget,
  nextPosition: WorkbenchGridPosition,
  pushDirection: WorkbenchPushDirection
) {
  const widgetsById = new Map(widgets.map(widget => [widget.id, { ...widget }]))
  const movedSource = {
    ...sourceWidget,
    column: nextPosition.column,
    row: nextPosition.row
  }
  widgetsById.set(sourceWidget.id, movedSource)
  const collidingWidgets = sortWidgetsForPush(
    getCollidingWidgets(movedSource, widgetsById, sourceWidget.id),
    pushDirection
  )

  if (!collidingWidgets.some(widget => widget.id === targetWidget.id)) {
    return null
  }

  for (const collidingWidget of collidingWidgets) {
    const requiredSteps = getRequiredPushSteps(movedSource, collidingWidget, pushDirection)

    for (let step = 0; step < requiredSteps; step += 1) {
      if (!shiftWidgetChainOneCell(widgetsById, collidingWidget.id, pushDirection, rows, columns, [sourceWidget.id])) {
        return null
      }
    }
  }

  if (getCollidingWidgets(movedSource, widgetsById, sourceWidget.id).length > 0) {
    return null
  }

  return [...widgetsById.values()]
}

function shiftWidgetChainOneCell(
  widgetsById: Map<string, WorkbenchLayoutWidget>,
  widgetId: string,
  pushDirection: WorkbenchPushDirection,
  rows: number,
  columns: number,
  ignoredCollisionWidgetIds: string[] = []
) {
  const snapshot = cloneWidgetMap(widgetsById)
  const widget = widgetsById.get(widgetId)

  if (!widget) {
    return false
  }

  const { columnDelta, rowDelta } = getPushDirectionDelta(pushDirection)
  const candidateWidget = {
    ...widget,
    column: widget.column + columnDelta,
    row: widget.row + rowDelta
  }

  if (!isWidgetInsideGrid(candidateWidget, rows, columns)) {
    restoreWidgetMap(widgetsById, snapshot)
    return false
  }

  const ignoredCollisionIds = new Set(ignoredCollisionWidgetIds)
  const collidingWidgets = sortWidgetsForPush(
    getCollidingWidgets(candidateWidget, widgetsById, widgetId, ignoredCollisionIds),
    pushDirection
  )

  for (const collidingWidget of collidingWidgets) {
    if (!shiftWidgetChainOneCell(widgetsById, collidingWidget.id, pushDirection, rows, columns, ignoredCollisionWidgetIds)) {
      restoreWidgetMap(widgetsById, snapshot)
      return false
    }
  }

  if (getCollidingWidgets(candidateWidget, widgetsById, widgetId, ignoredCollisionIds).length > 0) {
    restoreWidgetMap(widgetsById, snapshot)
    return false
  }

  widgetsById.set(widgetId, candidateWidget)
  return true
}

function getRequiredPushSteps(
  sourceWidget: WorkbenchLayoutWidget,
  targetWidget: WorkbenchLayoutWidget,
  pushDirection: WorkbenchPushDirection
) {
  switch (pushDirection) {
    case 'down':
      return Math.max(sourceWidget.row + sourceWidget.rowSpan - targetWidget.row, 1)
    case 'up':
      return Math.max(targetWidget.row + targetWidget.rowSpan - sourceWidget.row, 1)
    case 'right':
      return Math.max(sourceWidget.column + sourceWidget.colSpan - targetWidget.column, 1)
    case 'left':
      return Math.max(targetWidget.column + targetWidget.colSpan - sourceWidget.column, 1)
  }
}

function getPushDirectionDelta(pushDirection: WorkbenchPushDirection) {
  switch (pushDirection) {
    case 'up':
      return { columnDelta: 0, rowDelta: -1 }
    case 'down':
      return { columnDelta: 0, rowDelta: 1 }
    case 'left':
      return { columnDelta: -1, rowDelta: 0 }
    case 'right':
      return { columnDelta: 1, rowDelta: 0 }
  }
}

function sortWidgetsForPush(widgets: WorkbenchLayoutWidget[], pushDirection: WorkbenchPushDirection) {
  return [...widgets].sort((left, right) => {
    if (pushDirection === 'down') {
      if (left.row !== right.row) {
        return right.row - left.row
      }
    } else if (pushDirection === 'up') {
      if (left.row !== right.row) {
        return left.row - right.row
      }
    } else if (pushDirection === 'right') {
      if (left.column !== right.column) {
        return right.column - left.column
      }
    } else if (left.column !== right.column) {
      return left.column - right.column
    }

    if (left.row !== right.row) {
      return left.row - right.row
    }

    if (left.column !== right.column) {
      return left.column - right.column
    }

    return left.id.localeCompare(right.id)
  })
}

function getCollidingWidgets(
  widget: WorkbenchLayoutWidget,
  widgetsById: Map<string, WorkbenchLayoutWidget>,
  ignoredWidgetId: string,
  ignoredWidgetIds: Set<string> = new Set()
) {
  return [...widgetsById.values()].filter(existingWidget =>
    existingWidget.id !== ignoredWidgetId && !ignoredWidgetIds.has(existingWidget.id) && gridWidgetsCollide(widget, existingWidget)
  )
}

function cloneWidgetMap(widgetsById: Map<string, WorkbenchLayoutWidget>) {
  return new Map([...widgetsById.entries()].map(([widgetId, widget]) => [widgetId, { ...widget }]))
}

function restoreWidgetMap(
  widgetsById: Map<string, WorkbenchLayoutWidget>,
  snapshot: Map<string, WorkbenchLayoutWidget>
) {
  widgetsById.clear()

  for (const [widgetId, widget] of snapshot.entries()) {
    widgetsById.set(widgetId, { ...widget })
  }
}

function findWidgetPosition(occupied: boolean[][], colSpan: number, rowSpan: number) {
  for (let row = 0; row <= occupied.length - rowSpan; row += 1) {
    const occupiedRow = occupied[row]

    if (!occupiedRow) {
      continue
    }

    for (let column = 0; column <= occupiedRow.length - colSpan; column += 1) {
      if (canPlaceWidgetInOccupiedGrid(occupied, row, column, colSpan, rowSpan)) {
        return { row, column }
      }
    }
  }

  return null
}

function createOccupiedGrid(widgets: WorkbenchLayoutWidget[], rows: number, columns: number, ignoredWidgetIds: string[] = []) {
  const ignoredIds = new Set(ignoredWidgetIds)
  const occupied = Array.from({ length: rows }, () => Array.from({ length: columns }, () => false))

  for (const widget of widgets) {
    if (ignoredIds.has(widget.id)) {
      continue
    }

    for (let row = widget.row; row < widget.row + widget.rowSpan; row += 1) {
      const occupiedRow = occupied[row]

      if (!occupiedRow) {
        continue
      }

      for (let column = widget.column; column < widget.column + widget.colSpan; column += 1) {
        if (occupiedRow[column] === false) {
          occupiedRow[column] = true
        }
      }
    }
  }

  return occupied
}

function canPlaceWidgetInOccupiedGrid(occupied: boolean[][], startRow: number, startColumn: number, colSpan: number, rowSpan: number) {
  for (let row = startRow; row < startRow + rowSpan; row += 1) {
    for (let column = startColumn; column < startColumn + colSpan; column += 1) {
      if (occupied[row]?.[column] !== false) {
        return false
      }
    }
  }

  return true
}

function canPlaceWidgetAt(widgets: WorkbenchLayoutWidget[], widget: WorkbenchLayoutWidget, position: WorkbenchGridPosition, rows: number, columns: number, ignoredWidgetIds: string[] = []) {
  const candidateWidget = {
    ...widget,
    column: position.column,
    row: position.row
  }
  const ignoredIds = new Set([...ignoredWidgetIds, widget.id])

  if (!isWidgetInsideGrid(candidateWidget, rows, columns)) {
    return false
  }

  return widgets.every(existingWidget => ignoredIds.has(existingWidget.id) || !gridWidgetsCollide(candidateWidget, existingWidget))
}

function canPlaceAllWidgetsInGrid(widgets: WorkbenchLayoutWidget[], rows: number, columns: number) {
  return widgets.every((widget, index) => {
    if (!isWidgetInsideGrid(widget, rows, columns)) {
      return false
    }

    return widgets.every((otherWidget, otherIndex) => index === otherIndex || !gridWidgetsCollide(widget, otherWidget))
  })
}

function isWidgetInsideGrid(widget: WorkbenchLayoutWidget, rows: number, columns: number) {
  return widget.column >= 0
    && widget.row >= 0
    && widget.column + widget.colSpan <= columns
    && widget.row + widget.rowSpan <= rows
}

function gridWidgetsCollide(left: WorkbenchLayoutWidget, right: WorkbenchLayoutWidget) {
  if (left.column + left.colSpan <= right.column) {
    return false
  }

  if (left.column >= right.column + right.colSpan) {
    return false
  }

  if (left.row + left.rowSpan <= right.row) {
    return false
  }

  if (left.row >= right.row + right.rowSpan) {
    return false
  }

  return true
}

function clampWidgetPosition(position: WorkbenchGridPosition, widget: Pick<WorkbenchLayoutWidget, 'colSpan' | 'rowSpan'>, rows: number, columns: number) {
  return {
    column: clampInteger(position.column, 0, Math.max(columns - widget.colSpan, 0)),
    row: clampInteger(position.row, 0, Math.max(rows - widget.rowSpan, 0))
  }
}

function sortedWidgets(widgets: WorkbenchLayoutWidget[]) {
  return [...widgets].sort((left, right) => {
    if (left.row !== right.row) {
      return left.row - right.row
    }

    if (left.column !== right.column) {
      return left.column - right.column
    }

    if (left.order !== right.order) {
      return left.order - right.order
    }

    return left.id.localeCompare(right.id)
  })
}

function cloneLayout(layout: WorkbenchLayout): WorkbenchLayout {
  return {
    ...layout,
    widgets: layout.widgets.map(widget => ({
      ...widget,
      header: { ...widget.header }
    }))
  }
}

function createNewLayoutWidget(key: WorkbenchWidgetKey, order: number, rows: number, columns: number): WorkbenchLayoutWidget | null {
  const definition = getWorkbenchWidgetMetadata(key)

  if (!definition || order >= maxWidgetCount) {
    return null
  }

  return {
    id: createWidgetId(key),
    key,
    order,
    column: 0,
    row: 0,
    ...constrainWidgetSpan(key, definition.defaultLayout.colSpan, definition.defaultLayout.rowSpan, rows, columns),
    chrome: 'card',
    orientation: 'auto',
    header: createDefaultWidgetHeaderPreference()
  }
}

function createDefaultWidgetHeaderPreference(): WorkbenchWidgetHeaderPreference {
  return {
    visible: true,
    icon: true,
    title: true,
    description: true
  }
}

function constrainWidgetSpan(key: WorkbenchWidgetKey, colSpan: number, rowSpan: number, rows: number, columns: number) {
  return constrainWorkbenchWidgetSpan(key, colSpan, rowSpan, rows, columns)
}

function normalizeWidgetOrientation(key: WorkbenchWidgetKey, orientation: WorkbenchWidgetOrientation) {
  const definition = getWorkbenchWidgetMetadata(key)
  const supportedOrientations = definition?.supportedOrientations ?? workbenchWidgetOrientations

  return supportedOrientations.includes(orientation) ? orientation : 'auto'
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
