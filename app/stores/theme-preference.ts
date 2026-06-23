import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import {
  applyThemeCssVariables,
  createNeutralScale,
  createScale,
  createThemeCssVariables,
  defaultThemePreference,
  neutralColorOptions,
  normalizeHex,
  primaryColorOptions,
  storedThemeSchema,
  themeCssVariablesStorageKey,
  themePreferenceStorageKey,
  themeRadiusValues,
  type ThemeNeutralColorKey,
  type ThemePreference,
  type ThemePrimaryColorKey,
  type ThemeRadiusValue
} from '~/utils/theme-runtime'

const radiusOptions = themeRadiusValues.map(value => ({
  value,
  label: value
}))

export const useThemePreferenceStore = defineStore('theme-preference', () => {
  const appConfig = useAppConfig()
  const colorMode = useColorMode()
  const hydrated = shallowRef(false)
  const preference = ref<ThemePreference>({ ...defaultThemePreference })

  const activePrimaryOption = computed(() => primaryColorOptions.find(option => option.key === preference.value.primary) ?? primaryColorOptions[0]!)
  const activeNeutralOption = computed(() => neutralColorOptions.find(option => option.key === preference.value.neutral) ?? neutralColorOptions[0]!)
  const activePrimaryHex = computed(() => preference.value.primaryMode === 'custom' ? normalizeHex(preference.value.customPrimary) : activePrimaryOption.value.swatch)
  const activeNeutralHex = computed(() => preference.value.neutralMode === 'custom' ? normalizeHex(preference.value.customNeutral, defaultThemePreference.customNeutral) : activeNeutralOption.value.swatch)
  const activePrimaryScale = computed(() => preference.value.primaryMode === 'custom' ? createScale(activePrimaryHex.value) : activePrimaryOption.value.scale)
  const activeNeutralScale = computed(() => preference.value.neutralMode === 'custom' ? createNeutralScale(activeNeutralHex.value) : activeNeutralOption.value.scale)
  const activeColorMode = computed(() => colorMode.preference)

  function hydrate(options: HydrateThemeOptions = {}) {
    if ((hydrated.value && !options.force) || !isBrowserRuntime()) {
      return
    }

    preference.value = readStoredTheme()
    hydrated.value = true
    applyTheme()
    persistTheme()
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

  function applyUserPreferenceTheme(nextPreference: ThemePreference, nextColorMode: 'system' | 'light' | 'dark') {
    preference.value = storedThemeSchema.parse({
      ...defaultThemePreference,
      ...nextPreference
    })
    colorMode.preference = nextColorMode
    commitTheme()
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
    const radius = Number.parseFloat(preference.value.radius)
    const variables = createThemeCssVariables({
      primaryScale: activePrimaryScale.value,
      neutralScale: activeNeutralScale.value,
      primaryHex: activePrimaryHex.value,
      neutralHex: activeNeutralHex.value,
      radius
    })

    applyThemeCssVariables(rootStyle, variables)
  }

  function persistTheme() {
    if (!isBrowserRuntime()) {
      return
    }

    window.localStorage.setItem(themePreferenceStorageKey, JSON.stringify(preference.value))
    window.localStorage.setItem(themeCssVariablesStorageKey, JSON.stringify(createThemeCssVariables({
      primaryScale: activePrimaryScale.value,
      neutralScale: activeNeutralScale.value,
      primaryHex: activePrimaryHex.value,
      neutralHex: activeNeutralHex.value,
      radius: Number.parseFloat(preference.value.radius)
    })))
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
    applyUserPreferenceTheme,
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
  const shouldReadStoredVariables = raw === undefined && isBrowserRuntime()
  const storedVariablesValue = shouldReadStoredVariables
    ? window.localStorage.getItem(themeCssVariablesStorageKey)
    : null
  const variablePatch = readStoredThemePatchFromCssVariables(storedVariablesValue)

  if (storedValue) {
    const preference = parseStoredThemePreference(storedValue)

    if (preference) {
      return reconcileStoredTheme(preference, variablePatch)
    }
  }

  return variablePatch ? storedThemeSchema.parse({ ...defaultThemePreference, ...variablePatch }) : { ...defaultThemePreference }
}

function parseStoredThemePreference(storedValue: string) {
  try {
    const storedTheme = JSON.parse(storedValue)

    return storedThemeSchema.parse({
      ...defaultThemePreference,
      ...storedTheme
    })
  } catch {
    return null
  }
}

function readStoredThemePatchFromCssVariables(raw: string | null): Partial<ThemePreference> | null {
  if (!raw) {
    return null
  }

  try {
    const variables = JSON.parse(raw) as Record<string, unknown>
    const primaryHex = typeof variables['--hdx-theme-primary'] === 'string'
      ? normalizeHex(variables['--hdx-theme-primary'])
      : null
    const neutralHex = typeof variables['--hdx-theme-neutral'] === 'string'
      ? normalizeHex(variables['--hdx-theme-neutral'], defaultThemePreference.customNeutral)
      : null
    const radius = typeof variables['--ui-radius'] === 'string'
      ? parseStoredRadius(variables['--ui-radius'])
      : null

    if (!primaryHex && !neutralHex && !radius) {
      return null
    }

    return {
      ...createColorPreference('primary', primaryHex),
      ...createColorPreference('neutral', neutralHex),
      ...(radius ? { radius } : {})
    }
  } catch {
    return null
  }
}

function reconcileStoredTheme(preference: ThemePreference, variablePatch: Partial<ThemePreference> | null): ThemePreference {
  if (!variablePatch) {
    return preference
  }

  return storedThemeSchema.parse({
    ...preference,
    ...readConflictingCssVariablePatch(preference, variablePatch)
  })
}

function readConflictingCssVariablePatch(preference: ThemePreference, variablePatch: Partial<ThemePreference>) {
  const patch: Partial<ThemePreference> = {}
  const primaryPreference = pickPrimaryPreference(variablePatch)
  const neutralPreference = pickNeutralPreference(variablePatch)
  const radiusPreference = pickRadiusPreference(variablePatch)

  if (primaryPreference.primaryMode) {
    const visiblePreference = storedThemeSchema.parse({
      ...preference,
      ...primaryPreference
    })

    if (resolvePrimaryHex(preference) !== resolvePrimaryHex(visiblePreference)) {
      Object.assign(patch, primaryPreference)
    }
  }

  if (neutralPreference.neutralMode) {
    const visiblePreference = storedThemeSchema.parse({
      ...preference,
      ...neutralPreference
    })

    if (resolveNeutralHex(preference) !== resolveNeutralHex(visiblePreference)) {
      Object.assign(patch, neutralPreference)
    }
  }

  if (radiusPreference.radius && radiusPreference.radius !== preference.radius) {
    patch.radius = radiusPreference.radius
  }

  return patch
}

function createColorPreference(name: 'primary', hex: string | null): Pick<ThemePreference, 'primaryMode' | 'primary' | 'customPrimary'>
function createColorPreference(name: 'neutral', hex: string | null): Pick<ThemePreference, 'neutralMode' | 'neutral' | 'customNeutral'>
function createColorPreference(name: ThemePreferenceColorName, hex: string | null) {
  if (!hex) {
    return {}
  }

  if (name === 'primary') {
    const preset = primaryColorOptions.find(option => option.swatch.toLowerCase() === hex)

    return preset
      ? { primaryMode: 'preset', primary: preset.key, customPrimary: hex }
      : { primaryMode: 'custom', customPrimary: hex }
  }

  const preset = neutralColorOptions.find(option => option.swatch.toLowerCase() === hex)

  return preset
    ? { neutralMode: 'preset', neutral: preset.key, customNeutral: hex }
    : { neutralMode: 'custom', customNeutral: hex }
}

function pickPrimaryPreference(preference: Partial<ThemePreference>): Partial<ThemePreference> {
  if (!preference.primaryMode) {
    return {}
  }

  return {
    primaryMode: preference.primaryMode,
    ...(preference.primary ? { primary: preference.primary } : {}),
    ...(preference.customPrimary ? { customPrimary: preference.customPrimary } : {})
  }
}

function pickNeutralPreference(preference: Partial<ThemePreference>): Partial<ThemePreference> {
  if (!preference.neutralMode) {
    return {}
  }

  return {
    neutralMode: preference.neutralMode,
    ...(preference.neutral ? { neutral: preference.neutral } : {}),
    ...(preference.customNeutral ? { customNeutral: preference.customNeutral } : {})
  }
}

function pickRadiusPreference(preference: Partial<ThemePreference>): Partial<ThemePreference> {
  return preference.radius ? { radius: preference.radius } : {}
}

function resolvePrimaryHex(preference: Pick<ThemePreference, 'primaryMode' | 'primary' | 'customPrimary'>) {
  if (preference.primaryMode === 'custom') {
    return normalizeHex(preference.customPrimary)
  }

  return primaryColorOptions.find(option => option.key === preference.primary)?.swatch.toLowerCase()
    ?? defaultThemePreference.customPrimary
}

function resolveNeutralHex(preference: Pick<ThemePreference, 'neutralMode' | 'neutral' | 'customNeutral'>) {
  if (preference.neutralMode === 'custom') {
    return normalizeHex(preference.customNeutral, defaultThemePreference.customNeutral)
  }

  return neutralColorOptions.find(option => option.key === preference.neutral)?.swatch.toLowerCase()
    ?? defaultThemePreference.customNeutral
}

function parseStoredRadius(value: string): ThemeRadiusValue | null {
  const match = /^([0-9]+(?:\.[0-9]+)?)rem$/.exec(value)
  const radius = match?.[1] as ThemeRadiusValue | undefined

  return radius && themeRadiusValues.includes(radius) ? radius : null
}

type ThemePreferenceColorName = 'primary' | 'neutral'

interface HydrateThemeOptions {
  force?: boolean
}

function isBrowserRuntime() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useThemePreferenceStore, import.meta.hot))
}
