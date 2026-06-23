import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { UserPreferenceRecord, UserPreferenceSaveRequest } from '~/types/hdx-api'
import { extractUserPreferenceConflict, isAuthRequiredApiError } from '~/utils/api-error'
import { fetchUserPreferences, saveUserPreferences } from '~/utils/hdx-api-client'

export type UserPreferencePersistenceResult = 'success' | 'failed' | 'auth-expired' | 'conflict'
export type UserPreferenceSaveInput = Omit<UserPreferenceSaveRequest, 'schemaVersion' | 'version'>

export const useUserPreferenceStore = defineStore('user-preference', () => {
  const remotePreference = ref<UserPreferenceRecord | null>(null)
  const loading = shallowRef(false)
  const saving = shallowRef(false)
  const loaded = shallowRef(false)
  const errorKey = ref<string | null>(null)

  async function loadPreferences(): Promise<UserPreferencePersistenceResult> {
    loading.value = true
    errorKey.value = null

    try {
      remotePreference.value = await fetchUserPreferences()
      loaded.value = true
      return 'success'
    } catch (error) {
      if (isAuthRequiredApiError(error)) {
        remotePreference.value = null
        loaded.value = false
        errorKey.value = 'auth.sessionExpired'
        return 'auth-expired'
      }

      remotePreference.value = null
      loaded.value = false
      errorKey.value = 'userPreference.loadFailed'
      return 'failed'
    } finally {
      loading.value = false
    }
  }

  async function savePreferences(input: UserPreferenceSaveInput): Promise<UserPreferencePersistenceResult> {
    return savePreferencesWithVersion(input, remotePreference.value?.version ?? 0, true)
  }

  async function savePreferencesWithVersion(
    input: UserPreferenceSaveInput,
    version: number,
    retryOnConflict: boolean
  ): Promise<UserPreferencePersistenceResult> {
    saving.value = true
    errorKey.value = null

    try {
      remotePreference.value = await saveUserPreferences({
        schemaVersion: 1,
        version,
        ...cloneSaveInput(input)
      })
      loaded.value = true
      return 'success'
    } catch (error) {
      if (isAuthRequiredApiError(error)) {
        remotePreference.value = null
        loaded.value = false
        errorKey.value = 'auth.sessionExpired'
        return 'auth-expired'
      }

      const conflict = extractUserPreferenceConflict(error)

      if (conflict) {
        remotePreference.value = conflict.serverPreference
        loaded.value = true

        if (retryOnConflict) {
          return await savePreferencesWithVersion(input, conflict.serverPreference.version, false)
        }

        errorKey.value = 'userPreference.conflict'
        return 'conflict'
      }

      errorKey.value = 'userPreference.saveFailed'
      return 'failed'
    } finally {
      saving.value = false
    }
  }

  function resetState() {
    remotePreference.value = null
    loading.value = false
    saving.value = false
    loaded.value = false
    errorKey.value = null
  }

  return {
    errorKey,
    loaded,
    loading,
    remotePreference,
    saving,
    loadPreferences,
    resetState,
    savePreferences
  }
})

function cloneSaveInput(input: UserPreferenceSaveInput): UserPreferenceSaveInput {
  return {
    locale: input.locale,
    colorMode: input.colorMode,
    theme: { ...input.theme },
    navigation: {
      pinnedItemIds: [...input.navigation.pinnedItemIds]
    }
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useUserPreferenceStore, import.meta.hot))
}
