import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import { useAuthStore } from './auth'
import type { HolidayAdminRecord, HolidayConflictResponse, HolidayCreateRequest, HolidayUpdateRequest } from '~/types/hdx-api'
import { extractHolidayConflict, isAuthRequiredApiError } from '~/utils/api-error'
import { createAdminHoliday, deleteAdminHoliday, fetchAdminHolidays, updateAdminHoliday } from '~/utils/hdx-api-client'

export type HolidayAdminPersistenceResult = 'success' | 'failed' | 'auth-expired' | 'conflict'

export const useHolidayAdminStore = defineStore('holiday-admin', () => {
  const remoteHolidays = shallowRef<HolidayAdminRecord[]>([])
  const initialized = shallowRef(false)
  const loading = shallowRef(false)
  const saving = shallowRef(false)
  const deletingIds = shallowRef<Set<number>>(new Set())
  const errorKey = shallowRef<string | null>(null)
  const conflict = shallowRef<HolidayConflictResponse | null>(null)

  const holidays = computed(() => [...remoteHolidays.value].sort(compareHolidayAdminRecords))

  async function loadHolidays() {
    const auth = useAuthStore()

    loading.value = true
    errorKey.value = null

    try {
      remoteHolidays.value = [...await fetchAdminHolidays()].sort(compareHolidayAdminRecords)
      initialized.value = true
      return 'success' satisfies HolidayAdminPersistenceResult
    } catch (error) {
      if (isAuthRequiredApiError(error)) {
        auth.markSessionExpired()
        initialized.value = true
        errorKey.value = 'admin.holidays.authExpired'
        return 'auth-expired' satisfies HolidayAdminPersistenceResult
      }

      errorKey.value = 'admin.holidays.loadFailed'
      initialized.value = true
      return 'failed' satisfies HolidayAdminPersistenceResult
    } finally {
      loading.value = false
    }
  }

  async function createHoliday(input: HolidayCreateRequest) {
    saving.value = true
    errorKey.value = null
    conflict.value = null

    try {
      upsertHoliday(await createAdminHoliday(input))
      return 'success' satisfies HolidayAdminPersistenceResult
    } catch (error) {
      return handleMutationError(error, 'admin.holidays.saveFailed')
    } finally {
      saving.value = false
    }
  }

  async function updateHoliday(id: number, input: HolidayUpdateRequest) {
    saving.value = true
    errorKey.value = null
    conflict.value = null

    try {
      upsertHoliday(await updateAdminHoliday(id, input))
      return 'success' satisfies HolidayAdminPersistenceResult
    } catch (error) {
      return handleMutationError(error, 'admin.holidays.saveFailed')
    } finally {
      saving.value = false
    }
  }

  async function deleteHoliday(record: HolidayAdminRecord) {
    setDeleting(record.id, true)
    errorKey.value = null
    conflict.value = null

    try {
      await deleteAdminHoliday(record.id, record.version)
      remoteHolidays.value = remoteHolidays.value.filter(holiday => holiday.id !== record.id)
      return 'success' satisfies HolidayAdminPersistenceResult
    } catch (error) {
      return handleMutationError(error, 'admin.holidays.deleteFailed')
    } finally {
      setDeleting(record.id, false)
    }
  }

  function clearNotice() {
    errorKey.value = null
    conflict.value = null
  }

  function resetState() {
    remoteHolidays.value = []
    initialized.value = false
    loading.value = false
    saving.value = false
    deletingIds.value = new Set()
    errorKey.value = null
    conflict.value = null
  }

  function handleMutationError(error: unknown, fallbackErrorKey: string): HolidayAdminPersistenceResult {
    const auth = useAuthStore()

    if (isAuthRequiredApiError(error)) {
      auth.markSessionExpired()
      errorKey.value = 'admin.holidays.authExpired'
      return 'auth-expired'
    }

    const holidayConflict = extractHolidayConflict(error)

    if (holidayConflict) {
      conflict.value = holidayConflict
      upsertHoliday(holidayConflict.serverHoliday)
      return 'conflict'
    }

    errorKey.value = fallbackErrorKey
    return 'failed'
  }

  function upsertHoliday(record: HolidayAdminRecord) {
    const records = remoteHolidays.value.filter(holiday => holiday.id !== record.id)
    records.push(record)
    remoteHolidays.value = records.sort(compareHolidayAdminRecords)
  }

  function setDeleting(id: number, deleting: boolean) {
    const nextIds = new Set(deletingIds.value)

    if (deleting) {
      nextIds.add(id)
    } else {
      nextIds.delete(id)
    }

    deletingIds.value = nextIds
  }

  return {
    conflict,
    deletingIds,
    errorKey,
    holidays,
    initialized,
    loading,
    remoteHolidays,
    saving,
    clearNotice,
    createHoliday,
    deleteHoliday,
    loadHolidays,
    resetState,
    updateHoliday
  }
})

export function compareHolidayAdminRecords(left: HolidayAdminRecord, right: HolidayAdminRecord) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder
  }

  return left.holidayKey.localeCompare(right.holidayKey)
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useHolidayAdminStore, import.meta.hot))
}
