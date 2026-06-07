import { z } from 'zod'

export const webAuthLoginRequestSchema = z.object({
  identifier: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200)
})

export type WebAuthLoginRequest = z.infer<typeof webAuthLoginRequestSchema>

export const backendAuthUserSchema = z.object({
  id: z.number().int().nonnegative(),
  displayName: z.string().min(1).max(120)
})

export type BackendAuthUser = z.infer<typeof backendAuthUserSchema>

export const webAuthActorTypeSchema = z.enum(['USER', 'LOCAL_ADMIN'])

export type WebAuthActorType = z.infer<typeof webAuthActorTypeSchema>

export const backendAuthTokenResponseSchema = z.object({
  tokenType: z.literal('Bearer'),
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.string().datetime(),
  refreshToken: z.string().min(1).max(200),
  refreshTokenExpiresAt: z.string().datetime(),
  sid: z.string().min(1).max(80),
  user: backendAuthUserSchema,
  roles: z.array(z.string().min(1)),
  permissions: z.array(z.string().min(1))
})

export type BackendAuthTokenResponse = z.infer<typeof backendAuthTokenResponseSchema>

export const webAuthSessionDataSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.string().datetime(),
  refreshToken: z.string().min(1).max(200),
  refreshTokenExpiresAt: z.string().datetime(),
  sid: z.string().min(1).max(80),
  user: backendAuthUserSchema,
  roles: z.array(z.string().min(1)),
  permissions: z.array(z.string().min(1))
})

export type WebAuthSessionData = z.infer<typeof webAuthSessionDataSchema>

export const webAuthPublicSessionSchema = z.object({
  authenticated: z.boolean(),
  csrfToken: z.string().min(32),
  accessTokenExpiresAt: z.string().datetime().nullable(),
  refreshTokenExpiresAt: z.string().datetime().nullable(),
  sid: z.string().nullable(),
  actorType: webAuthActorTypeSchema.nullable(),
  subject: z.string().min(1).nullable(),
  user: backendAuthUserSchema.nullable(),
  roles: z.array(z.string()),
  permissions: z.array(z.string())
})

export type WebAuthPublicSession = z.infer<typeof webAuthPublicSessionSchema>
