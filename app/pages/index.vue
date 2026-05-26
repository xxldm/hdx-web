<script setup lang="ts">
import { storeToRefs } from 'pinia'

const { t, locale } = useI18n()
const route = useRoute()
const workbench = useWorkbenchStore()
const { runtime, tools, enabledTools, loading, errorKey } = storeToRefs(workbench)
const { setPreferredLocale } = useLocalePreference()

const localeItems = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
]

const statusCards = computed(() => [
  {
    label: t('workbench.application'),
    value: runtime.value?.application ?? 'HDX',
    icon: 'lucide:blocks',
    color: 'primary' as const
  },
  {
    label: t('workbench.topology'),
    value: runtime.value?.topology ?? 'web-shell',
    icon: 'lucide:network',
    color: 'success' as const
  },
  {
    label: t('workbench.javaVersion'),
    value: runtime.value?.javaVersion ?? '-',
    icon: 'lucide:server',
    color: 'warning' as const
  },
  {
    label: t('workbench.nativeImage'),
    value: runtime.value ? (runtime.value.nativeImage ? 'true' : 'false') : '-',
    icon: 'lucide:cpu',
    color: 'secondary' as const
  }
])

const boundaryItems = computed(() => [
  {
    label: t('workbench.apiMode'),
    value: 'BFF',
    icon: 'lucide:shield-check'
  },
  {
    label: t('workbench.localeMode'),
    value: locale.value,
    icon: 'lucide:languages'
  },
  {
    label: t('workbench.themeMode'),
    value: t('workbench.themeManaged'),
    icon: 'lucide:monitor-cog'
  }
])

await callOnce('workbench-overview', () => workbench.loadOverview())

const currentPath = computed(() => route.fullPath)

useSeoMeta({
  title: () => t('workbench.title'),
  description: () => t('workbench.description'),
  ogTitle: () => t('workbench.title'),
  ogDescription: () => t('workbench.description')
})
</script>

<template>
  <main class="min-h-screen bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
    <header class="border-b border-neutral-200 bg-white/90 dark:border-neutral-800 dark:bg-neutral-950/90">
      <div class="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div class="flex min-w-0 items-center gap-3">
          <div class="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-600 text-white">
            <UIcon name="lucide:box" class="size-5" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {{ t('app.subtitle') }}
            </p>
            <h1 class="truncate text-xl font-semibold tracking-normal text-neutral-950 dark:text-white">
              {{ t('app.name') }}
            </h1>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <USelect
            :model-value="locale"
            :items="localeItems"
            value-key="value"
            :aria-label="t('actions.language')"
            class="w-36"
            @update:model-value="setPreferredLocale(String($event))"
          />
          <UColorModeSelect :aria-label="t('actions.theme')" class="w-36" />
          <UButton
            color="primary"
            variant="soft"
            leading-icon="lucide:refresh-cw"
            :loading="loading"
            class="cursor-pointer"
            @click="workbench.loadOverview"
          >
            {{ t('actions.refresh') }}
          </UButton>
        </div>
      </div>
    </header>

    <div class="mx-auto grid w-full max-w-[1400px] grid-cols-12 gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <section class="col-span-12 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
          <div>
            <p class="mb-2 text-sm font-medium text-primary-700 dark:text-primary-300">
              {{ currentPath }}
            </p>
            <h2 class="max-w-3xl text-3xl font-semibold tracking-normal text-neutral-950 dark:text-white sm:text-4xl">
              {{ t('workbench.title') }}
            </h2>
            <p class="mt-3 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-300">
              {{ t('workbench.description') }}
            </p>
          </div>

          <UAlert
            v-if="errorKey"
            color="warning"
            variant="soft"
            icon="lucide:triangle-alert"
            :title="t('workbench.unavailable')"
            :description="t(errorKey)"
          />
        </div>
      </section>

      <section class="col-span-12 grid gap-4 lg:col-span-8">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div
            v-for="card in statusCards"
            :key="card.label"
            class="rounded-lg border border-neutral-200 bg-white p-4 transition-colors duration-200 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {{ card.label }}
              </p>
              <UBadge :color="card.color" variant="soft" size="sm">
                <UIcon :name="card.icon" class="size-4" />
              </UBadge>
            </div>
            <p class="mt-3 truncate text-lg font-semibold text-neutral-950 dark:text-white">
              {{ card.value }}
            </p>
          </div>
        </div>

        <section class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div class="flex items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <div>
              <h3 class="text-base font-semibold text-neutral-950 dark:text-white">
                {{ t('workbench.tools') }}
              </h3>
              <p class="text-sm text-neutral-500 dark:text-neutral-400">
                {{ enabledTools.length }} {{ t('workbench.enabledTools') }}
              </p>
            </div>
            <UBadge color="success" variant="subtle">
              {{ tools.length }}
            </UBadge>
          </div>

          <div v-if="loading" class="grid gap-3 p-4">
            <USkeleton v-for="item in 3" :key="item" class="h-12 w-full" />
          </div>

          <ul v-else-if="tools.length" class="divide-y divide-neutral-200 dark:divide-neutral-800">
            <li v-for="tool in tools" :key="tool.id" class="flex items-center justify-between gap-4 px-4 py-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-neutral-950 dark:text-white">
                  {{ tool.displayName }}
                </p>
                <p class="truncate text-sm text-neutral-500 dark:text-neutral-400">
                  {{ tool.description || tool.toolKey }}
                </p>
              </div>
              <UBadge :color="tool.enabled ? 'success' : 'neutral'" variant="soft">
                {{ tool.enabled ? 'enabled' : 'disabled' }}
              </UBadge>
            </li>
          </ul>

          <div v-else class="grid place-items-center gap-3 px-4 py-12 text-center">
            <UIcon name="lucide:folder-open" class="size-8 text-neutral-400" />
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              {{ t('workbench.emptyTools') }}
            </p>
          </div>
        </section>
      </section>

      <aside class="col-span-12 grid content-start gap-4 lg:col-span-4">
        <section class="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <h3 class="text-base font-semibold text-neutral-950 dark:text-white">
            {{ t('workbench.runtime') }}
          </h3>
          <dl class="mt-4 grid gap-3 text-sm">
            <div
              v-for="card in statusCards"
              :key="`detail-${card.label}`"
              class="grid grid-cols-[7rem_minmax(0,1fr)] gap-3"
            >
              <dt class="text-neutral-500 dark:text-neutral-400">
                {{ card.label }}
              </dt>
              <dd class="truncate font-medium text-neutral-900 dark:text-neutral-100">
                {{ card.value }}
              </dd>
            </div>
          </dl>
        </section>

        <section class="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <ul class="grid gap-3">
            <li v-for="item in boundaryItems" :key="item.label" class="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3">
              <UIcon :name="item.icon" class="mt-0.5 size-5 shrink-0 text-primary-600 dark:text-primary-300" />
              <span class="min-w-0">
                <span class="block text-sm text-neutral-500 dark:text-neutral-400">{{ item.label }}</span>
                <span class="block truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ item.value }}</span>
              </span>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </main>
</template>
