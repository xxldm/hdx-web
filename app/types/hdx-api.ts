import { z } from 'zod'

export const backendApiErrorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1)
})

export type BackendApiErrorResponse = z.infer<typeof backendApiErrorResponseSchema>

export const runtimeInfoSchema = z.object({
  application: z.string().min(1),
  topology: z.string().min(1),
  javaVersion: z.string().min(1),
  nativeImage: z.boolean()
})

export type RuntimeInfo = z.infer<typeof runtimeInfoSchema>

export const toolRecordSchema = z.object({
  id: z.number().int().nonnegative(),
  toolKey: z.string().min(1).max(80),
  displayName: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type ToolRecord = z.infer<typeof toolRecordSchema>

export const toolRecordsSchema = z.array(toolRecordSchema)

export const createToolRequestSchema = z.object({
  toolKey: z.string().trim().min(1).max(80),
  displayName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional()
})

export type CreateToolRequest = z.infer<typeof createToolRequestSchema>

export const workbenchLayoutHeaderSchema = z.object({
  visible: z.boolean(),
  icon: z.boolean(),
  title: z.boolean(),
  description: z.boolean()
})

export type WorkbenchLayoutHeader = z.infer<typeof workbenchLayoutHeaderSchema>

export const workbenchLayoutWidgetSchema = z.object({
  id: z.string().min(1).max(120),
  key: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
  order: z.number().int().min(0).max(23),
  column: z.number().int().min(0).max(7),
  row: z.number().int().min(0).max(7),
  colSpan: z.number().int().min(1).max(8),
  rowSpan: z.number().int().min(1).max(8),
  chrome: z.enum(['card', 'bare']),
  orientation: z.enum(['auto', 'horizontal', 'vertical']),
  header: workbenchLayoutHeaderSchema
})

export type WorkbenchLayoutWidgetRecord = z.infer<typeof workbenchLayoutWidgetSchema>

export const workbenchLayoutSchema = z.object({
  schemaVersion: z.literal(1),
  version: z.number().int().nonnegative(),
  rows: z.number().int().min(1).max(8),
  columns: z.number().int().min(1).max(8),
  gap: z.number().int().min(2).max(24),
  widgets: z.array(workbenchLayoutWidgetSchema).max(24)
})

export type WorkbenchLayoutRecord = z.infer<typeof workbenchLayoutSchema>

export const workbenchLayoutConflictResponseSchema = z.object({
  code: z.literal('WORKBENCH_LAYOUT_CONFLICT'),
  message: z.string().min(1),
  resourceType: z.literal('workbenchLayout'),
  baseVersion: z.number().int().nonnegative(),
  currentVersion: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  updatedByUserId: z.string().min(1),
  serverLayout: workbenchLayoutSchema
})

export type WorkbenchLayoutConflictResponse = z.infer<typeof workbenchLayoutConflictResponseSchema>

export const timerPreferencePresetRequestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
  order: z.number().int().min(0).max(23),
  durationSeconds: z.number().int().min(1).max(24 * 60 * 60)
})

export type TimerPreferencePresetRequest = z.infer<typeof timerPreferencePresetRequestSchema>

export const timerPreferencePresetSchema = timerPreferencePresetRequestSchema.extend({
  createdAt: z.string().datetime()
})

export type TimerPreferencePresetRecord = z.infer<typeof timerPreferencePresetSchema>

export const timerPreferenceSchema = z.object({
  schemaVersion: z.literal(1),
  version: z.number().int().nonnegative(),
  presets: z.array(timerPreferencePresetSchema).min(1).max(24)
})

export type TimerPreferenceRecord = z.infer<typeof timerPreferenceSchema>

export const timerPreferenceSaveSchema = z.object({
  schemaVersion: z.literal(1),
  version: z.number().int().nonnegative(),
  presets: z.array(timerPreferencePresetRequestSchema).min(1).max(24)
})

export type TimerPreferenceSaveRequest = z.infer<typeof timerPreferenceSaveSchema>

export const timerPreferenceConflictResponseSchema = z.object({
  code: z.literal('TIMER_PREFERENCE_CONFLICT'),
  message: z.string().min(1),
  resourceType: z.literal('timerPreferences'),
  baseVersion: z.number().int().nonnegative(),
  currentVersion: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  updatedByUserId: z.string().min(1),
  serverPreference: timerPreferenceSchema
})

export type TimerPreferenceConflictResponse = z.infer<typeof timerPreferenceConflictResponseSchema>

export const userPreferenceThemeSchema = z.object({
  primaryMode: z.enum(['preset', 'custom']),
  primary: z.enum([
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
  ]),
  customPrimary: z.string().regex(/^#[0-9a-f]{6}$/i),
  neutralMode: z.enum(['preset', 'custom']),
  neutral: z.enum(['slate', 'gray', 'zinc', 'neutral', 'stone', 'taupe', 'mauve', 'mist', 'olive']),
  customNeutral: z.string().regex(/^#[0-9a-f]{6}$/i),
  radius: z.enum(['0', '0.125', '0.25', '0.375', '0.5'])
})

export type UserPreferenceThemeRecord = z.infer<typeof userPreferenceThemeSchema>

export const userPreferenceNavigationSchema = z.object({
  pinnedItemIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/)).max(6)
})

export type UserPreferenceNavigationRecord = z.infer<typeof userPreferenceNavigationSchema>

export const userPreferenceSchema = z.object({
  schemaVersion: z.literal(1),
  version: z.number().int().nonnegative(),
  locale: z.enum(['zh-CN', 'en-US']),
  colorMode: z.enum(['system', 'light', 'dark']),
  theme: userPreferenceThemeSchema,
  navigation: userPreferenceNavigationSchema
})

export type UserPreferenceRecord = z.infer<typeof userPreferenceSchema>

export const userPreferenceSaveSchema = userPreferenceSchema

export type UserPreferenceSaveRequest = z.infer<typeof userPreferenceSaveSchema>

export const userPreferenceConflictResponseSchema = z.object({
  code: z.literal('USER_PREFERENCE_CONFLICT'),
  message: z.string().min(1),
  resourceType: z.literal('userPreferences'),
  baseVersion: z.number().int().nonnegative(),
  currentVersion: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  updatedByUserId: z.string().min(1),
  serverPreference: userPreferenceSchema
})

export type UserPreferenceConflictResponse = z.infer<typeof userPreferenceConflictResponseSchema>
