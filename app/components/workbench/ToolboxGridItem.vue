<script setup lang="ts">
import type { RuntimeInfo, ToolRecord } from '~/types/hdx-api'
import type {
  PlacedWorkbenchWidget,
  WorkbenchWidgetChrome
} from '~/stores/workbench-layout'
import type { ResolvedWorkbenchWidgetOrientation, WorkbenchWidgetKey, WorkbenchWidgetOrientation } from '~/utils/workbench-widget-meta'
import { useWorkbenchWidgetDrag } from '~/composables/use-workbench-widget-drag'
import { useWorkbenchWidgetEditSurface } from '~/composables/use-workbench-widget-edit-surface'
import { useWorkbenchWidgetResize } from '~/composables/use-workbench-widget-resize'
import { getWorkbenchWidgetDefinition, workbenchWidgetDefinitions } from '~/utils/workbench-widgets'

const props = defineProps<{
  widget: PlacedWorkbenchWidget
  editing: boolean
  selected?: boolean
  highlighted?: boolean
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
const widgetTitle = computed(() => definition.value ? t(definition.value.titleKey) : '')
const removeWidgetAriaLabel = computed(() => t('workbench.layout.removeWidgetByTitle', { title: widgetTitle.value }))
const resizeWidgetAriaLabel = computed(() => t('workbench.layout.resizeWidgetByTitle', { title: widgetTitle.value }))
const changeWidgetAriaLabel = computed(() => t('workbench.layout.changeWidgetByTitle', { title: widgetTitle.value }))
const isDropTarget = computed(() => layout.dropTargetWidgetId === props.widget.id && layout.draggedWidgetId !== props.widget.id)
const isDragging = computed(() => layout.draggedWidgetId === props.widget.id)
const isResizing = computed(() => layout.resizingWidgetId === props.widget.id)
const resolvedOrientation = computed<ResolvedWorkbenchWidgetOrientation>(() => {
  if (props.widget.orientation === 'horizontal' || props.widget.orientation === 'vertical') {
    return props.widget.orientation
  }

  return props.widget.colSpan >= props.widget.rowSpan ? 'horizontal' : 'vertical'
})
const componentChromeClass = computed(() => props.widget.chrome === 'bare'
  ? 'border-transparent bg-transparent shadow-none backdrop-blur-none dark:border-transparent dark:bg-transparent dark:shadow-none'
  : 'border-white/65 bg-white/64 shadow-lg shadow-slate-900/7 backdrop-blur-2xl dark:border-white/14 dark:bg-white/9 dark:shadow-black/28')
const cardContentClass = computed(() => props.widget.chrome === 'bare'
  ? 'grid-rows-[auto_minmax(0,1fr)] gap-3 hdx-radius-card p-0'
  : 'grid-rows-[auto_minmax(0,1fr)] gap-3 hdx-radius-card p-4')
const shouldShowHeader = computed(() =>
  props.widget.header.visible
  && (props.widget.header.icon || props.widget.header.title || props.widget.header.description)
)
const shouldShowHeaderText = computed(() => props.widget.header.title || props.widget.header.description)
const widgetMenuItems = computed(() => [
  workbenchWidgetDefinitions.map((item) => ({
    label: t(item.titleKey),
    icon: item.icon,
    type: 'checkbox' as const,
    checked: item.key === props.widget.key,
    active: item.key === props.widget.key,
    disabled: item.key === props.widget.key ? false : !layout.canUpdateWidgetKey(props.widget.id, item.key as WorkbenchWidgetKey),
    onUpdateChecked: (checked: boolean) => {
      if (checked) {
        layout.updateWidgetKey(props.widget.id, item.key as WorkbenchWidgetKey)
      }
    }
  })),
  [
    {
      label: t('workbench.layout.chromeCard'),
      icon: 'i-lucide-square',
      type: 'checkbox' as const,
      checked: props.widget.chrome === 'card',
      active: props.widget.chrome === 'card',
      onUpdateChecked: (checked: boolean) => {
        if (checked) {
          layout.updateWidgetChrome(props.widget.id, 'card' satisfies WorkbenchWidgetChrome)
        }
      }
    },
    {
      label: t('workbench.layout.chromeBare'),
      icon: 'i-lucide-square-dashed',
      type: 'checkbox' as const,
      checked: props.widget.chrome === 'bare',
      active: props.widget.chrome === 'bare',
      onUpdateChecked: (checked: boolean) => {
        if (checked) {
          layout.updateWidgetChrome(props.widget.id, 'bare' satisfies WorkbenchWidgetChrome)
        }
      }
    }
  ],
  [
    {
      label: t('workbench.layout.orientationAuto'),
      icon: 'i-lucide-sparkles',
      type: 'checkbox' as const,
      checked: props.widget.orientation === 'auto',
      active: props.widget.orientation === 'auto',
      onUpdateChecked: (checked: boolean) => {
        if (checked) {
          layout.updateWidgetOrientation(props.widget.id, 'auto' satisfies WorkbenchWidgetOrientation)
        }
      }
    },
    {
      label: t('workbench.layout.orientationHorizontal'),
      icon: 'i-lucide-panel-top',
      type: 'checkbox' as const,
      checked: props.widget.orientation === 'horizontal',
      active: props.widget.orientation === 'horizontal',
      onUpdateChecked: (checked: boolean) => {
        if (checked) {
          layout.updateWidgetOrientation(props.widget.id, 'horizontal' satisfies WorkbenchWidgetOrientation)
        }
      }
    },
    {
      label: t('workbench.layout.orientationVertical'),
      icon: 'i-lucide-panel-left',
      type: 'checkbox' as const,
      checked: props.widget.orientation === 'vertical',
      active: props.widget.orientation === 'vertical',
      onUpdateChecked: (checked: boolean) => {
        if (checked) {
          layout.updateWidgetOrientation(props.widget.id, 'vertical' satisfies WorkbenchWidgetOrientation)
        }
      }
    }
  ],
  [
    {
      label: t('workbench.layout.showHeader'),
      icon: 'i-lucide-panel-top-open',
      type: 'checkbox' as const,
      checked: props.widget.header.visible,
      onUpdateChecked: (checked: boolean) => layout.updateWidgetHeader(props.widget.id, { visible: checked })
    },
    {
      label: t('workbench.layout.showIcon'),
      icon: 'i-lucide-badge',
      type: 'checkbox' as const,
      checked: props.widget.header.icon,
      disabled: !props.widget.header.visible,
      onUpdateChecked: (checked: boolean) => layout.updateWidgetHeader(props.widget.id, { icon: checked })
    },
    {
      label: t('workbench.layout.showTitle'),
      icon: 'i-lucide-heading',
      type: 'checkbox' as const,
      checked: props.widget.header.title,
      disabled: !props.widget.header.visible,
      onUpdateChecked: (checked: boolean) => layout.updateWidgetHeader(props.widget.id, { title: checked })
    },
    {
      label: t('workbench.layout.showDescription'),
      icon: 'i-lucide-text',
      type: 'checkbox' as const,
      checked: props.widget.header.description,
      disabled: !props.widget.header.visible,
      onUpdateChecked: (checked: boolean) => layout.updateWidgetHeader(props.widget.id, { description: checked })
    }
  ]
])
const itemElement = ref<HTMLElement | null>(null)
const {
  removeConfirmOpen,
  isRemoving,
  onConfirmRemoveWidget,
  onCancelRemoveWidget,
  armEditActionClickGuard,
  onEditActionClickCapture
} = useWorkbenchWidgetEditSurface({
  widgetId: () => props.widget.id,
  editing: () => props.editing,
  selected: () => props.selected
})
const {
  dragOffset,
  dragFixedRect,
  dragOrigin,
  onItemPointerDown,
  onItemPointerLeave,
  onItemPointerMove,
  onItemPointerUp,
  onItemPointerCancel
} = useWorkbenchWidgetDrag({
  itemElement,
  widget: () => props.widget,
  editing: () => props.editing,
  selected: () => props.selected,
  isRemoveConfirmOpen: () => removeConfirmOpen.value,
  closeRemoveConfirm: onCancelRemoveWidget,
  armEditActionClickGuard,
  selectWidget: widgetId => emit('select', widgetId),
  leaveWidget: widgetId => emit('leave', widgetId)
})
const {
  resizeLimitFeedback,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
  onResizePointerCancel
} = useWorkbenchWidgetResize({
  itemElement,
  widget: () => props.widget,
  editing: () => props.editing,
  selectWidget: widgetId => emit('select', widgetId),
  closeRemoveConfirm: onCancelRemoveWidget
})
const resizeLimitFeedbackText = computed(() => {
  if (resizeLimitFeedback.value === 'min') {
    return t('workbench.layout.resizeMinLimitReached')
  }

  if (resizeLimitFeedback.value === 'max') {
    return t('workbench.layout.resizeMaxLimitReached')
  }

  if (resizeLimitFeedback.value === 'boundary') {
    return t('workbench.layout.resizeBoundaryLimitReached')
  }

  return ''
})
const componentProps = computed(() => {
  const displayProps = {
    orientation: resolvedOrientation.value
  }

  if (props.widget.key === 'tool-catalog') {
    return {
      ...displayProps,
      tools: props.tools,
      loading: props.loading
    }
  }

  if (props.widget.key === 'runtime') {
    return {
      ...displayProps,
      runtime: props.runtime
    }
  }

  return displayProps
})

</script>

<template>
  <article
    v-if="definition"
    ref="itemElement"
    :data-workbench-widget-id="widget.id"
    :data-workbench-widget-key="widget.key"
    class="toolbox-grid-item relative min-h-0 overflow-hidden border text-slate-950 transition-[border-color,background,box-shadow,transform,opacity] duration-200 hdx-radius-card dark:text-white"
    :class="[
      componentChromeClass,
      editing ? 'toolbox-grid-item-editing cursor-grab active:cursor-grabbing' : '',
      props.selected ? 'toolbox-grid-item-selected ring-1 ring-cyan-400/45 shadow-[0_20px_40px_rgba(15,23,42,0.12)] dark:ring-cyan-200/30 dark:shadow-[0_20px_40px_rgba(0,0,0,0.32)]' : '',
      props.highlighted ? 'toolbox-grid-item-navigation-highlighted' : '',
      removeConfirmOpen ? 'toolbox-grid-item-remove-open' : '',
      isRemoving ? 'toolbox-grid-item-removing' : '',
      isDropTarget ? 'border-cyan-400 bg-cyan-50/70 shadow-cyan-900/16 dark:border-cyan-200/55 dark:bg-cyan-300/12' : '',
      isDragging ? 'toolbox-grid-item-dragging' : '',
      isResizing ? 'toolbox-grid-item-resizing' : '',
      resizeLimitFeedback ? 'toolbox-grid-item-resize-limited' : ''
    ]"
    :style="{
      gridColumnStart: widget.column + 1,
      gridColumnEnd: `span ${widget.colSpan}`,
      gridRowStart: widget.row + 1,
      gridRowEnd: `span ${widget.rowSpan}`,
      '--workbench-drag-x': `${dragOffset.x}px`,
      '--workbench-drag-y': `${dragOffset.y}px`,
      '--workbench-drag-left': `${dragOrigin.left}px`,
      '--workbench-drag-top': `${dragOrigin.top}px`,
      '--workbench-drag-width': `${dragFixedRect.width}px`,
      '--workbench-drag-height': `${dragFixedRect.height}px`
    }"
    @pointerdown="onItemPointerDown"
    @pointerleave="onItemPointerLeave"
    @pointermove="onItemPointerMove"
    @pointerup="onItemPointerUp"
    @pointercancel="onItemPointerCancel"
  >
    <div v-if="isDragging" class="toolbox-drag-placeholder grid h-full min-h-0 place-items-center hdx-radius-card" aria-hidden="true">
      <UIcon name="i-lucide-move" class="size-6 text-cyan-100/70" />
    </div>

    <div v-else class="toolbox-card-content relative grid h-full min-h-0" :class="cardContentClass">
      <div v-if="widget.chrome === 'card'" class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r opacity-70 blur-2xl" :class="definition.accentClass" />
      <header v-if="shouldShowHeader || editing" class="flex min-w-0 items-start justify-between gap-3">
        <div v-if="shouldShowHeader" class="flex min-w-0 items-center gap-3">
          <div v-if="widget.header.icon" class="grid size-10 shrink-0 place-items-center border border-white/60 bg-white/58 shadow-sm shadow-slate-900/5 hdx-radius-card dark:border-white/16 dark:bg-white/10 dark:shadow-black/20">
            <UIcon :name="definition.icon" class="size-5 text-slate-800 dark:text-white" />
          </div>
          <div v-if="shouldShowHeaderText" class="min-w-0">
            <h2 v-if="widget.header.title" class="truncate text-base font-semibold tracking-normal text-slate-950 dark:text-white">
              {{ t(definition.titleKey) }}
            </h2>
            <p v-if="widget.header.description" class="truncate text-sm text-slate-600 dark:text-white/62">
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
            :ui="{ content: 'hdx-floating-menu hdx-radius-popover' }"
          >
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              class="toolbox-remove-button cursor-pointer"
              :aria-label="removeWidgetAriaLabel"
              @click.stop="emit('select', props.widget.id)"
            />

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
                    class="cursor-pointer hdx-radius-card"
                    @click="() => { onCancelRemoveWidget(); close() }"
                  >
                    {{ t('workbench.layout.cancel') }}
                  </UButton>
                  <UButton
                    type="button"
                    color="error"
                    variant="solid"
                    size="sm"
                    class="cursor-pointer hdx-radius-card"
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

      <div v-if="editing" class="toolbox-edit-affordance pointer-events-none absolute inset-0 z-20 bg-slate-950/7 opacity-0 transition-opacity duration-200 hdx-radius-card dark:bg-black/14" />

      <div
        v-if="editing"
        data-workbench-control="true"
        class="toolbox-edit-actions absolute bottom-3 left-3 z-30 max-w-[calc(100%-4.25rem)] opacity-0 transition-[opacity,transform] duration-200"
        @click.capture="onEditActionClickCapture"
      >
        <div class="border border-white/65 bg-white/78 p-1 shadow-xl shadow-slate-900/12 backdrop-blur-2xl hdx-radius-popover dark:border-white/16 dark:bg-slate-950/72 dark:shadow-black/35">
          <UTooltip :text="t('workbench.layout.changeWidget')">
            <UDropdownMenu
              :items="widgetMenuItems"
              :content="{ align: 'start' }"
              :ui="{
                content: 'hdx-floating-menu hdx-radius-popover',
                item: 'workbench-widget-menu-item',
                itemLeadingIcon: 'workbench-widget-menu-icon',
                itemTrailing: 'workbench-widget-menu-trailing',
                itemTrailingIcon: 'workbench-widget-menu-trailing-icon'
              }"
            >
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                icon="i-lucide-replace"
                size="sm"
                class="toolbox-change-button cursor-pointer"
                :aria-label="changeWidgetAriaLabel"
              >
                {{ t('workbench.layout.changeWidget') }}
              </UButton>
            </UDropdownMenu>
          </UTooltip>
        </div>
      </div>

      <div
        v-if="editing && resizeLimitFeedbackText"
        class="toolbox-resize-limit-hint pointer-events-none absolute bottom-11 right-3 z-30 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50/86 px-2.5 py-1 text-xs font-medium text-amber-950 shadow-lg shadow-amber-900/12 backdrop-blur-xl dark:border-amber-200/18 dark:bg-amber-300/16 dark:text-amber-50 dark:shadow-black/28"
      >
        <UIcon name="i-lucide-circle-alert" class="size-3.5 shrink-0" />
        <span class="truncate">{{ resizeLimitFeedbackText }}</span>
      </div>

      <button
        v-if="editing"
        type="button"
        data-workbench-control="true"
        class="toolbox-resize-handle absolute bottom-1.5 right-1.5 z-30 cursor-nwse-resize border border-white/65 bg-white/78 text-slate-700 shadow-sm shadow-slate-900/12 backdrop-blur-xl transition-[opacity,background,color] duration-200 hdx-radius-control hover:bg-cyan-50 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:border-white/18 dark:bg-slate-950/72 dark:text-white/74 dark:shadow-black/35 dark:hover:bg-cyan-300/14"
        :aria-label="resizeWidgetAriaLabel"
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
        class="toolbox-drag-preview fixed grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden border border-white/65 bg-white/70 p-4 text-slate-950 shadow-2xl shadow-slate-950/22 backdrop-blur-2xl hdx-radius-card dark:border-white/16 dark:bg-slate-950/80 dark:text-white dark:shadow-black/45"
        :style="{
          left: `${dragOrigin.left}px`,
          top: `${dragOrigin.top}px`,
          width: `${dragFixedRect.width}px`,
          height: `${dragFixedRect.height}px`,
          transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) scale(1.015)`
        }"
        aria-hidden="true"
      >
        <div class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r opacity-70 blur-2xl" :class="definition.accentClass" />
        <header v-if="shouldShowHeader" class="relative flex min-w-0 items-start justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <div v-if="widget.header.icon" class="grid size-10 shrink-0 place-items-center border border-white/60 bg-white/58 shadow-sm shadow-slate-900/5 hdx-radius-card dark:border-white/16 dark:bg-white/10 dark:shadow-black/20">
              <UIcon :name="definition.icon" class="size-5 text-slate-800 dark:text-white" />
            </div>
            <div v-if="shouldShowHeaderText" class="min-w-0">
              <h2 v-if="widget.header.title" class="truncate text-base font-semibold tracking-normal text-slate-950 dark:text-white">
                {{ t(definition.titleKey) }}
              </h2>
              <p v-if="widget.header.description" class="truncate text-sm text-slate-600 dark:text-white/62">
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

.toolbox-grid-item-resize-limited {
  border-color: rgba(245, 158, 11, 0.86);
  box-shadow:
    0 24px 60px rgba(245, 158, 11, 0.18),
    inset 0 0 0 1px rgba(245, 158, 11, 0.22);
}

.dark .toolbox-grid-item-resize-limited {
  border-color: rgba(251, 191, 36, 0.72);
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.28),
    inset 0 0 0 1px rgba(251, 191, 36, 0.22);
}

.toolbox-grid-item-navigation-highlighted {
  border-color: color-mix(in srgb, var(--hdx-theme-primary) 58%, white);
  box-shadow:
    0 20px 48px rgba(var(--hdx-theme-primary-rgb), 0.16),
    inset 0 0 0 2px rgba(var(--hdx-theme-primary-rgb), 0.2);
}

.dark .toolbox-grid-item-navigation-highlighted {
  border-color: rgba(var(--hdx-theme-primary-rgb), 0.58);
  box-shadow:
    0 20px 48px rgba(0, 0, 0, 0.28),
    inset 0 0 0 2px rgba(var(--hdx-theme-primary-rgb), 0.22);
}

.toolbox-grid-item-resize-limited .toolbox-resize-handle {
  color: rgb(146, 64, 14);
  background: rgba(254, 243, 199, 0.92);
  opacity: 1;
  pointer-events: auto;
  animation: toolbox-resize-limit-pulse 260ms ease;
}

.dark .toolbox-grid-item-resize-limited .toolbox-resize-handle {
  color: rgb(254, 243, 199);
  background: rgba(245, 158, 11, 0.22);
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
  border-radius: var(--hdx-radius-card);
  padding-inline: 0.75rem;
  white-space: nowrap;
}

.toolbox-change-button :deep(.truncate) {
  max-width: 7rem;
}

:global(.workbench-widget-menu-item[data-disabled]) {
  opacity: 0.34 !important;
}

:global(.workbench-widget-menu-item[data-disabled]::before) {
  background: transparent !important;
}

:global(.workbench-widget-menu-item[data-disabled] .workbench-widget-menu-icon),
:global(.workbench-widget-menu-item[data-disabled] .workbench-widget-menu-trailing-icon) {
  color: var(--ui-text-dimmed) !important;
}

:global(.workbench-widget-menu-trailing) {
  min-width: 1.25rem;
  justify-content: flex-end;
}

:global(.workbench-widget-menu-trailing-icon) {
  width: 1rem;
  height: 1rem;
  color: var(--ui-primary);
}

:global(.dark .workbench-widget-menu-trailing-icon) {
  color: var(--ui-primary);
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
  border-radius: var(--hdx-radius-card);
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

@keyframes toolbox-resize-limit-pulse {
  0%,
  100% {
    transform: translate3d(0, 0, 0);
  }

  46% {
    transform: translate3d(-2px, -2px, 0) scale(1.05);
  }
}

@media (prefers-reduced-motion: reduce) {
  .toolbox-grid-item-resize-limited .toolbox-resize-handle {
    animation: none;
  }
}

</style>
