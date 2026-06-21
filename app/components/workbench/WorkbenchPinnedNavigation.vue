<script setup lang="ts">
import type { WorkbenchNavigationItem } from '~/utils/workbench-navigation'
import { isWorkbenchNavigationItemActive } from '~/utils/workbench-navigation'

defineProps<{
  items: readonly WorkbenchNavigationItem[]
}>()
const emit = defineEmits<{
  select: [item: WorkbenchNavigationItem]
}>()

const { t } = useI18n()
const route = useRoute()

function selectItem(item: WorkbenchNavigationItem) {
  if (item.disabled) {
    return
  }

  emit('select', item)
}
</script>

<template>
  <nav v-if="items.length > 0" :aria-label="t('workbench.navigation.pinned')" class="workbench-pinned-navigation min-w-0">
    <div class="flex min-w-0 items-center gap-1 overflow-hidden">
      <UTooltip
        v-for="item in items"
        :key="item.id"
        :text="t(item.titleKey)"
      >
        <UButton
          type="button"
          color="neutral"
          :variant="isWorkbenchNavigationItemActive(item, route.path) ? 'soft' : 'ghost'"
          :icon="item.icon"
          class="workbench-pinned-navigation-button cursor-pointer"
          :aria-label="t(item.titleKey)"
          @click="selectItem(item)"
        >
          <span class="truncate">{{ t(item.titleKey) }}</span>
        </UButton>
      </UTooltip>
    </div>
  </nav>
</template>

<style scoped>
.workbench-pinned-navigation {
  flex: 1 1 14rem;
  max-width: min(42vw, 36rem);
}

.workbench-pinned-navigation-button {
  min-width: 2.25rem;
  max-width: 10rem;
  height: 2.25rem;
  border-radius: var(--hdx-radius-toolbar-item);
  padding-inline: 0.65rem;
  color: rgba(15, 23, 42, 0.72);
}

.workbench-pinned-navigation-button:hover {
  background: rgba(var(--hdx-theme-primary-rgb), 0.12);
  color: rgb(15, 23, 42);
}

.dark .workbench-pinned-navigation-button {
  color: rgba(255, 255, 255, 0.84);
}

.dark .workbench-pinned-navigation-button:hover {
  background: rgba(255, 255, 255, 0.14);
  color: white;
}
</style>
