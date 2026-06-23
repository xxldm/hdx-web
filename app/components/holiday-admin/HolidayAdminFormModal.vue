<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { reactive } from 'vue'
import { z } from 'zod'
import type { HolidayAdminRecord, HolidayCreateRequest, HolidayUpdateRequest } from '~/types/hdx-api'

const props = defineProps<{
  holiday: HolidayAdminRecord | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  submit: [value: HolidayCreateRequest | HolidayUpdateRequest]
}>()

const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()

const schema = z.object({
  holidayKey: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,79}$/, t('admin.holidays.validation.key')),
  displayName: z.string().trim().min(1, t('admin.holidays.validation.name')).max(120, t('admin.holidays.validation.nameLength')),
  description: z.string().trim().max(500, t('admin.holidays.validation.descriptionLength')),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('admin.holidays.validation.date')),
  recurring: z.boolean(),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999)
})

type HolidayFormState = z.output<typeof schema>

const state = reactive<HolidayFormState>(createInitialState(null))
const isEditing = computed(() => Boolean(props.holiday))

watch(
  () => [props.holiday, open.value] as const,
  ([holiday, isOpen]) => {
    if (isOpen) {
      Object.assign(state, createInitialState(holiday))
    }
  },
  { immediate: true }
)

function submitForm(event: FormSubmitEvent<HolidayFormState>) {
  const description = event.data.description.trim() || null

  if (props.holiday) {
    emit('submit', {
      version: props.holiday.version,
      displayName: event.data.displayName.trim(),
      description,
      date: event.data.date,
      recurring: event.data.recurring,
      enabled: event.data.enabled,
      sortOrder: event.data.sortOrder
    })
    return
  }

  emit('submit', {
    holidayKey: event.data.holidayKey.trim(),
    displayName: event.data.displayName.trim(),
    description,
    date: event.data.date,
    recurring: event.data.recurring,
    enabled: event.data.enabled,
    sortOrder: event.data.sortOrder
  })
}

function createInitialState(holiday: HolidayAdminRecord | null): HolidayFormState {
  return {
    holidayKey: holiday?.holidayKey ?? '',
    displayName: holiday?.displayName ?? '',
    description: holiday?.description ?? '',
    date: holiday?.date ?? '',
    recurring: holiday?.recurring ?? true,
    enabled: holiday?.enabled ?? true,
    sortOrder: holiday?.sortOrder ?? 0
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEditing ? t('admin.holidays.editTitle') : t('admin.holidays.createTitle')"
    :description="isEditing ? t('admin.holidays.editDescription') : t('admin.holidays.createDescription')"
    :ui="{ content: 'hdx-radius-popover', footer: 'justify-end' }"
  >
    <template #body>
      <UForm
        id="holiday-admin-form"
        :schema="schema"
        :state="state"
        class="grid gap-4"
        @submit="submitForm"
      >
        <UFormField name="holidayKey" :label="t('admin.holidays.fields.key')" required>
          <UInput
            v-model="state.holidayKey"
            :disabled="isEditing"
            placeholder="new-year"
            class="w-full"
          />
        </UFormField>

        <UFormField name="displayName" :label="t('admin.holidays.fields.name')" required>
          <UInput v-model="state.displayName" class="w-full" />
        </UFormField>

        <UFormField name="date" :label="t('admin.holidays.fields.date')" required>
          <UInput v-model="state.date" type="date" class="w-full" />
        </UFormField>

        <UFormField name="description" :label="t('admin.holidays.fields.description')">
          <UTextarea v-model="state.description" autoresize :maxrows="4" class="w-full" />
        </UFormField>

        <div class="grid gap-3 sm:grid-cols-[1fr_1fr_9rem]">
          <UFormField name="recurring" :label="t('admin.holidays.fields.recurring')">
            <USwitch v-model="state.recurring" :label="t('admin.holidays.fields.recurringHint')" />
          </UFormField>

          <UFormField name="enabled" :label="t('admin.holidays.fields.enabled')">
            <USwitch v-model="state.enabled" :label="t('admin.holidays.fields.enabledHint')" />
          </UFormField>

          <UFormField name="sortOrder" :label="t('admin.holidays.fields.sortOrder')" required>
            <UInputNumber v-model="state.sortOrder" :min="0" :max="9999" class="w-full" />
          </UFormField>
        </div>
      </UForm>
    </template>

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
        type="submit"
        form="holiday-admin-form"
        color="primary"
        icon="i-lucide-save"
        :loading="submitting"
        class="cursor-pointer"
      >
        {{ t('admin.holidays.save') }}
      </UButton>
    </template>
  </UModal>
</template>
