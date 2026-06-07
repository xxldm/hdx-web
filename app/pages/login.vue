<script setup lang="ts">
import loginBackground from '~/assets/images/login-background.bmp'
import { normalizeInternalRedirect } from '~/utils/internal-redirect'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  identifier: '',
  password: ''
})
const showPassword = ref(false)
const formErrorKey = ref<string | null>(null)
const redirectPath = computed(() => normalizeInternalRedirect(route.query.redirect))

async function submitLogin() {
  formErrorKey.value = null

  try {
    await auth.login(form)
    await router.push(redirectPath.value)
  } catch {
    formErrorKey.value = auth.errorKey ?? 'auth.loginFailed'
  }
}

useSeoMeta({
  title: () => t('auth.loginTitle'),
  description: () => t('auth.loginDescription')
})
</script>

<template>
  <main class="relative grid min-h-screen overflow-hidden bg-neutral-950 text-white">
    <img
      :src="loginBackground"
      :alt="t('auth.backgroundAlt')"
      class="absolute inset-0 h-full w-full object-cover"
    >
    <div class="absolute inset-0 bg-neutral-950/35" />

    <section class="relative z-10 box-border flex min-h-screen w-full items-center justify-center px-4 py-8">
      <div class="box-border w-full min-w-0 max-w-[21rem] rounded-lg border border-white/35 bg-white/20 p-5 shadow-2xl shadow-neutral-950/25 backdrop-blur-xl sm:max-w-[26rem] sm:p-8">
        <div class="mb-6 grid gap-2">
          <div class="grid size-11 place-items-center rounded-lg bg-primary-600 text-white">
            <UIcon name="lucide:box" class="size-5" />
          </div>
          <p class="text-sm font-medium text-white/75">
            {{ t('app.subtitle') }}
          </p>
          <h1 class="text-2xl font-semibold tracking-normal text-white">
            {{ t('auth.loginTitle') }}
          </h1>
          <p class="text-sm leading-6 text-white/75">
            {{ t('auth.loginDescription') }}
          </p>
        </div>

        <UAlert
          v-if="formErrorKey"
          color="error"
          variant="soft"
          icon="lucide:circle-alert"
          :title="t('auth.loginFailedTitle')"
          :description="t(formErrorKey)"
          class="mb-4"
        />

        <form class="grid gap-4" @submit.prevent="submitLogin">
          <UFormField :label="t('auth.identifier')">
            <UInput
              v-model="form.identifier"
              name="identifier"
              type="text"
              autocomplete="username"
              :placeholder="t('auth.identifierPlaceholder')"
              icon="lucide:user"
              class="w-full"
              required
              autofocus
            />
          </UFormField>

          <UFormField :label="t('auth.password')">
            <UInput
              v-model="form.password"
              name="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              :placeholder="t('auth.passwordPlaceholder')"
              icon="lucide:lock-keyhole"
              class="w-full"
              required
            >
              <template #trailing>
                <UButton
                  type="button"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  :icon="showPassword ? 'lucide:eye-off' : 'lucide:eye'"
                  :aria-label="showPassword ? t('auth.hidePassword') : t('auth.showPassword')"
                  class="cursor-pointer"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>
          </UFormField>

          <UButton
            type="submit"
            color="primary"
            size="lg"
            leading-icon="lucide:log-in"
            :loading="auth.loginLoading"
            class="mt-2 w-full cursor-pointer justify-center"
          >
            {{ t('auth.loginAction') }}
          </UButton>
        </form>
      </div>
    </section>
  </main>
</template>
