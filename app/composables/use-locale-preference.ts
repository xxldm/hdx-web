const localeStorageKey = 'hdx-locale'
const localeCookieKey = 'hdx_locale'
const supportedLocales = ['zh-CN', 'en-US'] as const

type SupportedLocale = typeof supportedLocales[number]

interface SetPreferredLocaleOptions {
  persistLocal?: boolean
}

function isSupportedLocale(value: string): value is SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale)
}

export function useLocalePreference() {
  const { locale, setLocale } = useI18n()
  const localeCookie = useCookie<string>(localeCookieKey, {
    sameSite: 'lax',
    default: () => 'zh-CN'
  })

  const setPreferredLocale = async (code: string, options: SetPreferredLocaleOptions = {}) => {
    if (!isSupportedLocale(code)) {
      return
    }

    await setLocale(code)
    localeCookie.value = code

    if (import.meta.client && options.persistLocal !== false) {
      window.localStorage.setItem(localeStorageKey, code)
    }
  }

  onMounted(async () => {
    const storedLocale = window.localStorage.getItem(localeStorageKey)

    if (storedLocale && storedLocale !== locale.value) {
      await setPreferredLocale(storedLocale)
    }
  })

  return {
    locale,
    setPreferredLocale
  }
}
