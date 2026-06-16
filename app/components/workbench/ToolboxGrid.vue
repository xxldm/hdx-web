<script setup lang="ts">
import ToolboxGridItem from '~/components/workbench/ToolboxGridItem.vue'
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
const widgetMenuItems = computed(() => workbenchWidgetDefinitions.map(definition => ({
  label: t(definition.titleKey),
  icon: definition.icon,
  onSelect: () => layout.addWidget(definition.key as WorkbenchWidgetKey)
})))
const canShowAddWidget = computed(() => layout.emptyCellCount > 0)
const emptyCellPreviewCount = computed(() => Math.min(Math.max(layout.emptyCellCount - (canShowAddWidget.value ? 1 : 0), 0), 12))
</script>

<template>
  <section class="grid h-full min-h-0 gap-3 overflow-hidden">
    <TransitionGroup
      name="toolbox-grid"
      tag="div"
      class="toolbox-grid h-full min-h-0"
      data-workbench-grid="true"
      :style="{
        '--toolbox-columns': layout.columns,
        '--toolbox-rows': layout.rows,
        '--toolbox-gap': `${layout.gap}px`,
        '--toolbox-row-min': '8rem'
      }"
    >
      <ToolboxGridItem
        v-for="widget in layout.placedWidgets"
        :key="widget.id"
        :widget="widget"
        :editing="layout.editing"
        :tools="tools"
        :runtime="runtime"
        :loading="loading"
      />

      <div
        v-if="layout.editing && canShowAddWidget"
        key="add-widget"
        class="min-h-32"
      >
        <UDropdownMenu
          :items="widgetMenuItems"
          :content="{ align: 'start' }"
        >
          <UButton
            type="button"
            color="primary"
            variant="soft"
            block
            class="toolbox-add-widget-button cursor-pointer"
          >
            <span class="grid justify-items-center gap-2">
              <UIcon name="lucide:plus" class="size-6" />
              <span class="text-sm font-semibold">{{ t('workbench.layout.addWidget') }}</span>
            </span>
          </UButton>
        </UDropdownMenu>
      </div>

      <template v-if="layout.editing">
        <div
          v-for="index in emptyCellPreviewCount"
          :key="`empty-${index}`"
          class="min-h-32 rounded-lg border border-dashed border-slate-300/72 bg-white/24 dark:border-white/16 dark:bg-white/4"
        />
      </template>
    </TransitionGroup>
  </section>
</template>

<style scoped>
.toolbox-grid {
  display: grid;
  grid-template-columns: repeat(var(--toolbox-columns), minmax(0, 1fr));
  grid-template-rows: repeat(var(--toolbox-rows), minmax(0, 1fr));
  grid-auto-rows: minmax(0, 1fr);
  gap: var(--toolbox-gap);
  grid-auto-flow: dense;
}

.toolbox-grid-move,
.toolbox-grid-enter-active,
.toolbox-grid-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.toolbox-grid-enter-from,
.toolbox-grid-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

.toolbox-add-widget-button {
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 8rem;
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
