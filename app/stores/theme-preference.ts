import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { z } from 'zod'

export const themePrimaryColorKeys = [
  'black',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose'
] as const

export const themeNeutralColorKeys = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'taupe',
  'mauve',
  'mist',
  'olive'
] as const

export const themeRadiusValues = ['0', '0.125', '0.25', '0.375', '0.5'] as const
export const themePreferenceStorageKey = 'hdx:web:theme:v1'

export type ThemePrimaryColorKey = typeof themePrimaryColorKeys[number]
export type ThemeNeutralColorKey = typeof themeNeutralColorKeys[number]
export type ThemeRadiusValue = typeof themeRadiusValues[number]
type ThemeColorMode = 'preset' | 'custom'
type ThemeSemanticColorName = 'primary' | 'neutral'

interface ThemeColorScale {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950: string
}

interface ThemeColorOption<T extends string> {
  key: T
  labelKey: string
  swatch: string
  scale: ThemeColorScale
}

interface ThemePreference {
  version: 1
  primaryMode: ThemeColorMode
  primary: ThemePrimaryColorKey
  customPrimary: string
  neutralMode: ThemeColorMode
  neutral: ThemeNeutralColorKey
  customNeutral: string
  radius: ThemeRadiusValue
}

export const defaultThemePreference: ThemePreference = {
  version: 1,
  primaryMode: 'preset',
  primary: 'green',
  customPrimary: '#22c55e',
  neutralMode: 'preset',
  neutral: 'slate',
  customNeutral: '#64748b',
  radius: '0.25'
}

const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i)
const storedThemeSchema = z.object({
  version: z.literal(1),
  primaryMode: z.enum(['preset', 'custom']).default(defaultThemePreference.primaryMode),
  primary: z.enum([...themePrimaryColorKeys] as [ThemePrimaryColorKey, ...ThemePrimaryColorKey[]]).default(defaultThemePreference.primary),
  customPrimary: hexColorSchema.default(defaultThemePreference.customPrimary),
  neutralMode: z.enum(['preset', 'custom']).default(defaultThemePreference.neutralMode),
  neutral: z.enum([...themeNeutralColorKeys] as [ThemeNeutralColorKey, ...ThemeNeutralColorKey[]]).default(defaultThemePreference.neutral),
  customNeutral: hexColorSchema.default(defaultThemePreference.customNeutral),
  radius: z.enum([...themeRadiusValues] as [ThemeRadiusValue, ...ThemeRadiusValue[]]).default(defaultThemePreference.radius)
})

const primaryColorOptions: ThemeColorOption<ThemePrimaryColorKey>[] = [
  { key: 'black', labelKey: 'theme.colors.black', swatch: '#0f172a', scale: createNeutralScale('#0f172a') },
  { key: 'red', labelKey: 'theme.colors.red', swatch: '#ef4444', scale: createScale('#ef4444') },
  { key: 'orange', labelKey: 'theme.colors.orange', swatch: '#f97316', scale: createScale('#f97316') },
  { key: 'amber', labelKey: 'theme.colors.amber', swatch: '#f59e0b', scale: createScale('#f59e0b') },
  { key: 'yellow', labelKey: 'theme.colors.yellow', swatch: '#eab308', scale: createScale('#eab308') },
  { key: 'lime', labelKey: 'theme.colors.lime', swatch: '#84cc16', scale: createScale('#84cc16') },
  { key: 'green', labelKey: 'theme.colors.green', swatch: '#22c55e', scale: createScale('#22c55e') },
  { key: 'emerald', labelKey: 'theme.colors.emerald', swatch: '#10b981', scale: createScale('#10b981') },
  { key: 'teal', labelKey: 'theme.colors.teal', swatch: '#14b8a6', scale: createScale('#14b8a6') },
  { key: 'cyan', labelKey: 'theme.colors.cyan', swatch: '#06b6d4', scale: createScale('#06b6d4') },
  { key: 'sky', labelKey: 'theme.colors.sky', swatch: '#0ea5e9', scale: createScale('#0ea5e9') },
  { key: 'blue', labelKey: 'theme.colors.blue', swatch: '#3b82f6', scale: createScale('#3b82f6') },
  { key: 'indigo', labelKey: 'theme.colors.indigo', swatch: '#6366f1', scale: createScale('#6366f1') },
  { key: 'violet', labelKey: 'theme.colors.violet', swatch: '#8b5cf6', scale: createScale('#8b5cf6') },
  { key: 'purple', labelKey: 'theme.colors.purple', swatch: '#a855f7', scale: createScale('#a855f7') },
  { key: 'fuchsia', labelKey: 'theme.colors.fuchsia', swatch: '#d946ef', scale: createScale('#d946ef') },
  { key: 'pink', labelKey: 'theme.colors.pink', swatch: '#ec4899', scale: createScale('#ec4899') },
  { key: 'rose', labelKey: 'theme.colors.rose', swatch: '#f43f5e', scale: createScale('#f43f5e') }
]

const neutralColorOptions: ThemeColorOption<ThemeNeutralColorKey>[] = [
  { key: 'slate', labelKey: 'theme.colors.slate', swatch: '#64748b', scale: createNeutralScale('#64748b') },
  { key: 'gray', labelKey: 'theme.colors.gray', swatch: '#6b7280', scale: createNeutralScale('#6b7280') },
  { key: 'zinc', labelKey: 'theme.colors.zinc', swatch: '#71717a', scale: createNeutralScale('#71717a') },
  { key: 'neutral', labelKey: 'theme.colors.neutral', swatch: '#737373', scale: createNeutralScale('#737373') },
  { key: 'stone', labelKey: 'theme.colors.stone', swatch: '#78716c', scale: createNeutralScale('#78716c') },
  { key: 'taupe', labelKey: 'theme.colors.taupe', swatch: '#82736c', scale: createNeutralScale('#82736c') },
  { key: 'mauve', labelKey: 'theme.colors.mauve', swatch: '#857386', scale: createNeutralScale('#857386') },
  { key: 'mist', labelKey: 'theme.colors.mist', swatch: '#75858a', scale: createNeutralScale('#75858a') },
  { key: 'olive', labelKey: 'theme.colors.olive', swatch: '#777f5c', scale: createNeutralScale('#777f5c') }
]

const radiusOptions = themeRadiusValues.map(value => ({
  value,
  label: value
}))

export const useThemePreferenceStore = defineStore('theme-preference', () => {
  const appConfig = useAppConfig()
  const colorMode = useColorMode()
  const hydrated = ref(false)
  const preference = ref<ThemePreference>({ ...defaultThemePreference })

  const activePrimaryOption = computed(() => primaryColorOptions.find(option => option.key === preference.value.primary) ?? primaryColorOptions[0]!)
  const activeNeutralOption = computed(() => neutralColorOptions.find(option => option.key === preference.value.neutral) ?? neutralColorOptions[0]!)
  const activePrimaryHex = computed(() => preference.value.primaryMode === 'custom' ? normalizeHex(preference.value.customPrimary) : activePrimaryOption.value.swatch)
  const activeNeutralHex = computed(() => preference.value.neutralMode === 'custom' ? normalizeHex(preference.value.customNeutral, defaultThemePreference.customNeutral) : activeNeutralOption.value.swatch)
  const activePrimaryScale = computed(() => preference.value.primaryMode === 'custom' ? createScale(activePrimaryHex.value) : activePrimaryOption.value.scale)
  const activeNeutralScale = computed(() => preference.value.neutralMode === 'custom' ? createNeutralScale(activeNeutralHex.value) : activeNeutralOption.value.scale)
  const activeColorMode = computed(() => colorMode.preference)

  function hydrate() {
    if (hydrated.value || !isBrowserRuntime()) {
      return
    }

    preference.value = readStoredTheme()
    hydrated.value = true
    applyTheme()
  }

  function setPrimaryColor(key: ThemePrimaryColorKey) {
    preference.value = {
      ...preference.value,
      primaryMode: 'preset',
      primary: key
    }
    commitTheme()
  }

  function setCustomPrimaryColor(value: string | undefined) {
    const normalized = normalizeHex(value, defaultThemePreference.customPrimary)

    preference.value = {
      ...preference.value,
      primaryMode: 'custom',
      customPrimary: normalized
    }
    commitTheme()
  }

  function activateCustomPrimaryColor() {
    preference.value = {
      ...preference.value,
      primaryMode: 'custom',
      customPrimary: normalizeHex(preference.value.customPrimary, defaultThemePreference.customPrimary)
    }
    commitTheme()
  }

  function setNeutralColor(key: ThemeNeutralColorKey) {
    preference.value = {
      ...preference.value,
      neutralMode: 'preset',
      neutral: key
    }
    commitTheme()
  }

  function setCustomNeutralColor(value: string | undefined) {
    const normalized = normalizeHex(value, defaultThemePreference.customNeutral)

    preference.value = {
      ...preference.value,
      neutralMode: 'custom',
      customNeutral: normalized
    }
    commitTheme()
  }

  function activateCustomNeutralColor() {
    preference.value = {
      ...preference.value,
      neutralMode: 'custom',
      customNeutral: normalizeHex(preference.value.customNeutral, defaultThemePreference.customNeutral)
    }
    commitTheme()
  }

  function setRadius(value: ThemeRadiusValue) {
    preference.value = {
      ...preference.value,
      radius: value
    }
    commitTheme()
  }

  function setColorMode(value: 'system' | 'light' | 'dark') {
    colorMode.preference = value
  }

  function resetTheme() {
    preference.value = { ...defaultThemePreference }
    commitTheme()
  }

  function commitTheme() {
    applyTheme()
    persistTheme()
  }

  function applyTheme() {
    appConfig.ui.colors.primary = 'primary'
    appConfig.ui.colors.neutral = 'neutral'

    if (!isBrowserRuntime()) {
      return
    }

    const rootStyle = document.documentElement.style
    applyScaleToCssVariables(rootStyle, 'primary', activePrimaryScale.value)
    applyScaleToCssVariables(rootStyle, 'neutral', activeNeutralScale.value)
    rootStyle.setProperty('--ui-radius', `${preference.value.radius}rem`)
    rootStyle.setProperty('--hdx-theme-primary', activePrimaryHex.value)
    rootStyle.setProperty('--hdx-theme-primary-rgb', hexToRgbTriplet(activePrimaryHex.value))
    rootStyle.setProperty('--hdx-theme-neutral', activeNeutralHex.value)
    rootStyle.setProperty('--hdx-theme-neutral-rgb', hexToRgbTriplet(activeNeutralHex.value))
  }

  function persistTheme() {
    if (!isBrowserRuntime()) {
      return
    }

    window.localStorage.setItem(themePreferenceStorageKey, JSON.stringify(preference.value))
  }

  if (isBrowserRuntime()) {
    hydrate()
  }

  return {
    activeColorMode,
    activeNeutralHex,
    activeNeutralOption,
    activePrimaryHex,
    activePrimaryOption,
    activateCustomNeutralColor,
    activateCustomPrimaryColor,
    hydrate,
    neutralColorOptions,
    preference,
    primaryColorOptions,
    radiusOptions,
    resetTheme,
    setColorMode,
    setCustomPrimaryColor,
    setCustomNeutralColor,
    setNeutralColor,
    setPrimaryColor,
    setRadius
  }
})

export function readStoredTheme(raw?: string | null): ThemePreference {
  const storedValue = raw ?? (isBrowserRuntime() ? window.localStorage.getItem(themePreferenceStorageKey) : null)

  if (!storedValue) {
    return { ...defaultThemePreference }
  }

  try {
    return storedThemeSchema.parse(JSON.parse(storedValue))
  } catch {
    return { ...defaultThemePreference }
  }
}

function applyScaleToCssVariables(style: CSSStyleDeclaration, name: ThemeSemanticColorName, scale: ThemeColorScale) {
  for (const [shade, value] of Object.entries(scale)) {
    style.setProperty(`--ui-color-${name}-${shade}`, value)
  }
}

function createScale(hex: string): ThemeColorScale {
  return {
    50: mixHex('#ffffff', hex, 0.08),
    100: mixHex('#ffffff', hex, 0.18),
    200: mixHex('#ffffff', hex, 0.32),
    300: mixHex('#ffffff', hex, 0.48),
    400: mixHex('#ffffff', hex, 0.68),
    500: hex,
    600: mixHex('#000000', hex, 0.88),
    700: mixHex('#000000', hex, 0.72),
    800: mixHex('#000000', hex, 0.56),
    900: mixHex('#000000', hex, 0.42),
    950: mixHex('#000000', hex, 0.28)
  }
}

function createNeutralScale(hex: string): ThemeColorScale {
  return {
    50: mixHex('#ffffff', hex, 0.06),
    100: mixHex('#ffffff', hex, 0.14),
    200: mixHex('#ffffff', hex, 0.26),
    300: mixHex('#ffffff', hex, 0.42),
    400: mixHex('#ffffff', hex, 0.62),
    500: hex,
    600: mixHex('#000000', hex, 0.86),
    700: mixHex('#000000', hex, 0.68),
    800: mixHex('#000000', hex, 0.5),
    900: mixHex('#000000', hex, 0.34),
    950: mixHex('#000000', hex, 0.22)
  }
}

function mixHex(baseHex: string, colorHex: string, colorWeight: number) {
  const base = hexToRgb(baseHex)
  const color = hexToRgb(colorHex)
  const weight = clampNumber(colorWeight, 0, 1)
  const mixed = {
    r: Math.round(base.r * (1 - weight) + color.r * weight),
    g: Math.round(base.g * (1 - weight) + color.g * weight),
    b: Math.round(base.b * (1 - weight) + color.b * weight)
  }

  return rgbToHex(mixed.r, mixed.g, mixed.b)
}

function normalizeHex(value: string | undefined, fallback = defaultThemePreference.customPrimary) {
  if (!value) {
    return fallback
  }

  const trimmed = value.trim()
  const expanded = /^#[0-9a-f]{3}$/i.test(trimmed)
    ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
    : trimmed

  return hexColorSchema.safeParse(expanded).success ? expanded.toLowerCase() : fallback
}

function hexToRgbTriplet(hex: string) {
  const color = hexToRgb(hex)
  return `${color.r}, ${color.g}, ${color.b}`
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex)
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16)
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map(value => clampNumber(value, 0, 255).toString(16).padStart(2, '0')).join('')}`
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function isBrowserRuntime() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useThemePreferenceStore, import.meta.hot))
}
