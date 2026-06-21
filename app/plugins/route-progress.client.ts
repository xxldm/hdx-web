const minRouteProgressVisibleMs = 280
const routeProgressEstimatedDurationMs = 2000

export default defineNuxtPlugin(() => {
  const router = useRouter()
  const { active, progress } = useRouteProgressState()

  let progressFrame: number | null = null
  let hideTimer: ReturnType<typeof window.setTimeout> | null = null
  let startedAt = 0

  function clearProgressFrame() {
    if (progressFrame === null) {
      return
    }

    window.cancelAnimationFrame(progressFrame)
    progressFrame = null
  }

  function clearHideTimer() {
    if (hideTimer === null) {
      return
    }

    window.clearTimeout(hideTimer)
    hideTimer = null
  }

  function startProgress() {
    clearHideTimer()
    clearProgressFrame()

    startedAt = window.performance.now()
    active.value = true
    progress.value = 0

    const updateProgress = () => {
      const elapsed = window.performance.now() - startedAt

      progress.value = Math.max(0, Math.min(100, estimateRouteProgress(routeProgressEstimatedDurationMs, elapsed)))
      progressFrame = window.requestAnimationFrame(updateProgress)
    }

    progressFrame = window.requestAnimationFrame(updateProgress)
  }

  function finishProgress() {
    clearProgressFrame()

    if (!active.value) {
      progress.value = 0
      return
    }

    progress.value = 100

    const elapsed = window.performance.now() - startedAt
    const hideDelay = Math.max(120, minRouteProgressVisibleMs - elapsed)

    clearHideTimer()
    hideTimer = window.setTimeout(() => {
      active.value = false
      progress.value = 0
      hideTimer = null
    }, hideDelay)
  }

  router.beforeEach((to, from) => {
    if (to.fullPath !== from.fullPath) {
      startProgress()
    }
  })

  router.afterEach(() => {
    finishProgress()
  })

  router.onError(() => {
    finishProgress()
  })
})
