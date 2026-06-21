<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => t('workbench.navigation.items.settings.title'),
  description: () => t('workbench.navigation.items.settings.description')
})
</script>

<template>
  <section class="h-full min-h-0 overflow-hidden" />
</template>
