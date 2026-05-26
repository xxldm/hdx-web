import { describe, expect, it, vi } from 'vitest'
import { getBackendConfig } from '../../server/utils/backend-config'

describe('backend config boundary', () => {
  it('parses private backend config', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      backendBaseUrl: 'http://localhost:18080',
      backendLocalTokenHeader: 'X-HDX-Local-Token',
      backendLocalToken: 'local-token',
      public: {
        appName: 'HDX'
      }
    }))

    expect(getBackendConfig({} as never)).toEqual({
      backendBaseUrl: 'http://localhost:18080',
      backendLocalTokenHeader: 'X-HDX-Local-Token',
      backendLocalToken: 'local-token'
    })
  })

  it('rejects invalid backend config', () => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      backendBaseUrl: 'not-a-url'
    }))

    expect(() => getBackendConfig({} as never)).toThrow('Web 服务配置无效。')
  })
})
