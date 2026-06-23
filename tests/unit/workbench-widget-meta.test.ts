import { describe, expect, it } from 'vitest'
import { getWorkbenchWidgetMetadata, workbenchWidgetMetadata } from '../../app/utils/workbench-widget-meta'

describe('workbench widget metadata', () => {
  it('declares a user data boundary for every widget', () => {
    expect(workbenchWidgetMetadata.every(widget => Boolean(widget.data.moduleData.scope))).toBe(true)
    expect(workbenchWidgetMetadata.every(widget => Boolean(widget.data.modulePreferences.scope))).toBe(true)
    expect(workbenchWidgetMetadata.every(widget => Boolean(widget.data.runtimeState.scope))).toBe(true)
  })

  it('keeps timer preferences out of layout and runtime state on the current device', () => {
    const timer = getWorkbenchWidgetMetadata('timer')

    expect(timer?.data.modulePreferences).toEqual({
      scope: 'account',
      endpoint: '/api/v1/timer/preferences'
    })
    expect(timer?.data.runtimeState).toEqual({
      scope: 'device',
      storage: 'localStorage'
    })
  })

  it('declares date countdown holidays as shared module data without user preferences or runtime state', () => {
    const dateCountdown = getWorkbenchWidgetMetadata('date-countdown')

    expect(dateCountdown?.data.moduleData).toEqual({
      scope: 'shared',
      endpoint: '/api/v1/holidays'
    })
    expect(dateCountdown?.data.modulePreferences).toEqual({
      scope: 'none'
    })
    expect(dateCountdown?.data.runtimeState).toEqual({
      scope: 'none'
    })
  })
})
