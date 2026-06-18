<script setup lang="ts">
import type { RuntimeInfo, ToolRecord } from '~/types/hdx-api'
import type {
  PlacedWorkbenchWidget,
  WorkbenchDropPlacement,
  WorkbenchGridPosition,
  WorkbenchPushDirection
} from '~/stores/workbench-layout'
import type { WorkbenchWidgetKey } from '~/utils/workbench-widget-meta'
import { getWorkbenchWidgetDefinition, workbenchWidgetDefinitions } from '~/utils/workbench-widgets'

const props = defineProps<{
  widget: PlacedWorkbenchWidget
  editing: boolean
  selected?: boolean
  tools: ToolRecord[]
  runtime: RuntimeInfo | null
  loading: boolean
}>()
const emit = defineEmits<{
  select: [widgetId: string]
  leave: [widgetId: string]
}>()

const { t } = useI18n()
const layout = useWorkbenchLayoutStore()
const definition = computed(() => getWorkbenchWidgetDefinition(props.widget.key))
const isDropTarget = computed(() => layout.dropTargetWidgetId === props.widget.id && layout.draggedWidgetId !== props.widget.id)
const isDragging = computed(() => layout.draggedWidgetId === props.widget.id)
const isResizing = computed(() => layout.resizingWidgetId === props.widget.id)
const widgetMenuItems = computed(() => workbenchWidgetDefinitions.map((item) => ({
  label: t(item.titleKey),
  icon: item.icon,
  selected: item.key === props.widget.key,
  disabled: item.key === props.widget.key ? false : !layout.canUpdateWidgetKey(props.widget.id, item.key as WorkbenchWidgetKey),
  onSelect: () => {
    layout.updateWidgetKey(props.widget.id, item.key as WorkbenchWidgetKey)
  }
})))
const dragOffset = reactive({
  x: 0,
  y: 0
})
const dragFixedRect = reactive({
  width: 0,
  height: 0
})
const itemElement = ref<HTMLElement | null>(null)
const removeConfirmOpen = ref(false)
const isRemoving = ref(false)
const suppressNextEditActionClick = ref(false)
let dragPointerId: number | null = null
let dragStartX = 0
let dragStartY = 0
let dragStartLeft = 0
let dragStartTop = 0
let dragStartOrder = 0
let dragStartColumn = 0
let dragStartRow = 0
let dragStartColSpan = 1
let dragStartRowSpan = 1
let dragGrabColumnOffset = 0
let dragGrabRowOffset = 0
let dragHasStarted = false
let resizePointerId: number | null = null
let resizeStartX = 0
let resizeStartY = 0
let resizeStartColSpan = 1
let resizeStartRowSpan = 1
let resizeCellWidth = 1
let resizeCellHeight = 1
let resizeGap = 0
let resizeHandleElement: HTMLElement | null = null
let removeWidgetTimer: number | null = null
let suppressEditActionClickTimer: number | null = null
const componentProps = computed(() => {
  if (props.widget.key === 'tool-catalog') {
    return {
      tools: props.tools,
      loading: props.loading
    }
  }

  if (props.widget.key === 'runtime') {
    return {
      runtime: props.runtime
    }
  }

  return {}
})

interface DragTargetRect {
  id: string
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
  column: number
  row: number
  colSpan: number
  rowSpan: number
  order: number
}

interface DragPreviewRect {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

interface DragGridRect {
  column: number
  row: number
  colSpan: number
  rowSpan: number
}

interface WidgetDropTarget {
  id: string
  placement: WorkbenchDropPlacement
  pushDirection: WorkbenchPushDirection
  position: WorkbenchGridPosition
}

let dragTargetRects: DragTargetRect[] = []

function onItemPointerDown(event: PointerEvent) {
  if (!props.editing || event.button !== 0 || isWorkbenchControl(event.target)) {
    return
  }

  removeConfirmOpen.value = false

  if (event.pointerType && event.pointerType !== 'mouse' && !props.selected) {
    event.preventDefault()
    event.stopPropagation()
    armEditActionClickGuard()
    emit('select', props.widget.id)
    return
  }

  emit('select', props.widget.id)
  startLocalDrag(event)
}

function onItemPointerLeave(event: PointerEvent) {
  if (event.pointerType && event.pointerType !== 'mouse') {
    return
  }

  if (removeConfirmOpen.value) {
    return
  }

  emit('leave', props.widget.id)
}

function startLocalDrag(event: PointerEvent) {
  event.preventDefault()
  removeWindowDragListeners()
  const itemRect = itemElement.value?.getBoundingClientRect()

  if (!itemRect) {
    return
  }

  dragPointerId = event.pointerId
  dragStartX = event.clientX
  dragStartY = event.clientY
  dragStartLeft = itemRect.left
  dragStartTop = itemRect.top
  dragStartOrder = props.widget.order
  dragStartColumn = props.widget.column
  dragStartRow = props.widget.row
  dragStartColSpan = props.widget.colSpan
  dragStartRowSpan = props.widget.rowSpan
  const grabOffset = calculateGrabGridOffset(event.clientX, event.clientY, itemRect)
  dragGrabColumnOffset = grabOffset.column
  dragGrabRowOffset = grabOffset.row
  dragFixedRect.width = itemRect.width
  dragFixedRect.height = itemRect.height
  dragTargetRects = collectDragTargetRects()
  dragHasStarted = false
  itemElement.value?.setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', onWindowDragPointerMove)
  window.addEventListener('pointerup', onWindowDragPointerUp)
  window.addEventListener('pointercancel', onWindowDragPointerCancel)
}

function onItemPointerMove(event: PointerEvent) {
  if (!props.editing || dragPointerId !== event.pointerId) {
    return
  }

  const offsetX = event.clientX - dragStartX
  const offsetY = event.clientY - dragStartY

  if (!dragHasStarted && Math.hypot(offsetX, offsetY) < 6) {
    return
  }

  if (!dragHasStarted) {
    dragHasStarted = true
    layout.beginDrag(props.widget.id)
  }

  event.preventDefault()
  dragOffset.x = offsetX
  dragOffset.y = offsetY
  previewWidgetUnderPointer(event.clientX, event.clientY)
}

function onItemPointerUp(event: PointerEvent) {
  if (dragPointerId !== event.pointerId) {
    return
  }

  if (dragHasStarted) {
    const target = getWidgetDropTargetUnderPointer(event.clientX, event.clientY)

    if (target && target.id !== props.widget.id) {
      layout.dropOnPosition(target.position, target.id, target.placement, target.pushDirection)
    } else if (target) {
      layout.dropOnPosition(target.position)
    } else if (isPointerInsideGrid(event.clientX, event.clientY)) {
      layout.dropOnPosition(getGridPositionUnderPointer(event.clientX, event.clientY))
    } else if (layout.dropTargetWidgetId) {
      layout.dropOnMarkedTarget()
    } else {
      layout.endDrag()
    }
  }

  endLocalDrag(event.pointerId)
}

function onItemPointerCancel(event: PointerEvent) {
  if (dragPointerId !== event.pointerId) {
    return
  }

  cancelLocalDrag(event.pointerId)
}

function onWindowDragPointerMove(event: PointerEvent) {
  onItemPointerMove(event)
}

function onWindowDragPointerUp(event: PointerEvent) {
  onItemPointerUp(event)
}

function onWindowDragPointerCancel(event: PointerEvent) {
  onItemPointerCancel(event)
}

function onResizePointerDown(event: PointerEvent) {
  if (!props.editing || event.button !== 0) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  removeConfirmOpen.value = false
  emit('select', props.widget.id)

  const grid = itemElement.value?.closest<HTMLElement>('[data-workbench-grid]')
  const itemRect = itemElement.value?.getBoundingClientRect()

  if (!grid || !itemRect) {
    return
  }

  resizePointerId = event.pointerId
  resizeStartX = event.clientX
  resizeStartY = event.clientY
  resizeStartColSpan = props.widget.colSpan
  resizeStartRowSpan = props.widget.rowSpan
  resizeGap = layout.gap
  resizeCellWidth = Math.max((itemRect.width - resizeGap * (props.widget.colSpan - 1)) / props.widget.colSpan, 1)
  resizeCellHeight = Math.max((itemRect.height - resizeGap * (props.widget.rowSpan - 1)) / props.widget.rowSpan, 1)
  layout.beginResize(props.widget.id)
  const resizeHandle = event.currentTarget as HTMLElement
  resizeHandleElement = resizeHandle
  resizeHandle.setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', onWindowResizePointerMove)
  window.addEventListener('pointerup', onWindowResizePointerUp)
  window.addEventListener('pointercancel', onWindowResizePointerCancel)
}

function onResizePointerMove(event: PointerEvent) {
  if (!props.editing || resizePointerId !== event.pointerId) {
    return
  }

  event.preventDefault()

  const stepWidth = resizeCellWidth + resizeGap
  const stepHeight = resizeCellHeight + resizeGap
  const colDelta = Math.round((event.clientX - resizeStartX) / stepWidth)
  const rowDelta = Math.round((event.clientY - resizeStartY) / stepHeight)

  layout.updateWidgetSpan(props.widget.id, {
    colSpan: resizeStartColSpan + colDelta,
    rowSpan: resizeStartRowSpan + rowDelta
  })
}

function onResizePointerUp(event: PointerEvent) {
  if (resizePointerId !== event.pointerId) {
    return
  }

  endLocalResize()
}

function onResizePointerCancel(event: PointerEvent) {
  if (resizePointerId !== event.pointerId) {
    return
  }

  endLocalResize()
}

function onWindowResizePointerMove(event: PointerEvent) {
  onResizePointerMove(event)
}

function onWindowResizePointerUp(event: PointerEvent) {
  onResizePointerUp(event)
}

function onWindowResizePointerCancel(event: PointerEvent) {
  onResizePointerCancel(event)
}

function endLocalDrag(pointerId?: number) {
  const capturedPointerId = dragPointerId
  dragPointerId = null
  dragHasStarted = false
  dragOffset.x = 0
  dragOffset.y = 0
  dragFixedRect.width = 0
  dragFixedRect.height = 0
  dragStartOrder = 0
  dragStartColumn = 0
  dragStartRow = 0
  dragStartColSpan = 1
  dragStartRowSpan = 1
  dragGrabColumnOffset = 0
  dragGrabRowOffset = 0
  dragTargetRects = []
  removeWindowDragListeners()

  if (capturedPointerId !== null && pointerId === capturedPointerId && itemElement.value?.hasPointerCapture(pointerId)) {
    itemElement.value.releasePointerCapture(pointerId)
  }
}

function cancelLocalDrag(pointerId?: number) {
  if (dragHasStarted) {
    layout.endDrag()
  }

  endLocalDrag(pointerId)
}

function endLocalResize(target?: HTMLElement) {
  const capturedPointerId = resizePointerId
  const capturedTarget = target ?? resizeHandleElement
  resizePointerId = null
  resizeHandleElement = null
  layout.endResize()
  removeWindowResizeListeners()

  if (capturedPointerId !== null && capturedTarget?.hasPointerCapture(capturedPointerId)) {
    capturedTarget.releasePointerCapture(capturedPointerId)
  }
}

function removeWindowDragListeners() {
  window.removeEventListener('pointermove', onWindowDragPointerMove)
  window.removeEventListener('pointerup', onWindowDragPointerUp)
  window.removeEventListener('pointercancel', onWindowDragPointerCancel)
}

function removeWindowResizeListeners() {
  window.removeEventListener('pointermove', onWindowResizePointerMove)
  window.removeEventListener('pointerup', onWindowResizePointerUp)
  window.removeEventListener('pointercancel', onWindowResizePointerCancel)
}

function previewWidgetUnderPointer(clientX: number, clientY: number) {
  const target = getWidgetDropTargetUnderPointer(clientX, clientY)

  if (target) {
    layout.previewDragOverPosition(target.id, target.position, target.placement, target.pushDirection)
    return
  }

  if (!target && isPointerInsideGrid(clientX, clientY)) {
    layout.previewDragOverPosition(null, getGridPositionUnderPointer(clientX, clientY))
    return
  }

  layout.previewDragOverWidget(null)
}

function getWidgetDropTargetUnderPointer(clientX: number, clientY: number) {
  const dragRect = createDragPreviewRect(clientX, clientY)
  return createDropTargetFromGridCollision(dragTargetRects, clientX, clientY, dragRect)
}

function createDragPreviewRect(clientX: number, clientY: number): DragPreviewRect {
  const left = dragStartLeft + clientX - dragStartX
  const top = dragStartTop + clientY - dragStartY
  const width = dragFixedRect.width
  const height = dragFixedRect.height

  return {
    left,
    right: left + width,
    top,
    bottom: top + height,
    width,
    height
  }
}

function createDropTargetFromGridCollision(targetRects: DragTargetRect[], clientX: number, clientY: number, dragRect: DragPreviewRect): WidgetDropTarget | null {
  const projectedRect = projectPointerToAnchoredGrid(clientX, clientY)

  if (!projectedRect) {
    return null
  }

  if (isDragProjectedAtStart(projectedRect)) {
    return null
  }

  const targetRect = sortTargetRectsByGrid(targetRects).find(rect => gridRectsCollide(projectedRect, rect))
  return targetRect ? createDropTargetFromRect(targetRect, dragRect, projectedRect) : null
}

function getGridPositionUnderPointer(clientX: number, clientY: number): WorkbenchGridPosition {
  const projectedRect = projectPointerToAnchoredGrid(clientX, clientY)

  return {
    column: projectedRect?.column ?? dragStartColumn,
    row: projectedRect?.row ?? dragStartRow
  }
}

function projectPointerToAnchoredGrid(clientX: number, clientY: number): DragGridRect | null {
  const gridRect = itemElement.value?.closest<HTMLElement>('[data-workbench-grid]')?.getBoundingClientRect()

  if (!gridRect) {
    return null
  }

  const pointerCell = projectPointerToGridCell(clientX, clientY, gridRect)
  const maxColumn = Math.max(layout.columns - props.widget.colSpan, 0)
  const maxRow = Math.max(layout.rows - props.widget.rowSpan, 0)

  return {
    column: clampNumber(pointerCell.column - dragGrabColumnOffset, 0, maxColumn),
    row: clampNumber(pointerCell.row - dragGrabRowOffset, 0, maxRow),
    colSpan: props.widget.colSpan,
    rowSpan: props.widget.rowSpan
  }
}

function projectPointerToGridCell(clientX: number, clientY: number, gridRect: DOMRect) {
  const gap = layout.gap
  const cellWidth = Math.max((gridRect.width - gap * (layout.columns - 1)) / layout.columns, 1)
  const cellHeight = Math.max((gridRect.height - gap * (layout.rows - 1)) / layout.rows, 1)
  const columnStep = cellWidth + gap
  const rowStep = cellHeight + gap

  return {
    column: clampNumber(Math.floor((clientX - gridRect.left) / columnStep), 0, layout.columns - 1),
    row: clampNumber(Math.floor((clientY - gridRect.top) / rowStep), 0, layout.rows - 1)
  }
}

function calculateGrabGridOffset(clientX: number, clientY: number, itemRect: DOMRect) {
  const gap = layout.gap
  const cellWidth = Math.max((itemRect.width - gap * (props.widget.colSpan - 1)) / props.widget.colSpan, 1)
  const cellHeight = Math.max((itemRect.height - gap * (props.widget.rowSpan - 1)) / props.widget.rowSpan, 1)
  const columnStep = cellWidth + gap
  const rowStep = cellHeight + gap
  const localX = clampNumber(clientX - itemRect.left, 0, Math.max(itemRect.width - 1, 0))
  const localY = clampNumber(clientY - itemRect.top, 0, Math.max(itemRect.height - 1, 0))

  return {
    column: clampNumber(Math.floor(localX / columnStep), 0, props.widget.colSpan - 1),
    row: clampNumber(Math.floor(localY / rowStep), 0, props.widget.rowSpan - 1)
  }
}

function isDragProjectedAtStart(projectedRect: DragGridRect) {
  return projectedRect.column === dragStartColumn && projectedRect.row === dragStartRow
}

function sortTargetRectsByGrid(targetRects: DragTargetRect[]) {
  return [...targetRects].sort((left, right) => {
    if (left.row !== right.row) {
      return left.row - right.row
    }

    if (left.column !== right.column) {
      return left.column - right.column
    }

    return left.id.localeCompare(right.id)
  })
}

function gridRectsCollide(left: DragGridRect, right: DragGridRect) {
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

function collectDragTargetRects() {
  const grid = itemElement.value?.closest<HTMLElement>('[data-workbench-grid]')
  const placedWidgetsById = new Map(layout.placedWidgets.map(widget => [widget.id, widget]))

  if (!grid) {
    return []
  }

  return [...grid.querySelectorAll<HTMLElement>('[data-workbench-widget-id]')]
    .filter(element => element.dataset.workbenchWidgetId && element.dataset.workbenchWidgetId !== props.widget.id)
    .map((element) => {
      const rect = element.getBoundingClientRect()
      const placedWidget = placedWidgetsById.get(element.dataset.workbenchWidgetId ?? '')

      return {
        id: element.dataset.workbenchWidgetId ?? '',
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        column: placedWidget?.column ?? 0,
        row: placedWidget?.row ?? 0,
        colSpan: placedWidget?.colSpan ?? 1,
        rowSpan: placedWidget?.rowSpan ?? 1,
        order: placedWidget?.order ?? 0
      }
    })
    .filter(rect => rect.id)
}

function createDropTargetFromRect(rect: DragTargetRect, dragRect: DragPreviewRect, projectedRect?: DragGridRect | null): WidgetDropTarget {
  const dragCenterX = dragRect.left + dragRect.width / 2
  const dragCenterY = dragRect.top + dragRect.height / 2
  const rectCenterX = rect.left + rect.width / 2
  const rectCenterY = rect.top + rect.height / 2
  const horizontal = resolveDropAxis(rect, dragCenterX, dragCenterY, rectCenterX, rectCenterY)
  const placement = resolveDropPlacementByEdge(rect, dragRect, horizontal)
  const pushDirection = resolvePushDirection(horizontal, dragCenterX, dragCenterY, rectCenterX, rectCenterY)

  return {
    id: rect.id,
    placement,
    pushDirection,
    position: {
      column: projectedRect?.column ?? rect.column,
      row: projectedRect?.row ?? rect.row
    }
  }
}

function resolveDropAxis(rect: DragTargetRect, dragCenterX: number, dragCenterY: number, rectCenterX: number, rectCenterY: number) {
  const sourceRowsOverlapTarget = gridRangesOverlap(dragStartRow, dragStartRowSpan, rect.row, rect.rowSpan)
  const sourceColumnsOverlapTarget = gridRangesOverlap(dragStartColumn, dragStartColSpan, rect.column, rect.colSpan)

  if (sourceRowsOverlapTarget && !sourceColumnsOverlapTarget) {
    return true
  }

  if (sourceColumnsOverlapTarget && !sourceRowsOverlapTarget) {
    return false
  }

  return Math.abs(dragCenterX - rectCenterX) >= Math.abs(dragCenterY - rectCenterY)
}

function resolveDropPlacementByEdge(rect: DragTargetRect, dragRect: DragPreviewRect, horizontal: boolean): WorkbenchDropPlacement {
  const rectCenter = horizontal
    ? rect.left + rect.width / 2
    : rect.top + rect.height / 2

  if (dragStartOrder < rect.order) {
    const sourceEnd = horizontal ? dragRect.right : dragRect.bottom
    return sourceEnd >= rectCenter ? 'after' : 'before'
  }

  if (dragStartOrder > rect.order) {
    const sourceStart = horizontal ? dragRect.left : dragRect.top
    return sourceStart <= rectCenter ? 'before' : 'after'
  }

  const dragCenter = horizontal
    ? dragRect.left + dragRect.width / 2
    : dragRect.top + dragRect.height / 2

  return dragCenter >= rectCenter ? 'after' : 'before'
}

function resolvePushDirection(
  horizontal: boolean,
  dragCenterX: number,
  dragCenterY: number,
  rectCenterX: number,
  rectCenterY: number
): WorkbenchPushDirection {
  if (horizontal) {
    return dragCenterX >= rectCenterX ? 'right' : 'left'
  }

  return dragCenterY >= rectCenterY ? 'down' : 'up'
}

function gridRangesOverlap(sourceStart: number, sourceSpan: number, targetStart: number, targetSpan: number) {
  return sourceStart < targetStart + targetSpan && sourceStart + sourceSpan > targetStart
}

function isPointerInsideGrid(clientX: number, clientY: number) {
  const gridRect = itemElement.value?.closest<HTMLElement>('[data-workbench-grid]')?.getBoundingClientRect()

  if (!gridRect) {
    return false
  }

  return clientX >= gridRect.left && clientX <= gridRect.right && clientY >= gridRect.top && clientY <= gridRect.bottom
}

function isWorkbenchControl(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('[data-workbench-control="true"]'))
}

function onConfirmRemoveWidget() {
  if (isRemoving.value) {
    return
  }

  removeConfirmOpen.value = false
  isRemoving.value = true
  removeWidgetTimer = window.setTimeout(() => {
    removeWidgetTimer = null
    layout.removeWidget(props.widget.id)
  }, 220)
}

function onCancelRemoveWidget() {
  removeConfirmOpen.value = false
}

function armEditActionClickGuard() {
  suppressNextEditActionClick.value = true

  if (suppressEditActionClickTimer !== null) {
    window.clearTimeout(suppressEditActionClickTimer)
  }

  suppressEditActionClickTimer = window.setTimeout(() => {
    suppressEditActionClickTimer = null
    suppressNextEditActionClick.value = false
  }, 350)
}

function clearEditActionClickGuard() {
  suppressNextEditActionClick.value = false

  if (suppressEditActionClickTimer !== null) {
    window.clearTimeout(suppressEditActionClickTimer)
    suppressEditActionClickTimer = null
  }
}

function onEditActionClickCapture(event: MouseEvent) {
  if (!suppressNextEditActionClick.value) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
  clearEditActionClickGuard()
}

watch(() => props.selected, (selected) => {
  if (!selected) {
    removeConfirmOpen.value = false
    clearEditActionClickGuard()
  }
})

watch(() => props.editing, (editing) => {
  if (editing) {
    return
  }

  removeConfirmOpen.value = false
  clearEditActionClickGuard()
})

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

onUnmounted(() => {
  cancelLocalDrag()

  if (resizePointerId !== null) {
    endLocalResize()
  }

  if (removeWidgetTimer !== null) {
    window.clearTimeout(removeWidgetTimer)
  }

  clearEditActionClickGuard()
})
</script>

<template>
  <article
    v-if="definition"
    ref="itemElement"
    :data-workbench-widget-id="widget.id"
    class="toolbox-grid-item relative min-h-0 overflow-hidden rounded-lg border border-white/65 bg-white/64 text-slate-950 shadow-lg shadow-slate-900/7 backdrop-blur-2xl transition-[border-color,background,box-shadow,transform,opacity] duration-200 dark:border-white/14 dark:bg-white/9 dark:text-white dark:shadow-black/28"
    :class="[
      editing ? 'toolbox-grid-item-editing cursor-grab active:cursor-grabbing' : '',
      props.selected ? 'toolbox-grid-item-selected ring-1 ring-cyan-400/45 shadow-[0_20px_40px_rgba(15,23,42,0.12)] dark:ring-cyan-200/30 dark:shadow-[0_20px_40px_rgba(0,0,0,0.32)]' : '',
      removeConfirmOpen ? 'toolbox-grid-item-remove-open' : '',
      isRemoving ? 'toolbox-grid-item-removing' : '',
      isDropTarget ? 'border-cyan-400 bg-cyan-50/70 shadow-cyan-900/16 dark:border-cyan-200/55 dark:bg-cyan-300/12' : '',
      isDragging ? 'toolbox-grid-item-dragging' : '',
      isResizing ? 'toolbox-grid-item-resizing' : ''
    ]"
    :style="{
      gridColumnStart: widget.column + 1,
      gridColumnEnd: `span ${widget.colSpan}`,
      gridRowStart: widget.row + 1,
      gridRowEnd: `span ${widget.rowSpan}`,
      '--workbench-drag-x': `${dragOffset.x}px`,
      '--workbench-drag-y': `${dragOffset.y}px`,
      '--workbench-drag-left': `${dragStartLeft}px`,
      '--workbench-drag-top': `${dragStartTop}px`,
      '--workbench-drag-width': `${dragFixedRect.width}px`,
      '--workbench-drag-height': `${dragFixedRect.height}px`
    }"
    @pointerdown="onItemPointerDown"
    @pointerleave="onItemPointerLeave"
    @pointermove="onItemPointerMove"
    @pointerup="onItemPointerUp"
    @pointercancel="onItemPointerCancel"
  >
    <div v-if="isDragging" class="toolbox-drag-placeholder grid h-full min-h-0 place-items-center rounded-lg" aria-hidden="true">
      <UIcon name="lucide:move" class="size-6 text-cyan-100/70" />
    </div>

    <div v-else class="toolbox-card-content relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-lg p-4">
      <div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r opacity-70 blur-2xl" :class="definition.accentClass" />
      <header class="flex min-w-0 items-start justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <div class="grid size-10 shrink-0 place-items-center rounded-lg border border-white/60 bg-white/58 shadow-sm shadow-slate-900/5 dark:border-white/16 dark:bg-white/10 dark:shadow-black/20">
            <UIcon :name="definition.icon" class="size-5 text-slate-800 dark:text-white" />
          </div>
          <div class="min-w-0">
            <h2 class="truncate text-base font-semibold tracking-normal text-slate-950 dark:text-white">
              {{ t(definition.titleKey) }}
            </h2>
            <p class="truncate text-sm text-slate-600 dark:text-white/62">
              {{ t(definition.descriptionKey) }}
            </p>
          </div>
        </div>

        <div
          v-if="editing"
          data-workbench-control="true"
          class="toolbox-remove-action absolute right-3 top-3 z-30 opacity-0 transition-[opacity,transform] duration-200"
        >
          <UPopover
            v-model:open="removeConfirmOpen"
            mode="click"
            :content="{ align: 'end', side: 'bottom', sideOffset: 8 }"
            :ui="{ content: 'workbench-floating-menu rounded-[1rem]' }"
          >
            <button
              type="button"
              class="toolbox-remove-button cursor-pointer"
              :aria-label="t('workbench.layout.removeWidget')"
              @click.stop="emit('select', props.widget.id)"
            >
              <UIcon name="lucide:x" class="size-4" />
            </button>

            <template #content="{ close }">
              <div class="grid gap-1.5 p-2">
                <p class="px-1.5 py-0.5 text-sm font-medium text-slate-950 dark:text-white">
                  {{ t('workbench.layout.confirmRemoveWidget') }}
                </p>
                <div class="flex items-center gap-1.5">
                  <UButton
                    type="button"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    class="cursor-pointer rounded-lg"
                    @click="() => { onCancelRemoveWidget(); close() }"
                  >
                    {{ t('workbench.layout.cancel') }}
                  </UButton>
                  <UButton
                    type="button"
                    color="error"
                    variant="solid"
                    size="sm"
                    class="cursor-pointer rounded-lg"
                    @click="() => { onConfirmRemoveWidget(); close() }"
                  >
                    {{ t('workbench.layout.removeWidget') }}
                  </UButton>
                </div>
              </div>
            </template>
          </UPopover>
        </div>
      </header>

      <div class="min-h-0 overflow-hidden">
        <component
          :is="definition.component"
          v-bind="componentProps"
        />
      </div>

      <div v-if="editing" class="toolbox-edit-affordance pointer-events-none absolute inset-0 z-20 rounded-lg bg-slate-950/7 opacity-0 transition-opacity duration-200 dark:bg-black/14" />

      <div
        v-if="editing"
        data-workbench-control="true"
        class="toolbox-edit-actions absolute bottom-3 left-3 z-30 max-w-[calc(100%-4.25rem)] opacity-0 transition-[opacity,transform] duration-200"
        @click.capture="onEditActionClickCapture"
      >
        <div class="rounded-full border border-white/65 bg-white/78 p-1 shadow-xl shadow-slate-900/12 backdrop-blur-2xl dark:border-white/16 dark:bg-slate-950/72 dark:shadow-black/35">
          <UTooltip :text="t('workbench.layout.changeWidget')">
            <UDropdownMenu
              :items="widgetMenuItems"
              :content="{ align: 'start' }"
              :ui="{ content: 'workbench-floating-menu rounded-[1.25rem]' }"
            >
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                icon="lucide:replace"
                size="sm"
                class="toolbox-change-button cursor-pointer"
                :aria-label="t('workbench.layout.changeWidget')"
              >
                {{ t('workbench.layout.changeWidget') }}
              </UButton>
              <template #item-trailing="{ item }">
                <UIcon v-if="item.selected" name="lucide:check" class="size-4 text-cyan-700 dark:text-cyan-100" />
              </template>
            </UDropdownMenu>
          </UTooltip>
        </div>
      </div>

      <button
        v-if="editing"
        type="button"
        data-workbench-control="true"
        class="toolbox-resize-handle absolute bottom-1.5 right-1.5 z-30 cursor-nwse-resize rounded-md border border-white/65 bg-white/78 text-slate-700 shadow-sm shadow-slate-900/12 backdrop-blur-xl transition-[opacity,background,color] duration-200 hover:bg-cyan-50 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:border-white/18 dark:bg-slate-950/72 dark:text-white/74 dark:shadow-black/35 dark:hover:bg-cyan-300/14"
        :aria-label="t('workbench.layout.resizeWidget')"
        @pointerdown="onResizePointerDown"
        @pointermove="onResizePointerMove"
        @pointerup="onResizePointerUp"
        @pointercancel="onResizePointerCancel"
        @lostpointercapture="onResizePointerCancel"
      >
        <span aria-hidden="true" class="toolbox-resize-corner" />
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="isDragging"
        class="toolbox-drag-preview fixed grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-lg border border-white/65 bg-white/70 p-4 text-slate-950 shadow-2xl shadow-slate-950/22 backdrop-blur-2xl dark:border-white/16 dark:bg-slate-950/80 dark:text-white dark:shadow-black/45"
        :style="{
          left: `${dragStartLeft}px`,
          top: `${dragStartTop}px`,
          width: `${dragFixedRect.width}px`,
          height: `${dragFixedRect.height}px`,
          transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) scale(1.015)`
        }"
        aria-hidden="true"
      >
        <div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r opacity-70 blur-2xl" :class="definition.accentClass" />
        <header class="relative flex min-w-0 items-start justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <div class="grid size-10 shrink-0 place-items-center rounded-lg border border-white/60 bg-white/58 shadow-sm shadow-slate-900/5 dark:border-white/16 dark:bg-white/10 dark:shadow-black/20">
              <UIcon :name="definition.icon" class="size-5 text-slate-800 dark:text-white" />
            </div>
            <div class="min-w-0">
              <h2 class="truncate text-base font-semibold tracking-normal text-slate-950 dark:text-white">
                {{ t(definition.titleKey) }}
              </h2>
              <p class="truncate text-sm text-slate-600 dark:text-white/62">
                {{ t(definition.descriptionKey) }}
              </p>
            </div>
          </div>
        </header>

        <div class="relative min-h-0 overflow-hidden">
          <component
            :is="definition.component"
            v-bind="componentProps"
          />
        </div>
      </div>
    </Teleport>
  </article>
</template>

<style scoped>
.toolbox-grid-item {
  min-height: 0;
  translate: 0 0;
}

.toolbox-grid-item-removing {
  opacity: 0;
  pointer-events: none;
}

.toolbox-grid-item-editing {
  user-select: none;
  touch-action: none;
}

.toolbox-card-content {
  min-height: inherit;
}

.toolbox-grid-item-dragging {
  border-style: dashed;
  background: rgba(125, 211, 252, 0.14);
  box-shadow: none;
  transform: none !important;
  transition: none !important;
}

.toolbox-grid-item-dragging.toolbox-grid-move {
  transform: none !important;
  transition: none !important;
}

.toolbox-drag-placeholder {
  border: 1px dashed rgba(103, 232, 249, 0.58);
  background:
    repeating-linear-gradient(
      -45deg,
      rgba(103, 232, 249, 0.08),
      rgba(103, 232, 249, 0.08) 0.65rem,
      rgba(255, 255, 255, 0.04) 0.65rem,
      rgba(255, 255, 255, 0.04) 1.3rem
    );
}

.toolbox-drag-preview {
  z-index: 9999;
  pointer-events: none;
  opacity: 0.84;
  transition: none;
  will-change: transform;
}

.toolbox-grid-item-resizing {
  z-index: 20;
  border-color: rgba(6, 182, 212, 0.72);
  box-shadow: 0 24px 60px rgba(8, 145, 178, 0.16);
}

.toolbox-grid-item-resizing .toolbox-card-content {
  opacity: 0.72;
}

.toolbox-grid-item-selected .toolbox-edit-affordance,
.toolbox-grid-item-selected .toolbox-edit-actions,
.toolbox-grid-item-selected .toolbox-remove-action,
.toolbox-grid-item-remove-open .toolbox-remove-action {
  opacity: 1;
}

.toolbox-grid-item-selected .toolbox-edit-actions,
.toolbox-grid-item-selected .toolbox-remove-action,
.toolbox-grid-item-remove-open .toolbox-remove-action {
  transform: translateY(0);
  pointer-events: auto;
}

.toolbox-edit-affordance {
  opacity: 0;
}

.toolbox-edit-actions {
  line-height: 1;
  pointer-events: none;
  transform: translateY(0.35rem);
}

.toolbox-remove-action {
  pointer-events: none;
  transform: translateY(-0.35rem);
}

.toolbox-change-button {
  min-width: 0;
  max-width: 100%;
  border-radius: 9999px;
  padding-inline: 0.75rem;
  white-space: nowrap;
}

.toolbox-change-button :deep(.truncate) {
  max-width: 7rem;
}

@media (hover: hover) and (pointer: fine) {
  .toolbox-grid-item-editing:hover .toolbox-edit-affordance,
  .toolbox-grid-item-editing:hover .toolbox-edit-actions,
  .toolbox-grid-item-editing:hover .toolbox-remove-action {
    opacity: 1;
  }

  .toolbox-grid-item-editing:hover .toolbox-edit-actions,
  .toolbox-grid-item-editing:hover .toolbox-remove-action {
    transform: translateY(0);
    pointer-events: auto;
  }

  .toolbox-grid-item-editing:hover .toolbox-resize-handle {
    opacity: 1;
    pointer-events: auto;
  }
}

.toolbox-remove-button {
  display: inline-grid;
  width: 2rem;
  height: 2rem;
  appearance: none;
  padding: 0;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.46);
  border-radius: 9999px;
  background: rgba(15, 23, 42, 0.22);
  color: rgba(255, 255, 255, 0.86);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.14);
  line-height: 1;
  transition:
    background-color 160ms ease,
    color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.toolbox-remove-button:hover {
  background: rgba(244, 63, 94, 0.82);
  color: white;
  box-shadow: 0 10px 24px rgba(127, 29, 29, 0.24);
}

.toolbox-remove-button:focus-visible {
  outline: 2px solid rgba(244, 63, 94, 0.72);
  outline-offset: 2px;
}

.dark .toolbox-remove-button {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.18);
}

.dark .toolbox-remove-button:hover {
  background: rgba(244, 63, 94, 0.72);
}

.toolbox-resize-handle {
  display: inline-grid;
  width: 2rem;
  height: 2rem;
  padding: 0;
  place-items: center;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  opacity: 0;
  pointer-events: none;
}

.toolbox-grid-item-selected .toolbox-resize-handle {
  opacity: 1;
  pointer-events: auto;
}

.toolbox-resize-handle:hover {
  background: rgba(14, 165, 233, 0.14);
}

.toolbox-resize-corner {
  position: relative;
  width: 1rem;
  height: 1rem;
  opacity: 0.78;
}

.toolbox-resize-corner::before,
.toolbox-resize-corner::after {
  position: absolute;
  right: 0;
  bottom: 0;
  border-right: 2px solid currentcolor;
  border-bottom: 2px solid currentcolor;
  border-radius: 0 0 0.2rem;
  content: "";
}

.toolbox-resize-corner::before {
  width: 0.95rem;
  height: 0.95rem;
}

.toolbox-resize-corner::after {
  width: 0.55rem;
  height: 0.55rem;
}

</style>
