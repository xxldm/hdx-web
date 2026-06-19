<script setup lang="ts">
import type { ThemeNeutralColorKey, ThemePrimaryColorKey, ThemeRadiusValue } from '~/utils/theme-runtime'

const props = withDefaults(defineProps<{
  buttonClass?: string
  buttonSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  colorModeOnly?: boolean
  contentClass?: string
}>(), {
  buttonClass: '',
  buttonSize: 'sm',
  colorModeOnly: false,
  contentClass: 'workbench-floating-menu hdx-radius-popover'
})

const { t } = useI18n()
const theme = useThemePreferenceStore()
const open = ref(false)
const customPrimary = computed({
  get: () => theme.preference.customPrimary,
  set: (value: string | undefined) => theme.setCustomPrimaryColor(value)
})
const customNeutral = computed({
  get: () => theme.preference.customNeutral,
  set: (value: string | undefined) => theme.setCustomNeutralColor(value)
})
const colorModeItems = computed(() => [
  {
    value: 'light' as const,
    label: t('actions.themeLight'),
    icon: 'lucide:sun'
  },
  {
    value: 'dark' as const,
    label: t('actions.themeDark'),
    icon: 'lucide:moon'
  },
  {
    value: 'system' as const,
    label: t('actions.themeSystem'),
    icon: 'lucide:monitor'
  }
])
const panelClass = computed(() => props.colorModeOnly
  ? 'theme-settings-panel grid w-[min(20rem,calc(100vw-2rem))] gap-3 p-3'
  : 'theme-settings-panel grid max-h-[min(42rem,calc(100vh-2rem))] w-[min(32rem,calc(100vw-2rem))] gap-5 overflow-y-auto p-4'
)

function isPrimarySelected(key: ThemePrimaryColorKey) {
  return theme.preference.primaryMode === 'preset' && theme.preference.primary === key
}

function isNeutralSelected(key: ThemeNeutralColorKey) {
  return theme.preference.neutralMode === 'preset' && theme.preference.neutral === key
}

function isRadiusSelected(value: ThemeRadiusValue) {
  return theme.preference.radius === value
}

onMounted(() => {
  theme.hydrate()
})

watch(open, (isOpen) => {
  if (isOpen) {
    theme.hydrate({ force: true })
  }
})
</script>

<template>
  <UPopover
    v-model:open="open"
    mode="click"
    :content="{ align: 'end', sideOffset: 10 }"
    :ui="{ content: contentClass }"
  >
    <UTooltip :text="t('actions.theme')">
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        icon="lucide:palette"
        :size="props.buttonSize"
        :aria-label="t('actions.theme')"
        :class="props.buttonClass"
      />
    </UTooltip>

    <template #content>
      <div :class="panelClass">
        <section v-if="!props.colorModeOnly" class="grid gap-2.5">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-sm font-semibold text-[color:var(--ui-text-highlighted)]">
              {{ t('theme.primary') }}
            </h2>
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              size="xs"
              icon="lucide:rotate-ccw"
              class="cursor-pointer hdx-radius-card"
              :aria-label="t('theme.reset')"
              @click="theme.resetTheme()"
            />
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <UButton
              v-for="item in theme.primaryColorOptions"
              :key="item.key"
              type="button"
              color="neutral"
              variant="ghost"
              class="theme-choice-button"
              :class="isPrimarySelected(item.key) ? 'theme-choice-button-active' : ''"
              :aria-pressed="isPrimarySelected(item.key)"
              @click="theme.setPrimaryColor(item.key)"
            >
              <span class="theme-choice-swatch" :style="{ backgroundColor: item.swatch }" />
              <span class="truncate">{{ t(item.labelKey) }}</span>
            </UButton>
            <UPopover
              mode="click"
              :content="{ align: 'start', side: 'bottom', sideOffset: 8 }"
              :ui="{ content: 'hdx-radius-popover' }"
            >
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                class="theme-choice-button"
                :class="theme.preference.primaryMode === 'custom' ? 'theme-choice-button-active' : ''"
                :aria-pressed="theme.preference.primaryMode === 'custom'"
                @click="theme.activateCustomPrimaryColor()"
              >
                <span class="theme-choice-swatch" :style="{ backgroundColor: theme.preference.customPrimary }" />
                <span class="truncate">{{ t('theme.customPrimary') }}</span>
              </UButton>

              <template #content>
                <UColorPicker
                  v-model="customPrimary"
                  format="hex"
                  size="sm"
                  class="p-2"
                />
              </template>
            </UPopover>
          </div>
        </section>

        <section v-if="!props.colorModeOnly" class="grid gap-2.5">
          <h2 class="text-sm font-semibold text-[color:var(--ui-text-highlighted)]">
            {{ t('theme.neutral') }}
          </h2>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <UButton
              v-for="item in theme.neutralColorOptions"
              :key="item.key"
              type="button"
              color="neutral"
              variant="ghost"
              class="theme-choice-button"
              :class="isNeutralSelected(item.key) ? 'theme-choice-button-active' : ''"
              :aria-pressed="isNeutralSelected(item.key)"
              @click="theme.setNeutralColor(item.key)"
            >
              <span class="theme-choice-swatch" :style="{ backgroundColor: item.swatch }" />
              <span class="truncate">{{ t(item.labelKey) }}</span>
            </UButton>
            <UPopover
              mode="click"
              :content="{ align: 'start', side: 'bottom', sideOffset: 8 }"
              :ui="{ content: 'hdx-radius-popover' }"
            >
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                class="theme-choice-button"
                :class="theme.preference.neutralMode === 'custom' ? 'theme-choice-button-active' : ''"
                :aria-pressed="theme.preference.neutralMode === 'custom'"
                @click="theme.activateCustomNeutralColor()"
              >
                <span class="theme-choice-swatch" :style="{ backgroundColor: theme.preference.customNeutral }" />
                <span class="truncate">{{ t('theme.customNeutral') }}</span>
              </UButton>

              <template #content>
                <UColorPicker
                  v-model="customNeutral"
                  format="hex"
                  size="sm"
                  class="p-2"
                />
              </template>
            </UPopover>
          </div>
        </section>

        <section v-if="!props.colorModeOnly" class="grid gap-2.5">
          <h2 class="text-sm font-semibold text-[color:var(--ui-text-highlighted)]">
            {{ t('theme.radius') }}
          </h2>
          <div class="grid grid-cols-5 gap-2">
            <UButton
              v-for="item in theme.radiusOptions"
              :key="item.value"
              type="button"
              color="neutral"
              variant="ghost"
              class="theme-choice-button justify-center"
              :class="isRadiusSelected(item.value) ? 'theme-choice-button-active' : ''"
              :aria-pressed="isRadiusSelected(item.value)"
              @click="theme.setRadius(item.value)"
            >
              {{ item.label }}
            </UButton>
          </div>
        </section>

        <section class="grid gap-2.5">
          <h2 class="text-sm font-semibold text-[color:var(--ui-text-highlighted)]">
            {{ t('theme.colorMode') }}
          </h2>
          <div class="grid grid-cols-3 gap-2">
            <UButton
              v-for="item in colorModeItems"
              :key="item.value"
              type="button"
              color="neutral"
              variant="ghost"
              class="theme-choice-button justify-center"
              :class="theme.activeColorMode === item.value ? 'theme-choice-button-active' : ''"
              :aria-pressed="theme.activeColorMode === item.value"
              @click="theme.setColorMode(item.value)"
            >
              <UIcon :name="item.icon" class="size-4 shrink-0" />
              <span class="truncate">{{ item.label }}</span>
            </UButton>
          </div>
        </section>
      </div>
    </template>
  </UPopover>
</template>

<style scoped>
.theme-choice-button {
  display: flex;
  min-width: 0;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.65rem;
  border: 1px solid rgba(var(--hdx-theme-neutral-rgb), 0.18);
  border-radius: var(--hdx-radius-card);
  background: rgba(255, 255, 255, 0.44);
  padding: 0.55rem 0.7rem;
  color: var(--ui-text);
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
  cursor: pointer;
}

.theme-choice-button:hover,
.theme-choice-button-active {
  border-color: rgba(var(--hdx-theme-primary-rgb), 0.38);
  background: rgba(var(--hdx-theme-primary-rgb), 0.12);
  box-shadow: 0 8px 22px rgba(var(--hdx-theme-primary-rgb), 0.1);
}

.theme-choice-swatch {
  width: 0.75rem;
  height: 0.75rem;
  flex: 0 0 auto;
  border-radius: 9999px;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.1);
}

.dark .theme-choice-button {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
}

.dark .theme-choice-button:hover,
.dark .theme-choice-button-active {
  border-color: rgba(var(--hdx-theme-primary-rgb), 0.48);
  background: rgba(var(--hdx-theme-primary-rgb), 0.16);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.24);
}
</style>
