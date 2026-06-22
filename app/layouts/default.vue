<script setup lang="ts">
import { storeToRefs } from 'pinia'
import hdxIcon from '~/assets/brand/hdx-icon.png'
import ThemeSettingsPopover from '~/components/theme/ThemeSettingsPopover.vue'
import WorkbenchMenuSlideover from '~/components/workbench/WorkbenchMenuSlideover.vue'
import WorkbenchPinnedNavigation from '~/components/workbench/WorkbenchPinnedNavigation.vue'
import type { WorkbenchNavigationItem } from '~/utils/workbench-navigation'
import { workbenchNavigationItems } from '~/utils/workbench-navigation'

const { t, locale } = useI18n()
const route = useRoute()
const layout = useWorkbenchLayoutStore()
const workbench = useWorkbenchStore()
const auth = useAuthStore()
const navigation = useWorkbenchNavigationStore()
const theme = useThemePreferenceStore()
const { authenticated, displayName, isLocalAdmin } = storeToRefs(auth)
const { pinnedItems } = storeToRefs(navigation)
const { setPreferredLocale } = useLocalePreference()
const { active: routeProgressActive, progress: routeProgress } = useRouteProgressState()
const { highlightWorkbenchWidget, stopWorkbenchWidgetHighlight } = useWorkbenchWidgetHighlight()

const localeItems = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
]
const menuOpen = ref(false)
const localeMenuOpen = ref(false)
const topbarElement = useTemplateRef<HTMLElement>('workbenchTopbar')
const topbarWidth = shallowRef(0)
const topbarHeight = shallowRef(0)
const topbarRadius = shallowRef(0)
let topbarResizeObserver: ResizeObserver | null = null
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
}

const accountMenuItems = computed<WorkbenchMenuItem[]>(() => [
  {
    label: t('workbench.account.settings'),
    icon: 'i-lucide-settings',
    onSelect: goToSettings
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
const routeProgressPath = computed(() => createRouteProgressHalfArcPaths({
  progress: routeProgress.value,
  width: topbarWidth.value,
  height: topbarHeight.value,
  radius: topbarRadius.value
}))

async function goToSettings() {
  await navigateTo('/settings')
}

async function logout() {
  if (isLocalAdmin.value) {
    return
  }

  try {
    await auth.logout()
  } finally {
    workbench.resetState()
    layout.resetState()
  }

  await navigateTo('/login')
}

async function handleAccountMenuSelect(item: WorkbenchMenuItem, close?: () => void) {
  await item.onSelect?.()
  close?.()
}

async function handleNavigationItemSelect(item: WorkbenchNavigationItem) {
  if (item.disabled) {
    return
  }

  const targetPath = item.to ?? (item.widgetKey ? '/' : null)

  if (targetPath && targetPath !== route.path) {
    await navigateTo(targetPath)
  }

  if (item.widgetKey) {
    highlightWorkbenchWidget(item.widgetKey)
  }
}

function parseCssPixelValue(value: string) {
  const match = value.match(/[\d.]+/)

  return match ? Number.parseFloat(match[0]) : 0
}

function updateTopbarMetrics() {
  const element = topbarElement.value

  if (!element) {
    return
  }

  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)

  topbarWidth.value = rect.width
  topbarHeight.value = rect.height
  topbarRadius.value = parseCssPixelValue(style.borderTopLeftRadius)
}

function scheduleTopbarMetricsUpdate() {
  if (!import.meta.client) {
    return
  }

  void nextTick(() => {
    window.requestAnimationFrame(updateTopbarMetrics)
  })
}

watch(() => theme.preference.radius, scheduleTopbarMetricsUpdate)

onUnmounted(() => {
  stopWorkbenchWidgetHighlight()
  topbarResizeObserver?.disconnect()
  topbarResizeObserver = null
})

onMounted(() => {
  const element = topbarElement.value

  if (!element) {
    return
  }

  const observedElement: HTMLElement = element

  updateTopbarMetrics()

  topbarResizeObserver = new ResizeObserver(updateTopbarMetrics)

  topbarResizeObserver.observe(observedElement)
})
</script>

<template>
  <main class="hdx-app-scene hdx-app-scene-workbench workbench-shell relative h-dvh overflow-hidden text-slate-950 transition-colors duration-300 dark:text-white">
    <div class="hdx-app-backdrop absolute inset-0" />
    <div class="hdx-app-liquid-field absolute inset-0" />
    <div class="hdx-app-grid-lines absolute inset-0" />

    <section class="relative z-10 grid h-full min-h-0 w-full grid-rows-[auto_minmax(0,1fr)] gap-3 px-3 py-3 sm:px-4">
      <header
        ref="workbenchTopbar"
        class="workbench-topbar relative hdx-radius-panel border border-white/62 bg-white/58 px-3 shadow-xl shadow-cyan-950/7 backdrop-blur-2xl dark:border-white/14 dark:bg-white/8 dark:shadow-black/28"
      >
        <span
          class="workbench-topbar-route-progress"
          :class="{ 'workbench-topbar-route-progress-active': routeProgressActive }"
          aria-hidden="true"
        >
          <svg
            class="workbench-topbar-route-progress-svg"
            :viewBox="`0 0 ${routeProgressPath.width} ${routeProgressPath.height}`"
            preserveAspectRatio="none"
            focusable="false"
          >
            <path
              class="workbench-topbar-route-progress-path"
              :d="routeProgressPath.topPath"
              pathLength="100"
              :style="{ strokeDasharray: routeProgressPath.dashArray }"
            />
            <path
              class="workbench-topbar-route-progress-path"
              :d="routeProgressPath.bottomPath"
              pathLength="100"
              :style="{ strokeDasharray: routeProgressPath.dashArray }"
            />
          </svg>
        </span>

        <div class="relative z-10 flex h-16 min-w-0 items-center gap-2">
          <UTooltip :text="t('workbench.menu')">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              icon="i-lucide-menu"
              :aria-label="t('workbench.menu')"
              class="hdx-toolbar-button shrink-0 cursor-pointer"
              @click="menuOpen = true"
            />
          </UTooltip>

          <UTooltip :text="t('workbench.navigation.items.home.title')">
            <NuxtLink
              to="/"
              class="workbench-brand-link flex min-w-0 items-center gap-3"
              :aria-label="t('workbench.navigation.items.home.title')"
            >
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
            </NuxtLink>
          </UTooltip>

          <WorkbenchPinnedNavigation
            v-if="!layout.editing && pinnedItems.length > 0"
            :items="pinnedItems"
            class="mx-1 hidden xl:block"
            @select="handleNavigationItemSelect"
          />

          <div class="ml-auto flex min-w-0 items-center justify-end gap-2">
            <div id="workbench-topbar-actions" class="contents" />

            <UDropdownMenu
              v-model:open="localeMenuOpen"
              :items="localeMenuItems"
              :content="{ align: 'end' }"
              :ui="{ content: 'hdx-floating-menu hdx-radius-popover' }"
            >
              <UTooltip :text="t('actions.language')">
                <UButton
                  type="button"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-languages"
                  :aria-label="t('actions.language')"
                  class="hdx-toolbar-button cursor-pointer"
                />
              </UTooltip>
              <template #item-trailing="{ item }">
                <UIcon v-if="item.selected" name="i-lucide-check" class="size-4 text-primary" />
              </template>
            </UDropdownMenu>

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

        <WorkbenchMenuSlideover
          v-model:open="menuOpen"
          :items="workbenchNavigationItems"
          @select="handleNavigationItemSelect"
        />
      </header>

      <slot />
    </section>
  </main>
</template>

<style>
.workbench-subtitle {
  color: color-mix(in srgb, var(--hdx-theme-primary) 78%, #155e75);
}

.workbench-topbar-route-progress {
  position: absolute;
  inset: -1px;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  overflow: visible;
  transition: opacity 160ms ease;
}

.workbench-topbar-route-progress-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.workbench-topbar-route-progress-path {
  fill: none;
  stroke: rgba(var(--hdx-theme-primary-rgb), 0.96);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
  filter: drop-shadow(0 0 9px rgba(var(--hdx-theme-primary-rgb), 0.38));
  transition: stroke-dasharray 90ms ease-out;
}

.workbench-topbar-route-progress-active {
  opacity: 1;
}

.workbench-brand-link {
  min-height: 3.25rem;
  padding: 0.25rem 0.5rem 0.25rem 0.25rem;
  border-radius: var(--hdx-radius-card);
  text-decoration: none;
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.workbench-brand-link:hover {
  background: rgba(var(--hdx-theme-primary-rgb), 0.1);
  box-shadow: 0 10px 26px rgba(var(--hdx-theme-primary-rgb), 0.08);
}

.workbench-brand-link:focus-visible {
  outline: 2px solid rgba(var(--hdx-theme-primary-rgb), 0.55);
  outline-offset: 2px;
}

.dark .workbench-subtitle {
  color: color-mix(in srgb, var(--hdx-theme-primary) 56%, #cffafe);
}

.dark .workbench-brand-link:hover {
  background: rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.24);
}

@media (prefers-reduced-motion: reduce) {
  .workbench-topbar-route-progress {
    transition-duration: 1ms;
  }
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
