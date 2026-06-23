<script setup lang="ts">
import ToolboxTimerPresetChip from '~/components/workbench/widgets/ToolboxTimerPresetChip.vue'
import {
  maxWorkbenchTimerDurationSeconds,
  minWorkbenchTimerDurationSeconds,
  type WorkbenchTimerPreset
} from '~/stores/workbench-timer'
import type { ResolvedWorkbenchWidgetOrientation } from '~/utils/workbench-widget-meta'

type TimerPresetUnit = 'seconds' | 'minutes' | 'hours'

const props = withDefaults(defineProps<{
  orientation?: ResolvedWorkbenchWidgetOrientation
}>(), {
  orientation: 'horizontal'
})

const timerPresetUnitMultipliers: Record<TimerPresetUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 60 * 60
}

const { t } = useI18n()
const timer = useWorkbenchTimerStore()
const addPresetOpen = shallowRef(false)
const addingPreset = shallowRef(false)
const newPresetValue = shallowRef<number | null>(10)
const newPresetUnit = shallowRef<TimerPresetUnit>('minutes')
const alarmAudio = shallowRef<HTMLAudioElement | null>(null)

const isHorizontal = computed(() => props.orientation === 'horizontal')
const runningSummary = computed(() => timer.runningPresetCount > 0
  ? t('workbench.timer.runningCount', { count: timer.runningPresetCount })
  : timer.loading && !timer.initialized
    ? t('workbench.timer.loading')
    : timer.unavailable
      ? t('workbench.timer.unavailable')
      : t('workbench.timer.presets')
)
const presetUnitItems = computed(() => [
  {
    label: t('workbench.timer.secondsUnit'),
    value: 'seconds'
  },
  {
    label: t('workbench.timer.minutesUnit'),
    value: 'minutes'
  },
  {
    label: t('workbench.timer.hoursUnit'),
    value: 'hours'
  }
])
const maxNewPresetValue = computed(() => Math.floor(maxWorkbenchTimerDurationSeconds / timerPresetUnitMultipliers[newPresetUnit.value]))
const hasNewPresetValue = computed(() => typeof newPresetValue.value === 'number' && Number.isFinite(newPresetValue.value))
const newPresetSeconds = computed(() => normalizeNewPresetValue(newPresetValue.value) * timerPresetUnitMultipliers[newPresetUnit.value])
const canAddPreset = computed(() => !timer.loading && !timer.saving && !timer.unavailable && hasNewPresetValue.value && newPresetSeconds.value >= minWorkbenchTimerDurationSeconds && newPresetSeconds.value <= maxWorkbenchTimerDurationSeconds)

async function onAddPreset() {
  if (!canAddPreset.value || addingPreset.value) {
    return
  }

  addingPreset.value = true

  try {
    const addedPreset = await timer.addPresetSeconds(newPresetSeconds.value)

    if (addedPreset) {
      addPresetOpen.value = false
    }
  } finally {
    addingPreset.value = false
  }
}

async function onRemovePreset(id: string) {
  await timer.removePreset(id)
}

function formatPresetDuration(seconds: number) {
  if (seconds % timerPresetUnitMultipliers.hours === 0) {
    return t('workbench.timer.presetHours', { count: seconds / timerPresetUnitMultipliers.hours })
  }

  if (seconds % timerPresetUnitMultipliers.minutes === 0) {
    return t('workbench.timer.presetMinutes', { count: seconds / timerPresetUnitMultipliers.minutes })
  }

  return t('workbench.timer.presetSeconds', { count: seconds })
}

function canResetPreset(preset: WorkbenchTimerPreset) {
  return timer.getPresetStatusById(preset.id) !== 'idle'
    || timer.getPresetRemainingSecondsById(preset.id) !== preset.durationSeconds
}

function normalizeNewPresetValue(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1
  }

  return Math.min(Math.max(Math.trunc(value), 1), maxNewPresetValue.value)
}

function playAlarm() {
  if (!import.meta.client) {
    return
  }

  const audio = alarmAudio.value ?? new Audio('/闹钟.mp3')
  alarmAudio.value = audio
  audio.currentTime = 0

  void audio.play().catch(() => {
    // 浏览器可能因为自动播放策略拒绝播放；计时状态仍然需要确认，避免持续重复触发。
  })
}

function handleDueAlarms() {
  const duePresets = timer.dueAlarmPresets

  if (duePresets.length === 0) {
    return
  }

  playAlarm()

  for (const preset of duePresets) {
    if (preset.endsAt !== null) {
      timer.acknowledgePresetAlarm(preset.id, preset.endsAt)
    }
  }
}

watch(newPresetUnit, () => {
  newPresetValue.value = normalizeNewPresetValue(newPresetValue.value)
})

if (import.meta.client) {
  watch(
    () => timer.dueAlarmPresets.map(preset => `${preset.id}:${preset.endsAt}`).join('|'),
    handleDueAlarms,
    { flush: 'post' }
  )

  onMounted(handleDueAlarms)
  onMounted(() => {
    void timer.ensurePreferencesLoaded()
  })
}
</script>

<template>
  <div
    class="timer-widget grid h-full min-h-0 gap-3"
    :class="isHorizontal ? 'timer-widget-horizontal' : 'timer-widget-vertical'"
  >
    <div class="timer-widget-summary flex min-w-0 items-center justify-between gap-2">
      <span class="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-[color:var(--ui-text-muted)]">
        <UIcon name="i-lucide-hourglass" class="size-3.5 shrink-0" />
        <span class="truncate">{{ runningSummary }}</span>
      </span>

      <UPopover
        v-model:open="addPresetOpen"
        mode="click"
        :content="{ align: 'end', side: 'bottom', sideOffset: 8 }"
        :ui="{ content: 'hdx-floating-menu hdx-radius-popover' }"
      >
        <UTooltip :text="t('workbench.timer.addPreset')">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-plus"
            class="timer-add-button cursor-pointer hdx-radius-card"
            :aria-label="t('workbench.timer.addPreset')"
            :disabled="timer.loading || timer.saving || timer.unavailable"
          />
        </UTooltip>

        <template #content>
          <form class="timer-add-form grid w-56 gap-3 p-3" @submit.prevent="onAddPreset">
            <label class="grid gap-1.5 text-xs font-medium text-[color:var(--ui-text-muted)]">
              <span>{{ t('workbench.timer.newPreset') }}</span>
              <span class="grid grid-cols-[minmax(0,1fr)_5.75rem] gap-2">
                <UInputNumber
                  v-model="newPresetValue"
                  :min="1"
                  :max="maxNewPresetValue"
                  :step="1"
                  :increment="true"
                  :decrement="true"
                  size="sm"
                  variant="subtle"
                  class="min-w-0"
                  :ui="{ base: 'hdx-radius-card text-center tabular-nums' }"
                />
                <USelect
                  v-model="newPresetUnit"
                  :items="presetUnitItems"
                  size="sm"
                  variant="subtle"
                  class="min-w-0"
                  :ui="{ base: 'hdx-radius-card' }"
                />
              </span>
            </label>
            <UButton
              type="submit"
              color="primary"
              variant="soft"
              icon="i-lucide-plus"
              block
              class="cursor-pointer justify-center hdx-radius-card"
              :disabled="!canAddPreset"
              :loading="addingPreset || timer.saving"
            >
              {{ t('workbench.timer.addPreset') }}
            </UButton>
          </form>
        </template>
      </UPopover>
    </div>

    <div class="timer-preset-list min-w-0">
      <div
        v-if="timer.loading && timer.presets.length === 0"
        class="timer-state-message hdx-radius-card"
      >
        <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
        <span>{{ t('workbench.timer.loading') }}</span>
      </div>
      <div
        v-else-if="timer.unavailable"
        class="timer-state-message hdx-radius-card"
      >
        <UIcon name="i-lucide-circle-alert" class="size-4" />
        <span>{{ t(timer.errorKey ?? 'workbench.timer.unavailable') }}</span>
      </div>
      <template v-else>
        <ToolboxTimerPresetChip
          v-for="preset in timer.presets"
          :key="preset.id"
          :preset="preset"
          :status="timer.getPresetStatusById(preset.id)"
          :duration-label="formatPresetDuration(preset.durationSeconds)"
          :remaining-label="timer.getPresetRemainingLabelById(preset.id)"
          :progress-percent="timer.getPresetProgressPercentById(preset.id)"
          :can-remove="timer.canRemovePreset(preset.id) && !timer.saving"
          :can-reset="canResetPreset(preset)"
          @toggle="timer.togglePreset"
          @reset="timer.resetPreset"
          @remove="onRemovePreset"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.timer-widget {
  container-type: inline-size;
  align-content: start;
}

.timer-widget-horizontal {
  grid-template-rows: auto minmax(0, 1fr);
}

.timer-widget-vertical {
  grid-template-rows: auto minmax(0, 1fr);
}

.timer-widget-summary {
  min-height: 2rem;
}

.timer-preset-list {
  display: grid;
  min-height: 0;
  align-content: start;
  gap: 0.5rem;
  overflow: hidden;
}

.timer-add-button {
  min-width: 0;
}

.timer-state-message {
  display: inline-flex;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid rgba(var(--hdx-theme-neutral-rgb), 0.18);
  background: rgba(255, 255, 255, 0.34);
  padding: 0.65rem 0.75rem;
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

:global(.dark) .timer-state-message {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.07);
}

@container (min-width: 19rem) {
  .timer-widget-horizontal .timer-preset-list {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  }
}

@container (max-width: 18.99rem) {
  .timer-widget-horizontal .timer-preset-list,
  .timer-widget-vertical .timer-preset-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
