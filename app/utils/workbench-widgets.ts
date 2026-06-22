import type { Component } from 'vue'
import ToolboxTimerWidget from '~/components/workbench/widgets/ToolboxTimerWidget.vue'
import { workbenchWidgetMetadata, workbenchWidgetMetadataByKey, type WorkbenchWidgetKey, type WorkbenchWidgetMetadata } from '~/utils/workbench-widget-meta'

export interface WorkbenchWidgetDefinition extends WorkbenchWidgetMetadata {
  component: Component
}

const widgetComponents: Record<WorkbenchWidgetKey, Component> = {
  timer: ToolboxTimerWidget
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
