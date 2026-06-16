import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultWorkbenchLayout, placeWorkbenchWidgets, readStoredLayout, reorderLayoutWidgets, useWorkbenchLayoutStore, type WorkbenchLayoutWidget } from '../../app/stores/workbench-layout'

describe('workbench layout store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('falls back to the default layout when stored data is invalid', () => {
    const layout = readStoredLayout('{bad json')

    expect(layout).toEqual(createDefaultWorkbenchLayout())
  })

  it('places widgets by order while respecting spans', () => {
    const layout = {
      version: 1 as const,
      rows: 3,
      columns: 3,
      gap: 8,
      widgets: [
        createWidget('wide', 0, 2, 1),
        createWidget('tall', 1, 1, 2),
        createWidget('small', 2, 1, 1)
      ]
    }

    const placedWidgets = placeWorkbenchWidgets(layout)

    expect(placedWidgets.map(widget => ({ id: widget.id, row: widget.row, column: widget.column }))).toEqual([
      { id: 'wide', row: 0, column: 0 },
      { id: 'tall', row: 0, column: 2 },
      { id: 'small', row: 1, column: 0 }
    ])
  })

  it('reorders widgets by dragging one widget onto another', () => {
    const widgets = [
      createWidget('first', 0, 1, 1),
      createWidget('second', 1, 1, 1),
      createWidget('third', 2, 1, 1)
    ]

    const reorderedWidgets = reorderLayoutWidgets(widgets, 'third', 'first')

    expect(reorderedWidgets.map(widget => widget.id)).toEqual(['third', 'first', 'second'])
    expect(reorderedWidgets.map(widget => widget.order)).toEqual([0, 1, 2])
  })

  it('drops a widget after the target when dragging forward', () => {
    const widgets = [
      createWidget('first', 0, 1, 1),
      createWidget('second', 1, 1, 1),
      createWidget('third', 2, 1, 1)
    ]

    const reorderedWidgets = reorderLayoutWidgets(widgets, 'first', 'second')

    expect(reorderedWidgets.map(widget => widget.id)).toEqual(['second', 'first', 'third'])
    expect(reorderedWidgets.map(widget => widget.order)).toEqual([0, 1, 2])
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

  it('moves a widget earlier or later inside the draft layout', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    store.moveWidget('default-notes', -1)

    expect(store.widgets.map(widget => widget.id)).toEqual([
      'default-quick-links',
      'default-notes',
      'default-tool-catalog',
      'default-runtime'
    ])
  })

  it('previews drag ordering while keeping cancel rollback available', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    store.beginDrag('default-runtime')
    store.previewDragOverWidget('default-quick-links')

    expect(store.widgets.map(widget => widget.id)).toEqual([
      'default-quick-links',
      'default-tool-catalog',
      'default-notes',
      'default-runtime'
    ])
    expect(store.placedWidgets.map(widget => widget.id)).toEqual([
      'default-runtime',
      'default-quick-links',
      'default-tool-catalog',
      'default-notes'
    ])

    store.endDrag()

    expect(store.widgets.map(widget => widget.id)).toEqual([
      'default-quick-links',
      'default-tool-catalog',
      'default-notes',
      'default-runtime'
    ])
  })

  it('commits previewed drag ordering on drop', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    store.beginDrag('default-runtime')
    store.previewDragOverWidget('default-quick-links')
    store.dropOnWidget('default-quick-links')

    expect(store.widgets.map(widget => widget.id)).toEqual([
      'default-runtime',
      'default-quick-links',
      'default-tool-catalog',
      'default-notes'
    ])
  })

  it('tracks resize state while widget spans update', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    store.beginResize('default-quick-links')
    store.updateWidgetSpan('default-quick-links', { colSpan: 4, rowSpan: 2 })

    expect(store.resizingWidgetId).toBe('default-quick-links')
    expect(store.widgets.find(widget => widget.id === 'default-quick-links')).toMatchObject({
      colSpan: 4,
      rowSpan: 2
    })

    store.endResize()

    expect(store.resizingWidgetId).toBeNull()
  })

  it('keeps the last valid layout when a span update would push widgets out', () => {
    const store = useWorkbenchLayoutStore()

    store.startEditing()
    store.updateWidgetSpan('default-tool-catalog', { colSpan: 4, rowSpan: 4 })

    expect(store.widgets.find(widget => widget.id === 'default-tool-catalog')).toMatchObject({
      colSpan: 2,
      rowSpan: 2
    })
    expect(store.placedWidgets).toHaveLength(store.widgets.length)
  })
})

function createWidget(id: string, order: number, colSpan: number, rowSpan: number): WorkbenchLayoutWidget {
  return {
    id,
    key: 'quick-links',
    order,
    colSpan,
    rowSpan
  }
}
