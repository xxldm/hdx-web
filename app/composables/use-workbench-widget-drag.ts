import { onUnmounted, reactive, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import type {
  PlacedWorkbenchWidget,
  WorkbenchDropPlacement,
  WorkbenchGridPosition,
  WorkbenchPushDirection
} from '~/stores/workbench-layout'
import { useWorkbenchLayoutStore } from '~/stores/workbench-layout'

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

interface UseWorkbenchWidgetDragOptions {
  itemElement: Ref<HTMLElement | null>
  widget: MaybeRefOrGetter<PlacedWorkbenchWidget>
  editing: MaybeRefOrGetter<boolean>
  selected: MaybeRefOrGetter<boolean | undefined>
  isRemoveConfirmOpen: MaybeRefOrGetter<boolean>
  closeRemoveConfirm: () => void
  armEditActionClickGuard: () => void
  selectWidget: (widgetId: string) => void
  leaveWidget: (widgetId: string) => void
}

export function useWorkbenchWidgetDrag(options: UseWorkbenchWidgetDragOptions) {
  const layout = useWorkbenchLayoutStore()
  const dragOffset = reactive({
    x: 0,
    y: 0
  })
  const dragFixedRect = reactive({
    width: 0,
    height: 0
  })
  const dragOrigin = reactive({
    left: 0,
    top: 0
  })
  let dragPointerId: number | null = null
  let dragStartX = 0
  let dragStartY = 0
  let dragStartOrder = 0
  let dragStartColumn = 0
  let dragStartRow = 0
  let dragStartColSpan = 1
  let dragStartRowSpan = 1
  let dragGrabColumnOffset = 0
  let dragGrabRowOffset = 0
  let dragHasStarted = false
  let dragTargetRects: DragTargetRect[] = []

  function onItemPointerDown(event: PointerEvent) {
    const widget = toValue(options.widget)

    if (!toValue(options.editing) || event.button !== 0 || isWorkbenchControl(event.target)) {
      return
    }

    options.closeRemoveConfirm()

    if (event.pointerType && event.pointerType !== 'mouse' && !toValue(options.selected)) {
      event.preventDefault()
      event.stopPropagation()
      options.armEditActionClickGuard()
      options.selectWidget(widget.id)
      return
    }

    options.selectWidget(widget.id)
    startLocalDrag(event)
  }

  function onItemPointerLeave(event: PointerEvent) {
    const widget = toValue(options.widget)

    if (event.pointerType && event.pointerType !== 'mouse') {
      return
    }

    if (toValue(options.isRemoveConfirmOpen)) {
      return
    }

    options.leaveWidget(widget.id)
  }

  function startLocalDrag(event: PointerEvent) {
    const widget = toValue(options.widget)

    event.preventDefault()
    removeWindowDragListeners()
    const itemRect = options.itemElement.value?.getBoundingClientRect()

    if (!itemRect) {
      return
    }

    dragPointerId = event.pointerId
    dragStartX = event.clientX
    dragStartY = event.clientY
    dragOrigin.left = itemRect.left
    dragOrigin.top = itemRect.top
    dragStartOrder = widget.order
    dragStartColumn = widget.column
    dragStartRow = widget.row
    dragStartColSpan = widget.colSpan
    dragStartRowSpan = widget.rowSpan
    const grabOffset = calculateGrabGridOffset(event.clientX, event.clientY, itemRect)
    dragGrabColumnOffset = grabOffset.column
    dragGrabRowOffset = grabOffset.row
    dragFixedRect.width = itemRect.width
    dragFixedRect.height = itemRect.height
    dragTargetRects = collectDragTargetRects()
    dragHasStarted = false
    options.itemElement.value?.setPointerCapture(event.pointerId)
    window.addEventListener('pointermove', onWindowDragPointerMove)
    window.addEventListener('pointerup', onWindowDragPointerUp)
    window.addEventListener('pointercancel', onWindowDragPointerCancel)
  }

  function onItemPointerMove(event: PointerEvent) {
    const widget = toValue(options.widget)

    if (!toValue(options.editing) || dragPointerId !== event.pointerId) {
      return
    }

    const offsetX = event.clientX - dragStartX
    const offsetY = event.clientY - dragStartY

    if (!dragHasStarted && Math.hypot(offsetX, offsetY) < 6) {
      return
    }

    if (!dragHasStarted) {
      dragHasStarted = true
      layout.beginDrag(widget.id)
    }

    event.preventDefault()
    dragOffset.x = offsetX
    dragOffset.y = offsetY
    previewWidgetUnderPointer(event.clientX, event.clientY)
  }

  function onItemPointerUp(event: PointerEvent) {
    const widget = toValue(options.widget)

    if (dragPointerId !== event.pointerId) {
      return
    }

    if (dragHasStarted) {
      const target = getWidgetDropTargetUnderPointer(event.clientX, event.clientY)

      if (target && target.id !== widget.id) {
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

    if (capturedPointerId !== null && pointerId === capturedPointerId && options.itemElement.value?.hasPointerCapture(pointerId)) {
      options.itemElement.value.releasePointerCapture(pointerId)
    }
  }

  function cancelLocalDrag(pointerId?: number) {
    if (dragHasStarted) {
      layout.endDrag()
    }

    endLocalDrag(pointerId)
  }

  function removeWindowDragListeners() {
    window.removeEventListener('pointermove', onWindowDragPointerMove)
    window.removeEventListener('pointerup', onWindowDragPointerUp)
    window.removeEventListener('pointercancel', onWindowDragPointerCancel)
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
    const left = dragOrigin.left + clientX - dragStartX
    const top = dragOrigin.top + clientY - dragStartY
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
    const widget = toValue(options.widget)
    const gridRect = options.itemElement.value?.closest<HTMLElement>('[data-workbench-grid]')?.getBoundingClientRect()

    if (!gridRect) {
      return null
    }

    const pointerCell = projectPointerToGridCell(clientX, clientY, gridRect)
    const maxColumn = Math.max(layout.columns - widget.colSpan, 0)
    const maxRow = Math.max(layout.rows - widget.rowSpan, 0)

    return {
      column: clampNumber(pointerCell.column - dragGrabColumnOffset, 0, maxColumn),
      row: clampNumber(pointerCell.row - dragGrabRowOffset, 0, maxRow),
      colSpan: widget.colSpan,
      rowSpan: widget.rowSpan
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
    const widget = toValue(options.widget)
    const gap = layout.gap
    const cellWidth = Math.max((itemRect.width - gap * (widget.colSpan - 1)) / widget.colSpan, 1)
    const cellHeight = Math.max((itemRect.height - gap * (widget.rowSpan - 1)) / widget.rowSpan, 1)
    const columnStep = cellWidth + gap
    const rowStep = cellHeight + gap
    const localX = clampNumber(clientX - itemRect.left, 0, Math.max(itemRect.width - 1, 0))
    const localY = clampNumber(clientY - itemRect.top, 0, Math.max(itemRect.height - 1, 0))

    return {
      column: clampNumber(Math.floor(localX / columnStep), 0, widget.colSpan - 1),
      row: clampNumber(Math.floor(localY / rowStep), 0, widget.rowSpan - 1)
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
    const widget = toValue(options.widget)
    const grid = options.itemElement.value?.closest<HTMLElement>('[data-workbench-grid]')
    const placedWidgetsById = new Map(layout.placedWidgets.map(widget => [widget.id, widget]))

    if (!grid) {
      return []
    }

    return [...grid.querySelectorAll<HTMLElement>('[data-workbench-widget-id]')]
      .filter(element => element.dataset.workbenchWidgetId && element.dataset.workbenchWidgetId !== widget.id)
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
    const pushDirection = resolveWorkbenchDragPushDirection(
      {
        column: dragStartColumn,
        row: dragStartRow,
        colSpan: dragStartColSpan,
        rowSpan: dragStartRowSpan
      },
      rect,
      horizontal,
      {
        dragCenterX,
        dragCenterY,
        rectCenterX,
        rectCenterY
      }
    )

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

  function gridRangesOverlap(sourceStart: number, sourceSpan: number, targetStart: number, targetSpan: number) {
    return sourceStart < targetStart + targetSpan && sourceStart + sourceSpan > targetStart
  }

  function isPointerInsideGrid(clientX: number, clientY: number) {
    const gridRect = options.itemElement.value?.closest<HTMLElement>('[data-workbench-grid]')?.getBoundingClientRect()

    if (!gridRect) {
      return false
    }

    return clientX >= gridRect.left && clientX <= gridRect.right && clientY >= gridRect.top && clientY <= gridRect.bottom
  }

  function isWorkbenchControl(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest('[data-workbench-control="true"]'))
  }

  function clampNumber(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
  }

  onUnmounted(() => {
    cancelLocalDrag()
  })

  return {
    dragOffset,
    dragFixedRect,
    dragOrigin,
    onItemPointerDown,
    onItemPointerLeave,
    onItemPointerMove,
    onItemPointerUp,
    onItemPointerCancel
  }
}

export function resolveWorkbenchDragPushDirection(
  sourceRect: {
    column: number
    row: number
    colSpan: number
    rowSpan: number
  },
  targetRect: {
    column: number
    row: number
    colSpan: number
    rowSpan: number
  },
  horizontal: boolean,
  centers: {
    dragCenterX: number
    dragCenterY: number
    rectCenterX: number
    rectCenterY: number
  }
): WorkbenchPushDirection {
  if (horizontal) {
    if (sourceRect.column + sourceRect.colSpan <= targetRect.column) {
      return 'left'
    }

    if (sourceRect.column >= targetRect.column + targetRect.colSpan) {
      return 'right'
    }

    return centers.dragCenterX >= centers.rectCenterX ? 'right' : 'left'
  }

  if (sourceRect.row + sourceRect.rowSpan <= targetRect.row) {
    return 'up'
  }

  if (sourceRect.row >= targetRect.row + targetRect.rowSpan) {
    return 'down'
  }

  return centers.dragCenterY >= centers.rectCenterY ? 'down' : 'up'
}
