import type { Component } from 'vue'
import ToolCatalogWidget from '~/components/workbench/widgets/ToolCatalogWidget.vue'
import ToolboxNotesWidget from '~/components/workbench/widgets/ToolboxNotesWidget.vue'
import ToolboxQuickLinksWidget from '~/components/workbench/widgets/ToolboxQuickLinksWidget.vue'
import ToolboxRuntimeWidget from '~/components/workbench/widgets/ToolboxRuntimeWidget.vue'
import { workbenchWidgetMetadata, workbenchWidgetMetadataByKey, type WorkbenchWidgetKey, type WorkbenchWidgetMetadata } from '~/utils/workbench-widget-meta'

export interface WorkbenchWidgetDefinition extends WorkbenchWidgetMetadata {
  component: Component
}

const widgetComponents: Record<WorkbenchWidgetKey, Component> = {
  'quick-links': ToolboxQuickLinksWidget,
  'tool-catalog': ToolCatalogWidget,
  notes: ToolboxNotesWidget,
  runtime: ToolboxRuntimeWidget
}

export const workbenchWidgetDefinitions = workbenchWidgetMetadata.map(definition => ({
  ...definition,
  component: widgetComponents[definition.key]
})) satisfies WorkbenchWidgetDefinition[]

export const workbenchWidgetDefinitionByKey = workbenchWidgetDefinitions.reduce<Record<WorkbenchWidgetKey, WorkbenchWidgetDefinition>>((definitions, definition) => {
  definitions[definition.key] = definition
  return definitions
}, {} as Record<WorkbenchWidgetKey, WorkbenchWidgetDefinition>)

export function getWorkbenchWidgetDefinition(key: string) {
  const metadata = workbenchWidgetMetadataByKey[key as WorkbenchWidgetKey]

  if (!metadata) {
    return null
  }

  return workbenchWidgetDefinitionByKey[metadata.key]
}
