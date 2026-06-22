<script setup lang="ts">
import type { ResolvedWorkbenchWidgetOrientation } from '~/utils/workbench-widget-meta'

const props = withDefaults(defineProps<{
  orientation?: ResolvedWorkbenchWidgetOrientation
}>(), {
  orientation: 'horizontal'
})

const { t } = useI18n()
const timer = useWorkbenchTimerStore()

const isHorizontal = computed(() => props.orientation === 'horizontal')
const durationMinutes = computed({
  get: () => timer.durationMinutes,
  set: (value: number | null | undefined) => timer.setDurationMinutes(value)
})
const statusLabel = computed(() => t(`workbench.timer.status.${timer.status}`))
const primaryActionLabel = computed(() => timer.running ? t('workbench.timer.pause') : timer.paused ? t('workbench.timer.resume') : t('workbench.timer.start'))
const primaryActionIcon = computed(() => timer.running ? 'i-lucide-pause' : 'i-lucide-play')
const primaryActionColor = computed(() => timer.running ? 'warning' : 'primary')
const canReset = computed(() => timer.remainingSeconds !== timer.durationSeconds || timer.finished || timer.running)

function onPrimaryAction() {
  if (timer.running) {
    timer.pause()
    return
  }

  timer.start()
}
</script>

<template>
  <ClientOnly>
    <div
      class="timer-widget grid h-full min-h-0 gap-3"
      :class="isHorizontal ? 'timer-widget-horizontal' : 'timer-widget-vertical'"
    >
      <section class="timer-face grid min-w-0 content-center gap-2 border border-white/55 bg-white/48 p-3 shadow-sm shadow-slate-900/5 backdrop-blur-xl hdx-radius-card dark:border-white/12 dark:bg-white/8 dark:shadow-black/20">
        <div class="flex min-w-0 items-center justify-between gap-2">
          <span class="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-white/58">
            <UIcon name="i-lucide-hourglass" class="size-3.5 shrink-0" />
            <span class="truncate">{{ statusLabel }}</span>
          </span>
          <span class="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-100">
            {{ timer.progressPercent }}%
          </span>
        </div>

        <strong class="timer-time block truncate text-center font-semibold tabular-nums tracking-normal text-slate-950 dark:text-white">
          {{ timer.remainingLabel }}
        </strong>

        <UProgress
          :model-value="timer.progressPercent"
          :max="100"
          color="primary"
          size="sm"
          :ui="{
            base: 'bg-white/60 dark:bg-white/12',
            indicator: 'bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300 dark:from-amber-200 dark:via-orange-300 dark:to-rose-300'
          }"
        />
      </section>

      <section class="timer-controls grid min-w-0 content-center gap-2">
        <label class="grid min-w-0 gap-1.5 text-xs font-medium text-slate-500 dark:text-white/58">
          <span>{{ t('workbench.timer.durationMinutes') }}</span>
          <span class="grid grid-cols-[minmax(0,5.5rem)_auto] items-center gap-2">
            <UInputNumber
              v-model="durationMinutes"
              :min="1"
              :max="1440"
              :step="1"
              :increment="false"
              :decrement="false"
              :disabled="timer.running"
              size="xs"
              variant="subtle"
              class="min-w-0"
              :ui="{ base: 'hdx-radius-card text-center tabular-nums' }"
            />
            <span class="text-xs text-slate-500 dark:text-white/58">
              {{ t('workbench.timer.minutesUnit') }}
            </span>
          </span>
        </label>

        <div class="grid grid-cols-2 gap-2">
          <UTooltip :text="primaryActionLabel">
            <UButton
              type="button"
              :color="primaryActionColor"
              variant="soft"
              :icon="primaryActionIcon"
              class="timer-action-button cursor-pointer justify-center hdx-radius-card"
              :aria-label="primaryActionLabel"
              @click="onPrimaryAction"
            >
              {{ primaryActionLabel }}
            </UButton>
          </UTooltip>

          <UTooltip :text="t('workbench.timer.reset')">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              icon="i-lucide-rotate-ccw"
              class="timer-action-button cursor-pointer justify-center hdx-radius-card"
              :disabled="!canReset"
              :aria-label="t('workbench.timer.reset')"
              @click="timer.reset"
            >
              {{ t('workbench.timer.reset') }}
            </UButton>
          </UTooltip>
        </div>
      </section>
    </div>

    <template #fallback>
      <div class="grid h-full place-items-center border border-white/55 bg-white/48 p-3 shadow-sm shadow-slate-900/5 hdx-radius-card dark:border-white/12 dark:bg-white/8 dark:shadow-black/20">
        <strong class="text-3xl font-semibold tabular-nums text-slate-950 dark:text-white">
          10:00
        </strong>
      </div>
    </template>
  </ClientOnly>
</template>

<style scoped>
.timer-widget {
  container-type: inline-size;
}

.timer-widget-horizontal {
  grid-template-columns: minmax(0, 1fr);
  align-content: center;
}

.timer-widget-vertical {
  align-content: space-between;
}

.timer-time {
  font-size: clamp(2rem, 26cqi, 4.25rem);
  line-height: 0.95;
}

.timer-action-button {
  min-width: 0;
}

@container (min-width: 22rem) {
  .timer-widget-horizontal {
    grid-template-columns: minmax(0, 1fr) minmax(8.5rem, 0.58fr);
    align-items: center;
  }

  .timer-widget-horizontal .timer-face,
  .timer-widget-horizontal .timer-controls {
    height: 100%;
  }
}
</style>
