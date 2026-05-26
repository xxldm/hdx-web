import { describe, expect, it } from 'vitest'
import { createToolRequestSchema, runtimeInfoSchema, toolRecordsSchema } from '../../app/types/hdx-api'

describe('hdx api schemas', () => {
  it('parses runtime info responses', () => {
    expect(runtimeInfoSchema.parse({
      application: 'hdx-core-service',
      topology: 'core-service',
      javaVersion: '25.0.3',
      nativeImage: false
    })).toEqual({
      application: 'hdx-core-service',
      topology: 'core-service',
      javaVersion: '25.0.3',
      nativeImage: false
    })
  })

  it('rejects invalid tool request input', () => {
    expect(createToolRequestSchema.safeParse({
      toolKey: '',
      displayName: '工具'
    }).success).toBe(false)
  })

  it('parses tool record arrays', () => {
    expect(toolRecordsSchema.parse([
      {
        id: 1,
        toolKey: 'demo',
        displayName: 'Demo',
        description: null,
        enabled: true,
        createdAt: '2026-05-26T00:00:00Z',
        updatedAt: '2026-05-26T00:00:00Z'
      }
    ])).toHaveLength(1)
  })
})
