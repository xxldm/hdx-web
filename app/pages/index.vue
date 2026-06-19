<script setup lang="ts">
import { storeToRefs } from 'pinia'
import hdxIcon from '~/assets/brand/hdx-icon.png'
import ThemeSettingsPopover from '~/components/theme/ThemeSettingsPopover.vue'
import ToolboxGrid from '~/components/workbench/ToolboxGrid.vue'

const { t, locale } = useI18n()
const workbench = useWorkbenchStore()
const layout = useWorkbenchLayoutStore()
const auth = useAuthStore()
const { runtime, tools, loading, errorKey } = storeToRefs(workbench)
const { authenticated, displayName, isLocalAdmin } = storeToRefs(auth)
const { setPreferredLocale } = useLocalePreference()

const localeItems = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
]
const localeMenuOpen = ref(false)
const localeMenuItems = computed(() => localeItems.map(item => ({
  label: item.label,
  icon: 'lucide:languages',
  selected: locale.value === item.value,
  onSelect: () => {
    void setPreferredLocale(item.value)
    localeMenuOpen.value = false
  }
})))
interface WorkbenchMenuItem {
  label: string
  icon: string
  disabled?: boolean
  onSelect?: () => void
  children?: WorkbenchMenuItem[]
}

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
const layoutMenuItems = computed<WorkbenchMenuItem[]>(() => [
  ...layoutStats.value.map(stat => ({
    label: `${stat.label}: ${stat.value}`,
    icon: 'lucide:sliders-horizontal',
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
    icon: 'lucide:sparkles',
    onSelect: layout.resetLayout
  },
  {
    label: t('workbench.layout.save'),
    icon: 'lucide:save',
    onSelect: layout.saveEditing
  },
  {
    label: t('workbench.layout.cancel'),
    icon: 'lucide:rotate-ccw',
    onSelect: layout.cancelEditing
  }
])
const accountMenuItems = computed<WorkbenchMenuItem[]>(() => [
  {
    label: t('workbench.account.settings'),
    icon: 'lucide:settings',
    disabled: true
  },
  ...(authenticated.value && !isLocalAdmin.value
    ? [
        {
          label: t('auth.logoutAction'),
          icon: 'lucide:log-out',
          disabled: auth.loading,
          onSelect: logout
        }
      ]
    : [])
])
const avatarLabel = computed(() => displayName.value.trim().slice(0, 1).toUpperCase() || 'H')
const contentRowsClass = computed(() => errorKey.value ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)]')

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
  <main class="workbench-shell relative h-dvh overflow-hidden text-slate-950 transition-colors duration-300 dark:text-white">
    <div class="workbench-backdrop absolute inset-0" />
    <div class="workbench-liquid-field absolute inset-0" />
    <div class="workbench-grid-lines absolute inset-0" />

    <section class="relative z-10 grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-3 px-3 py-3 sm:px-4">
      <header class="workbench-topbar rounded-lg border border-white/62 bg-white/58 px-3 shadow-xl shadow-cyan-950/7 backdrop-blur-2xl dark:border-white/14 dark:bg-white/8 dark:shadow-black/28">
        <div class="flex h-16 min-w-0 items-center gap-2">
          <UTooltip :text="t('workbench.menu')">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              icon="lucide:menu"
              :aria-label="t('workbench.menu')"
              class="workbench-tool-button shrink-0 cursor-pointer"
            />
          </UTooltip>

          <div class="flex min-w-0 items-center gap-3">
            <div class="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/70 bg-white/65 p-1.5 shadow-sm shadow-slate-900/6 dark:border-white/18 dark:bg-white/10">
              <img :src="hdxIcon" :alt="t('app.iconAlt')" width="394" height="394" class="size-full rounded-full object-contain">
            </div>
            <div class="min-w-0">
              <p class="workbench-subtitle truncate text-xs font-medium">
                {{ t('app.subtitle') }}
              </p>
              <h1 class="truncate text-xl font-semibold tracking-normal text-slate-950 dark:text-white">
                {{ t('workbench.title') }}
              </h1>
            </div>
          </div>

          <div class="ml-auto flex min-w-0 items-center justify-end gap-2">
            <div v-if="layout.editing" class="workbench-edit-commandbar hidden min-w-0 items-center gap-2 rounded-full border border-white/62 bg-white/54 p-1 shadow-sm shadow-slate-900/6 backdrop-blur-xl dark:border-white/14 dark:bg-white/8 dark:shadow-black/24 lg:flex">
              <div class="flex min-w-0 items-center gap-1">
                <div
                  v-for="stat in layoutStats"
                  :key="stat.label"
                  class="flex items-center gap-1 rounded-full border border-slate-900/9 bg-white/64 px-1.5 py-1 text-xs text-slate-700 dark:border-white/14 dark:bg-white/8 dark:text-white/72"
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
                  icon="lucide:sparkles"
                  :aria-label="t('workbench.layout.reset')"
                  class="workbench-tool-button cursor-pointer"
                  @click="layout.resetLayout()"
                />
              </UTooltip>
              <UTooltip :text="t('workbench.layout.save')">
                <UButton
                  type="button"
                  color="primary"
                  variant="solid"
                  icon="lucide:save"
                  :aria-label="t('workbench.layout.save')"
                  class="workbench-tool-button cursor-pointer"
                  @click="layout.saveEditing()"
                />
              </UTooltip>
              <UTooltip :text="t('workbench.layout.cancel')">
                <UButton
                  type="button"
                  color="neutral"
                  variant="soft"
                  icon="lucide:rotate-ccw"
                  :aria-label="t('workbench.layout.cancel')"
                  class="workbench-tool-button cursor-pointer"
                  @click="layout.cancelEditing()"
                />
              </UTooltip>
            </div>

            <UButton
              v-else
              type="button"
              color="primary"
              variant="soft"
              icon="lucide:layout-grid"
              class="workbench-edit-button hidden cursor-pointer sm:inline-flex"
              @click="layout.startEditing()"
            >
              {{ t('workbench.layout.edit') }}
            </UButton>

            <UDropdownMenu
              v-if="layout.editing"
              :items="layoutMenuItems"
              :content="{ align: 'end' }"
              :ui="{ content: 'workbench-floating-menu rounded-[1.25rem]' }"
            >
              <UButton
                type="button"
                color="primary"
                variant="soft"
                icon="lucide:sliders-horizontal"
                :aria-label="t('workbench.layout.edit')"
                class="workbench-tool-button cursor-pointer lg:hidden"
              />
            </UDropdownMenu>

            <UTooltip v-else :text="t('workbench.layout.edit')">
              <UButton
                type="button"
                color="primary"
                variant="soft"
                icon="lucide:layout-grid"
                :aria-label="t('workbench.layout.edit')"
                class="workbench-tool-button cursor-pointer sm:hidden"
                @click="layout.startEditing()"
              />
            </UTooltip>

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
                  <UIcon v-if="item.selected" name="lucide:check" class="size-4 text-primary" />
                </template>
              </UDropdownMenu>
            </UTooltip>

            <ThemeSettingsPopover button-class="workbench-tool-button cursor-pointer" />

            <UPopover
              mode="hover"
              :open-delay="0"
              :close-delay="180"
              :content="{ align: 'end' }"
              :ui="{ content: 'workbench-floating-menu workbench-account-menu rounded-[1.25rem]' }"
            >
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                class="workbench-avatar-button workbench-account-trigger cursor-pointer"
                :aria-label="t('workbench.account.menu')"
              >
                <UIcon v-if="isLocalAdmin" name="lucide:monitor" class="size-4" />
                <span v-else>{{ avatarLabel }}</span>
              </UButton>

              <template #content>
                <div class="grid min-w-44 gap-1 p-1.5">
                  <div class="border-b border-slate-900/8 px-2.5 py-2 dark:border-white/12">
                    <p class="text-xs text-slate-500 dark:text-white/55">
                      {{ t('workbench.account.current') }}
                    </p>
                    <p class="mt-0.5 max-w-48 truncate text-sm font-semibold text-slate-950 dark:text-white">
                      {{ displayName }}
                    </p>
                  </div>
                  <UButton
                    v-for="item in accountMenuItems"
                    :key="item.label"
                    type="button"
                    color="neutral"
                    variant="ghost"
                    :icon="item.icon"
                    :disabled="item.disabled"
                    class="workbench-account-menu-item cursor-pointer justify-start rounded-xl"
                    @click="item.onSelect?.()"
                  >
                    {{ item.label }}
                  </UButton>
                </div>
              </template>
            </UPopover>
          </div>
        </div>
      </header>

      <section class="grid h-full min-h-0 gap-3 overflow-hidden" :class="contentRowsClass">
        <div v-if="errorKey" class="rounded-lg border border-amber-300/45 bg-amber-50/72 p-3 text-sm text-amber-900 shadow-sm shadow-amber-950/8 backdrop-blur-xl dark:border-amber-200/20 dark:bg-amber-300/10 dark:text-amber-100">
          <div class="flex items-start gap-2">
            <UIcon name="lucide:triangle-alert" class="mt-0.5 size-4 shrink-0" />
            <span>{{ t('workbench.unavailable') }} {{ t(errorKey) }}</span>
          </div>
        </div>

        <ToolboxGrid
          :tools="tools"
          :runtime="runtime"
          :loading="loading"
        />
      </section>
    </section>
  </main>
</template>

<style>
.workbench-backdrop {
  background:
    radial-gradient(ellipse at 12% 12%, rgba(var(--hdx-theme-accent-rgb), 0.24), transparent 48%),
    radial-gradient(ellipse at 82% 18%, rgba(var(--hdx-theme-warm-rgb), 0.16), transparent 42%),
    radial-gradient(ellipse at 54% 88%, rgba(var(--hdx-theme-primary-rgb), 0.18), transparent 48%),
    linear-gradient(135deg, color-mix(in srgb, var(--hdx-theme-primary) 8%, #fbfeff) 0%, color-mix(in srgb, var(--hdx-theme-primary) 14%, #e8fbff) 42%, color-mix(in srgb, var(--hdx-theme-primary) 10%, #f8efff) 72%, #fff8ed 100%);
}

.dark .workbench-backdrop {
  background:
    radial-gradient(ellipse at 14% 18%, rgba(var(--hdx-theme-accent-rgb), 0.16), transparent 46%),
    radial-gradient(ellipse at 88% 14%, rgba(var(--hdx-theme-warm-rgb), 0.12), transparent 44%),
    radial-gradient(ellipse at 46% 92%, rgba(var(--hdx-theme-primary-rgb), 0.1), transparent 48%),
    linear-gradient(145deg, #101014 0%, color-mix(in srgb, var(--hdx-theme-primary) 10%, #15141a) 48%, #111015 100%);
}

.workbench-liquid-field {
  pointer-events: none;
  background:
    linear-gradient(105deg, transparent 0 16%, rgba(var(--hdx-theme-accent-rgb), 0.16) 30%, transparent 48%),
    linear-gradient(35deg, transparent 0 35%, rgba(var(--hdx-theme-warm-rgb), 0.11) 48%, transparent 66%),
    linear-gradient(155deg, rgba(255, 255, 255, 0.5), transparent 42%, rgba(var(--hdx-theme-primary-rgb), 0.14));
  filter: blur(22px);
  opacity: 0.78;
  animation: workbench-liquid-drift 18s ease-in-out infinite alternate;
}

.dark .workbench-liquid-field {
  background:
    radial-gradient(ellipse at 22% 72%, rgba(var(--hdx-theme-primary-rgb), 0.15), transparent 52%),
    radial-gradient(ellipse at 82% 26%, rgba(var(--hdx-theme-warm-rgb), 0.1), transparent 58%),
    linear-gradient(116deg, rgba(255, 255, 255, 0.05) 0%, transparent 46%, rgba(var(--hdx-theme-accent-rgb), 0.06) 100%);
  opacity: 0.64;
}

.workbench-grid-lines {
  pointer-events: none;
  background-image:
    linear-gradient(rgba(var(--hdx-theme-neutral-rgb), 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--hdx-theme-neutral-rgb), 0.04) 1px, transparent 1px);
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

.workbench-shell {
  background:
    var(--hdx-workbench-shell-bg, linear-gradient(135deg, #fbfeff 0%, #e8fbff 42%, #f8efff 72%, #fff8ed 100%));
}

.dark .workbench-shell {
  background:
    var(--hdx-workbench-shell-dark-bg, linear-gradient(145deg, #101014 0%, #15141a 48%, #111015 100%));
}

.workbench-subtitle {
  color: color-mix(in srgb, var(--hdx-theme-primary) 78%, #155e75);
}

.dark .workbench-subtitle {
  color: color-mix(in srgb, var(--hdx-theme-primary) 56%, #cffafe);
}

.workbench-tool-button {
  align-items: center;
  justify-content: center;
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

.workbench-edit-button {
  min-height: 2.25rem;
  align-items: center;
  gap: 0.45rem;
  border-radius: 9999px;
  background: rgba(var(--hdx-theme-primary-rgb), 0.12);
  padding: 0 0.9rem;
  color: color-mix(in srgb, var(--hdx-theme-primary) 80%, #0f172a);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1;
  transition:
    background-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}

.workbench-edit-button:hover {
  background: rgba(var(--hdx-theme-primary-rgb), 0.18);
  color: rgb(15, 23, 42);
  box-shadow: 0 8px 22px rgba(var(--hdx-theme-primary-rgb), 0.1);
}

.dark .workbench-edit-button {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(207, 250, 254, 0.92);
}

.dark .workbench-edit-button:hover {
  background: rgba(255, 255, 255, 0.16);
  color: white;
}

.workbench-avatar-button {
  display: inline-grid;
  width: 2.25rem;
  min-width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.66);
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.68);
  color: rgba(15, 23, 42, 0.78);
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(16px);
  transition:
    background-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}

.workbench-avatar-button:hover {
  background: rgba(var(--hdx-theme-primary-rgb), 0.12);
  color: rgb(15, 23, 42);
}

.dark .workbench-avatar-button {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.86);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);
}

.dark .workbench-avatar-button:hover {
  background: rgba(255, 255, 255, 0.14);
  color: white;
}

.workbench-tool-button:hover {
  background: rgba(var(--hdx-theme-primary-rgb), 0.12);
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
