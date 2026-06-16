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
const emptyCellPreviewCount = computed(() => Math.min(layout.emptyCellCount, 12))
</script>

<template>
  <section class="grid gap-3">
    <TransitionGroup
      name="toolbox-grid"
      tag="div"
      class="toolbox-grid"
      data-workbench-grid="true"
      :style="{
        '--toolbox-columns': layout.columns,
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
        v-if="layout.editing"
        key="add-widget"
        class="min-h-32"
      >
        <UDropdownMenu
          :items="widgetMenuItems"
          :content="{ align: 'start' }"
        >
          <button
            type="button"
            class="grid h-full min-h-32 w-full cursor-pointer place-items-center rounded-lg border border-dashed border-cyan-400/70 bg-cyan-50/44 text-cyan-800 transition-colors duration-200 hover:bg-cyan-100/58 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:border-cyan-200/34 dark:bg-cyan-300/8 dark:text-cyan-100 dark:hover:bg-cyan-300/14"
          >
            <span class="grid justify-items-center gap-2">
              <UIcon name="lucide:plus" class="size-6" />
              <span class="text-sm font-semibold">{{ t('workbench.layout.addWidget') }}</span>
            </span>
          </button>
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
  grid-auto-rows: minmax(var(--toolbox-row-min), auto);
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
