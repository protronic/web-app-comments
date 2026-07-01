import { onMounted, ref, unref, watch } from 'vue'
import { useClientService, useMessages, useSpacesStore, useUserStore } from '@opencloud-eu/web-pkg'
import { useCommentGettext } from '../i18n/useCommentGettext'
import { commentMessages as msg } from '../i18n/messages'
import { COMMENT_TAG } from '../constants/tags'
import { CommentsDashboardQuery, DashboardThreadEntry } from '../types'
import { WebdavSidecarDashboardStorage } from '../storage/WebdavSidecarDashboardStorage'
import { loadDashboardSpaces } from '../utils/dashboardSpaces'

export function useCommentsDashboard() {
  const { $gettext } = useCommentGettext()
  const { showErrorMessage } = useMessages()
  const clientService = useClientService()
  const spacesStore = useSpacesStore()
  const userStore = useUserStore()
  const api = new WebdavSidecarDashboardStorage(
    clientService.webdav,
    clientService.graphAuthenticated
  )

  const entries = ref<DashboardThreadEntry[]>([])
  const total = ref(0)
  const isLoading = ref(false)
  const error = ref<string>()
  const availableTags = ref<string[]>([])
  const query = ref<CommentsDashboardQuery>({
    status: 'open',
    answered: 'answered',
    type: 'all',
    tags: [COMMENT_TAG]
  })

  const loadAvailableTags = async () => {
    try {
      const tags = new Set<string>([COMMENT_TAG, ...(await clientService.graphAuthenticated.tags.listTags())])

      availableTags.value = [...tags].sort((left, right) => left.localeCompare(right))
    } catch {
      availableTags.value = [COMMENT_TAG]
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
      error.value = $gettext(msg.failedToLoadCommentDashboard)
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
        if (!query.value.tags?.length) {
          query.value.tags = [COMMENT_TAG]
        }

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
