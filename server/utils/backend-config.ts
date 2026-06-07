import { z } from 'zod'
import { BoundaryError } from '~~/app/utils/api-error'

const optionalNonBlankStringSchema = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().min(1).optional()
)

export const backendConfigSchema = z.object({
  backendBaseUrl: z.string().url(),
  authBaseUrl: z.string().url(),
  backendLocalTokenHeader: optionalNonBlankStringSchema,
  backendLocalToken: optionalNonBlankStringSchema,
  authSessionCookieName: z.string().min(1),
  authSessionSecret: z.string().min(32),
  authCsrfCookieName: z.string().min(1),
  authCsrfHeaderName: z.string().min(1),
  authCookieSecure: z.boolean(),
  authSessionMaxAgeSeconds: z.number().int().positive(),
  authRefreshSkewSeconds: z.number().int().nonnegative()
})

export type BackendConfig = z.infer<typeof backendConfigSchema>

export function getBackendConfig(event: Parameters<typeof useRuntimeConfig>[0]): BackendConfig {
  const parsed = backendConfigSchema.safeParse(useRuntimeConfig(event))

  if (!parsed.success) {
    throw new BoundaryError('invalid-config', 'Web 服务配置无效。', 500)
  }

  return parsed.data
}

export function isAllInOneBackendConfig(config: BackendConfig) {
  return Boolean(config.backendLocalTokenHeader && config.backendLocalToken)
}
