export default defineNuxtPlugin(() => {
  const theme = useThemePreferenceStore()

  theme.hydrate()
})
