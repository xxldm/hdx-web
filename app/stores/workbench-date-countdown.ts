import { useTimestamp } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import { useAuthStore } from './auth'
import type { HolidayRecord } from '~/types/hdx-api'
import { holidayRecordsSchema } from '~/types/hdx-api'
import { isAuthRequiredApiError } from '~/utils/api-error'
import { fetchHolidays } from '~/utils/hdx-api-client'

export type WorkbenchDateCountdownPersistenceResult = 'success' | 'failed' | 'auth-expired'

export interface WorkbenchHoliday {
  id: number
  holidayKey: string
  displayName: string
  description: string | null
  date: string
  recurring: boolean
  sortOrder: number
}

export interface UpcomingWorkbenchHoliday extends WorkbenchHoliday {
  nextDate: Date
  daysUntil: number
}

export const useWorkbenchDateCountdownStore = defineStore('workbench-date-countdown', () => {
  const remoteHolidays = shallowRef<WorkbenchHoliday[] | null>(null)
  const initialized = shallowRef(false)
  const loading = shallowRef(false)
  const errorKey = shallowRef<string | null>(null)
  const timestamp = useTimestamp({ interval: 60 * 1000 })

  const holidays = computed(() => remoteHolidays.value ?? [])
  const upcomingHolidays = computed(() => getUpcomingWorkbenchHolidays(holidays.value, timestamp.value, 6))
  const nextHoliday = computed(() => upcomingHolidays.value[0] ?? null)
  const unavailable = computed(() => initialized.value && !remoteHolidays.value)

  async function ensureHolidaysLoaded() {
    if (initialized.value || loading.value) {
      return remoteHolidays.value ? 'success' satisfies WorkbenchDateCountdownPersistenceResult : 'failed' satisfies WorkbenchDateCountdownPersistenceResult
    }

    return await loadHolidays()
  }

  async function loadHolidays() {
    const auth = useAuthStore()

    loading.value = true
    errorKey.value = null

    try {
      remoteHolidays.value = normalizeWorkbenchHolidays(await fetchHolidays())
      return 'success' satisfies WorkbenchDateCountdownPersistenceResult
    } catch (error) {
      remoteHolidays.value = null

      if (isAuthRequiredApiError(error)) {
        auth.markSessionExpired()
        return 'auth-expired' satisfies WorkbenchDateCountdownPersistenceResult
      }

      errorKey.value = 'workbench.dateCountdown.loadFailed'
      return 'failed' satisfies WorkbenchDateCountdownPersistenceResult
    } finally {
      initialized.value = true
      loading.value = false
    }
  }

  function resetState() {
    remoteHolidays.value = null
    initialized.value = false
    loading.value = false
    errorKey.value = null
  }

  return {
    errorKey,
    holidays,
    initialized,
    loading,
    nextHoliday,
    remoteHolidays,
    unavailable,
    upcomingHolidays,
    ensureHolidaysLoaded,
    loadHolidays,
    resetState
  }
})

export function normalizeWorkbenchHolidays(value: unknown): WorkbenchHoliday[] {
  const parsed = holidayRecordsSchema.safeParse(value)

  if (!parsed.success) {
    return []
  }

  return parsed.data
    .map(normalizeHolidayRecord)
    .sort(compareWorkbenchHolidays)
}

export function getUpcomingWorkbenchHolidays(
  holidays: readonly WorkbenchHoliday[],
  timestamp: number,
  limit = 6
): UpcomingWorkbenchHoliday[] {
  const today = startOfLocalDate(new Date(timestamp))

  return holidays
    .map((holiday) => {
      const nextDate = getNextHolidayDate(holiday, today)

      if (!nextDate) {
        return null
      }

      return {
        ...holiday,
        nextDate,
        daysUntil: differenceInCalendarDays(nextDate, today)
      }
    })
    .filter((holiday): holiday is UpcomingWorkbenchHoliday => Boolean(holiday))
    .sort((left, right) => {
      if (left.daysUntil !== right.daysUntil) {
        return left.daysUntil - right.daysUntil
      }

      return compareWorkbenchHolidays(left, right)
    })
    .slice(0, Math.max(Math.trunc(limit), 0))
}

function normalizeHolidayRecord(record: HolidayRecord): WorkbenchHoliday {
  return {
    id: record.id,
    holidayKey: record.holidayKey,
    displayName: record.displayName,
    description: record.description ?? null,
    date: record.date,
    recurring: record.recurring,
    sortOrder: record.sortOrder
  }
}

function compareWorkbenchHolidays(left: WorkbenchHoliday, right: WorkbenchHoliday) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder
  }

  return left.holidayKey.localeCompare(right.holidayKey)
}

function getNextHolidayDate(holiday: WorkbenchHoliday, today: Date) {
  const date = parseHolidayDate(holiday.date)

  if (!date) {
    return null
  }

  if (!holiday.recurring) {
    return date.getTime() >= today.getTime() ? date : null
  }

  for (let year = today.getFullYear(); year <= today.getFullYear() + 4; year += 1) {
    const candidate = createLocalDate(year, date.getMonth() + 1, date.getDate())

    if (candidate && candidate.getTime() >= today.getTime()) {
      return candidate
    }
  }

  return null
}

function parseHolidayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  return createLocalDate(Number(match[1]), Number(match[2]), Number(match[3]))
}

function createLocalDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day)

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null
  }

  return startOfLocalDate(date)
}

function startOfLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function differenceInCalendarDays(left: Date, right: Date) {
  const leftTime = Date.UTC(left.getFullYear(), left.getMonth(), left.getDate())
  const rightTime = Date.UTC(right.getFullYear(), right.getMonth(), right.getDate())

  return Math.round((leftTime - rightTime) / 86_400_000)
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWorkbenchDateCountdownStore, import.meta.hot))
}
