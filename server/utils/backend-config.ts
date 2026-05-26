import { z } from 'zod'
import { BoundaryError } from '~~/app/utils/api-error'

export const backendConfigSchema = z.object({
  backendBaseUrl: z.string().url(),
  backendLocalTokenHeader: z.string().min(1).optional(),
  backendLocalToken: z.string().min(1).optional()
})

export type BackendConfig = z.infer<typeof backendConfigSchema>

export function getBackendConfig(event: Parameters<typeof useRuntimeConfig>[0]): BackendConfig {
  const parsed = backendConfigSchema.safeParse(useRuntimeConfig(event))

  if (!parsed.success) {
    throw new BoundaryError('invalid-config', 'Web 服务配置无效。', 500)
  }

  return parsed.data
}
