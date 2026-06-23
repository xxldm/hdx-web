<script setup lang="ts">
import hdxIcon from '~/assets/brand/hdx-icon.png'
import ThemeSettingsPopover from '~/components/theme/ThemeSettingsPopover.vue'
import { normalizeInternalRedirect } from '~/utils/internal-redirect'

const { t } = useI18n()
const { locale, setPreferredLocale } = useLocalePreference()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const desktopOnline = useDesktopOnlineStore()

definePageMeta({
  layout: false
})

const localeItems = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
]
const localeMenuOpen = ref(false)
const localeMenuItems = computed(() => localeItems.map((item) => ({
  label: item.label,
  icon: 'i-lucide-languages',
  selected: locale.value === item.value,
  onSelect: () => {
    void setPreferredLocale(item.value)
    localeMenuOpen.value = false
  }
})))
const form = reactive({
  identifier: '',
  password: ''
})
const showPassword = ref(false)
const formErrorKey = ref<string | null>(null)
const redirectPath = computed(() => normalizeInternalRedirect(route.query.redirect))
const loginDisabled = computed(() => desktopOnline.available && !desktopOnline.configured)
const loginPanelElement = ref<HTMLElement | null>(null)

onMounted(() => {
  void desktopOnline.loadConfig()

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.requestAnimationFrame(() => {
      loginPanelElement.value?.querySelector<HTMLInputElement>('input[autocomplete="username"]')?.focus()
    })
  }
})

async function submitLogin() {
  formErrorKey.value = null

  if (loginDisabled.value) {
    formErrorKey.value = 'desktopOnline.configRequired'
    return
  }

  try {
    await auth.login(form)
    await router.push(redirectPath.value)
  } catch {
    formErrorKey.value = auth.errorKey ?? 'auth.loginFailed'
  }
}

async function saveOnlineConfig() {
  try {
    await desktopOnline.saveConfig()
  } catch {
    // 错误信息已由 desktopOnline store 收敛到页面状态。
  }
}

async function checkOnlineConnection() {
  try {
    await desktopOnline.checkConnection()
  } catch {
    // 错误信息已由 desktopOnline store 收敛到页面状态。
  }
}

useSeoMeta({
  title: () => t('auth.loginTitle'),
  description: () => t('auth.loginDescription')
})
</script>

<template>
  <main class="hdx-app-scene hdx-app-scene-login login-shell relative min-h-screen overflow-hidden text-slate-950 transition-colors duration-300 dark:text-white">
    <div class="hdx-app-backdrop absolute inset-0" />
    <div class="hdx-app-liquid-field" />
    <div class="hdx-app-grid-lines" />

    <section class="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl items-center gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(23rem,27rem)] lg:px-8">
      <aside class="hidden min-w-0 lg:grid lg:gap-5">
        <div class="grid gap-5">
          <div class="login-brand-mark grid size-20 place-items-center overflow-hidden border border-slate-900/10 bg-white/45 p-2.5 shadow-2xl shadow-cyan-900/10 backdrop-blur-2xl hdx-radius-hero dark:border-white/20 dark:bg-white/12 dark:shadow-cyan-950/30">
            <img
              :src="hdxIcon"
              :alt="t('app.iconAlt')"
              width="394"
              height="394"
              class="size-full rounded-full object-contain"
            >
          </div>
          <div class="max-w-xl">
            <p class="login-brand-subtitle text-sm font-medium">
              {{ t('app.name') }}
            </p>
            <h1 class="mt-3 text-5xl font-semibold leading-tight tracking-normal text-slate-950 dark:text-white">
              {{ t('auth.loginHeroTitle') }}
            </h1>
          </div>
        </div>
      </aside>

      <div class="relative mx-auto w-full max-w-[27rem]">
        <div class="login-panel-glow" />
        <div ref="loginPanelElement" class="login-panel relative box-border w-full min-w-0 overflow-hidden border border-white/65 bg-white/70 p-4 shadow-2xl shadow-cyan-950/10 backdrop-blur-2xl hdx-radius-hero dark:border-white/28 dark:bg-white/18 dark:shadow-slate-950/35 sm:p-6">
          <div class="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />

          <header class="mb-6 grid gap-4">
            <div class="flex items-start justify-between gap-4">
              <div class="grid gap-2">
                <h2 class="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white">
                  {{ t('auth.loginPanelTitle') }}
                </h2>
              </div>
              <div class="login-panel-tools flex shrink-0 items-center gap-1.5 border border-slate-900/10 bg-white/65 p-1 text-slate-700 shadow-lg shadow-cyan-950/10 backdrop-blur-2xl hdx-radius-popover dark:border-white/25 dark:bg-white/18 dark:text-white dark:shadow-cyan-950/25">
                <UDropdownMenu
                  v-model:open="localeMenuOpen"
                  :items="localeMenuItems"
                  :content="{ align: 'end' }"
                  :ui="{ content: 'hdx-floating-menu hdx-radius-popover' }"
                >
                  <UTooltip :text="t('actions.language')">
                    <UButton
                      type="button"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      icon="i-lucide-languages"
                      :aria-label="t('actions.language')"
                      class="hdx-toolbar-button cursor-pointer"
                    />
                  </UTooltip>
                  <template #item-trailing="{ item }">
                    <UIcon
                      v-if="item.selected"
                      name="i-lucide-check"
                      class="size-4 text-primary"
                    />
                  </template>
                </UDropdownMenu>
                <ThemeSettingsPopover
                  color-mode-only
                  button-class="hdx-toolbar-button cursor-pointer"
                  content-class="hdx-floating-menu hdx-radius-popover"
                />
              </div>
            </div>
            <p class="text-sm leading-6 text-slate-600 dark:text-white/76">
              {{ t('auth.loginDescription') }}
            </p>
          </header>

          <UAlert
            v-if="formErrorKey"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :title="t('auth.loginFailedTitle')"
            :description="t(formErrorKey)"
            class="mb-4"
          />

          <section v-if="desktopOnline.available" class="mb-5 grid gap-3 border-y border-slate-900/10 py-4 dark:border-white/15">
            <div class="flex items-center justify-between gap-3">
              <h2 class="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <UIcon name="i-lucide-radio-tower" class="size-4 text-primary" />
                {{ t('desktopOnline.title') }}
              </h2>
              <UBadge :color="desktopOnline.configured ? 'success' : 'warning'" variant="soft">
                {{ desktopOnline.configured ? t('desktopOnline.configured') : t('desktopOnline.notConfigured') }}
              </UBadge>
            </div>

            <UAlert
              v-if="desktopOnline.errorMessage"
              color="error"
              variant="soft"
              icon="i-lucide-circle-alert"
              :title="t('desktopOnline.configError')"
              :description="desktopOnline.errorMessage"
            />
            <UAlert
              v-else-if="desktopOnline.statusMessage"
              :color="desktopOnline.checkResult?.ok === false ? 'warning' : 'success'"
              variant="soft"
              icon="i-lucide-plug-zap"
              :title="t('desktopOnline.status')"
              :description="desktopOnline.statusMessage"
            />

            <div class="grid gap-3">
              <UFormField :label="t('desktopOnline.authBaseUrl')">
                <UInput
                  v-model="desktopOnline.form.authBaseUrl"
                  type="url"
                  inputmode="url"
                  autocomplete="url"
                  placeholder="https://auth.example.com"
                  icon="i-lucide-key-round"
                  class="w-full"
                />
              </UFormField>
              <UFormField :label="t('desktopOnline.gatewayBaseUrl')">
                <UInput
                  v-model="desktopOnline.form.gatewayBaseUrl"
                  type="url"
                  inputmode="url"
                  autocomplete="url"
                  placeholder="https://api.example.com"
                  icon="i-lucide-network"
                  class="w-full"
                />
              </UFormField>
              <UFormField :label="t('desktopOnline.timeoutSeconds')">
                <UInput
                  v-model.number="desktopOnline.form.requestTimeoutSeconds"
                  type="number"
                  min="1"
                  max="60"
                  icon="i-lucide-timer"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                leading-icon="i-lucide-plug-zap"
                :loading="desktopOnline.checking"
                class="cursor-pointer justify-center"
                @click="checkOnlineConnection"
              >
                {{ t('desktopOnline.checkAction') }}
              </UButton>
              <UButton
                type="button"
                color="primary"
                variant="soft"
                leading-icon="i-lucide-save"
                :loading="desktopOnline.saving"
                class="cursor-pointer justify-center"
                @click="saveOnlineConfig"
              >
                {{ t('desktopOnline.saveAction') }}
              </UButton>
            </div>

            <dl v-if="desktopOnline.checkResult" class="grid gap-2 text-xs text-slate-600 dark:text-white/75">
              <div class="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
                <dt>{{ t('desktopOnline.authCheck') }}</dt>
                <dd class="truncate">
                  {{ desktopOnline.checkResult.auth.message }}
                </dd>
              </div>
              <div class="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
                <dt>{{ t('desktopOnline.gatewayCheck') }}</dt>
                <dd class="truncate">
                  {{ desktopOnline.checkResult.gateway.message }}
                </dd>
              </div>
            </dl>
          </section>

          <form
            class="grid gap-4"
            method="post"
            action="/login"
            @submit.prevent="submitLogin"
          >
            <UFormField :label="t('auth.identifier')">
              <UInput
                v-model="form.identifier"
                type="text"
                autocomplete="username"
                :placeholder="t('auth.identifierPlaceholder')"
                icon="i-lucide-user"
                class="w-full"
                required
              />
            </UFormField>

            <UFormField :label="t('auth.password')">
              <UInput
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                :placeholder="t('auth.passwordPlaceholder')"
                icon="i-lucide-lock-keyhole"
                class="w-full"
                required
              >
                <template #trailing>
                  <UButton
                    type="button"
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
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
              leading-icon="i-lucide-log-in"
              :loading="auth.loginLoading"
              :disabled="loginDisabled"
              class="login-action mt-2 w-full cursor-pointer justify-center"
            >
              {{ t('auth.loginAction') }}
            </UButton>
          </form>
        </div>
      </div>
    </section>
  </main>
</template>

<style>
.login-panel-glow {
  position: absolute;
  inset: -1.5rem;
  border-radius: var(--hdx-radius-hero);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(var(--hdx-theme-accent-rgb), 0.18) 52%, rgba(var(--hdx-theme-warm-rgb), 0.14)),
    linear-gradient(45deg, rgba(var(--hdx-theme-primary-rgb), 0.18), transparent 56%);
  opacity: 0.68;
  filter: blur(20px);
}

.dark .login-panel-glow {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(var(--hdx-theme-primary-rgb), 0.2) 52%, rgba(var(--hdx-theme-warm-rgb), 0.12)),
    linear-gradient(45deg, rgba(var(--hdx-theme-accent-rgb), 0.12), transparent 58%);
  opacity: 0.56;
}

.login-panel {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.48)),
    linear-gradient(315deg, rgba(var(--hdx-theme-accent-rgb), 0.16), rgba(var(--hdx-theme-primary-rgb), 0.08));
}

.login-brand-subtitle {
  color: color-mix(in srgb, var(--hdx-theme-primary) 76%, #155e75);
}

.dark .login-brand-subtitle {
  color: color-mix(in srgb, var(--hdx-theme-primary) 58%, #cffafe);
}

.login-brand-mark {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.45),
    0 24px 58px rgba(8, 47, 73, 0.18);
}

.dark .login-brand-mark {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    0 24px 58px rgba(8, 47, 73, 0.34);
}

.dark .login-panel {
  background:
    linear-gradient(145deg, rgba(22, 21, 24, 0.86), rgba(18, 17, 20, 0.66)),
    linear-gradient(315deg, rgba(var(--hdx-theme-primary-rgb), 0.14), rgba(var(--hdx-theme-warm-rgb), 0.08));
}

.login-panel label {
  color: rgba(15, 23, 42, 0.78);
  font-weight: 600;
}

.login-panel input {
  border-color: rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.82);
  color: #0f172a;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.1);
}

.login-panel input::placeholder {
  color: #64748b;
}

.login-panel input:focus {
  border-color: rgba(var(--hdx-theme-primary-rgb), 0.72);
  box-shadow:
    0 0 0 3px rgba(var(--hdx-theme-primary-rgb), 0.18),
    0 16px 36px rgba(15, 23, 42, 0.14);
}

.dark .login-panel label {
  color: rgba(255, 255, 255, 0.82);
}

.dark .login-panel input {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(15, 23, 42, 0.72);
  color: rgba(255, 255, 255, 0.94);
  box-shadow: 0 16px 36px rgba(2, 6, 23, 0.28);
}

.dark .login-panel input::placeholder {
  color: rgba(203, 213, 225, 0.72);
}

.dark .login-panel input:focus {
  border-color: rgba(var(--hdx-theme-primary-rgb), 0.72);
  box-shadow:
    0 0 0 3px rgba(var(--hdx-theme-primary-rgb), 0.16),
    0 16px 36px rgba(2, 6, 23, 0.36);
}

.login-action {
  box-shadow: 0 18px 44px rgba(var(--hdx-theme-primary-rgb), 0.22);
}

.dark .login-action {
  box-shadow: 0 18px 44px rgba(var(--hdx-theme-primary-rgb), 0.28);
}
</style>
