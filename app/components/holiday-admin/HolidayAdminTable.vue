<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { HolidayAdminRecord } from '~/types/hdx-api'

defineProps<{
  records: HolidayAdminRecord[]
  loading?: boolean
  deletingIds: Set<number>
}>()

const emit = defineEmits<{
  edit: [record: HolidayAdminRecord]
  delete: [record: HolidayAdminRecord]
}>()

const { t } = useI18n()

const columns = computed<TableColumn<HolidayAdminRecord>[]>(() => [
  {
    accessorKey: 'displayName',
    header: t('admin.holidays.fields.name')
  },
  {
    accessorKey: 'date',
    header: t('admin.holidays.fields.date')
  },
  {
    accessorKey: 'recurring',
    header: t('admin.holidays.fields.recurring')
  },
  {
    accessorKey: 'enabled',
    header: t('admin.holidays.fields.enabled')
  },
  {
    accessorKey: 'sortOrder',
    header: t('admin.holidays.fields.sortOrder')
  },
  {
    accessorKey: 'updatedAt',
    header: t('admin.holidays.fields.updatedAt')
  },
  {
    id: 'actions',
    header: ''
  }
])

function formatUpdatedAt(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}
</script>

<template>
  <UTable
    :data="records"
    :columns="columns"
    :loading="loading"
    class="holiday-admin-table"
  >
    <template #displayName-cell="{ row }">
      <div class="min-w-0">
        <p class="truncate font-medium text-highlighted">
          {{ row.original.displayName }}
        </p>
        <p class="mt-0.5 truncate text-xs text-muted">
          {{ row.original.holidayKey }}
        </p>
      </div>
    </template>

    <template #date-cell="{ row }">
      <span class="font-mono text-sm text-default">{{ row.original.date }}</span>
    </template>

    <template #recurring-cell="{ row }">
      <UBadge
        :color="row.original.recurring ? 'primary' : 'neutral'"
        variant="subtle"
        :label="row.original.recurring ? t('admin.holidays.recurring') : t('admin.holidays.oneOff')"
      />
    </template>

    <template #enabled-cell="{ row }">
      <UBadge
        :color="row.original.enabled ? 'success' : 'neutral'"
        variant="subtle"
        :label="row.original.enabled ? t('admin.holidays.enabled') : t('admin.holidays.disabled')"
      />
    </template>

    <template #updatedAt-cell="{ row }">
      <span class="text-sm text-muted">{{ formatUpdatedAt(row.original.updatedAt) }}</span>
    </template>

    <template #actions-cell="{ row }">
      <div class="flex justify-end gap-1">
        <UTooltip :text="t('admin.holidays.edit')">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            icon="i-lucide-pencil"
            :aria-label="t('admin.holidays.edit')"
            class="hdx-toolbar-button cursor-pointer"
            @click="emit('edit', row.original)"
          />
        </UTooltip>
        <UTooltip :text="t('admin.holidays.delete')">
          <UButton
            type="button"
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            :aria-label="t('admin.holidays.delete')"
            :loading="deletingIds.has(row.original.id)"
            class="hdx-toolbar-button cursor-pointer"
            @click="emit('delete', row.original)"
          />
        </UTooltip>
      </div>
    </template>

    <template #empty>
      <div class="grid min-h-44 place-items-center text-center">
        <div>
          <UIcon name="i-lucide-calendar-x" class="mx-auto size-8 text-muted" />
          <p class="mt-3 text-sm font-medium text-default">
            {{ t('admin.holidays.empty') }}
          </p>
        </div>
      </div>
    </template>
  </UTable>
</template>

<style scoped>
.holiday-admin-table {
  min-width: 100%;
}
</style>
