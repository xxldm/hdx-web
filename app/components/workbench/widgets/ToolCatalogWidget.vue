<script setup lang="ts">
import type { ToolRecord } from '~/types/hdx-api'

const props = defineProps<{
  tools?: ToolRecord[]
  loading?: boolean
}>()

const { t } = useI18n()
const visibleTools = computed(() => (props.tools ?? []).slice(0, 5))
</script>

<template>
  <div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
    <div class="flex items-center justify-between gap-3">
      <span class="text-sm font-medium text-slate-600 dark:text-white/70">
        {{ t('workbench.enabledToolsCount', { count: props.tools?.filter(tool => tool.enabled).length ?? 0 }) }}
      </span>
      <UBadge color="neutral" variant="soft">
        {{ props.tools?.length ?? 0 }}
      </UBadge>
    </div>

    <div v-if="props.loading" class="grid content-start gap-2">
      <USkeleton v-for="item in 3" :key="item" class="h-12 rounded-2xl" />
    </div>

    <ul v-else-if="visibleTools.length" class="grid min-h-0 content-start gap-2 overflow-hidden">
      <li
        v-for="tool in visibleTools"
        :key="tool.id"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[1.1rem] border border-white/55 bg-white/54 px-3 py-2.5 shadow-sm shadow-slate-900/5 backdrop-blur-xl dark:border-white/12 dark:bg-white/9 dark:shadow-black/20"
      >
        <span class="min-w-0">
          <span class="block truncate text-sm font-semibold text-slate-900 dark:text-white">{{ tool.displayName }}</span>
          <span class="block truncate text-xs text-slate-500 dark:text-white/55">{{ tool.description || tool.toolKey }}</span>
        </span>
        <UBadge :color="tool.enabled ? 'success' : 'neutral'" variant="soft" size="sm">
          {{ tool.enabled ? t('workbench.toolEnabled') : t('workbench.toolDisabled') }}
        </UBadge>
      </li>
    </ul>

    <div v-else class="grid place-items-center rounded-[1.25rem] border border-dashed border-slate-300/80 bg-white/38 p-5 text-center dark:border-white/20 dark:bg-white/6">
      <div class="grid justify-items-center gap-2">
        <UIcon name="lucide:folder-plus" class="size-7 text-slate-400 dark:text-white/45" />
        <p class="max-w-56 text-sm text-slate-600 dark:text-white/64">
          {{ t('workbench.emptyTools') }}
        </p>
      </div>
    </div>
  </div>
</template>
