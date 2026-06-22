<script setup lang="ts">
import { storeToRefs } from 'pinia'
import ToolboxGrid from '~/components/workbench/ToolboxGrid.vue'

const { t } = useI18n()
const auth = useAuthStore()
const layout = useWorkbenchLayoutStore()
const { saving: layoutSaving, errorKey: layoutErrorKey } = storeToRefs(layout)
const { highlightedWidgetKey } = useWorkbenchWidgetHighlight()
const activeErrorKeys = computed(() => [layoutErrorKey.value].filter((key): key is string => Boolean(key)))
const contentRowsClass = computed(() => activeErrorKeys.value.length > 0 ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)]')
interface WorkbenchMenuItem {
  label: string
  icon: string
  onSelect?: () => void
  children?: WorkbenchMenuItem[]
}

const layoutStats = computed(() => [
  {
    label: t('workbench.layout.columns'),
    value: layout.columns,
    setter: layout.setColumns,
    decreaseIcon: 'i-lucide-minus',
    increaseIcon: 'i-lucide-plus'
  },
  {
    label: t('workbench.layout.rows'),
    value: layout.rows,
    setter: layout.setRows,
    decreaseIcon: 'i-lucide-minus',
    increaseIcon: 'i-lucide-plus'
  },
  {
    label: t('workbench.layout.gap'),
    value: layout.gap,
    setter: layout.setGap,
    decreaseIcon: 'i-lucide-minus',
    increaseIcon: 'i-lucide-plus'
  }
])
const layoutMenuItems = computed<WorkbenchMenuItem[]>(() => [
  ...layoutStats.value.map(stat => ({
    label: `${stat.label}: ${stat.value}`,
    icon: 'i-lucide-sliders-horizontal',
    children: [
      {
        label: t('workbench.layout.decrease', { label: stat.label }),
        icon: stat.decreaseIcon,
        onSelect: () => updateLayoutValue(stat.setter, stat.value, -1)
      },
      {
        label: t('workbench.layout.increase', { label: stat.label }),
        icon: stat.increaseIcon,
        onSelect: () => updateLayoutValue(stat.setter, stat.value, 1)
      }
    ]
  })),
  {
    label: t('workbench.layout.reset'),
    icon: 'i-lucide-sparkles',
    onSelect: layout.resetLayout
  },
  {
    label: t('workbench.layout.save'),
    icon: 'i-lucide-save',
    onSelect: () => layout.saveEditing()
  },
  {
    label: t('workbench.layout.cancel'),
    icon: 'i-lucide-rotate-ccw',
    onSelect: layout.cancelEditing
  }
])

const actorScope = auth.session?.subject ?? 'anonymous'

await callOnce(`workbench-layout:${actorScope}`, () => layout.loadLayout(), { mode: 'navigation' })

function updateLayoutValue(setter: (value: number) => void, value: number, delta: number) {
  setter(value + delta)
}

onUnmounted(() => {
  if (layout.editing) {
    layout.cancelEditing()
  }
})

useSeoMeta({
  title: () => t('workbench.title'),
  description: () => t('workbench.description'),
  ogTitle: () => t('workbench.title'),
  ogDescription: () => t('workbench.description')
})
</script>

<template>
  <div class="contents">
    <ClientOnly>
      <Teleport to="#workbench-topbar-actions">
        <div v-if="layout.editing" class="workbench-edit-commandbar hidden min-w-0 items-center gap-2 border border-white/62 bg-white/54 p-1 shadow-sm shadow-slate-900/6 backdrop-blur-xl hdx-radius-popover dark:border-white/14 dark:bg-white/8 dark:shadow-black/24 lg:flex">
          <div class="flex min-w-0 items-center gap-1">
            <div
              v-for="stat in layoutStats"
              :key="stat.label"
              class="flex items-center gap-1 border border-slate-900/9 bg-white/64 px-1.5 py-1 text-xs text-slate-700 hdx-radius-card dark:border-white/14 dark:bg-white/8 dark:text-white/72"
            >
              <span class="px-1 font-medium">{{ stat.label }}</span>
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                size="xs"
                :icon="stat.decreaseIcon"
                :aria-label="t('workbench.layout.decrease', { label: stat.label })"
                class="workbench-mini-button cursor-pointer"
                @click="updateLayoutValue(stat.setter, stat.value, -1)"
              />
              <span class="min-w-5 text-center font-semibold text-slate-950 dark:text-white">{{ stat.value }}</span>
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                size="xs"
                :icon="stat.increaseIcon"
                :aria-label="t('workbench.layout.increase', { label: stat.label })"
                class="workbench-mini-button cursor-pointer"
                @click="updateLayoutValue(stat.setter, stat.value, 1)"
              />
            </div>
          </div>
          <UTooltip :text="t('workbench.layout.reset')">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              icon="i-lucide-sparkles"
              :aria-label="t('workbench.layout.reset')"
              class="hdx-toolbar-button cursor-pointer"
              @click="layout.resetLayout()"
            />
          </UTooltip>
          <UTooltip :text="t('workbench.layout.save')">
            <UButton
              type="button"
              color="primary"
              variant="solid"
              icon="i-lucide-save"
              :aria-label="t('workbench.layout.save')"
              :loading="layoutSaving"
              class="hdx-toolbar-button cursor-pointer"
              @click="layout.saveEditing()"
            />
          </UTooltip>
          <UTooltip :text="t('workbench.layout.cancel')">
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              icon="i-lucide-rotate-ccw"
              :aria-label="t('workbench.layout.cancel')"
              class="hdx-toolbar-button cursor-pointer"
              @click="layout.cancelEditing()"
            />
          </UTooltip>
        </div>

        <UButton
          v-else
          type="button"
          color="primary"
          variant="soft"
          icon="i-lucide-layout-grid"
          class="workbench-edit-button hidden cursor-pointer sm:inline-flex"
          @click="layout.startEditing()"
        >
          {{ t('workbench.layout.edit') }}
        </UButton>

        <UDropdownMenu
          v-if="layout.editing"
          :items="layoutMenuItems"
          :content="{ align: 'end' }"
          :ui="{ content: 'hdx-floating-menu hdx-radius-popover' }"
        >
          <UButton
            type="button"
            color="primary"
            variant="soft"
            icon="i-lucide-sliders-horizontal"
            :aria-label="t('workbench.layout.edit')"
            class="hdx-toolbar-button cursor-pointer lg:hidden"
          />
        </UDropdownMenu>

        <UTooltip v-else :text="t('workbench.layout.edit')">
          <UButton
            type="button"
            color="primary"
            variant="soft"
            icon="i-lucide-layout-grid"
            :aria-label="t('workbench.layout.edit')"
            class="hdx-toolbar-button cursor-pointer sm:hidden"
            @click="layout.startEditing()"
          />
        </UTooltip>
      </Teleport>
    </ClientOnly>

    <section class="grid h-full min-h-0 gap-3 overflow-hidden" :class="contentRowsClass">
      <div v-if="activeErrorKeys.length > 0" class="grid gap-2 border border-amber-300/45 bg-amber-50/72 p-3 text-sm text-amber-900 shadow-sm shadow-amber-950/8 backdrop-blur-xl hdx-radius-card dark:border-amber-200/20 dark:bg-amber-300/10 dark:text-amber-100">
        <div v-for="activeErrorKey in activeErrorKeys" :key="activeErrorKey" class="flex items-start gap-2">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0" />
          <span>{{ t('workbench.unavailable') }} {{ t(activeErrorKey) }}</span>
        </div>
      </div>

      <ToolboxGrid
        :highlighted-widget-key="highlightedWidgetKey"
      />
    </section>
  </div>
</template>
