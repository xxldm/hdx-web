<script setup lang="ts">
import type { UpcomingWorkbenchHoliday } from '~/stores/workbench-date-countdown'
import type { ResolvedWorkbenchWidgetOrientation } from '~/utils/workbench-widget-meta'

const props = withDefaults(defineProps<{
  orientation?: ResolvedWorkbenchWidgetOrientation
}>(), {
  orientation: 'horizontal'
})

const { locale, t } = useI18n()
const countdown = useWorkbenchDateCountdownStore()

const isHorizontal = computed(() => props.orientation === 'horizontal')
const nextHoliday = computed(() => countdown.nextHoliday)
const secondaryHolidays = computed(() => countdown.upcomingHolidays.slice(1, 4))
const dateFormatter = computed(() => new Intl.DateTimeFormat(locale.value, {
  month: 'short',
  day: 'numeric',
  weekday: 'short'
}))

const summaryLabel = computed(() => {
  if (countdown.loading && !countdown.initialized) {
    return t('workbench.dateCountdown.loading')
  }

  if (countdown.unavailable) {
    return t('workbench.dateCountdown.unavailable')
  }

  return t('workbench.dateCountdown.next')
})

function formatHolidayDate(holiday: UpcomingWorkbenchHoliday) {
  return dateFormatter.value.format(holiday.nextDate)
}

function formatDaysUntil(holiday: UpcomingWorkbenchHoliday) {
  if (holiday.daysUntil === 0) {
    return t('workbench.dateCountdown.today')
  }

  return t('workbench.dateCountdown.daysLeft', { count: holiday.daysUntil })
}

onMounted(() => {
  void countdown.ensureHolidaysLoaded()
})
</script>

<template>
  <div
    class="date-countdown-widget grid h-full min-h-0 gap-3"
    :class="isHorizontal ? 'date-countdown-widget-horizontal' : 'date-countdown-widget-vertical'"
  >
    <div class="date-countdown-summary flex min-w-0 items-center gap-1.5 text-xs font-medium text-[color:var(--ui-text-muted)]">
      <UIcon name="i-lucide-calendar-clock" class="size-3.5 shrink-0" />
      <span class="truncate">{{ summaryLabel }}</span>
    </div>

    <div
      v-if="countdown.loading && countdown.holidays.length === 0"
      class="date-countdown-state hdx-radius-card"
    >
      <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
      <span>{{ t('workbench.dateCountdown.loading') }}</span>
    </div>

    <div
      v-else-if="countdown.unavailable"
      class="date-countdown-state hdx-radius-card"
    >
      <UIcon name="i-lucide-circle-alert" class="size-4" />
      <span>{{ t(countdown.errorKey ?? 'workbench.dateCountdown.unavailable') }}</span>
    </div>

    <div
      v-else-if="!nextHoliday"
      class="date-countdown-state hdx-radius-card"
    >
      <UIcon name="i-lucide-calendar-x" class="size-4" />
      <span>{{ t('workbench.dateCountdown.empty') }}</span>
    </div>

    <template v-else>
      <section class="date-countdown-hero hdx-radius-card">
        <div class="date-countdown-hero-copy min-w-0">
          <p class="truncate text-sm font-semibold text-[color:var(--ui-text)]">
            {{ nextHoliday.displayName }}
          </p>
          <p class="mt-1 truncate text-xs text-[color:var(--ui-text-muted)]">
            {{ formatHolidayDate(nextHoliday) }}
          </p>
        </div>

        <div class="date-countdown-days shrink-0 text-right">
          <p class="date-countdown-days-number tabular-nums">
            {{ nextHoliday.daysUntil }}
          </p>
          <p class="text-xs font-semibold text-[color:var(--ui-text-muted)]">
            {{ nextHoliday.daysUntil === 0 ? t('workbench.dateCountdown.today') : t('workbench.dateCountdown.daysUnit') }}
          </p>
        </div>
      </section>

      <div
        v-if="secondaryHolidays.length > 0"
        class="date-countdown-list min-w-0"
      >
        <div
          v-for="holiday in secondaryHolidays"
          :key="holiday.holidayKey"
          class="date-countdown-row hdx-radius-card"
        >
          <span class="min-w-0 truncate text-xs font-medium text-[color:var(--ui-text)]">
            {{ holiday.displayName }}
          </span>
          <span class="shrink-0 text-xs tabular-nums text-[color:var(--ui-text-muted)]">
            {{ formatDaysUntil(holiday) }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.date-countdown-widget {
  container-type: inline-size;
  align-content: start;
}

.date-countdown-widget-horizontal,
.date-countdown-widget-vertical {
  grid-template-rows: auto minmax(0, 1fr);
}

.date-countdown-summary {
  min-height: 2rem;
}

.date-countdown-hero {
  display: grid;
  min-height: 5.5rem;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid rgba(var(--hdx-theme-primary-rgb), 0.2);
  background:
    radial-gradient(circle at 20% 18%, rgba(var(--hdx-theme-primary-rgb), 0.2), transparent 44%),
    rgba(255, 255, 255, 0.36);
  padding: 0.8rem;
  overflow: hidden;
}

.date-countdown-days-number {
  color: rgb(var(--hdx-theme-primary-rgb));
  font-size: 2.5rem;
  font-weight: 750;
  line-height: 0.9;
}

.date-countdown-list {
  display: grid;
  min-height: 0;
  align-content: start;
  gap: 0.45rem;
  overflow: hidden;
}

.date-countdown-row,
.date-countdown-state {
  display: flex;
  min-height: 2.25rem;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid rgba(var(--hdx-theme-neutral-rgb), 0.16);
  background: rgba(255, 255, 255, 0.26);
  padding: 0.55rem 0.65rem;
}

.date-countdown-row {
  justify-content: space-between;
}

.date-countdown-state {
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

:global(.dark) .date-countdown-hero {
  border-color: rgba(var(--hdx-theme-primary-rgb), 0.28);
  background:
    radial-gradient(circle at 20% 18%, rgba(var(--hdx-theme-primary-rgb), 0.24), transparent 44%),
    rgba(255, 255, 255, 0.07);
}

:global(.dark) .date-countdown-row,
:global(.dark) .date-countdown-state {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
}

@container (min-width: 20rem) {
  .date-countdown-widget-horizontal {
    grid-template-columns: minmax(0, 1.2fr) minmax(8rem, 0.8fr);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .date-countdown-widget-horizontal .date-countdown-summary {
    grid-column: 1 / -1;
  }

  .date-countdown-widget-horizontal .date-countdown-list {
    min-height: 5.5rem;
  }
}

@container (max-height: 10.5rem) {
  .date-countdown-list {
    display: none;
  }
}
</style>
