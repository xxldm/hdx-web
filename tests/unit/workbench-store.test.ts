import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkbenchStore } from '../../app/stores/workbench'

const runtimeResponse = {
  application: 'hdx-core-service',
  topology: 'core-service',
  javaVersion: '25.0.3',
  nativeImage: false
}

const toolsResponse = [
  {
    id: 1,
    toolKey: 'demo',
    displayName: 'Demo',
    description: 'Demo tool',
    enabled: true,
    createdAt: '2026-05-26T00:00:00Z',
    updatedAt: '2026-05-26T00:00:00Z'
  }
]

describe('workbench store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('$fetch', vi.fn((url: string) => {
      if (url.endsWith('/runtime')) {
        return Promise.resolve(runtimeResponse)
      }

      if (url.endsWith('/tools')) {
        return Promise.resolve(toolsResponse)
      }

      return Promise.reject(new Error('unexpected url'))
    }))
  })

  it('loads and validates overview data', async () => {
    const store = useWorkbenchStore()

    await store.loadOverview()

    expect(store.runtime?.application).toBe('hdx-core-service')
    expect(store.tools).toHaveLength(1)
    expect(store.enabledTools).toHaveLength(1)
    expect(store.errorKey).toBeNull()
  })

  it('stores a readable error when loading fails', async () => {
    vi.stubGlobal('$fetch', vi.fn(() => Promise.reject(new Error('offline'))))
    const store = useWorkbenchStore()

    await store.loadOverview()

    expect(store.errorKey).toBe('workbench.loadFailed')
    expect(store.loading).toBe(false)
  })

  it('clears overview data for account switching', async () => {
    const store = useWorkbenchStore()

    await store.loadOverview()
    store.resetState()

    expect(store.runtime).toBeNull()
    expect(store.tools).toEqual([])
    expect(store.enabledTools).toEqual([])
    expect(store.errorKey).toBeNull()
    expect(store.loading).toBe(false)
  })
})
