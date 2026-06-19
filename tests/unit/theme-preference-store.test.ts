import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  defaultThemePreference,
  readStoredTheme,
  useThemePreferenceStore,
  themePreferenceStorageKey
} from '../../app/stores/theme-preference'

describe('theme preference store', () => {
  let appConfig: {
    ui: {
      colors: {
        primary: string
        neutral: string
      }
    }
  }

  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('style')
    setActivePinia(createPinia())
    appConfig = {
      ui: {
        colors: {
          primary: 'green',
          neutral: 'slate'
        }
      }
    }
    vi.stubGlobal('useAppConfig', () => appConfig)
    vi.stubGlobal('useColorMode', () => ({
      preference: 'system'
    }))
  })

  it('falls back to the default theme when stored data is invalid', () => {
    expect(readStoredTheme('{bad json')).toEqual(defaultThemePreference)
  })

  it('persists custom colors to local storage', () => {
    const store = useThemePreferenceStore()

    store.setCustomPrimaryColor('#3366ff')
    store.setCustomNeutralColor('#123456')

    const stored = JSON.parse(localStorage.getItem(themePreferenceStorageKey) ?? '{}')

    expect(stored.customPrimary).toBe('#3366ff')
    expect(stored.customNeutral).toBe('#123456')
    expect(stored.primaryMode).toBe('custom')
    expect(stored.neutralMode).toBe('custom')
  })

  it('keeps Nuxt UI semantic colors aligned with runtime theme variables', () => {
    const store = useThemePreferenceStore()

    store.setCustomPrimaryColor('#3366ff')
    store.setCustomNeutralColor('#123456')

    const style = document.documentElement.style

    expect(appConfig.ui.colors.primary).toBe('primary')
    expect(appConfig.ui.colors.neutral).toBe('neutral')
    expect(style.getPropertyValue('--ui-color-primary-500')).toBe('#3366ff')
    expect(style.getPropertyValue('--ui-color-neutral-500')).toBe('#123456')
    expect(style.getPropertyValue('--hdx-theme-primary')).toBe('#3366ff')
    expect(style.getPropertyValue('--hdx-theme-neutral')).toBe('#123456')
  })

  it('activates custom colors without replacing the saved custom value', () => {
    const store = useThemePreferenceStore()

    store.setCustomPrimaryColor('#3366ff')
    store.setPrimaryColor('rose')
    store.activateCustomPrimaryColor()

    expect(store.preference.primaryMode).toBe('custom')
    expect(store.preference.customPrimary).toBe('#3366ff')
    expect(document.documentElement.style.getPropertyValue('--ui-color-primary-500')).toBe('#3366ff')
  })
})
