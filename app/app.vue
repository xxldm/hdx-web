<script setup lang="ts">
import { en, zh_cn } from '@nuxt/ui/locale'

const { locale } = useI18n()

const nuxtUiLocale = computed(() => locale.value === 'en-US' ? en : zh_cn)
const htmlLang = computed(() => locale.value === 'en-US' ? 'en-US' : 'zh-CN')
const htmlDir = computed(() => nuxtUiLocale.value.dir)

useHead({
  htmlAttrs: {
    lang: htmlLang,
    dir: htmlDir
  }
})
</script>

<template>
  <UApp :locale="nuxtUiLocale">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
