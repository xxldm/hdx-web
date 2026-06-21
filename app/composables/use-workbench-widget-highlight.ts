import type { WorkbenchWidgetKey } from '~/utils/workbench-widget-meta'

const highlightedWorkbenchWidgetKey = 'hdx:web:workbench:highlighted-widget-key'
let highlightedWidgetTimer: ReturnType<typeof window.setTimeout> | null = null

export function useWorkbenchWidgetHighlight() {
  const highlightedWidgetKey = useState<WorkbenchWidgetKey | null>(highlightedWorkbenchWidgetKey, () => null)

  function clearHighlightTimer() {
    if (!import.meta.client || highlightedWidgetTimer === null) {
      return
    }

    window.clearTimeout(highlightedWidgetTimer)
    highlightedWidgetTimer = null
  }

  function stopWorkbenchWidgetHighlight() {
    clearHighlightTimer()
    highlightedWidgetKey.value = null
  }

  function highlightWorkbenchWidget(widgetKey: WorkbenchWidgetKey) {
    highlightedWidgetKey.value = widgetKey

    if (!import.meta.client) {
      return
    }

    clearHighlightTimer()

    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-workbench-widget-key="${widgetKey}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    })

    highlightedWidgetTimer = window.setTimeout(() => {
      highlightedWidgetKey.value = null
      highlightedWidgetTimer = null
    }, 1400)
  }

  return {
    highlightedWidgetKey,
    highlightWorkbenchWidget,
    stopWorkbenchWidgetHighlight
  }
}
