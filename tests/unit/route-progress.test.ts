import { describe, expect, it } from 'vitest'
import { createRouteProgressHalfArcPaths, estimateRouteProgress } from '../../app/composables/use-route-progress'

describe('route progress helpers', () => {
  it('uses Nuxt loading indicator default progress estimation', () => {
    expect(estimateRouteProgress(2000, 0)).toBe(0)
    expect(estimateRouteProgress(2000, 1000)).toBeCloseTo(50)
    expect(estimateRouteProgress(2000, 2000)).toBeCloseTo(70.483, 3)
  })

  it('creates matched top and bottom SVG half-border paths', () => {
    const paths = createRouteProgressHalfArcPaths({
      progress: 42,
      width: 720,
      height: 72,
      radius: 24
    })

    expect(paths.width).toBe(720)
    expect(paths.height).toBe(72)
    expect(paths.dashArray).toBe('42 100')
    expect(paths.topPath).toContain('M 0.5 36')
    expect(paths.topPath).toContain('L 719.5 36')
    expect(paths.bottomPath).toContain('M 0.5 36')
    expect(paths.bottomPath).toContain('L 719.5 36')
  })
})
