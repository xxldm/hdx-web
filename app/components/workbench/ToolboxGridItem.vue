<script setup lang="ts">
import type { RuntimeInfo, ToolRecord } from '~/types/hdx-api'
import type { PlacedWorkbenchWidget } from '~/stores/workbench-layout'
import { getWorkbenchWidgetDefinition } from '~/utils/workbench-widgets'

const props = defineProps<{
  widget: PlacedWorkbenchWidget
  editing: boolean
  tools: ToolRecord[]
  runtime: RuntimeInfo | null
  loading: boolean
}>()

const { t } = useI18n()
const layout = useWorkbenchLayoutStore()
const definition = computed(() => getWorkbenchWidgetDefinition(props.widget.key))
const isDropTarget = computed(() => layout.dropTargetWidgetId === props.widget.id && layout.draggedWidgetId !== props.widget.id)
const canIncreaseColSpan = computed(() => props.widget.colSpan < layout.columns)
const canDecreaseColSpan = computed(() => props.widget.colSpan > 1)
const canIncreaseRowSpan = computed(() => props.widget.rowSpan < layout.rows)
const canDecreaseRowSpan = computed(() => props.widget.rowSpan > 1)
const isDragging = computed(() => layout.draggedWidgetId === props.widget.id)
const isResizing = computed(() => layout.resizingWidgetId === props.widget.id)
const dragOffset = reactive({
  x: 0,
  y: 0
})
const itemElement = ref<HTMLElement | null>(null)
let dragPointerId: number | null = null
let dragStartX = 0
let dragStartY = 0
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

function updateColSpan(delta: number) {
  layout.updateWidgetSpan(props.widget.id, {
    colSpan: props.widget.colSpan + delta
  })
}

function updateRowSpan(delta: number) {
  layout.updateWidgetSpan(props.widget.id, {
    rowSpan: props.widget.rowSpan + delta
  })
}

function onItemPointerDown(event: PointerEvent) {
  if (!props.editing || event.button !== 0 || isWorkbenchControl(event.target)) {
    return
  }

  startLocalDrag(event)
}

function onDragHandlePointerDown(event: PointerEvent) {
  if (!props.editing || event.button !== 0) {
    return
  }

  event.stopPropagation()
  startLocalDrag(event)
}

function startLocalDrag(event: PointerEvent) {
  event.preventDefault()
  removeWindowDragListeners()
  dragPointerId = event.pointerId
  dragStartX = event.clientX
  dragStartY = event.clientY
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
    const targetWidgetId = getWidgetIdUnderPointer(event.clientX, event.clientY)

    if (targetWidgetId && targetWidgetId !== props.widget.id) {
      layout.dropOnWidget(targetWidgetId)
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

  const grid = itemElement.value?.closest<HTMLElement>('[data-workbench-grid]')
  const gridRect = grid?.getBoundingClientRect()
  const itemRect = itemElement.value?.getBoundingClientRect()

  if (!grid || !gridRect || !itemRect) {
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

  endLocalResize(event.currentTarget as HTMLElement)
}

function onResizePointerCancel(event: PointerEvent) {
  if (resizePointerId !== event.pointerId) {
    return
  }

  endLocalResize(event.currentTarget as HTMLElement)
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
  const targetWidgetId = getWidgetIdUnderPointer(clientX, clientY)
  layout.previewDragOverWidget(targetWidgetId)
}

function getWidgetIdUnderPointer(clientX: number, clientY: number) {
  const target = document.elementFromPoint(clientX, clientY)
  return target?.closest<HTMLElement>('[data-workbench-widget-id]')?.dataset.workbenchWidgetId ?? null
}

function isWorkbenchControl(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('[data-workbench-control="true"]'))
}

onUnmounted(() => {
  cancelLocalDrag()

  if (resizePointerId !== null) {
    endLocalResize()
  }
})
</script>

<template>
  <article
    v-if="definition"
    ref="itemElement"
    :data-workbench-widget-id="widget.id"
    class="toolbox-grid-item group relative min-h-0 overflow-hidden rounded-lg border border-white/65 bg-white/64 text-slate-950 shadow-lg shadow-slate-900/7 backdrop-blur-2xl transition-[border-color,background,box-shadow,transform] duration-200 dark:border-white/14 dark:bg-white/9 dark:text-white dark:shadow-black/28"
    :class="[
      editing ? 'toolbox-grid-item-editing cursor-grab active:cursor-grabbing' : '',
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
      '--workbench-drag-y': `${dragOffset.y}px`
    }"
    @pointerdown="onItemPointerDown"
    @pointermove="onItemPointerMove"
    @pointerup="onItemPointerUp"
    @pointercancel="onItemPointerCancel"
    @lostpointercapture="onItemPointerCancel"
  >
    <div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r opacity-70 blur-2xl" :class="definition.accentClass" />
    <div class="relative grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-4">
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

        <div v-if="editing" class="flex shrink-0 items-center gap-1 rounded-full border border-white/55 bg-white/62 p-1 shadow-sm shadow-slate-900/5 backdrop-blur-xl dark:border-white/16 dark:bg-white/10 dark:shadow-black/20">
          <UTooltip :text="t('workbench.layout.removeWidget')">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="lucide:x"
              :aria-label="t('workbench.layout.removeWidget')"
              class="cursor-pointer"
              @click.stop="layout.removeWidget(widget.id)"
            />
          </UTooltip>
        </div>
      </header>

      <div class="min-h-0 overflow-hidden">
        <component
          :is="definition.component"
          v-bind="componentProps"
        />
      </div>

      <div
        v-if="editing"
        data-workbench-control="true"
        class="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-900/10 bg-white/82 px-2 py-1.5 text-xs shadow-lg shadow-slate-900/10 backdrop-blur-xl dark:border-white/14 dark:bg-slate-950/72 dark:shadow-black/35"
      >
        <span
          class="inline-flex cursor-grab select-none items-center gap-1 rounded-full px-2 py-1 font-medium text-slate-600 active:cursor-grabbing dark:text-white/64"
          @pointerdown="onDragHandlePointerDown"
        >
          <UIcon name="lucide:move" class="size-3.5" />
          {{ t('workbench.layout.dragToSort') }}
        </span>
        <div class="flex items-center gap-1">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="lucide:arrow-left"
            :aria-label="t('workbench.layout.moveEarlier')"
            class="cursor-pointer"
            @click.stop="layout.moveWidget(widget.id, -1)"
          />
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="lucide:arrow-right"
            :aria-label="t('workbench.layout.moveLater')"
            class="cursor-pointer"
            @click.stop="layout.moveWidget(widget.id, 1)"
          />
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="lucide:chevron-left"
            :disabled="!canDecreaseColSpan"
            :aria-label="t('workbench.layout.decreaseColSpan')"
            class="cursor-pointer"
            @click.stop="updateColSpan(-1)"
          />
          <span class="min-w-8 text-center font-semibold text-slate-800 dark:text-white">{{ widget.colSpan }}x{{ widget.rowSpan }}</span>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="lucide:chevron-right"
            :disabled="!canIncreaseColSpan"
            :aria-label="t('workbench.layout.increaseColSpan')"
            class="cursor-pointer"
            @click.stop="updateColSpan(1)"
          />
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="lucide:chevron-up"
            :disabled="!canDecreaseRowSpan"
            :aria-label="t('workbench.layout.decreaseRowSpan')"
            class="cursor-pointer"
            @click.stop="updateRowSpan(-1)"
          />
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="lucide:chevron-down"
            :disabled="!canIncreaseRowSpan"
            :aria-label="t('workbench.layout.increaseRowSpan')"
            class="cursor-pointer"
            @click.stop="updateRowSpan(1)"
          />
        </div>
      </div>

      <button
        v-if="editing"
        type="button"
        data-workbench-control="true"
        class="toolbox-resize-handle absolute bottom-1.5 right-1.5 z-20 cursor-nwse-resize rounded-md border border-slate-900/16 bg-white/80 text-slate-700 shadow-sm shadow-slate-900/12 backdrop-blur-xl transition-colors duration-200 hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:border-white/18 dark:bg-slate-950/68 dark:text-white/74 dark:shadow-black/35 dark:hover:bg-cyan-300/14"
        :aria-label="t('workbench.layout.resizeWidget')"
        @pointerdown="onResizePointerDown"
        @pointermove="onResizePointerMove"
        @pointerup="onResizePointerUp"
        @pointercancel="onResizePointerCancel"
        @lostpointercapture="onResizePointerCancel"
      >
        <UIcon name="lucide:grip" class="size-3.5" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.toolbox-grid-item {
  min-height: 7.5rem;
  translate: 0 0;
}

.toolbox-grid-item-editing {
  user-select: none;
  touch-action: none;
}

.toolbox-grid-item-dragging {
  z-index: 30;
  pointer-events: none;
  opacity: 0.78;
  translate: var(--workbench-drag-x) var(--workbench-drag-y);
  scale: 1.015;
  box-shadow: 0 28px 70px rgba(15, 23, 42, 0.22);
}

.toolbox-grid-item-resizing {
  z-index: 20;
  border-color: rgba(6, 182, 212, 0.72);
  background: rgba(236, 254, 255, 0.72);
  box-shadow: 0 24px 60px rgba(8, 145, 178, 0.16);
}

.toolbox-resize-handle {
  display: inline-grid;
  width: 1.45rem;
  height: 1.45rem;
  place-items: center;
}

.toolbox-resize-handle::after {
  position: absolute;
  right: 0.28rem;
  bottom: 0.28rem;
  width: 0.48rem;
  height: 0.48rem;
  border-right: 2px solid currentcolor;
  border-bottom: 2px solid currentcolor;
  content: "";
  opacity: 0.62;
}
</style>
