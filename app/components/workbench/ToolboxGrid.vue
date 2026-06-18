<script setup lang="ts">
import ToolboxGridItem from '~/components/workbench/ToolboxGridItem.vue'
import type { PlacedWorkbenchWidget, WorkbenchGridPosition } from '~/stores/workbench-layout'
import type { RuntimeInfo, ToolRecord } from '~/types/hdx-api'
import type { WorkbenchWidgetKey } from '~/utils/workbench-widget-meta'
import { workbenchWidgetDefinitions } from '~/utils/workbench-widgets'

defineProps<{
  tools: ToolRecord[]
  runtime: RuntimeInfo | null
  loading: boolean
}>()

const { t } = useI18n()
const layout = useWorkbenchLayoutStore()
const gridElement = ref<HTMLElement | null>(null)
const hoverPosition = ref<WorkbenchGridPosition | null>(null)
const addMenuOpen = ref(false)
const manualFlipTransition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
const manualFlipCleanupDelayMs = 260
let debugLayoutSequence = 0
let debugLayoutFrame: number | null = null
const manualFlipCleanupTimers = new Map<string, number>()
const renderedWidgets = computed(() => {
  const stableOrder = new Map(layout.widgets.map((widget, index) => [widget.id, index]))

  return [...layout.placedWidgets].sort((left: PlacedWorkbenchWidget, right: PlacedWorkbenchWidget) => {
    const leftIndex = stableOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER
    const rightIndex = stableOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex
    }

    return left.id.localeCompare(right.id)
  })
})
const flipLayoutSignature = computed(() => renderedWidgets.value
  .map(widget => `${widget.id}:${widget.column},${widget.row},${widget.colSpan}x${widget.rowSpan}`)
  .join('|'))
const debugLayoutSignature = computed(() => [
  `drag=${layout.draggedWidgetId ?? '-'}`,
  `target=${layout.dropTargetWidgetId ?? '-'}`,
  flipLayoutSignature.value
].join('|'))
const widgetMenuItems = computed(() => workbenchWidgetDefinitions.map(definition => ({
  label: t(definition.titleKey),
  icon: definition.icon,
  disabled: hoverPosition.value ? !layout.canAddWidgetAt(definition.key as WorkbenchWidgetKey, hoverPosition.value) : true,
  onSelect: () => addWidgetAtHoverPosition(definition.key as WorkbenchWidgetKey)
})))
const hoveredEmptyCellStyle = computed(() => {
  if (!hoverPosition.value) {
    return {}
  }

  return {
    gridColumnStart: hoverPosition.value.column + 1,
    gridRowStart: hoverPosition.value.row + 1
  }
})

function onGridPointerMove(event: PointerEvent) {
  if (!layout.editing || layout.draggedWidgetId || layout.resizingWidgetId) {
    hoverPosition.value = null
    return
  }

  hoverPosition.value = getEmptyPositionFromPointer(event.clientX, event.clientY)
}

function onGridPointerLeave() {
  if (addMenuOpen.value) {
    return
  }

  hoverPosition.value = null
}

function getEmptyPositionFromPointer(clientX: number, clientY: number) {
  const gridRect = gridElement.value?.getBoundingClientRect()

  if (!gridRect) {
    return null
  }

  const position = projectPointerToGrid(clientX, clientY, gridRect)

  if (!position || isPositionOccupied(position)) {
    return null
  }

  return position
}

function projectPointerToGrid(clientX: number, clientY: number, gridRect: DOMRect): WorkbenchGridPosition | null {
  const gap = layout.gap
  const cellWidth = Math.max((gridRect.width - gap * (layout.columns - 1)) / layout.columns, 1)
  const cellHeight = Math.max((gridRect.height - gap * (layout.rows - 1)) / layout.rows, 1)
  const columnStep = cellWidth + gap
  const rowStep = cellHeight + gap
  const localX = clientX - gridRect.left
  const localY = clientY - gridRect.top

  if (localX < 0 || localY < 0 || localX > gridRect.width || localY > gridRect.height) {
    return null
  }

  const column = Math.floor(localX / columnStep)
  const row = Math.floor(localY / rowStep)
  const columnOffset = localX - column * columnStep
  const rowOffset = localY - row * rowStep

  if (column < 0 || row < 0 || column >= layout.columns || row >= layout.rows || columnOffset > cellWidth || rowOffset > cellHeight) {
    return null
  }

  return { column, row }
}

function isPositionOccupied(position: WorkbenchGridPosition) {
  return layout.placedWidgets.some(widget =>
    position.column >= widget.column
    && position.column < widget.column + widget.colSpan
    && position.row >= widget.row
    && position.row < widget.row + widget.rowSpan
  )
}

function addWidgetAtHoverPosition(key: WorkbenchWidgetKey) {
  if (!hoverPosition.value) {
    return
  }

  if (layout.addWidgetAt(key, hoverPosition.value)) {
    addMenuOpen.value = false
    hoverPosition.value = null
  }
}

function onAddMenuOpenUpdate(open: boolean) {
  addMenuOpen.value = open
}

function collectGridItemElements() {
  return [...(gridElement.value?.querySelectorAll<HTMLElement>('[data-workbench-widget-id]') ?? [])]
}

function collectGridItemRects() {
  return new Map(
    collectGridItemElements()
      .map((element) => {
        const widgetId = element.dataset.workbenchWidgetId

        if (!widgetId) {
          return null
        }

        return [widgetId, element.getBoundingClientRect()] as const
      })
      .filter((entry): entry is readonly [string, DOMRect] => Boolean(entry))
  )
}

function clearManualFlipAnimation(element: HTMLElement, widgetId?: string) {
  if (widgetId) {
    const cleanupTimer = manualFlipCleanupTimers.get(widgetId)

    if (cleanupTimer !== undefined) {
      window.clearTimeout(cleanupTimer)
      manualFlipCleanupTimers.delete(widgetId)
    }
  }

  element.style.removeProperty('transition')
  element.style.removeProperty('transform')
  element.style.removeProperty('will-change')
}

function applyManualFlip(previousRects: Map<string, DOMRect>) {
  const preparedElements = collectGridItemElements()
    .map((element) => {
      const widgetId = element.dataset.workbenchWidgetId

      if (!widgetId || widgetId === layout.draggedWidgetId || widgetId === layout.resizingWidgetId) {
        return null
      }

      const previousRect = previousRects.get(widgetId)

      if (!previousRect) {
        clearManualFlipAnimation(element, widgetId)
        return null
      }

      const nextRect = element.getBoundingClientRect()
      const deltaX = previousRect.left - nextRect.left
      const deltaY = previousRect.top - nextRect.top

      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) {
        clearManualFlipAnimation(element, widgetId)
        return null
      }

      clearManualFlipAnimation(element, widgetId)
      element.style.transition = 'none'
      element.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`
      element.style.willChange = 'transform'

      return { element, widgetId }
    })
    .filter((entry): entry is { element: HTMLElement, widgetId: string } => Boolean(entry))

  if (preparedElements.length === 0) {
    return
  }

  requestAnimationFrame(() => {
    for (const { element, widgetId } of preparedElements) {
      element.style.transition = manualFlipTransition
      element.style.transform = 'translate3d(0, 0, 0)'

      const cleanupTimer = window.setTimeout(() => {
        clearManualFlipAnimation(element, widgetId)
      }, manualFlipCleanupDelayMs)

      manualFlipCleanupTimers.set(widgetId, cleanupTimer)
    }
  })
}

function scheduleManualFlip() {
  if (!import.meta.client) {
    return
  }

  const previousRects = collectGridItemRects()

  if (previousRects.size === 0) {
    return
  }

  nextTick(() => {
    applyManualFlip(previousRects)
  })
}

function logWorkbenchLayoutDebug(signature: string) {
  if (!import.meta.dev || !import.meta.client || !layout.editing) {
    return
  }

  debugLayoutSequence += 1
  const sequence = debugLayoutSequence

  console.groupCollapsed(`[workbench-layout-debug #${sequence}] store ${signature}`)
  console.table(renderedWidgets.value.map(widget => ({
    id: widget.id,
    key: widget.key,
    column: widget.column,
    row: widget.row,
    colSpan: widget.colSpan,
    rowSpan: widget.rowSpan,
    dragged: layout.draggedWidgetId === widget.id,
    dropTarget: layout.dropTargetWidgetId === widget.id
  })))
  console.groupEnd()

  if (debugLayoutFrame !== null) {
    cancelAnimationFrame(debugLayoutFrame)
  }

  debugLayoutFrame = requestAnimationFrame(() => {
    debugLayoutFrame = null
    const gridRect = gridElement.value?.getBoundingClientRect()
    const domRows = [...(gridElement.value?.querySelectorAll<HTMLElement>('[data-workbench-widget-id]') ?? [])].map((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)

      return {
        id: element.dataset.workbenchWidgetId,
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        relLeft: gridRect ? Math.round(rect.left - gridRect.left) : null,
        relTop: gridRect ? Math.round(rect.top - gridRect.top) : null,
        gridColumnStart: style.gridColumnStart,
        gridColumnEnd: style.gridColumnEnd,
        gridRowStart: style.gridRowStart,
        gridRowEnd: style.gridRowEnd,
        hasMoveClass: element.classList.contains('toolbox-grid-move'),
        transform: style.transform,
        transition: style.transition
      }
    })

    console.groupCollapsed(`[workbench-layout-debug #${sequence}] dom`)
    console.table(domRows)
    console.groupEnd()
  })
}

if (import.meta.client && import.meta.dev) {
  watch(debugLayoutSignature, logWorkbenchLayoutDebug, { flush: 'post' })
}

if (import.meta.client) {
  watch(flipLayoutSignature, scheduleManualFlip, { flush: 'pre' })

  onUnmounted(() => {
    if (debugLayoutFrame !== null) {
      cancelAnimationFrame(debugLayoutFrame)
    }

    for (const cleanupTimer of manualFlipCleanupTimers.values()) {
      window.clearTimeout(cleanupTimer)
    }

    manualFlipCleanupTimers.clear()
  })
}
</script>

<template>
  <section class="grid h-full min-h-0 gap-3 overflow-hidden">
    <div
      ref="gridElement"
      class="toolbox-grid relative min-h-full"
      data-workbench-grid="true"
      :style="{
        '--toolbox-columns': layout.columns,
        '--toolbox-rows': layout.rows,
        '--toolbox-gap': `${layout.gap}px`,
        '--toolbox-row-min': '0px'
      }"
      @pointermove="onGridPointerMove"
      @pointerleave="onGridPointerLeave"
    >
      <TransitionGroup name="toolbox-grid">
        <ToolboxGridItem
          v-for="widget in renderedWidgets"
          :key="widget.id"
          :widget="widget"
          :editing="layout.editing"
          :tools="tools"
          :runtime="runtime"
          :loading="loading"
        />
      </TransitionGroup>

      <Transition name="toolbox-empty-cell">
        <div
          v-if="layout.editing && hoverPosition"
          class="toolbox-empty-cell-hover pointer-events-none relative z-0 min-h-0 rounded-lg border border-dashed border-cyan-300/80 bg-cyan-50/32 shadow-inner shadow-cyan-900/6 dark:border-cyan-200/30 dark:bg-cyan-300/8"
          :style="hoveredEmptyCellStyle"
        >
          <UDropdownMenu
            v-model:open="addMenuOpen"
            :items="widgetMenuItems"
            :content="{ align: 'center' }"
            :ui="{ content: 'workbench-floating-menu rounded-[1.25rem]' }"
            @update:open="onAddMenuOpenUpdate"
          >
            <UButton
              type="button"
              color="primary"
              variant="soft"
              block
              class="toolbox-add-widget-button pointer-events-auto cursor-pointer"
            >
              <span class="grid justify-items-center gap-2">
                <UIcon name="lucide:plus" class="size-6" />
                <span class="text-sm font-semibold">{{ t('workbench.layout.addWidget') }}</span>
              </span>
            </UButton>
          </UDropdownMenu>
        </div>
      </Transition>
    </div>
  </section>
</template>

<style scoped>
.toolbox-grid {
  display: grid;
  grid-template-columns: repeat(var(--toolbox-columns), minmax(0, 1fr));
  grid-template-rows: repeat(var(--toolbox-rows), minmax(var(--toolbox-row-min), 1fr));
  grid-auto-rows: minmax(var(--toolbox-row-min), 1fr);
  gap: var(--toolbox-gap);
}

.toolbox-grid-move {
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1) !important;
  will-change: transform;
}

.toolbox-grid-enter-active,
.toolbox-grid-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.toolbox-grid-enter-from,
.toolbox-grid-leave-to {
  opacity: 0;
  transform: translateY(0.35rem);
}

.toolbox-grid-leave-active {
  position: absolute;
  pointer-events: none;
}

.toolbox-empty-cell-enter-active,
.toolbox-empty-cell-leave-active {
  transition: opacity 140ms ease;
}

.toolbox-empty-cell-enter-from,
.toolbox-empty-cell-leave-to {
  opacity: 0;
}

.toolbox-empty-cell-hover {
  grid-column-end: span 1;
  grid-row-end: span 1;
}

.toolbox-add-widget-button {
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 0;
  place-items: center;
  border: 1px dashed rgba(34, 211, 238, 0.7);
  border-radius: 0.5rem;
  background: rgba(236, 254, 255, 0.44);
  color: rgb(21, 94, 117);
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.toolbox-add-widget-button:hover {
  background: rgba(207, 250, 254, 0.58);
}

.dark .toolbox-add-widget-button {
  border-color: rgba(165, 243, 252, 0.34);
  background: rgba(103, 232, 249, 0.08);
  color: rgb(207, 250, 254);
}

.dark .toolbox-add-widget-button:hover {
  background: rgba(103, 232, 249, 0.14);
}

@media (max-width: 767px) {
  .toolbox-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .toolbox-grid > * {
    grid-column: span 1 / span 1 !important;
    grid-row: span 1 / span 1 !important;
  }
}
</style>
