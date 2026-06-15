import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { z } from 'zod'
import { createToolRequestSchema, runtimeInfoSchema, toolRecordsSchema, type CreateToolRequest, type RuntimeInfo, type ToolRecord } from '~/types/hdx-api'
import { createTool as createRemoteTool, fetchRuntimeInfo, fetchTools } from '~/utils/hdx-api-client'

export const workbenchSnapshotSchema = z.object({
  runtime: runtimeInfoSchema.nullable(),
  tools: toolRecordsSchema
})

export type WorkbenchSnapshot = z.infer<typeof workbenchSnapshotSchema>

export const useWorkbenchStore = defineStore('workbench', () => {
  const runtime = ref<RuntimeInfo | null>(null)
  const tools = ref<ToolRecord[]>([])
  const loading = ref(false)
  const errorKey = ref<string | null>(null)

  const enabledTools = computed(() => tools.value.filter(tool => tool.enabled))
  const snapshot = computed<WorkbenchSnapshot>(() => ({
    runtime: runtime.value,
    tools: tools.value
  }))

  async function loadOverview() {
    loading.value = true
    errorKey.value = null

    try {
      const [runtimeResponse, toolsResponse] = await Promise.all([
        fetchRuntimeInfo(),
        fetchTools()
      ])

      runtime.value = runtimeResponse
      tools.value = toolsResponse
    } catch {
      errorKey.value = 'workbench.loadFailed'
    } finally {
      loading.value = false
    }
  }

  async function createTool(input: CreateToolRequest) {
    const payload = createToolRequestSchema.parse(input)
    const tool = await createRemoteTool(payload)

    tools.value = [tool, ...tools.value]
    return tool
  }

  return {
    runtime,
    tools,
    loading,
    errorKey,
    enabledTools,
    snapshot,
    loadOverview,
    createTool
  }
})
