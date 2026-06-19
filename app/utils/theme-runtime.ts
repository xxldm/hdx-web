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
export const themeCssVariablesStorageKey = 'hdx:web:theme-vars:v1'

export type ThemePrimaryColorKey = typeof themePrimaryColorKeys[number]
export type ThemeNeutralColorKey = typeof themeNeutralColorKeys[number]
export type ThemeRadiusValue = typeof themeRadiusValues[number]
export type ThemeColorMode = 'preset' | 'custom'
export type ThemeSemanticColorName = 'primary' | 'neutral'

export interface ThemeColorScale {
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

export interface ThemeColorOption<T extends string> {
  key: T
  labelKey: string
  swatch: string
  scale: ThemeColorScale
}

export type ThemeCssVariables = Record<string, string>

export interface ThemePreference {
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

export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i)

export const storedThemeSchema = z.object({
  version: z.literal(1).default(defaultThemePreference.version),
  primaryMode: z.enum(['preset', 'custom']).default(defaultThemePreference.primaryMode),
  primary: z.enum([...themePrimaryColorKeys] as [ThemePrimaryColorKey, ...ThemePrimaryColorKey[]]).default(defaultThemePreference.primary),
  customPrimary: hexColorSchema.default(defaultThemePreference.customPrimary),
  neutralMode: z.enum(['preset', 'custom']).default(defaultThemePreference.neutralMode),
  neutral: z.enum([...themeNeutralColorKeys] as [ThemeNeutralColorKey, ...ThemeNeutralColorKey[]]).default(defaultThemePreference.neutral),
  customNeutral: hexColorSchema.default(defaultThemePreference.customNeutral),
  radius: z.enum([...themeRadiusValues] as [ThemeRadiusValue, ...ThemeRadiusValue[]]).default(defaultThemePreference.radius)
})

export const primaryColorOptions: ThemeColorOption<ThemePrimaryColorKey>[] = [
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

export const neutralColorOptions: ThemeColorOption<ThemeNeutralColorKey>[] = [
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

export function applyScaleToCssVariables(style: CSSStyleDeclaration, name: ThemeSemanticColorName, scale: ThemeColorScale) {
  for (const [shade, value] of Object.entries(scale)) {
    style.setProperty(`--ui-color-${name}-${shade}`, value)
  }
}

export function createThemeCssVariables(input: {
  primaryScale: ThemeColorScale
  neutralScale: ThemeColorScale
  primaryHex: string
  neutralHex: string
  radius: number
}): ThemeCssVariables {
  const variables: ThemeCssVariables = {
    ...createRadiusCssVariables(input.radius),
    '--hdx-theme-primary': input.primaryHex,
    '--hdx-theme-primary-rgb': hexToRgbTriplet(input.primaryHex),
    '--hdx-theme-neutral': input.neutralHex,
    '--hdx-theme-neutral-rgb': hexToRgbTriplet(input.neutralHex)
  }

  for (const [shade, value] of Object.entries(input.primaryScale)) {
    variables[`--ui-color-primary-${shade}`] = value
  }

  for (const [shade, value] of Object.entries(input.neutralScale)) {
    variables[`--ui-color-neutral-${shade}`] = value
  }

  return variables
}

export function createRadiusCssVariables(radius: number): ThemeCssVariables {
  const safeRadius = Number.isFinite(radius) && radius >= 0
    ? radius
    : Number.parseFloat(defaultThemePreference.radius)
  const cardRadius = Math.min(safeRadius * 3, 1.25)
  const panelRadius = Math.min(safeRadius * 4, 1.5)
  const popoverRadius = Math.min(safeRadius * 3, 1.25)
  const heroRadius = Math.min(safeRadius * 5, 2)
  const innerRadius = Math.min(safeRadius * 2, 0.875)
  const toolbarItemRadius = Math.max(safeRadius, popoverRadius - 0.25)

  return {
    '--ui-radius': formatRem(safeRadius),
    '--hdx-radius-control': formatRem(safeRadius),
    '--hdx-radius-card': formatRem(cardRadius),
    '--hdx-radius-panel': formatRem(panelRadius),
    '--hdx-radius-popover': formatRem(popoverRadius),
    '--hdx-radius-hero': formatRem(heroRadius),
    '--hdx-radius-inner': formatRem(innerRadius),
    '--hdx-radius-toolbar-item': formatRem(toolbarItemRadius)
  }
}

export function applyThemeCssVariables(style: CSSStyleDeclaration, variables: ThemeCssVariables) {
  for (const [name, value] of Object.entries(variables)) {
    style.setProperty(name, value)
  }
}

export function applyRadiusCssVariables(style: CSSStyleDeclaration, radius: number) {
  applyThemeCssVariables(style, createRadiusCssVariables(radius))
}

export function createScale(hex: string): ThemeColorScale {
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

export function createNeutralScale(hex: string): ThemeColorScale {
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

export function normalizeHex(value: string | undefined, fallback = defaultThemePreference.customPrimary) {
  if (!value) {
    return fallback
  }

  const trimmed = value.trim()
  const expanded = /^#[0-9a-f]{3}$/i.test(trimmed)
    ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
    : trimmed

  return hexColorSchema.safeParse(expanded).success ? expanded.toLowerCase() : fallback
}

export function hexToRgbTriplet(hex: string) {
  const color = hexToRgb(hex)
  return `${color.r}, ${color.g}, ${color.b}`
}

export function createThemePreferenceHeadScript() {
  return String.raw`
;(function () {
  try {
    var storageKey = ${JSON.stringify(themeCssVariablesStorageKey)};
    var raw = window.localStorage.getItem(storageKey);

    if (!raw) return;

    var variables = JSON.parse(raw);
    var namePattern = /^--(?:ui-color-(?:primary|neutral)-(?:50|100|200|300|400|500|600|700|800|900|950)|ui-radius|hdx-radius-(?:control|card|panel|popover|hero|inner|toolbar-item)|hdx-theme-(?:primary|neutral)(?:-rgb)?)$/;
    var valuePattern = /^(?:#[0-9a-f]{6}|[0-9]+(?:\.[0-9]+)?rem|[0-9]{1,3},\s*[0-9]{1,3},\s*[0-9]{1,3})$/i;
    var style = document.documentElement.style;

    Object.keys(variables).forEach(function (name) {
      var value = variables[name];

      if (namePattern.test(name) && typeof value === 'string' && valuePattern.test(value)) {
        style.setProperty(name, value);
      }
    });
  } catch (error) {}
})()
`
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

function formatRem(value: number) {
  return `${Number(value.toFixed(4))}rem`
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
