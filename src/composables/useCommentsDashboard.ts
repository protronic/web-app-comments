import { onMounted, ref, unref, watch } from 'vue'
import { useClientService, useMessages, useSpacesStore, useUserStore } from '@opencloud-eu/web-pkg'
import { useGettext } from 'vue3-gettext'
import { CommentsDashboardQuery, DashboardThreadEntry } from '../types'
import { WebdavSidecarDashboardStorage } from '../storage/WebdavSidecarDashboardStorage'
import { loadDashboardSpaces } from '../utils/dashboardSpaces'

export function useCommentsDashboard() {
  const { $gettext } = useGettext()
  const { showErrorMessage } = useMessages()
  const clientService = useClientService()
  const spacesStore = useSpacesStore()
  const userStore = useUserStore()
  const api = new WebdavSidecarDashboardStorage(clientService.webdav)

  const entries = ref<DashboardThreadEntry[]>([])
  const total = ref(0)
  const isLoading = ref(false)
  const error = ref<string>()
  const availableTags = ref<string[]>([])
  const query = ref<CommentsDashboardQuery>({
    status: 'all',
    answered: 'all',
    type: 'all',
    tag: 'all'
  })

  const loadAvailableTags = async () => {
    try {
      availableTags.value = [...(await clientService.graphAuthenticated.tags.listTags())].sort(
        (left, right) => left.localeCompare(right)
      )
    } catch {
      availableTags.value = []
    }
  }

  const loadDashboard = async () => {
    if (!userStore.user) {
      return
    }

    isLoading.value = true
    error.value = undefined

    try {
      const spaces = await loadDashboardSpaces(spacesStore, clientService.graphAuthenticated)
      const result = await api.listThreads(spaces, unref(query))
      entries.value = result.entries
      total.value = result.total
    } catch (e) {
      error.value = $gettext('Failed to load comment dashboard')
      showErrorMessage({ title: error.value, errors: [e] })
    } finally {
      isLoading.value = false
    }
  }

  onMounted(() => {
    void loadAvailableTags()
    void loadDashboard()
  })

  watch(
    () => userStore.user,
    (user) => {
      if (user) {
        void loadAvailableTags()
        void loadDashboard()
      }
    }
  )

  watch(
    query,
    () => {
      if (userStore.user) {
        void loadDashboard()
      }
    },
    { deep: true }
  )

  return {
    entries,
    total,
    isLoading,
    error,
    availableTags,
    query,
    loadDashboard
  }
}
