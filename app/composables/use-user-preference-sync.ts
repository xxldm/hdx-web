import { storeToRefs } from 'pinia'
import type { Ref, WatchStopHandle } from 'vue'
import { computed, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import type { UserPreferenceRecord } from '~/types/hdx-api'
import type { UserPreferenceSaveInput } from '~/stores/user-preference'
import { storedThemeSchema, type ThemePreference } from '~/utils/theme-runtime'

interface LocalePreferenceBridge {
  locale: Ref<string>
  setPreferredLocale: (code: string) => Promise<void>
}

const preferenceSaveDebounceMs = 350

export function useUserPreferenceSync(localePreference: LocalePreferenceBridge) {
  const auth = useAuthStore()
  const theme = useThemePreferenceStore()
  const navigation = useWorkbenchNavigationStore()
  const userPreference = useUserPreferenceStore()
  const { authenticated } = storeToRefs(auth)
  const { activeColorMode, preference: themePreference } = storeToRefs(theme)
  const { pinnedItemIds } = storeToRefs(navigation)
  const started = shallowRef(false)
  const applyingRemotePreference = shallowRef(false)
  let stopCurrentPreferenceWatch: WatchStopHandle | null = null
  let pendingSaveTimer: ReturnType<typeof window.setTimeout> | null = null

  const currentPreferenceInput = computed<UserPreferenceSaveInput>(() => createUserPreferenceSaveInput({
    colorMode: activeColorMode.value,
    locale: localePreference.locale.value,
    pinnedItemIds: pinnedItemIds.value,
    theme: themePreference.value
  }))
  const currentPreferenceFingerprint = computed(() => JSON.stringify(currentPreferenceInput.value))

  async function start() {
    if (!import.meta.client || started.value || !authenticated.value) {
      return
    }

    started.value = true
    const loadResult = await userPreference.loadPreferences()

    if (loadResult !== 'success' || !userPreference.remotePreference) {
      started.value = false
      return
    }

    applyingRemotePreference.value = true

    try {
      if (userPreference.remotePreference.version > 0) {
        await applyRemotePreference(userPreference.remotePreference)
      } else {
        await userPreference.savePreferences(currentPreferenceInput.value)
      }
    } finally {
      applyingRemotePreference.value = false
    }

    stopCurrentPreferenceWatch = watch(
      currentPreferenceFingerprint,
      () => scheduleSaveCurrentPreference(),
      { flush: 'post' }
    )
  }

  function stop() {
    started.value = false
    stopCurrentPreferenceWatch?.()
    stopCurrentPreferenceWatch = null
    clearPendingSave()
    userPreference.resetState()
  }

  async function applyRemotePreference(preference: UserPreferenceRecord) {
    theme.applyUserPreferenceTheme(toThemePreference(preference), preference.colorMode)
    navigation.setPinnedItems(preference.navigation.pinnedItemIds)
    await localePreference.setPreferredLocale(preference.locale)
  }

  function scheduleSaveCurrentPreference() {
    if (!started.value || applyingRemotePreference.value || !authenticated.value) {
      return
    }

    clearPendingSave()
    pendingSaveTimer = window.setTimeout(() => {
      pendingSaveTimer = null
      void saveCurrentPreference()
    }, preferenceSaveDebounceMs)
  }

  async function saveCurrentPreference() {
    if (!started.value || applyingRemotePreference.value || !authenticated.value) {
      return
    }

    await userPreference.savePreferences(currentPreferenceInput.value)
  }

  function clearPendingSave() {
    if (pendingSaveTimer) {
      window.clearTimeout(pendingSaveTimer)
      pendingSaveTimer = null
    }
  }

  onMounted(() => {
    void start()
  })

  watch(authenticated, (isAuthenticated) => {
    if (isAuthenticated) {
      void start()
      return
    }

    stop()
  })

  onUnmounted(stop)

  return {
    saveCurrentPreference,
    start,
    stop
  }
}

export function createUserPreferenceSaveInput(input: {
  locale: string
  colorMode: string
  theme: ThemePreference
  pinnedItemIds: readonly string[]
}): UserPreferenceSaveInput {
  return {
    locale: normalizeUserPreferenceLocale(input.locale),
    colorMode: normalizeUserPreferenceColorMode(input.colorMode),
    theme: {
      primaryMode: input.theme.primaryMode,
      primary: input.theme.primary,
      customPrimary: input.theme.customPrimary,
      neutralMode: input.theme.neutralMode,
      neutral: input.theme.neutral,
      customNeutral: input.theme.customNeutral,
      radius: input.theme.radius
    },
    navigation: {
      pinnedItemIds: [...input.pinnedItemIds]
    }
  }
}

function toThemePreference(preference: UserPreferenceRecord): ThemePreference {
  return storedThemeSchema.parse({
    version: 1,
    ...preference.theme
  })
}

function normalizeUserPreferenceLocale(value: string): UserPreferenceSaveInput['locale'] {
  return value === 'en-US' ? 'en-US' : 'zh-CN'
}

function normalizeUserPreferenceColorMode(value: string): UserPreferenceSaveInput['colorMode'] {
  return value === 'light' || value === 'dark' ? value : 'system'
}
