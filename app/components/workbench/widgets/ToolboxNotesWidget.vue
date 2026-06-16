<script setup lang="ts">
const { t } = useI18n()

const noteItems = computed(() => [
  t('workbench.notes.first'),
  t('workbench.notes.second'),
  t('workbench.notes.third')
])
</script>

<template>
  <div class="grid h-full content-between gap-4">
    <div class="grid gap-2">
      <div
        v-for="note in noteItems"
        :key="note"
        class="rounded-[1.1rem] border border-white/55 bg-white/50 px-3 py-2.5 text-sm text-slate-700 shadow-sm shadow-slate-900/5 backdrop-blur-xl dark:border-white/12 dark:bg-white/9 dark:text-white/76 dark:shadow-black/20"
      >
        {{ note }}
      </div>
    </div>

    <button
      type="button"
      class="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-rose-200/70 bg-white/55 px-3 text-sm font-semibold text-rose-700 shadow-sm shadow-rose-950/5 transition-colors duration-200 hover:bg-white/78 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400 dark:border-rose-200/20 dark:bg-white/10 dark:text-rose-100 dark:hover:bg-white/16"
    >
      <UIcon name="lucide:pen-line" class="size-4" />
      {{ t('workbench.notes.action') }}
    </button>
  </div>
</template>
