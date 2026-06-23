<script setup lang="ts">
import HolidayAdminPanel from '~/components/holiday-admin/HolidayAdminPanel.vue'

const { t } = useI18n()
const auth = useAuthStore()
const holidayAdmin = useHolidayAdminStore()
const actorScope = auth.session?.subject ?? 'anonymous'

await callOnce(`holiday-admin:${actorScope}`, () => holidayAdmin.loadHolidays(), { mode: 'navigation' })

useSeoMeta({
  title: () => t('admin.holidays.title'),
  description: () => t('admin.holidays.description')
})
</script>

<template>
  <HolidayAdminPanel />
</template>
