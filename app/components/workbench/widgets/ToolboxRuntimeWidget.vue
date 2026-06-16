<script setup lang="ts">
import type { RuntimeInfo } from '~/types/hdx-api'

const props = defineProps<{
  runtime?: RuntimeInfo | null
}>()

const { t } = useI18n()

const runtimeRows = computed(() => [
  {
    label: t('workbench.application'),
    value: props.runtime?.application ?? 'HDX'
  },
  {
    label: t('workbench.topology'),
    value: props.runtime?.topology ?? 'web-shell'
  },
  {
    label: t('workbench.javaVersion'),
    value: props.runtime?.javaVersion ?? '-'
  }
])
</script>

<template>
  <dl class="grid h-full content-center gap-2">
    <div
      v-for="row in runtimeRows"
      :key="row.label"
      class="grid grid-cols-[4.8rem_minmax(0,1fr)] gap-2 text-sm"
    >
      <dt class="text-slate-500 dark:text-white/55">
        {{ row.label }}
      </dt>
      <dd class="truncate font-semibold text-slate-900 dark:text-white">
        {{ row.value }}
      </dd>
    </div>
  </dl>
</template>
