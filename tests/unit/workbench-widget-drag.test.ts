import { describe, expect, it } from 'vitest'
import { resolveWorkbenchDragPushDirection } from '../../app/composables/use-workbench-widget-drag'

describe('workbench widget drag', () => {
  it('keeps the push direction anchored to the original vertical side', () => {
    const sourceRect = createGridRect(0, 2, 4, 1)
    const targetRect = createGridRect(0, 0, 2, 2)

    expect(resolveWorkbenchDragPushDirection(sourceRect, targetRect, false, {
      dragCenterX: 100,
      dragCenterY: 20,
      rectCenterX: 100,
      rectCenterY: 120
    })).toBe('down')
  })

  it('keeps the push direction anchored to the original horizontal side', () => {
    const sourceRect = createGridRect(0, 0, 1, 1)
    const targetRect = createGridRect(2, 0, 1, 1)

    expect(resolveWorkbenchDragPushDirection(sourceRect, targetRect, true, {
      dragCenterX: 260,
      dragCenterY: 80,
      rectCenterX: 220,
      rectCenterY: 80
    })).toBe('left')
  })

  it('falls back to current center when the original axis overlaps', () => {
    const sourceRect = createGridRect(0, 0, 2, 1)
    const targetRect = createGridRect(1, 0, 2, 1)

    expect(resolveWorkbenchDragPushDirection(sourceRect, targetRect, true, {
      dragCenterX: 260,
      dragCenterY: 80,
      rectCenterX: 220,
      rectCenterY: 80
    })).toBe('right')
  })

})

function createGridRect(column: number, row: number, colSpan: number, rowSpan: number) {
  return {
    column,
    row,
    colSpan,
    rowSpan
  }
}
