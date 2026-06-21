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
  icon: 'i-lucide-languages',
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
  onSelect?: () => void | Promise<void>
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
    onSelect: layout.saveEditing
  },
  {
    label: t('workbench.layout.cancel'),
    icon: 'i-lucide-rotate-ccw',
    onSelect: layout.cancelEditing
  }
])
const accountMenuItems = computed<WorkbenchMenuItem[]>(() => [
  {
    label: t('workbench.account.settings'),
    icon: 'i-lucide-settings',
    disabled: true
  },
  ...(authenticated.value && !isLocalAdmin.value
    ? [
        {
          label: t('auth.logoutAction'),
          icon: 'i-lucide-log-out',
          disabled: auth.loading,
          onSelect: logout
        }
      ]
    : [])
])
const accountMenuId = 'workbench-account-menu'
const accountAvatarText = computed(() => Array.from(displayName.value.trim()).slice(0, 2).join('').toUpperCase() || 'HD')
const contentRowsClass = computed(() => errorKey.value ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)]')

await callOnce('workbench-overview', () => workbench.loadOverview())

async function logout() {
  if (isLocalAdmin.value) {
    return
  }

  await auth.logout()
  await navigateTo('/login')
}

async function handleAccountMenuSelect(item: WorkbenchMenuItem, close?: () => void) {
  await item.onSelect?.()
  close?.()
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
  <main class="hdx-app-scene hdx-app-scene-workbench workbench-shell relative h-dvh overflow-hidden text-slate-950 transition-colors duration-300 dark:text-white">
    <div class="hdx-app-backdrop absolute inset-0" />
    <div class="hdx-app-liquid-field absolute inset-0" />
    <div class="hdx-app-grid-lines absolute inset-0" />

    <section class="relative z-10 grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-3 px-3 py-3 sm:px-4">
      <header class="workbench-topbar hdx-radius-panel border border-white/62 bg-white/58 px-3 shadow-xl shadow-cyan-950/7 backdrop-blur-2xl dark:border-white/14 dark:bg-white/8 dark:shadow-black/28">
        <div class="flex h-16 min-w-0 items-center gap-2">
          <UTooltip :text="t('workbench.menu')">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              icon="i-lucide-menu"
              :aria-label="t('workbench.menu')"
              class="hdx-toolbar-button shrink-0 cursor-pointer"
            />
          </UTooltip>

          <div class="flex min-w-0 items-center gap-3">
            <div class="grid size-11 shrink-0 place-items-center overflow-hidden border border-white/70 bg-white/65 p-1.5 shadow-sm shadow-slate-900/6 hdx-radius-card dark:border-white/18 dark:bg-white/10">
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

            <UTooltip :text="t('actions.language')">
              <UDropdownMenu
                v-model:open="localeMenuOpen"
                :items="localeMenuItems"
                :content="{ align: 'end' }"
                :ui="{ content: 'hdx-floating-menu hdx-radius-popover' }"
              >
                <UButton
                  type="button"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-languages"
                  :aria-label="t('actions.language')"
                  class="hdx-toolbar-button cursor-pointer"
                />
                <template #item-trailing="{ item }">
                  <UIcon v-if="item.selected" name="i-lucide-check" class="size-4 text-primary" />
                </template>
              </UDropdownMenu>
            </UTooltip>

            <ThemeSettingsPopover button-class="hdx-toolbar-button cursor-pointer" />

            <UPopover
              mode="hover"
              :open-delay="0"
              :close-delay="180"
              :content="{ align: 'end' }"
              :ui="{ content: 'hdx-floating-menu workbench-account-menu hdx-radius-popover' }"
            >
              <template #default="{ open }">
                <UButton
                  type="button"
                  color="neutral"
                  variant="ghost"
                  class="workbench-avatar-button workbench-account-trigger cursor-pointer"
                  :aria-label="t('workbench.account.menu')"
                  aria-haspopup="menu"
                  :aria-expanded="open ? 'true' : 'false'"
                  :aria-controls="accountMenuId"
                >
                  <UAvatar
                    :alt="displayName"
                    :text="accountAvatarText"
                    size="sm"
                    class="workbench-account-avatar"
                  />
                </UButton>
              </template>

              <template #content="{ close }">
                <div :id="accountMenuId" role="menu" :aria-label="t('workbench.account.menu')" class="grid min-w-44 gap-1 p-1.5">
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
                    role="menuitem"
                    class="workbench-account-menu-item cursor-pointer justify-start hdx-radius-card"
                    @click="handleAccountMenuSelect(item, close)"
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
        <div v-if="errorKey" class="border border-amber-300/45 bg-amber-50/72 p-3 text-sm text-amber-900 shadow-sm shadow-amber-950/8 backdrop-blur-xl hdx-radius-card dark:border-amber-200/20 dark:bg-amber-300/10 dark:text-amber-100">
          <div class="flex items-start gap-2">
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0" />
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
.workbench-subtitle {
  color: color-mix(in srgb, var(--hdx-theme-primary) 78%, #155e75);
}

.dark .workbench-subtitle {
  color: color-mix(in srgb, var(--hdx-theme-primary) 56%, #cffafe);
}

.workbench-edit-button {
  min-height: 2.25rem;
  align-items: center;
  gap: 0.45rem;
  border-radius: var(--hdx-radius-card);
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
  display: inline-flex;
  width: 2.25rem;
  min-width: 2.25rem;
  height: 2.25rem;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.66);
  border-radius: var(--hdx-radius-card);
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

.workbench-account-avatar {
  color: inherit;
  border-radius: var(--hdx-radius-control);
  background: transparent;
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
</style>
