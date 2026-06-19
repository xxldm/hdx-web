import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  readStoredTheme,
  useThemePreferenceStore
} from '../../app/stores/theme-preference'
import {
  createNeutralScale,
  createScale,
  createThemeCssVariables,
  createThemePreferenceHeadScript,
  defaultThemePreference,
  themeCssVariablesStorageKey,
  themePreferenceStorageKey
} from '../../app/utils/theme-runtime'

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

  it('reads saved theme preferences before opening the settings panel', () => {
    const storedTheme = {
      ...defaultThemePreference,
      primaryMode: 'custom',
      customPrimary: '#3366ff',
      neutralMode: 'custom',
      customNeutral: '#123456',
      radius: '0.5'
    }

    localStorage.setItem(themePreferenceStorageKey, JSON.stringify(storedTheme))

    const store = useThemePreferenceStore()

    expect(store.preference.primaryMode).toBe('custom')
    expect(store.preference.customPrimary).toBe('#3366ff')
    expect(store.preference.neutralMode).toBe('custom')
    expect(store.preference.customNeutral).toBe('#123456')
    expect(store.preference.radius).toBe('0.5')
  })

  it('keeps legacy saved theme preferences that do not include a version', () => {
    const storedTheme = {
      primaryMode: 'custom',
      customPrimary: '#3366ff',
      neutralMode: 'custom',
      customNeutral: '#123456',
      radius: '0.5'
    }

    expect(readStoredTheme(JSON.stringify(storedTheme))).toMatchObject({
      version: 1,
      primaryMode: 'custom',
      customPrimary: '#3366ff',
      neutralMode: 'custom',
      customNeutral: '#123456',
      radius: '0.5'
    })
  })

  it('restores the settings panel selection from saved css variables when preference data is missing', () => {
    localStorage.setItem(themeCssVariablesStorageKey, JSON.stringify(createThemeCssVariables({
      primaryScale: createScale('#3366ff'),
      neutralScale: createNeutralScale('#123456'),
      primaryHex: '#3366ff',
      neutralHex: '#123456',
      radius: 0.5
    })))

    const store = useThemePreferenceStore()

    expect(store.preference.primaryMode).toBe('custom')
    expect(store.preference.customPrimary).toBe('#3366ff')
    expect(store.preference.neutralMode).toBe('custom')
    expect(store.preference.customNeutral).toBe('#123456')
    expect(store.preference.radius).toBe('0.5')
  })

  it('uses saved css variables when legacy default preferences disagree with the visible theme', () => {
    localStorage.setItem(themePreferenceStorageKey, JSON.stringify(defaultThemePreference))
    localStorage.setItem(themeCssVariablesStorageKey, JSON.stringify(createThemeCssVariables({
      primaryScale: createScale('#f43f5e'),
      neutralScale: createNeutralScale('#82736c'),
      primaryHex: '#f43f5e',
      neutralHex: '#82736c',
      radius: 0.375
    })))

    const store = useThemePreferenceStore()

    expect(store.preference.primaryMode).toBe('preset')
    expect(store.preference.primary).toBe('rose')
    expect(store.preference.neutralMode).toBe('preset')
    expect(store.preference.neutral).toBe('taupe')
    expect(store.preference.radius).toBe('0.375')
    expect(JSON.parse(localStorage.getItem(themePreferenceStorageKey) ?? '{}')).toMatchObject({
      primary: 'rose',
      neutral: 'taupe',
      radius: '0.375'
    })
  })

  it('uses saved css variables when stale preferences disagree with the visible theme', () => {
    localStorage.setItem(themePreferenceStorageKey, JSON.stringify({
      ...defaultThemePreference,
      primary: 'blue',
      customPrimary: '#3b82f6',
      neutral: 'gray',
      customNeutral: '#6b7280',
      radius: '0.125'
    }))
    localStorage.setItem(themeCssVariablesStorageKey, JSON.stringify(createThemeCssVariables({
      primaryScale: createScale('#f43f5e'),
      neutralScale: createNeutralScale('#82736c'),
      primaryHex: '#f43f5e',
      neutralHex: '#82736c',
      radius: 0.5
    })))

    const store = useThemePreferenceStore()

    expect(store.preference.primaryMode).toBe('preset')
    expect(store.preference.primary).toBe('rose')
    expect(store.preference.neutralMode).toBe('preset')
    expect(store.preference.neutral).toBe('taupe')
    expect(store.preference.radius).toBe('0.5')
    expect(JSON.parse(localStorage.getItem(themePreferenceStorageKey) ?? '{}')).toMatchObject({
      primary: 'rose',
      neutral: 'taupe',
      radius: '0.5'
    })
  })

  it('can force hydrate the settings panel from storage after the store was already mounted', () => {
    const store = useThemePreferenceStore()

    expect(store.preference.primary).toBe(defaultThemePreference.primary)

    localStorage.setItem(themePreferenceStorageKey, JSON.stringify(defaultThemePreference))
    localStorage.setItem(themeCssVariablesStorageKey, JSON.stringify(createThemeCssVariables({
      primaryScale: createScale('#3366ff'),
      neutralScale: createNeutralScale('#123456'),
      primaryHex: '#3366ff',
      neutralHex: '#123456',
      radius: 0.5
    })))

    store.hydrate({ force: true })

    expect(store.preference.primaryMode).toBe('custom')
    expect(store.preference.customPrimary).toBe('#3366ff')
    expect(store.preference.neutralMode).toBe('custom')
    expect(store.preference.customNeutral).toBe('#123456')
    expect(store.preference.radius).toBe('0.5')
  })

  it('applies stored theme variables before Nuxt hydrates', () => {
    const store = useThemePreferenceStore()

    store.setCustomPrimaryColor('#3366ff')
    store.setCustomNeutralColor('#123456')
    store.setRadius('0.5')
    document.documentElement.removeAttribute('style')

    window.eval(createThemePreferenceHeadScript())

    const style = document.documentElement.style

    expect(style.getPropertyValue('--ui-color-primary-500')).toBe('#3366ff')
    expect(style.getPropertyValue('--ui-color-neutral-500')).toBe('#123456')
    expect(style.getPropertyValue('--hdx-theme-primary')).toBe('#3366ff')
    expect(style.getPropertyValue('--hdx-theme-neutral')).toBe('#123456')
    expect(style.getPropertyValue('--hdx-radius-card')).toBe('1.25rem')
    expect(style.getPropertyValue('--hdx-radius-popover')).toBe('1.25rem')
    expect(style.getPropertyValue('--hdx-radius-toolbar-item')).toBe('1rem')
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
