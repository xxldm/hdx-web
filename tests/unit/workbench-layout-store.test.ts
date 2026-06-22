import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultWorkbenchLayout, defaultWorkbenchLayoutWidgetKeys, moveLayoutWidget, placeWorkbenchWidgets, readStoredLayout, useWorkbenchLayoutStore, type WorkbenchLayoutWidget } from '../../app/stores/workbench-layout'
import { constrainWorkbenchWidgetSpan } from '../../app/utils/workbench-widget-meta'

const fetchWorkbenchLayoutMock = vi.hoisted(() => vi.fn())
const saveWorkbenchLayoutMock = vi.hoisted(() => vi.fn())

vi.mock('../../app/utils/hdx-api-client', () => ({
  fetchWorkbenchLayout: fetchWorkbenchLayoutMock,
  saveWorkbenchLayout: saveWorkbenchLayoutMock
}))

describe('workbench layout store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    fetchWorkbenchLayoutMock.mockReset()
    fetchWorkbenchLayoutMock.mockResolvedValue(createDefaultWorkbenchLayout())
    saveWorkbenchLayoutMock.mockReset()
    saveWorkbenchLayoutMock.mockImplementation(async value => value)
  })

  it('falls back to the default layout when stored data is invalid', () => {
    const layout = readStoredLayout('{bad json')

    expect(layout).toEqual(createDefaultWorkbenchLayout())
  })

  it('keeps the default layout as an explicit curated set instead of every registry widget', () => {
    const layout = createDefaultWorkbenchLayout()

    expect(layout.widgets.map(widget => widget.key)).toEqual([...defaultWorkbenchLayoutWidgetKeys])
    expect(layout.widgets.some(widget => widget.key === 'timer')).toBe(false)
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

  it('keeps the dragged multi-row widget anchored while pushing a top widget down', () => {
    const widgets = [
      createWidget('tool-catalog', 0, 0, 0, 2, 2),
      createWidget('notes', 1, 0, 2, 2, 2)
    ]

    const movedWidgets = moveLayoutWidget(
      widgets,
      4,
      4,
      'notes',
      { column: 0, row: 0 },
      'tool-catalog',
      'down'
    )

    expect(movedWidgets.find(widget => widget.id === 'notes')).toMatchObject({
      column: 0,
      row: 0
    })
    expect(movedWidgets.find(widget => widget.id === 'tool-catalog')).toMatchObject({
      column: 0,
      row: 2
    })
  })

  it('loads layout from backend as the source of truth', async () => {
    const remoteLayout = {
      ...createDefaultWorkbenchLayout(),
      columns: 3
    }
    fetchWorkbenchLayoutMock.mockResolvedValueOnce(remoteLayout)
    const store = useWorkbenchLayoutStore()

    await store.loadLayout()

    expect(store.columns).toBe(3)
    expect(localStorage.getItem('hdx:web:workbench-layout:v1')).toBeNull()
  })

  it('uses an empty layout when backend layout loading fails', async () => {
    fetchWorkbenchLayoutMock.mockRejectedValueOnce(new Error('offline'))
    const store = useWorkbenchLayoutStore()

    await store.loadLayout()

    expect(store.widgets).toEqual([])
    expect(store.errorKey).toBe('workbench.layout.loadFailed')
    expect(store.loading).toBe(false)
  })

  it('clears loaded layout and edit state for account switching', async () => {
    const store = await createLoadedStore()

    store.startEditing()
    store.beginDrag('default-runtime')
    store.previewDragOverPosition(null, { column: 3, row: 3 })
    store.beginResize('default-runtime')
    store.resetState()

    expect(store.initialized).toBe(false)
    expect(store.editing).toBe(false)
    expect(store.loading).toBe(false)
    expect(store.saving).toBe(false)
    expect(store.errorKey).toBeNull()
    expect(store.widgets).toEqual([])
    expect(store.draggedWidgetId).toBeNull()
    expect(store.dropTargetWidgetId).toBeNull()
    expect(store.resizingWidgetId).toBeNull()
  })

  it('saves draft changes through backend persistence', async () => {
    const store = await createLoadedStore()

    store.startEditing()
    store.setColumns(3)
    await store.saveEditing()

    expect(store.columns).toBe(3)
    expect(saveWorkbenchLayoutMock).toHaveBeenCalledWith(expect.objectContaining({
      columns: 3
    }))
    expect(localStorage.getItem('hdx:web:workbench-layout:v1')).toBeNull()
  })

  it('moves a widget earlier or later through the current layout rules', async () => {
    const store = await createLoadedStore()
    const runtimeIndexBeforeMove = store.widgets.findIndex(widget => widget.id === 'default-runtime')
    const targetBeforeMove = store.widgets[runtimeIndexBeforeMove - 1]

    expect(targetBeforeMove).toBeTruthy()

    store.startEditing()
    store.moveWidget('default-runtime', -1)

    expect(store.widgets.find(widget => widget.id === 'default-runtime')).toMatchObject({
      column: targetBeforeMove?.column,
      row: targetBeforeMove?.row
    })
    expect(store.widgets.find(widget => widget.id === targetBeforeMove?.id)).not.toMatchObject({
      column: targetBeforeMove?.column,
      row: targetBeforeMove?.row
    })
    expect(store.placedWidgets).toHaveLength(store.widgets.length)
  })

  it('previews drag coordinates while keeping cancel rollback available', async () => {
    const store = await createLoadedStore()
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

  it('commits previewed coordinates on drop', async () => {
    const store = await createLoadedStore()

    store.startEditing()
    store.beginDrag('default-runtime')
    store.previewDragOverPosition(null, { column: 3, row: 3 })
    store.dropOnMarkedTarget()

    expect(store.widgets.find(widget => widget.id === 'default-runtime')).toMatchObject({
      column: 3,
      row: 3
    })
  })

  it('adds a widget at a requested empty coordinate', async () => {
    const store = await createLoadedStore()

    store.startEditing()
    expect(store.addWidgetAt('timer', { column: 3, row: 3 })).toBe(true)

    expect(store.widgets.find(widget => widget.id.startsWith('timer-'))).toMatchObject({
      key: 'timer',
      column: 3,
      row: 3
    })
  })

  it('does not add a widget at an occupied coordinate', async () => {
    const store = await createLoadedStore()

    store.startEditing()

    expect(store.canAddWidgetAt('runtime', { column: 0, row: 0 })).toBe(false)
    expect(store.addWidgetAt('runtime', { column: 0, row: 0 })).toBe(false)
  })

  it('does not change widget key when the target widget size no longer fits at the current position', async () => {
    const store = await createLoadedStore()

    store.startEditing()
    expect(store.canUpdateWidgetKey('default-runtime', 'tool-catalog')).toBe(false)
    expect(store.updateWidgetKey('default-runtime', 'tool-catalog')).toBe(false)
    expect(store.widgets.find(widget => widget.id === 'default-runtime')).toMatchObject({
      key: 'runtime',
      colSpan: 1,
      rowSpan: 1
    })
  })

  it('changes widget key when the target widget size still fits at the current position', async () => {
    const store = await createLoadedStore()

    store.startEditing()
    expect(store.canUpdateWidgetKey('default-quick-links', 'runtime')).toBe(true)
    expect(store.updateWidgetKey('default-quick-links', 'runtime')).toBe(true)
    expect(store.widgets.find(widget => widget.id === 'default-quick-links')).toMatchObject({
      key: 'runtime',
      colSpan: 1,
      rowSpan: 1
    })
  })

  it('tracks resize state while widget spans update', async () => {
    const store = await createLoadedStore()

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

  it('persists widget chrome, orientation, and header display preferences', async () => {
    const store = await createLoadedStore()

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

  it('clamps widgets to optional registry constraints when resizing', async () => {
    const store = await createLoadedStore()

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

  it('keeps the last valid layout when a span update would collide with another widget', async () => {
    const store = await createLoadedStore()

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

async function createLoadedStore() {
  const store = useWorkbenchLayoutStore()
  await store.loadLayout()
  return store
}

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
