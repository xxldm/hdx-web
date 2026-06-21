import { onUnmounted, shallowRef, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import type { PlacedWorkbenchWidget } from '~/stores/workbench-layout'
import { useWorkbenchLayoutStore } from '~/stores/workbench-layout'
import { constrainWorkbenchWidgetSpan } from '~/utils/workbench-widget-meta'

export type ResizeLimitFeedback = 'min' | 'max' | 'boundary'

interface ResizeSpan {
  colSpan: number
  rowSpan: number
}

interface UseWorkbenchWidgetResizeOptions {
  itemElement: Ref<HTMLElement | null>
  widget: MaybeRefOrGetter<PlacedWorkbenchWidget>
  editing: MaybeRefOrGetter<boolean>
  selectWidget: (widgetId: string) => void
  closeRemoveConfirm: () => void
}

export function useWorkbenchWidgetResize(options: UseWorkbenchWidgetResizeOptions) {
  const layout = useWorkbenchLayoutStore()
  const resizeLimitFeedback = shallowRef<ResizeLimitFeedback | null>(null)
  let resizePointerId: number | null = null
  let resizeStartX = 0
  let resizeStartY = 0
  let resizeStartColSpan = 1
  let resizeStartRowSpan = 1
  let resizeCellWidth = 1
  let resizeCellHeight = 1
  let resizeGap = 0
  let resizeHandleElement: HTMLElement | null = null

  function onResizePointerDown(event: PointerEvent) {
    const widget = toValue(options.widget)

    if (!toValue(options.editing) || event.button !== 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    options.closeRemoveConfirm()
    options.selectWidget(widget.id)

    const grid = options.itemElement.value?.closest<HTMLElement>('[data-workbench-grid]')
    const itemRect = options.itemElement.value?.getBoundingClientRect()

    if (!grid || !itemRect) {
      return
    }

    resizePointerId = event.pointerId
    resizeStartX = event.clientX
    resizeStartY = event.clientY
    resizeStartColSpan = widget.colSpan
    resizeStartRowSpan = widget.rowSpan
    resizeLimitFeedback.value = null
    resizeGap = layout.gap
    resizeCellWidth = Math.max((itemRect.width - resizeGap * (widget.colSpan - 1)) / widget.colSpan, 1)
    resizeCellHeight = Math.max((itemRect.height - resizeGap * (widget.rowSpan - 1)) / widget.rowSpan, 1)
    layout.beginResize(widget.id)
    const resizeHandle = event.currentTarget as HTMLElement
    resizeHandleElement = resizeHandle
    resizeHandle.setPointerCapture(event.pointerId)
    window.addEventListener('pointermove', onWindowResizePointerMove)
    window.addEventListener('pointerup', onWindowResizePointerUp)
    window.addEventListener('pointercancel', onWindowResizePointerCancel)
  }

  function onResizePointerMove(event: PointerEvent) {
    const widget = toValue(options.widget)

    if (!toValue(options.editing) || resizePointerId !== event.pointerId) {
      return
    }

    event.preventDefault()

    const stepWidth = resizeCellWidth + resizeGap
    const stepHeight = resizeCellHeight + resizeGap
    const colDelta = Math.round((event.clientX - resizeStartX) / stepWidth)
    const rowDelta = Math.round((event.clientY - resizeStartY) / stepHeight)
    const requestedSpan = {
      colSpan: resizeStartColSpan + colDelta,
      rowSpan: resizeStartRowSpan + rowDelta
    }

    resizeLimitFeedback.value = getResizeLimitFeedback(requestedSpan, constrainResizeSpan(widget, requestedSpan))

    layout.updateWidgetSpan(widget.id, requestedSpan)
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

  function endLocalResize(target?: HTMLElement) {
    const capturedPointerId = resizePointerId
    const capturedTarget = target ?? resizeHandleElement
    resizePointerId = null
    resizeHandleElement = null
    resizeLimitFeedback.value = null
    layout.endResize()
    removeWindowResizeListeners()

    if (capturedPointerId !== null && capturedTarget?.hasPointerCapture(capturedPointerId)) {
      capturedTarget.releasePointerCapture(capturedPointerId)
    }
  }

  function removeWindowResizeListeners() {
    window.removeEventListener('pointermove', onWindowResizePointerMove)
    window.removeEventListener('pointerup', onWindowResizePointerUp)
    window.removeEventListener('pointercancel', onWindowResizePointerCancel)
  }

  function constrainResizeSpan(widget: PlacedWorkbenchWidget, span: ResizeSpan) {
    return constrainWorkbenchWidgetSpan(widget.key, span.colSpan, span.rowSpan, layout.rows, layout.columns)
  }

  function getResizeLimitFeedback(requestedSpan: ResizeSpan, constrainedSpan: ResizeSpan): ResizeLimitFeedback | null {
    const reachedMin = requestedSpan.colSpan < constrainedSpan.colSpan || requestedSpan.rowSpan < constrainedSpan.rowSpan
    const reachedMax = requestedSpan.colSpan > constrainedSpan.colSpan || requestedSpan.rowSpan > constrainedSpan.rowSpan

    if (reachedMin && reachedMax) {
      return 'boundary'
    }

    if (reachedMax) {
      return 'max'
    }

    if (reachedMin) {
      return 'min'
    }

    return null
  }

  onUnmounted(() => {
    if (resizePointerId !== null) {
      endLocalResize()
    }
  })

  return {
    resizeLimitFeedback,
    onResizePointerDown,
    onResizePointerMove,
    onResizePointerUp,
    onResizePointerCancel
  }
}
