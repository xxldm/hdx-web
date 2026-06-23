import { describe, expect, it } from 'vitest'
import {
  extractBoundaryErrorCode,
  extractFetchStatus,
  extractTimerPreferenceConflict,
  extractWorkbenchLayoutConflict,
  isAuthRequiredApiError,
  isTimerPreferenceConflictApiError,
  isWorkbenchLayoutConflictApiError
} from '../../app/utils/api-error'

describe('api error helpers', () => {
  it('detects direct auth-required boundary errors', () => {
    const error = {
      statusCode: 401,
      data: {
        code: 'auth-required'
      }
    }

    expect(extractFetchStatus(error)).toBe(401)
    expect(extractBoundaryErrorCode(error)).toBe('auth-required')
    expect(isAuthRequiredApiError(error)).toBe(true)
  })

  it('detects nested h3 auth-required boundary errors', () => {
    const error = {
      data: {
        statusCode: 401,
        data: {
          code: 'auth-required'
        }
      }
    }

    expect(extractFetchStatus(error)).toBe(401)
    expect(extractBoundaryErrorCode(error)).toBe('auth-required')
    expect(isAuthRequiredApiError(error)).toBe(true)
  })

  it('does not treat ordinary upstream failures as auth expiration', () => {
    const error = {
      statusCode: 502,
      data: {
        code: 'upstream-failed'
      }
    }

    expect(isAuthRequiredApiError(error)).toBe(false)
  })

  it('extracts direct workbench layout conflict payloads', () => {
    const error = {
      statusCode: 409,
      data: createWorkbenchLayoutConflictPayload()
    }

    expect(isWorkbenchLayoutConflictApiError(error)).toBe(true)
    expect(extractWorkbenchLayoutConflict(error)?.serverLayout.version).toBe(2)
  })

  it('extracts nested h3 workbench layout conflict payloads', () => {
    const error = {
      data: {
        statusCode: 409,
        data: createWorkbenchLayoutConflictPayload()
      }
    }

    expect(isWorkbenchLayoutConflictApiError(error)).toBe(true)
    expect(extractWorkbenchLayoutConflict(error)?.currentVersion).toBe(2)
  })

  it('extracts timer preference conflict payloads', () => {
    const error = {
      statusCode: 409,
      data: createTimerPreferenceConflictPayload()
    }

    expect(isTimerPreferenceConflictApiError(error)).toBe(true)
    expect(extractTimerPreferenceConflict(error)?.serverPreference.presets[0]?.durationSeconds).toBe(60)
  })
})

function createWorkbenchLayoutConflictPayload() {
  return {
    code: 'WORKBENCH_LAYOUT_CONFLICT',
    message: '工作台布局已在其他位置更新，请处理冲突。',
    resourceType: 'workbenchLayout',
    baseVersion: 1,
    currentVersion: 2,
    updatedAt: '2026-06-23T12:00:00Z',
    updatedByUserId: 'USER:2',
    serverLayout: {
      schemaVersion: 1,
      version: 2,
      rows: 4,
      columns: 4,
      gap: 12,
      widgets: []
    }
  }
}

function createTimerPreferenceConflictPayload() {
  return {
    code: 'TIMER_PREFERENCE_CONFLICT',
    message: '计时器预设已在其他位置更新，请处理冲突。',
    resourceType: 'timerPreferences',
    baseVersion: 1,
    currentVersion: 2,
    updatedAt: '2026-06-23T12:00:00Z',
    updatedByUserId: 'USER:2',
    serverPreference: {
      schemaVersion: 1,
      version: 2,
      presets: [
        {
          id: 'timer-60',
          order: 0,
          durationSeconds: 60,
          createdAt: '2026-06-23T12:00:00Z'
        }
      ]
    }
  }
}
