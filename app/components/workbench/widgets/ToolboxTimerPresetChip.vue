<script setup lang="ts">
import type { WorkbenchTimerPreset, WorkbenchTimerStatus } from '~/stores/workbench-timer'

const props = defineProps<{
  preset: WorkbenchTimerPreset
  status: WorkbenchTimerStatus
  durationLabel: string
  remainingLabel: string
  progressPercent: number
  canRemove: boolean
  canReset: boolean
}>()
const emit = defineEmits<{
  remove: [id: string]
  reset: [id: string]
  toggle: [id: string]
}>()

const { t } = useI18n()
const statusLabel = computed(() => t(`workbench.timer.status.${props.status}`))
const primaryActionLabel = computed(() => {
  if (props.status === 'running') {
    return t('workbench.timer.pause')
  }

  if (props.status === 'paused') {
    return t('workbench.timer.resume')
  }

  if (props.status === 'finished') {
    return t('workbench.timer.restart')
  }

  return t('workbench.timer.start')
})
const primaryActionIcon = computed(() => props.status === 'running' ? 'i-lucide-pause' : 'i-lucide-play')
const displayLabel = computed(() => props.status === 'idle' ? props.durationLabel : props.remainingLabel)
const actionAriaLabel = computed(() => t('workbench.timer.presetActionByLabel', {
  action: primaryActionLabel.value,
  label: props.durationLabel
}))
const menuItems = computed(() => [
  [
    {
      label: primaryActionLabel.value,
      icon: primaryActionIcon.value,
      onSelect: () => emit('toggle', props.preset.id)
    },
    {
      label: t('workbench.timer.reset'),
      icon: 'i-lucide-rotate-ccw',
      disabled: !props.canReset,
      onSelect: () => emit('reset', props.preset.id)
    }
  ],
  [
    {
      label: props.canRemove
        ? t('workbench.timer.deletePresetByLabel', { label: props.durationLabel })
        : props.status === 'running'
          ? t('workbench.timer.runningPresetDeleteHint')
          : t('workbench.timer.lastPresetHint'),
      icon: 'i-lucide-x',
      color: 'error' as const,
      disabled: !props.canRemove,
      onSelect: () => emit('remove', props.preset.id)
    }
  ]
])
const chipStyle = computed(() => ({
  '--timer-progress': `${props.progressPercent}%`
}))
</script>

<template>
  <div
    class="timer-preset-chip relative min-w-0 overflow-hidden"
    :class="`timer-preset-chip-${status}`"
    :style="chipStyle"
  >
    <UTooltip :text="actionAriaLabel">
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        size="sm"
        class="timer-preset-main min-w-0 cursor-pointer justify-start hdx-radius-card"
        :aria-label="actionAriaLabel"
        @click="emit('toggle', preset.id)"
      >
        <template #leading>
          <UIcon :name="primaryActionIcon" class="timer-preset-main-icon size-4 shrink-0" />
        </template>
        <span class="grid min-w-0 text-left">
          <span class="truncate font-semibold tabular-nums">{{ displayLabel }}</span>
          <span class="truncate text-[0.68rem] font-medium text-[color:var(--ui-text-muted)]">
            {{ statusLabel }}
          </span>
        </span>
      </UButton>
    </UTooltip>

    <div class="timer-preset-menu-slot">
      <UDropdownMenu
        :items="menuItems"
        :content="{ align: 'end', sideOffset: 6 }"
        :ui="{ content: 'hdx-floating-menu hdx-radius-popover' }"
      >
        <UTooltip :text="t('workbench.timer.actionsByLabel', { label: durationLabel })">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-more-vertical"
            class="timer-preset-menu-button cursor-pointer hdx-radius-card"
            :aria-label="t('workbench.timer.actionsByLabel', { label: durationLabel })"
          />
        </UTooltip>
      </UDropdownMenu>
    </div>
  </div>
</template>

<style scoped>
.timer-preset-chip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  border: 1px solid rgba(var(--hdx-theme-neutral-rgb), 0.2);
  border-radius: var(--hdx-radius-card);
  background: rgba(255, 255, 255, 0.38);
  isolation: isolate;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.timer-preset-chip::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: rgba(var(--hdx-theme-primary-rgb), 0.1);
  content: "";
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease;
}

.timer-preset-chip:hover,
.timer-preset-chip:focus-within {
  border-color: rgba(var(--hdx-theme-primary-rgb), 0.2);
}

.timer-preset-chip:hover::before,
.timer-preset-chip:focus-within::before {
  opacity: 1;
}

.timer-preset-chip::after {
  position: absolute;
  inset-inline: 0.55rem;
  bottom: 0.35rem;
  z-index: 1;
  width: var(--timer-progress);
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ui-primary) 72%, transparent);
  content: "";
  opacity: 0.28;
  transition: width 180ms linear, opacity 160ms ease;
}

.timer-preset-chip-running {
  border-color: color-mix(in srgb, var(--ui-success) 52%, transparent);
  background: color-mix(in srgb, var(--ui-success) 17%, rgba(255, 255, 255, 0.44));
  box-shadow: 0 10px 24px color-mix(in srgb, var(--ui-success) 18%, transparent);
}

.timer-preset-chip-running::after {
  background: color-mix(in srgb, var(--ui-success) 78%, transparent);
  opacity: 0.72;
}

.timer-preset-chip-paused {
  border-color: color-mix(in srgb, var(--ui-warning) 48%, transparent);
  background: color-mix(in srgb, var(--ui-warning) 13%, rgba(255, 255, 255, 0.4));
}

.timer-preset-chip-finished {
  border-color: color-mix(in srgb, var(--ui-error) 42%, transparent);
  background: color-mix(in srgb, var(--ui-error) 10%, rgba(255, 255, 255, 0.4));
}

.timer-preset-main {
  position: relative;
  z-index: 2;
  width: 100%;
  background: transparent !important;
}

.timer-preset-main:hover,
.timer-preset-main:focus-visible,
.timer-preset-main:active {
  background: transparent !important;
}

.timer-preset-main-icon {
  color: var(--ui-primary);
}

.timer-preset-chip-running .timer-preset-main-icon {
  color: var(--ui-success);
}

.timer-preset-chip-paused .timer-preset-main-icon {
  color: var(--ui-warning);
}

.timer-preset-chip-finished .timer-preset-main-icon {
  color: var(--ui-error);
}

.timer-preset-menu-slot {
  position: relative;
  z-index: 2;
  display: grid;
  height: 100%;
  min-width: 2.5rem;
  place-items: center;
}

.timer-preset-menu-button {
  display: inline-flex;
  width: 2.25rem;
  min-width: 2.25rem;
  height: 2.25rem;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent !important;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}

.timer-preset-menu-button:hover,
.timer-preset-menu-button:focus-visible,
.timer-preset-menu-button:active,
.timer-preset-menu-button[aria-expanded="true"],
.timer-preset-menu-button[data-state="open"] {
  background: rgba(var(--hdx-theme-primary-rgb), 0.1) !important;
}

:global(.dark) .timer-preset-chip {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.07);
}

:global(.dark) .timer-preset-chip::before {
  background: rgba(255, 255, 255, 0.1);
}

:global(.dark) .timer-preset-chip:hover,
:global(.dark) .timer-preset-chip:focus-within {
  border-color: rgba(255, 255, 255, 0.18);
}

:global(.dark) .timer-preset-menu-button:hover,
:global(.dark) .timer-preset-menu-button:focus-visible,
:global(.dark) .timer-preset-menu-button:active,
:global(.dark) .timer-preset-menu-button[aria-expanded="true"],
:global(.dark) .timer-preset-menu-button[data-state="open"] {
  background: rgba(255, 255, 255, 0.12) !important;
}

:global(.dark) .timer-preset-chip-running {
  border-color: color-mix(in srgb, var(--ui-success) 54%, transparent);
  background: color-mix(in srgb, var(--ui-success) 18%, rgba(255, 255, 255, 0.08));
}

:global(.dark) .timer-preset-chip-paused {
  border-color: color-mix(in srgb, var(--ui-warning) 48%, transparent);
  background: color-mix(in srgb, var(--ui-warning) 14%, rgba(255, 255, 255, 0.07));
}

:global(.dark) .timer-preset-chip-finished {
  border-color: color-mix(in srgb, var(--ui-error) 48%, transparent);
  background: color-mix(in srgb, var(--ui-error) 13%, rgba(255, 255, 255, 0.07));
}
</style>
