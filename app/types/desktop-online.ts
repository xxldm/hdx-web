import { z } from 'zod'

export const desktopOnlineConfigSchema = z.object({
  authBaseUrl: z.string().trim().url(),
  gatewayBaseUrl: z.string().trim().url(),
  requestTimeoutSeconds: z.number().int().min(1).max(60)
})

export type DesktopOnlineConfig = z.infer<typeof desktopOnlineConfigSchema>

export const desktopOnlineConfigStateSchema = z.object({
  available: z.boolean(),
  configured: z.boolean(),
  config: desktopOnlineConfigSchema.nullable(),
  message: z.string().nullable()
})

export type DesktopOnlineConfigState = z.infer<typeof desktopOnlineConfigStateSchema>

export const desktopOnlineEndpointCheckSchema = z.object({
  ok: z.boolean(),
  url: z.string().url(),
  statusCode: z.number().int().min(100).max(599).nullable(),
  elapsedMs: z.number().int().nonnegative(),
  message: z.string().min(1)
})

export type DesktopOnlineEndpointCheck = z.infer<typeof desktopOnlineEndpointCheckSchema>

export const desktopOnlineConnectionCheckResultSchema = z.object({
  ok: z.boolean(),
  auth: desktopOnlineEndpointCheckSchema,
  gateway: desktopOnlineEndpointCheckSchema
})

export type DesktopOnlineConnectionCheckResult = z.infer<typeof desktopOnlineConnectionCheckResultSchema>
