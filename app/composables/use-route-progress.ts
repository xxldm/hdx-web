const routeProgressActiveKey = 'hdx:web:route-progress:active'
const routeProgressValueKey = 'hdx:web:route-progress:value'

interface RouteProgressHalfArcPathOptions {
  progress: number
  width: number
  height: number
  radius: number
}

export function useRouteProgressState() {
  const active = useState<boolean>(routeProgressActiveKey, () => false)
  const progress = useState<number>(routeProgressValueKey, () => 0)

  return {
    active,
    progress
  }
}

export function estimateRouteProgress(duration: number, elapsed: number) {
  const completionPercentage = elapsed / duration * 100

  return 2 / Math.PI * 100 * Math.atan(completionPercentage / 50)
}

export function createRouteProgressHalfArcPaths(options: RouteProgressHalfArcPathOptions) {
  const safeWidth = Math.max(1, options.width)
  const safeHeight = Math.max(1, options.height)
  const strokeCenterInset = 0.5
  const left = strokeCenterInset
  const top = strokeCenterInset
  const right = Math.max(left, safeWidth - strokeCenterInset)
  const bottom = Math.max(top, safeHeight - strokeCenterInset)
  const centerY = safeHeight / 2
  const maxRadius = Math.max(0, Math.min(safeWidth / 2, safeHeight / 2) - strokeCenterInset)
  const radius = clampNumber(options.radius, 0, maxRadius)
  const dashProgress = clampNumber(options.progress, 0, 100)

  return {
    width: safeWidth,
    height: safeHeight,
    dashArray: `${dashProgress} 100`,
    topPath: [
      `M ${left} ${centerY}`,
      `L ${left} ${top + radius}`,
      `Q ${left} ${top} ${left + radius} ${top}`,
      `L ${right - radius} ${top}`,
      `Q ${right} ${top} ${right} ${top + radius}`,
      `L ${right} ${centerY}`
    ].join(' '),
    bottomPath: [
      `M ${left} ${centerY}`,
      `L ${left} ${bottom - radius}`,
      `Q ${left} ${bottom} ${left + radius} ${bottom}`,
      `L ${right - radius} ${bottom}`,
      `Q ${right} ${bottom} ${right} ${bottom - radius}`,
      `L ${right} ${centerY}`
    ].join(' ')
  }
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
