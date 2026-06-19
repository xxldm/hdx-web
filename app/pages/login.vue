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

const localeItems = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
]
const localeMenuOpen = ref(false)
const localeMenuItems = computed(() => localeItems.map((item) => ({
  label: item.label,
  icon: 'lucide:languages',
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
      loginPanelElement.value?.querySelector<HTMLInputElement>('input[name="identifier"]')?.focus()
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
  <main class="login-shell relative min-h-screen overflow-hidden text-slate-950 transition-colors duration-300 dark:text-white">
    <div class="login-backdrop absolute inset-0" />
    <div class="login-liquid-field" />
    <div class="login-glass-grid" />

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
                <UTooltip :text="t('actions.language')">
                  <UDropdownMenu
                    v-model:open="localeMenuOpen"
                    :items="localeMenuItems"
                    :content="{ align: 'end' }"
                    :ui="{ content: 'login-floating-menu hdx-radius-popover' }"
                  >
                    <UButton
                      type="button"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      icon="lucide:languages"
                      :aria-label="t('actions.language')"
                      class="login-tool-button cursor-pointer"
                    />
                    <template #item-trailing="{ item }">
                      <UIcon
                        v-if="item.selected"
                        name="lucide:check"
                        class="size-4 text-primary"
                      />
                    </template>
                  </UDropdownMenu>
                </UTooltip>
                <ThemeSettingsPopover
                  color-mode-only
                  button-class="login-tool-button cursor-pointer"
                  content-class="login-floating-menu hdx-radius-popover"
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
            icon="lucide:circle-alert"
            :title="t('auth.loginFailedTitle')"
            :description="t(formErrorKey)"
            class="mb-4"
          />

          <section v-if="desktopOnline.available" class="mb-5 grid gap-3 border-y border-slate-900/10 py-4 dark:border-white/15">
            <div class="flex items-center justify-between gap-3">
              <h2 class="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <UIcon name="lucide:radio-tower" class="size-4 text-primary" />
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
              icon="lucide:circle-alert"
              :title="t('desktopOnline.configError')"
              :description="desktopOnline.errorMessage"
            />
            <UAlert
              v-else-if="desktopOnline.statusMessage"
              :color="desktopOnline.checkResult?.ok === false ? 'warning' : 'success'"
              variant="soft"
              icon="lucide:plug-zap"
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
                  icon="lucide:key-round"
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
                  icon="lucide:network"
                  class="w-full"
                />
              </UFormField>
              <UFormField :label="t('desktopOnline.timeoutSeconds')">
                <UInput
                  v-model.number="desktopOnline.form.requestTimeoutSeconds"
                  type="number"
                  min="1"
                  max="60"
                  icon="lucide:timer"
                  class="w-full"
                />
              </UFormField>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <UButton
                type="button"
                color="neutral"
                variant="soft"
                leading-icon="lucide:plug-zap"
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
                leading-icon="lucide:save"
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
.login-shell::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
  background:
    linear-gradient(122deg, transparent 0 20%, rgba(var(--hdx-theme-accent-rgb), 0.12) 28%, transparent 45%),
    linear-gradient(42deg, transparent 0 34%, rgba(var(--hdx-theme-warm-rgb), 0.1) 47%, transparent 64%),
    conic-gradient(from 214deg at 52% 48%, rgba(255, 255, 255, 0.22), transparent 23%, rgba(var(--hdx-theme-accent-rgb), 0.16), transparent 57%, rgba(var(--hdx-theme-sun-rgb), 0.12), transparent);
  opacity: 0.86;
  mix-blend-mode: multiply;
}

.dark .login-shell::after {
  background:
    radial-gradient(ellipse at 14% 72%, rgba(var(--hdx-theme-primary-rgb), 0.16), rgba(var(--hdx-theme-primary-rgb), 0.06) 34%, transparent 64%),
    radial-gradient(ellipse at 88% 20%, rgba(var(--hdx-theme-warm-rgb), 0.13), rgba(var(--hdx-theme-warm-rgb), 0.04) 32%, transparent 62%),
    linear-gradient(128deg, rgba(255, 255, 255, 0.04), transparent 42%, rgba(var(--hdx-theme-accent-rgb), 0.06));
  opacity: 0.84;
  filter: blur(18px);
  mix-blend-mode: screen;
}

.login-backdrop {
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--hdx-theme-primary) 6%, #f8fdff) 0%, color-mix(in srgb, var(--hdx-theme-primary) 13%, #e0f7ff) 36%, color-mix(in srgb, var(--hdx-theme-primary) 8%, #f1e8ff) 68%, #fff7ed 100%),
    conic-gradient(from 120deg at 52% 48%, rgba(var(--hdx-theme-accent-rgb), 0.12), rgba(255, 255, 255, 0.5), rgba(var(--hdx-theme-primary-rgb), 0.1), rgba(var(--hdx-theme-warm-rgb), 0.12), rgba(var(--hdx-theme-accent-rgb), 0.12));
}

.dark .login-backdrop {
  background:
    radial-gradient(ellipse at 18% 78%, rgba(var(--hdx-theme-primary-rgb), 0.18), transparent 58%),
    radial-gradient(ellipse at 82% 18%, rgba(var(--hdx-theme-warm-rgb), 0.14), transparent 56%),
    radial-gradient(ellipse at 62% 64%, rgba(var(--hdx-theme-accent-rgb), 0.08), transparent 62%),
    linear-gradient(145deg, #111113 0%, color-mix(in srgb, var(--hdx-theme-primary) 8%, #151316) 46%, #100f13 100%);
}

.login-liquid-field {
  position: absolute;
  inset: -12%;
  pointer-events: none;
  background:
    linear-gradient(108deg, transparent 0 16%, rgba(var(--hdx-theme-accent-rgb), 0.22) 30%, transparent 48%),
    linear-gradient(38deg, transparent 0 32%, rgba(var(--hdx-theme-warm-rgb), 0.13) 46%, transparent 64%),
    linear-gradient(155deg, rgba(255, 255, 255, 0.46), transparent 42%, rgba(var(--hdx-theme-primary-rgb), 0.16));
  filter: blur(18px);
  opacity: 0.78;
  transform: translate3d(0, 0, 0);
  animation: liquid-drift 14s ease-in-out infinite alternate;
}

.dark .login-liquid-field {
  background:
    radial-gradient(ellipse at 22% 72%, rgba(var(--hdx-theme-primary-rgb), 0.2), transparent 52%),
    radial-gradient(ellipse at 82% 26%, rgba(var(--hdx-theme-warm-rgb), 0.12), transparent 58%),
    linear-gradient(116deg, rgba(255, 255, 255, 0.07) 0%, transparent 46%, rgba(var(--hdx-theme-accent-rgb), 0.08) 100%);
  opacity: 0.68;
  filter: blur(26px);
}

.login-glass-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(var(--hdx-theme-neutral-rgb), 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--hdx-theme-neutral-rgb), 0.04) 1px, transparent 1px);
  background-size: 56px 56px;
  mask-image: radial-gradient(circle at center, black, transparent 72%);
  opacity: 0.42;
}

.dark .login-glass-grid {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  mask-image: radial-gradient(ellipse at 36% 58%, black, transparent 76%);
  opacity: 0.3;
}

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

.login-shell {
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--hdx-theme-primary) 6%, #f8fdff) 0%, color-mix(in srgb, var(--hdx-theme-primary) 13%, #e0f7ff) 36%, color-mix(in srgb, var(--hdx-theme-primary) 8%, #f1e8ff) 68%, #fff7ed 100%);
}

.dark .login-shell {
  background:
    linear-gradient(145deg, #111113 0%, color-mix(in srgb, var(--hdx-theme-primary) 8%, #151316) 46%, #100f13 100%);
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

.login-panel-tools .login-tool-button {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  min-width: 2rem;
  height: 2rem;
  padding: 0;
  border-radius: var(--hdx-radius-toolbar-item);
  border-color: transparent;
  background: transparent;
  color: rgba(15, 23, 42, 0.72);
  gap: 0;
  line-height: 1;
}

.login-panel-tools .login-tool-button:hover {
  background: rgba(var(--hdx-theme-primary-rgb), 0.12);
}

.dark .login-panel-tools .login-tool-button {
  color: rgba(255, 255, 255, 0.86);
}

.dark .login-panel-tools .login-tool-button:hover {
  background: rgba(255, 255, 255, 0.16);
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

.login-floating-menu {
  overflow: hidden;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: var(--hdx-radius-popover) !important;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(18px);
}

.dark .login-floating-menu {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(15, 23, 42, 0.86);
  box-shadow: 0 20px 50px rgba(2, 6, 23, 0.42);
}

@keyframes liquid-drift {
  from {
    transform: translate3d(-1.2rem, 0.4rem, 0) rotate(0deg);
  }

  to {
    transform: translate3d(1rem, -1rem, 0) rotate(8deg);
  }
}

@media (max-width: 640px) {
  .login-liquid-field {
    opacity: 0.62;
  }

  .login-glass-grid {
    background-size: 44px 44px;
    opacity: 0.28;
  }
}

@media (prefers-reduced-motion: reduce) {
  .login-liquid-field {
    animation: none;
  }
}
</style>
