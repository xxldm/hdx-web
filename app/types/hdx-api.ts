import { z } from 'zod'

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
