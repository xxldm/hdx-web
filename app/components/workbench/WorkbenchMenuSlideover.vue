<script setup lang="ts">
import type { WorkbenchNavigationItem } from '~/utils/workbench-navigation'
import { isWorkbenchNavigationItemActive, workbenchNavigationGroups } from '~/utils/workbench-navigation'

const props = defineProps<{
  open: boolean
  items: readonly WorkbenchNavigationItem[]
}>()
const emit = defineEmits<{
  'update:open': [open: boolean]
  select: [item: WorkbenchNavigationItem]
}>()

const { t } = useI18n()
const route = useRoute()
const navigation = useWorkbenchNavigationStore()
const modelOpen = computed({
  get: () => props.open,
  set: value => emit('update:open', value)
})
const groupedItems = computed(() => workbenchNavigationGroups
  .map(group => ({
    ...group,
    items: props.items.filter(item => item.groupKey === group.key)
  }))
  .filter(group => group.items.length > 0))

function selectItem(item: WorkbenchNavigationItem) {
  if (item.disabled) {
    return
  }

  emit('select', item)
  modelOpen.value = false
}

function togglePinnedItem(item: WorkbenchNavigationItem) {
  if (!item.pinnable || (!navigation.isPinnedItem(item.id) && !navigation.canPinItem(item.id))) {
    return
  }

  navigation.togglePinnedItem(item.id)
}

function getPinLabel(item: WorkbenchNavigationItem) {
  if (navigation.isPinnedItem(item.id)) {
    return t('workbench.navigation.unpin')
  }

  if (!navigation.canPinItem(item.id)) {
    return t('workbench.navigation.pinLimit', { count: navigation.maxPinnedWorkbenchNavigationItems })
  }

  return t('workbench.navigation.pin')
}
</script>

<template>
  <USlideover
    v-model:open="modelOpen"
    side="left"
    :title="t('workbench.navigation.title')"
    :description="t('workbench.navigation.description')"
    :ui="{
      overlay: 'bg-slate-950/22 backdrop-blur-[2px] dark:bg-black/45',
      content: 'workbench-menu-slideover border-white/60 bg-white/82 shadow-2xl shadow-slate-950/20 backdrop-blur-2xl hdx-radius-panel dark:border-white/14 dark:bg-slate-950/86 dark:shadow-black/50',
      header: 'border-b border-slate-900/8 dark:border-white/12',
      body: 'p-3 sm:p-4',
      title: 'text-slate-950 dark:text-white',
      description: 'text-slate-600 dark:text-white/62'
    }"
  >
    <template #body>
      <nav :aria-label="t('workbench.navigation.title')" class="grid gap-4">
        <section
          v-for="group in groupedItems"
          :key="group.key"
          class="grid gap-2"
        >
          <p class="px-2 text-xs font-semibold text-slate-500 dark:text-white/52">
            {{ t(group.titleKey) }}
          </p>

          <div class="grid gap-1">
            <div
              v-for="item in group.items"
              :key="item.id"
              class="workbench-menu-row grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-1 hdx-radius-card"
              :class="[
                isWorkbenchNavigationItemActive(item, route.path) ? 'workbench-menu-row-active' : '',
                item.disabled ? 'workbench-menu-row-disabled' : ''
              ]"
            >
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                :disabled="item.disabled"
                class="workbench-menu-item-button cursor-pointer justify-start hdx-radius-card"
                :class="item.pinnable ? '' : 'workbench-menu-item-button-full'"
                @click="selectItem(item)"
              >
                <span class="grid size-9 shrink-0 place-items-center border border-slate-900/8 bg-white/60 hdx-radius-card dark:border-white/12 dark:bg-white/8">
                  <UIcon :name="item.icon" class="size-4.5 text-slate-700 dark:text-white/78" />
                </span>
                <span class="min-w-0 text-left">
                  <span class="block truncate text-sm font-semibold text-slate-950 dark:text-white">
                    {{ t(item.titleKey) }}
                  </span>
                  <span class="block truncate text-xs text-slate-500 dark:text-white/52">
                    {{ t(item.descriptionKey) }}
                  </span>
                </span>
              </UButton>

              <div v-if="item.pinnable" class="workbench-menu-pin-slot">
                <UTooltip :text="getPinLabel(item)">
                  <UButton
                    type="button"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :icon="navigation.isPinnedItem(item.id) ? 'i-lucide-pin-off' : 'i-lucide-pin'"
                    :aria-label="getPinLabel(item)"
                    :disabled="!navigation.isPinnedItem(item.id) && !navigation.canPinItem(item.id)"
                    class="workbench-menu-pin-button cursor-pointer hdx-radius-card"
                    @click.stop="togglePinnedItem(item)"
                  />
                </UTooltip>
              </div>
            </div>
          </div>
        </section>
      </nav>
    </template>
  </USlideover>
</template>

<style scoped>
:global(.workbench-menu-slideover) {
  width: min(26rem, calc(100vw - 1rem));
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
}

.workbench-menu-row {
  border: 1px solid transparent;
  min-height: 3.75rem;
  overflow: hidden;
  padding: 0.25rem;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.workbench-menu-row:hover {
  border-color: rgba(var(--hdx-theme-primary-rgb), 0.18);
  background: rgba(var(--hdx-theme-primary-rgb), 0.07);
}

.workbench-menu-row-active {
  border-color: rgba(var(--hdx-theme-primary-rgb), 0.24);
  background: rgba(var(--hdx-theme-primary-rgb), 0.1);
  box-shadow: 0 10px 24px rgba(var(--hdx-theme-primary-rgb), 0.08);
}

.workbench-menu-row-disabled {
  opacity: 0.58;
}

.workbench-menu-item-button {
  min-width: 0;
  width: 100%;
  min-height: 3.15rem;
  padding: 0.25rem;
  gap: 0.6rem;
  background: transparent !important;
}

.workbench-menu-item-button:hover,
.workbench-menu-item-button:focus-visible,
.workbench-menu-item-button:active {
  background: transparent !important;
}

.workbench-menu-item-button-full {
  grid-column: 1 / -1;
}

.workbench-menu-pin-slot {
  display: grid;
  min-width: 2.5rem;
  height: 100%;
  place-items: center;
}

.workbench-menu-pin-button {
  display: inline-flex;
  width: 2.25rem;
  min-width: 2.25rem;
  height: 2.25rem;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: transparent !important;
}

.workbench-menu-pin-button:hover,
.workbench-menu-pin-button:focus-visible,
.workbench-menu-pin-button:active {
  background: rgba(var(--hdx-theme-primary-rgb), 0.1) !important;
}

.dark .workbench-menu-row:hover {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.08);
}

.dark .workbench-menu-row-active {
  border-color: rgba(var(--hdx-theme-primary-rgb), 0.28);
  background: rgba(var(--hdx-theme-primary-rgb), 0.13);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
}

.dark .workbench-menu-pin-button:hover,
.dark .workbench-menu-pin-button:focus-visible,
.dark .workbench-menu-pin-button:active {
  background: rgba(255, 255, 255, 0.12) !important;
}
</style>
