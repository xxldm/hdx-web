<script setup lang="ts">
import { storeToRefs } from 'pinia'
import hdxIcon from '~/assets/brand/hdx-icon.png'
import ToolboxGrid from '~/components/workbench/ToolboxGrid.vue'
import { workbenchWidgetDefinitions } from '~/utils/workbench-widgets'

const { t, locale } = useI18n()
const route = useRoute()
const workbench = useWorkbenchStore()
const layout = useWorkbenchLayoutStore()
const auth = useAuthStore()
const colorMode = useColorMode()
const { runtime, tools, loading, errorKey } = storeToRefs(workbench)
const { authenticated, displayName, isLocalAdmin } = storeToRefs(auth)
const { setPreferredLocale } = useLocalePreference()

const localeItems = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
]
const localeMenuOpen = ref(false)
const themeMenuOpen = ref(false)
const localeMenuItems = computed(() => localeItems.map(item => ({
  label: item.label,
  icon: 'lucide:languages',
  selected: locale.value === item.value,
  onSelect: () => {
    void setPreferredLocale(item.value)
    localeMenuOpen.value = false
  }
})))
const themeMenuItems = computed(() => [
  {
    label: t('actions.themeSystem'),
    icon: 'lucide:monitor',
    selected: colorMode.preference === 'system',
    onSelect: () => {
      colorMode.preference = 'system'
      themeMenuOpen.value = false
    }
  },
  {
    label: t('actions.themeLight'),
    icon: 'lucide:sun',
    selected: colorMode.preference === 'light',
    onSelect: () => {
      colorMode.preference = 'light'
      themeMenuOpen.value = false
    }
  },
  {
    label: t('actions.themeDark'),
    icon: 'lucide:moon',
    selected: colorMode.preference === 'dark',
    onSelect: () => {
      colorMode.preference = 'dark'
      themeMenuOpen.value = false
    }
  }
])
const currentPath = computed(() => route.fullPath)
const layoutStats = computed(() => [
  {
    label: t('workbench.layout.columns'),
    value: layout.columns,
    setter: layout.setColumns,
    decreaseIcon: 'lucide:minus',
    increaseIcon: 'lucide:plus'
  },
  {
    label: t('workbench.layout.rows'),
    value: layout.rows,
    setter: layout.setRows,
    decreaseIcon: 'lucide:minus',
    increaseIcon: 'lucide:plus'
  },
  {
    label: t('workbench.layout.gap'),
    value: layout.gap,
    setter: layout.setGap,
    decreaseIcon: 'lucide:minus',
    increaseIcon: 'lucide:plus'
  }
])

await callOnce('workbench-overview', () => workbench.loadOverview())

async function logout() {
  if (isLocalAdmin.value) {
    return
  }

  await auth.logout()
  await navigateTo('/login')
}

function updateLayoutValue(setter: (value: number) => void, value: number, delta: number) {
  setter(value + delta)
}

useSeoMeta({
  title: () => t('workbench.title'),
  description: () => t('workbench.description'),
  ogTitle: () => t('workbench.title'),
  ogDescription: () => t('workbench.description')
})
</script>

<template>
  <main class="workbench-shell relative min-h-screen overflow-x-hidden bg-[#f7fdff] text-slate-950 transition-colors duration-300 dark:bg-[#101014] dark:text-white">
    <div class="workbench-backdrop absolute inset-0" />
    <div class="workbench-liquid-field absolute inset-0" />
    <div class="workbench-grid-lines absolute inset-0" />

    <section class="relative z-10 mx-auto grid min-h-screen w-full max-w-[1500px] grid-rows-[auto_minmax(0,1fr)] gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <header class="workbench-topbar rounded-lg border border-white/62 bg-white/58 px-3 py-2.5 shadow-xl shadow-cyan-950/7 backdrop-blur-2xl dark:border-white/14 dark:bg-white/8 dark:shadow-black/28">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex min-w-0 items-center gap-3">
            <div class="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/70 bg-white/65 p-1.5 shadow-sm shadow-slate-900/6 dark:border-white/18 dark:bg-white/10">
              <img :src="hdxIcon" :alt="t('app.iconAlt')" class="size-full rounded-full object-contain">
            </div>
            <div class="min-w-0">
              <p class="truncate text-xs font-medium text-cyan-700/90 dark:text-cyan-100/72">
                {{ currentPath }}
              </p>
              <h1 class="truncate text-xl font-semibold tracking-normal text-slate-950 dark:text-white">
                {{ t('workbench.title') }}
              </h1>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <UBadge color="neutral" variant="soft" class="min-h-9 px-3">
              <span class="inline-flex min-w-0 items-center gap-2">
                <UIcon :name="isLocalAdmin ? 'lucide:monitor' : 'lucide:user-round'" class="size-4 shrink-0" />
                <span class="max-w-32 truncate">{{ displayName }}</span>
              </span>
            </UBadge>

            <UTooltip :text="t('actions.language')">
              <UDropdownMenu
                v-model:open="localeMenuOpen"
                :items="localeMenuItems"
                :content="{ align: 'end' }"
                :ui="{ content: 'workbench-floating-menu rounded-[1.25rem]' }"
              >
                <UButton
                  type="button"
                  color="neutral"
                  variant="ghost"
                  icon="lucide:languages"
                  :aria-label="t('actions.language')"
                  class="workbench-tool-button cursor-pointer"
                />
                <template #item-trailing="{ item }">
                  <UIcon v-if="item.selected" name="lucide:check" class="size-4 text-cyan-700 dark:text-cyan-100" />
                </template>
              </UDropdownMenu>
            </UTooltip>

            <UTooltip :text="t('actions.theme')">
              <UDropdownMenu
                v-model:open="themeMenuOpen"
                :items="themeMenuItems"
                :content="{ align: 'end' }"
                :ui="{ content: 'workbench-floating-menu rounded-[1.25rem]' }"
              >
                <UButton
                  type="button"
                  color="neutral"
                  variant="ghost"
                  icon="lucide:palette"
                  :aria-label="t('actions.theme')"
                  class="workbench-tool-button cursor-pointer"
                />
                <template #item-trailing="{ item }">
                  <UIcon v-if="item.selected" name="lucide:check" class="size-4 text-cyan-700 dark:text-cyan-100" />
                </template>
              </UDropdownMenu>
            </UTooltip>

            <UTooltip :text="t('actions.refresh')">
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                icon="lucide:refresh-cw"
                :loading="loading"
                :aria-label="t('actions.refresh')"
                class="workbench-tool-button cursor-pointer"
                @click="workbench.loadOverview"
              />
            </UTooltip>

            <UButton
              v-if="authenticated && !isLocalAdmin"
              color="neutral"
              variant="ghost"
              leading-icon="lucide:log-out"
              :loading="auth.loading"
              class="cursor-pointer"
              @click="logout"
            >
              {{ t('auth.logoutAction') }}
            </UButton>
          </div>
        </div>
      </header>

      <div class="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section class="grid min-h-0 content-start gap-4">
          <div class="grid gap-3 rounded-lg border border-white/62 bg-white/48 p-4 shadow-xl shadow-cyan-950/6 backdrop-blur-2xl dark:border-white/14 dark:bg-white/7 dark:shadow-black/24">
            <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <div class="min-w-0">
                <p class="text-sm font-medium text-cyan-700/90 dark:text-cyan-100/72">
                  {{ t('app.subtitle') }}
                </p>
                <h2 class="mt-1 text-3xl font-semibold tracking-normal text-slate-950 dark:text-white sm:text-4xl">
                  {{ t('workbench.heroTitle') }}
                </h2>
                <p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-white/68">
                  {{ t('workbench.description') }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <template v-if="layout.editing">
                  <UButton
                    type="button"
                    color="primary"
                    variant="solid"
                    leading-icon="lucide:save"
                    class="cursor-pointer"
                    @click="layout.saveEditing"
                  >
                    {{ t('workbench.layout.save') }}
                  </UButton>
                  <UButton
                    type="button"
                    color="neutral"
                    variant="soft"
                    leading-icon="lucide:rotate-ccw"
                    class="cursor-pointer"
                    @click="layout.cancelEditing"
                  >
                    {{ t('workbench.layout.cancel') }}
                  </UButton>
                </template>
                <UButton
                  v-else
                  type="button"
                  color="primary"
                  variant="soft"
                  leading-icon="lucide:layout-grid"
                  class="cursor-pointer"
                  @click="layout.startEditing"
                >
                  {{ t('workbench.layout.edit') }}
                </UButton>
              </div>
            </div>

            <div v-if="errorKey" class="rounded-lg border border-amber-300/45 bg-amber-50/72 p-3 text-sm text-amber-900 dark:border-amber-200/20 dark:bg-amber-300/10 dark:text-amber-100">
              <div class="flex items-start gap-2">
                <UIcon name="lucide:triangle-alert" class="mt-0.5 size-4 shrink-0" />
                <span>{{ t('workbench.unavailable') }} {{ t(errorKey) }}</span>
              </div>
            </div>

            <div v-if="layout.editing" class="grid gap-3 rounded-lg border border-slate-900/10 bg-white/54 p-3 shadow-sm shadow-slate-900/5 backdrop-blur-xl dark:border-white/14 dark:bg-white/8 dark:shadow-black/20">
              <div class="flex flex-wrap items-center gap-2">
                <div
                  v-for="stat in layoutStats"
                  :key="stat.label"
                  class="flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-2 py-1 text-sm text-slate-700 dark:border-white/14 dark:bg-white/8 dark:text-white/72"
                >
                  <span class="min-w-8 font-medium">{{ stat.label }}</span>
                  <UButton
                    type="button"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :icon="stat.decreaseIcon"
                    :aria-label="t('workbench.layout.decrease', { label: stat.label })"
                    class="cursor-pointer"
                    @click="updateLayoutValue(stat.setter, stat.value, -1)"
                  />
                  <span class="min-w-7 text-center font-semibold text-slate-950 dark:text-white">{{ stat.value }}</span>
                  <UButton
                    type="button"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :icon="stat.increaseIcon"
                    :aria-label="t('workbench.layout.increase', { label: stat.label })"
                    class="cursor-pointer"
                    @click="updateLayoutValue(stat.setter, stat.value, 1)"
                  />
                </div>
                <UButton
                  type="button"
                  color="neutral"
                  variant="ghost"
                  leading-icon="lucide:sparkles"
                  class="cursor-pointer"
                  @click="layout.resetLayout"
                >
                  {{ t('workbench.layout.reset') }}
                </UButton>
              </div>
            </div>
          </div>

          <ToolboxGrid
            :tools="tools"
            :runtime="runtime"
            :loading="loading"
          />
        </section>

        <aside class="grid content-start gap-3">
          <section class="rounded-lg border border-white/62 bg-white/50 p-4 shadow-xl shadow-cyan-950/6 backdrop-blur-2xl dark:border-white/14 dark:bg-white/7 dark:shadow-black/24">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-base font-semibold tracking-normal text-slate-950 dark:text-white">
                {{ t('workbench.layout.overview') }}
              </h2>
              <UBadge color="primary" variant="soft">
                {{ layout.widgets.length }}
              </UBadge>
            </div>
            <dl class="mt-4 grid gap-3 text-sm">
              <div class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                <dt class="text-slate-500 dark:text-white/55">{{ t('workbench.layout.grid') }}</dt>
                <dd class="font-semibold text-slate-900 dark:text-white">{{ layout.columns }} x {{ layout.rows }}</dd>
              </div>
              <div class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                <dt class="text-slate-500 dark:text-white/55">{{ t('workbench.layout.occupied') }}</dt>
                <dd class="font-semibold text-slate-900 dark:text-white">{{ layout.occupiedCells }} / {{ layout.totalCells }}</dd>
              </div>
              <div class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                <dt class="text-slate-500 dark:text-white/55">{{ t('workbench.layout.gap') }}</dt>
                <dd class="font-semibold text-slate-900 dark:text-white">{{ layout.gap }}px</dd>
              </div>
            </dl>
          </section>

          <section class="rounded-lg border border-white/62 bg-white/50 p-4 shadow-xl shadow-cyan-950/6 backdrop-blur-2xl dark:border-white/14 dark:bg-white/7 dark:shadow-black/24">
            <h2 class="text-base font-semibold tracking-normal text-slate-950 dark:text-white">
              {{ t('workbench.widgetLibrary') }}
            </h2>
            <ul class="mt-4 grid gap-2">
              <li
                v-for="definition in workbenchWidgetDefinitions"
                :key="definition.key"
                class="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-3 rounded-lg border border-white/50 bg-white/42 px-3 py-2.5 dark:border-white/10 dark:bg-white/6"
              >
                <span class="grid size-9 place-items-center rounded-lg bg-gradient-to-br" :class="definition.accentClass">
                  <UIcon :name="definition.icon" class="size-4 text-slate-900 dark:text-white" />
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-semibold text-slate-900 dark:text-white">{{ t(definition.titleKey) }}</span>
                  <span class="block truncate text-xs text-slate-500 dark:text-white/55">{{ t(definition.descriptionKey) }}</span>
                </span>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </section>
  </main>
</template>

<style>
.workbench-backdrop {
  background:
    radial-gradient(ellipse at 12% 12%, rgba(125, 211, 252, 0.24), transparent 48%),
    radial-gradient(ellipse at 82% 18%, rgba(251, 113, 133, 0.16), transparent 42%),
    radial-gradient(ellipse at 54% 88%, rgba(45, 212, 191, 0.18), transparent 48%),
    linear-gradient(135deg, #fbfeff 0%, #e8fbff 42%, #f8efff 72%, #fff8ed 100%);
}

.dark .workbench-backdrop {
  background:
    radial-gradient(ellipse at 14% 18%, rgba(34, 211, 238, 0.16), transparent 46%),
    radial-gradient(ellipse at 88% 14%, rgba(244, 114, 182, 0.12), transparent 44%),
    radial-gradient(ellipse at 46% 92%, rgba(45, 212, 191, 0.1), transparent 48%),
    linear-gradient(145deg, #101014 0%, #15141a 48%, #111015 100%);
}

.workbench-liquid-field {
  pointer-events: none;
  background:
    linear-gradient(105deg, transparent 0 16%, rgba(14, 165, 233, 0.16) 30%, transparent 48%),
    linear-gradient(35deg, transparent 0 35%, rgba(251, 113, 133, 0.11) 48%, transparent 66%),
    linear-gradient(155deg, rgba(255, 255, 255, 0.5), transparent 42%, rgba(45, 212, 191, 0.14));
  filter: blur(22px);
  opacity: 0.78;
  animation: workbench-liquid-drift 18s ease-in-out infinite alternate;
}

.dark .workbench-liquid-field {
  background:
    radial-gradient(ellipse at 22% 72%, rgba(45, 212, 191, 0.15), transparent 52%),
    radial-gradient(ellipse at 82% 26%, rgba(251, 113, 133, 0.1), transparent 58%),
    linear-gradient(116deg, rgba(255, 255, 255, 0.05) 0%, transparent 46%, rgba(167, 139, 250, 0.06) 100%);
  opacity: 0.64;
}

.workbench-grid-lines {
  pointer-events: none;
  background-image:
    linear-gradient(rgba(15, 23, 42, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 23, 42, 0.04) 1px, transparent 1px);
  background-size: 52px 52px;
  mask-image: radial-gradient(ellipse at 48% 42%, black, transparent 78%);
  opacity: 0.36;
}

.dark .workbench-grid-lines {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  mask-image: radial-gradient(ellipse at 38% 48%, black, transparent 78%);
  opacity: 0.24;
}

.workbench-tool-button {
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  min-width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border-radius: 9999px;
  border-color: transparent;
  background: transparent;
  color: rgba(15, 23, 42, 0.72);
  gap: 0;
  line-height: 1;
}

.workbench-tool-button:hover {
  background: rgba(14, 165, 233, 0.12);
}

.dark .workbench-tool-button {
  color: rgba(255, 255, 255, 0.86);
}

.dark .workbench-tool-button:hover {
  background: rgba(255, 255, 255, 0.14);
}

.workbench-floating-menu {
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 1.25rem !important;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(18px);
}

.dark .workbench-floating-menu {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(15, 23, 42, 0.88);
  box-shadow: 0 20px 50px rgba(2, 6, 23, 0.42);
}

@keyframes workbench-liquid-drift {
  from {
    transform: translate3d(-1rem, 0.5rem, 0) rotate(0deg);
  }

  to {
    transform: translate3d(1rem, -1rem, 0) rotate(5deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .workbench-liquid-field {
    animation: none;
  }
}
</style>
