<script setup lang="ts">
import type { ResolvedWorkbenchWidgetOrientation } from '~/utils/workbench-widget-meta'

defineProps<{
  orientation?: ResolvedWorkbenchWidgetOrientation
}>()

const { t } = useI18n()

const quickLinks = computed(() => [
  {
    label: t('workbench.quickLinks.newTool'),
    icon: 'lucide:plus',
    tone: 'text-cyan-700 dark:text-cyan-100'
  },
  {
    label: t('workbench.quickLinks.collectIdea'),
    icon: 'lucide:lightbulb',
    tone: 'text-amber-700 dark:text-amber-100'
  },
  {
    label: t('workbench.quickLinks.openFolder'),
    icon: 'lucide:folder-open',
    tone: 'text-indigo-700 dark:text-indigo-100'
  }
])
</script>

<template>
  <div class="grid h-full content-center gap-3">
    <div class="grid gap-2 sm:grid-cols-3">
      <UButton
        v-for="link in quickLinks"
        :key="link.label"
        type="button"
        color="neutral"
        variant="ghost"
        class="group grid min-h-24 cursor-pointer content-between rounded-[1.25rem] border border-white/60 bg-white/58 p-3 text-left shadow-sm shadow-slate-900/5 backdrop-blur-xl transition-colors duration-200 hover:border-cyan-300/70 hover:bg-white/76 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:border-white/15 dark:bg-white/10 dark:shadow-black/20 dark:hover:border-cyan-200/35 dark:hover:bg-white/16"
      >
        <UIcon :name="link.icon" :class="['size-5', link.tone]" />
        <span class="text-sm font-semibold text-slate-900 dark:text-white">
          {{ link.label }}
        </span>
      </UButton>
    </div>
  </div>
</template>
