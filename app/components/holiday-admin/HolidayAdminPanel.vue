<script setup lang="ts">
import { storeToRefs } from 'pinia'
import HolidayAdminFormModal from './HolidayAdminFormModal.vue'
import HolidayAdminTable from './HolidayAdminTable.vue'
import type { HolidayAdminRecord, HolidayCreateRequest, HolidayUpdateRequest } from '~/types/hdx-api'

const store = useHolidayAdminStore()
const { t } = useI18n()
const { conflict, deletingIds, errorKey, holidays, initialized, loading, saving } = storeToRefs(store)
const topbarActionsReady = shallowRef(false)
const search = shallowRef('')
const statusFilter = shallowRef<'all' | 'enabled' | 'disabled'>('all')
const formOpen = shallowRef(false)
const editingHoliday = shallowRef<HolidayAdminRecord | null>(null)
const deleteTarget = shallowRef<HolidayAdminRecord | null>(null)
const deleteDialogOpen = computed({
  get: () => Boolean(deleteTarget.value),
  set: (open: boolean) => {
    if (!open) {
      deleteTarget.value = null
    }
  }
})

const statusFilterItems = computed(() => [
  { label: t('admin.holidays.filters.all'), value: 'all' },
  { label: t('admin.holidays.filters.enabled'), value: 'enabled' },
  { label: t('admin.holidays.filters.disabled'), value: 'disabled' }
])

const visibleHolidays = computed(() => {
  const keyword = search.value.trim().toLowerCase()

  return holidays.value.filter((holiday) => {
    const matchesKeyword = !keyword
      || holiday.displayName.toLowerCase().includes(keyword)
      || holiday.holidayKey.toLowerCase().includes(keyword)
      || (holiday.description?.toLowerCase().includes(keyword) ?? false)
    const matchesStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'enabled' && holiday.enabled)
      || (statusFilter.value === 'disabled' && !holiday.enabled)

    return matchesKeyword && matchesStatus
  })
})

const noticeKey = computed(() => errorKey.value)

function openCreateForm() {
  store.clearNotice()
  editingHoliday.value = null
  formOpen.value = true
}

function openEditForm(record: HolidayAdminRecord) {
  store.clearNotice()
  editingHoliday.value = record
  formOpen.value = true
}

async function submitHoliday(input: HolidayCreateRequest | HolidayUpdateRequest) {
  const result = editingHoliday.value
    ? await store.updateHoliday(editingHoliday.value.id, input as HolidayUpdateRequest)
    : await store.createHoliday(input as HolidayCreateRequest)

  if (result === 'success') {
    formOpen.value = false
    editingHoliday.value = null
  }

  if (result === 'conflict' && conflict.value) {
    editingHoliday.value = conflict.value.serverHoliday
  }
}

async function confirmDelete() {
  if (!deleteTarget.value) {
    return
  }

  const result = await store.deleteHoliday(deleteTarget.value)

  if (result === 'success') {
    deleteTarget.value = null
  }
}

onMounted(() => {
  topbarActionsReady.value = true
})
</script>

<template>
  <section class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
    <Teleport v-if="topbarActionsReady" to="#workbench-topbar-actions">
      <UTooltip :text="t('admin.holidays.refresh')">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          :aria-label="t('admin.holidays.refresh')"
          :loading="loading"
          class="hdx-toolbar-button cursor-pointer"
          @click="store.loadHolidays()"
        />
      </UTooltip>
      <UButton
        type="button"
        color="primary"
        variant="soft"
        icon="i-lucide-plus"
        class="workbench-edit-button hidden cursor-pointer sm:inline-flex"
        @click="openCreateForm"
      >
        {{ t('admin.holidays.create') }}
      </UButton>
      <UTooltip :text="t('admin.holidays.create')">
        <UButton
          type="button"
          color="primary"
          variant="soft"
          icon="i-lucide-plus"
          :aria-label="t('admin.holidays.create')"
          class="hdx-toolbar-button cursor-pointer sm:hidden"
          @click="openCreateForm"
        />
      </UTooltip>
    </Teleport>

    <div class="grid gap-3">
      <div class="flex min-w-0 flex-wrap items-end gap-3">
        <div class="min-w-60 flex-1">
          <p class="text-xs font-medium text-primary">
            {{ t('admin.title') }}
          </p>
          <h2 class="mt-1 text-2xl font-semibold tracking-normal text-highlighted">
            {{ t('admin.holidays.title') }}
          </h2>
          <p class="mt-1 max-w-2xl text-sm text-muted">
            {{ t('admin.holidays.description') }}
          </p>
        </div>

        <div class="flex w-full flex-col gap-2 sm:w-auto sm:min-w-96 sm:flex-row">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="t('admin.holidays.search')"
            class="min-w-0 flex-1"
          />
          <USelect
            v-model="statusFilter"
            :items="statusFilterItems"
            value-key="value"
            class="sm:w-36"
          />
        </div>
      </div>

      <UAlert
        v-if="noticeKey"
        color="warning"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :title="t(noticeKey)"
      />

      <UAlert
        v-if="conflict"
        color="warning"
        variant="soft"
        icon="i-lucide-git-compare-arrows"
        :title="t('admin.holidays.conflictTitle')"
        :description="t('admin.holidays.conflictDescription', { name: conflict.resourceLabel, version: conflict.currentVersion })"
      />
    </div>

    <div class="min-h-0 overflow-auto border border-white/62 bg-white/58 shadow-xl shadow-cyan-950/7 backdrop-blur-2xl hdx-radius-panel dark:border-white/14 dark:bg-white/8 dark:shadow-black/28">
      <HolidayAdminTable
        :records="visibleHolidays"
        :loading="loading && !initialized"
        :deleting-ids="deletingIds"
        @edit="openEditForm"
        @delete="deleteTarget = $event"
      />
    </div>

    <HolidayAdminFormModal
      v-model:open="formOpen"
      :holiday="editingHoliday"
      :submitting="saving"
      @submit="submitHoliday"
    />

    <UModal
      v-model:open="deleteDialogOpen"
      :title="t('admin.holidays.deleteTitle')"
      :description="deleteTarget ? t('admin.holidays.deleteDescription', { name: deleteTarget.displayName }) : ''"
      :ui="{ content: 'hdx-radius-popover', footer: 'justify-end' }"
    >
      <template #footer="{ close }">
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          class="cursor-pointer"
          @click="close"
        >
          {{ t('admin.holidays.cancel') }}
        </UButton>
        <UButton
          type="button"
          color="error"
          icon="i-lucide-trash-2"
          :loading="deleteTarget ? deletingIds.has(deleteTarget.id) : false"
          class="cursor-pointer"
          @click="confirmDelete"
        >
          {{ t('admin.holidays.delete') }}
        </UButton>
      </template>
    </UModal>
  </section>
</template>
