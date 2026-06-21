import { onUnmounted, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useWorkbenchLayoutStore } from '~/stores/workbench-layout'

interface UseWorkbenchWidgetEditSurfaceOptions {
  widgetId: MaybeRefOrGetter<string>
  editing: MaybeRefOrGetter<boolean>
  selected: MaybeRefOrGetter<boolean | undefined>
}

export function useWorkbenchWidgetEditSurface(options: UseWorkbenchWidgetEditSurfaceOptions) {
  const layout = useWorkbenchLayoutStore()
  const removeConfirmOpen = shallowRef(false)
  const isRemoving = shallowRef(false)
  const suppressNextEditActionClick = shallowRef(false)
  let removeWidgetTimer: number | null = null
  let suppressEditActionClickTimer: number | null = null

  function onConfirmRemoveWidget() {
    if (isRemoving.value) {
      return
    }

    removeConfirmOpen.value = false
    isRemoving.value = true
    removeWidgetTimer = window.setTimeout(() => {
      removeWidgetTimer = null
      layout.removeWidget(toValue(options.widgetId))
    }, 220)
  }

  function onCancelRemoveWidget() {
    removeConfirmOpen.value = false
  }

  function armEditActionClickGuard() {
    suppressNextEditActionClick.value = true

    if (suppressEditActionClickTimer !== null) {
      window.clearTimeout(suppressEditActionClickTimer)
    }

    suppressEditActionClickTimer = window.setTimeout(() => {
      suppressEditActionClickTimer = null
      suppressNextEditActionClick.value = false
    }, 350)
  }

  function clearEditActionClickGuard() {
    suppressNextEditActionClick.value = false

    if (suppressEditActionClickTimer !== null) {
      window.clearTimeout(suppressEditActionClickTimer)
      suppressEditActionClickTimer = null
    }
  }

  function onEditActionClickCapture(event: MouseEvent) {
    if (!suppressNextEditActionClick.value) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    clearEditActionClickGuard()
  }

  watch(() => toValue(options.selected), (selected) => {
    if (!selected) {
      removeConfirmOpen.value = false
      clearEditActionClickGuard()
    }
  })

  watch(() => toValue(options.editing), (editing) => {
    if (editing) {
      return
    }

    removeConfirmOpen.value = false
    clearEditActionClickGuard()
  })

  onUnmounted(() => {
    if (removeWidgetTimer !== null) {
      window.clearTimeout(removeWidgetTimer)
    }

    clearEditActionClickGuard()
  })

  return {
    removeConfirmOpen,
    isRemoving,
    onConfirmRemoveWidget,
    onCancelRemoveWidget,
    armEditActionClickGuard,
    onEditActionClickCapture
  }
}
