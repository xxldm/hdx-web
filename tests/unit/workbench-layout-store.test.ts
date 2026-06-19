import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultWorkbenchLayout, moveLayoutWidget, placeWorkbenchWidgets, readStoredLayout, useWorkbenchLayoutStore, type WorkbenchLayoutWidget } from '../../app/stores/workbench-layout'
import { constrainWorkbenchWidgetSpan } from '../../app/utils/workbench-widget-meta'

describe('workbench layout store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('falls back to the default layout when stored data is invalid', () => {
    const layout = readStoredLayout('{bad json')

    expect(layout).toEqual(createDefaultWorkbenchLayout())
  })

  it('migrates order-only widgets to explicit grid coordinates', () => {
    const layout = {
      version: 1 as const,
      rows: 3,
      columns: 3,
      gap: 8,
      widgets: [
        createLegacyWidget('wide', 0, 2, 1),
        createLegacyWidget('tall', 1, 1, 2),
        createLegacyWidget('small', 2, 1, 1)
      ]
    }

    const placedWidgets = placeWorkbenchWidgets(layout)

    expect(placedWidgets.map(widget => ({ id: widget.id, row: widget.row, column: widget.column }))).toEqual([
      { id: 'wide', row: 0, column: 0 },
      { id: 'tall', row: 0, column: 2 },
      { id: 'small', row: 1, column: 0 }
    ])
    expect(placedWidgets[0]).toMatchObject({
      chrome: 'card',
      orientation: 'auto',
      header: {
        visible: true,
        icon: true,
        title: true,
        description: true
      }
    })
  })

  it('preserves explicit empty cells instead of compacting widgets', () => {
    const layout = {
      version: 1 as const,
      rows: 3,
      columns: 3,
      gap: 8,
      widgets: [
        createWidget('left', 0, 0, 0, 1, 1),
        createWidget('right', 1, 2, 0, 1, 1)
      ]
    }

    const placedWidgets = placeWorkbenchWidgets(layout)

    expect(placedWidgets.map(widget => ({ id: widget.id, row: widget.row, column: widget.column }))).toEqual([
      { id: 'left', row: 0, column: 0 },
      { id: 'right', row: 0, column: 2 }
    ])
  })

  it('moves a widget into an empty grid position', () => {
    const widgets = [
      createWidget('first', 0, 0, 0, 1, 1),
      createWidget('second', 1, 2, 0, 1, 1)
    ]

    const movedWidgets = moveLayoutWidget(widgets, 3, 3, 'second', { column: 1, row: 1 })

    expect(movedWidgets.find(widget => widget.id === 'second')).toMatchObject({
      column: 1,
      row: 1
    })
    expect(movedWidgets.find(widget => widget.id === 'first')).toMatchObject({
      column: 0,
      row: 0
    })
  })

  it('swaps positions when dropping onto another widget', () => {
    const widgets = [
      createWidget('first', 0, 0, 0, 1, 1),
      createWidget('second', 1, 2, 0, 1, 1)
    ]

    const movedWidgets = moveLayoutWidget(widgets, 3, 3, 'second', { column: 0, row: 0 }, 'first')

    expect(movedWidgets.find(widget => widget.id === 'second')).toMatchObject({
      column: 0,
      row: 0
    })
    expect(movedWidgets.find(widget => widget.id === 'first')).toMatchObject({
      column: 2,
      row: 0
    })
  })

  it('can place a small widget on a non-origin cell inside a larger widget area', () => {
    const widgets = [
      createWidget('small', 0, 0, 0, 1, 1),
      createWidget('large', 1, 1, 0, 2, 2)
    ]

    const movedWidgets = moveLayoutWidget(widgets, 3, 4, 'small', { column: 2, row: 1 }, 'large')

    expect(movedWidgets.find(widget => widget.id === 'small')).toMatchObject({
      column: 2,
      row: 1
    })
  })

  it('moves the displaced large widget when the requested inner cell would block a direct swap', () => {
    const widgets = [
      createWidget('small', 0, 0, 0, 1, 1),
      createWidget('large', 1, 1, 0, 2, 2)
    ]

    const movedWidgets = moveLayoutWidget(widgets, 4, 4, 'small', { column: 1, row: 1 }, 'large')

    expect(movedWidgets.find(widget => widget.id === 'small')).toMatchObject({
      column: 1,
      row: 1
    })
    expect(movedWidgets.find(widget => widget.id === 'large')).toMatchObject({
      column: 2,
      row: 0
    })
  })

  it('pushes affected widgets by the minimum required rows when a short widget moves back upward', () => {
    const widgets = [
      createWidget('quick-links', 0, 0, 2, 4, 1),
      createWidget('notes', 1, 0, 0, 2, 2),
      createWidget('runtime', 2, 2, 0, 2, 1)
    ]

    const movedWidgets = moveLayoutWidget(
      widgets,
      4,
      4,
      'quick-links',
      { column: 0, row: 0 },
      'notes',
      'down'
    )

    expect(movedWidgets.find(widget => widget.id === 'quick-links')).toMatchObject({
      column: 0,
      row: 0
    })
    expect(movedWidgets.find(widget => widget.id === 'notes')).toMatchObject({
      column: 0,
      row: 1
    })
    expect(movedWidgets.find(widget => widget.id === 'runtime')).toMatchObject({
      column: 2,
      row: 1
    })
  })

  it('saves draft changes to local storage', async () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    store.setColumns(3)
    store.saveEditing()
    await nextTick()

    expect(store.columns).toBe(3)
    expect(readStoredLayout(localStorage.getItem('hdx:web:workbench-layout:v1') ?? '').columns).toBe(3)
  })

  it('moves a widget earlier or later by swapping coordinates', () => {
    const store = useWorkbenchLayoutStore()
    const runtimeBeforeMove = store.widgets.find(widget => widget.id === 'default-runtime')
    const notesBeforeMove = store.widgets.find(widget => widget.id === 'default-notes')

    store.startEditing()
    store.moveWidget('default-runtime', -1)

    expect(store.widgets.find(widget => widget.id === 'default-runtime')).toMatchObject({
      column: notesBeforeMove?.column,
      row: notesBeforeMove?.row
    })
    expect(store.widgets.find(widget => widget.id === 'default-notes')).toMatchObject({
      column: runtimeBeforeMove?.column,
      row: runtimeBeforeMove?.row
    })
  })

  it('previews drag coordinates while keeping cancel rollback available', () => {
    const store = useWorkbenchLayoutStore()
    const runtimeBeforeDrag = store.widgets.find(widget => widget.id === 'default-runtime')

    store.startEditing()
    store.beginDrag('default-runtime')
    store.previewDragOverPosition(null, { column: 3, row: 3 })

    expect(store.placedWidgets.find(widget => widget.id === 'default-runtime')).toMatchObject({
      column: 3,
      row: 3
    })

    store.endDrag()

    expect(store.widgets.find(widget => widget.id === 'default-runtime')).toMatchObject({
      column: runtimeBeforeDrag?.column,
      row: runtimeBeforeDrag?.row
    })
  })

  it('commits previewed coordinates on drop', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    store.beginDrag('default-runtime')
    store.previewDragOverPosition(null, { column: 3, row: 3 })
    store.dropOnMarkedTarget()

    expect(store.widgets.find(widget => widget.id === 'default-runtime')).toMatchObject({
      column: 3,
      row: 3
    })
  })

  it('adds a widget at a requested empty coordinate', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    expect(store.addWidgetAt('runtime', { column: 3, row: 3 })).toBe(true)

    expect(store.widgets.find(widget => widget.id.startsWith('runtime-'))).toMatchObject({
      key: 'runtime',
      column: 3,
      row: 3
    })
  })

  it('does not add a widget at an occupied coordinate', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()

    expect(store.canAddWidgetAt('runtime', { column: 0, row: 0 })).toBe(false)
    expect(store.addWidgetAt('runtime', { column: 0, row: 0 })).toBe(false)
  })

  it('does not change widget key when the target widget size no longer fits at the current position', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    expect(store.canUpdateWidgetKey('default-runtime', 'tool-catalog')).toBe(false)
    expect(store.updateWidgetKey('default-runtime', 'tool-catalog')).toBe(false)
    expect(store.widgets.find(widget => widget.id === 'default-runtime')).toMatchObject({
      key: 'runtime',
      colSpan: 1,
      rowSpan: 1
    })
  })

  it('changes widget key when the target widget size still fits at the current position', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    expect(store.canUpdateWidgetKey('default-quick-links', 'runtime')).toBe(true)
    expect(store.updateWidgetKey('default-quick-links', 'runtime')).toBe(true)
    expect(store.widgets.find(widget => widget.id === 'default-quick-links')).toMatchObject({
      key: 'runtime',
      colSpan: 1,
      rowSpan: 1
    })
  })

  it('tracks resize state while widget spans update', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    store.beginResize('default-runtime')
    store.updateWidgetSpan('default-runtime', { colSpan: 1, rowSpan: 2 })

    expect(store.resizingWidgetId).toBe('default-runtime')
    expect(store.widgets.find(widget => widget.id === 'default-runtime')).toMatchObject({
      colSpan: 1,
      rowSpan: 2
    })

    store.endResize()

    expect(store.resizingWidgetId).toBeNull()
  })

  it('persists widget chrome, orientation, and header display preferences', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    store.updateWidgetChrome('default-runtime', 'bare')
    store.updateWidgetOrientation('default-runtime', 'vertical')
    store.updateWidgetHeader('default-runtime', {
      visible: false,
      icon: false
    })

    expect(store.widgets.find(widget => widget.id === 'default-runtime')).toMatchObject({
      chrome: 'bare',
      orientation: 'vertical',
      header: {
        visible: false,
        icon: false,
        title: true,
        description: true
      }
    })
  })

  it('clamps widgets to optional registry constraints when resizing', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    store.removeWidget('default-quick-links')
    store.removeWidget('default-tool-catalog')
    store.removeWidget('default-notes')
    store.updateWidgetSpan('default-runtime', { colSpan: 4, rowSpan: 4 })

    expect(store.widgets.find(widget => widget.id === 'default-runtime')).toMatchObject({
      colSpan: 2,
      rowSpan: 2
    })
  })

  it('keeps the last valid layout when a span update would collide with another widget', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    store.updateWidgetSpan('default-tool-catalog', { colSpan: 4, rowSpan: 4 })

    expect(store.widgets.find(widget => widget.id === 'default-tool-catalog')).toMatchObject({
      colSpan: 2,
      rowSpan: 2
    })
    expect(store.placedWidgets).toHaveLength(store.widgets.length)
  })

  it('shares widget span constraints with resize feedback helpers', () => {
    expect(constrainWorkbenchWidgetSpan('runtime', 4, 4, 4, 4)).toEqual({
      colSpan: 2,
      rowSpan: 2
    })
    expect(constrainWorkbenchWidgetSpan('quick-links', 10, 10, 3, 4)).toEqual({
      colSpan: 4,
      rowSpan: 3
    })
  })
})

function createLegacyWidget(id: string, order: number, colSpan: number, rowSpan: number) {
  return {
    id,
    key: 'quick-links' as const,
    order,
    colSpan,
    rowSpan
  }
}

function createWidget(id: string, order: number, column: number, row: number, colSpan: number, rowSpan: number): WorkbenchLayoutWidget {
  return {
    id,
    key: 'quick-links',
    order,
    column,
    row,
    colSpan,
    rowSpan,
    chrome: 'card',
    orientation: 'auto',
    header: {
      visible: true,
      icon: true,
      title: true,
      description: true
    }
  }
}
