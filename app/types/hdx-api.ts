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
  version: z.literal(1),
  rows: z.number().int().min(1).max(8),
  columns: z.number().int().min(1).max(8),
  gap: z.number().int().min(2).max(24),
  widgets: z.array(workbenchLayoutWidgetSchema).max(24)
})

export type WorkbenchLayoutRecord = z.infer<typeof workbenchLayoutSchema>
