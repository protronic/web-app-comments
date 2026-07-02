import { computed, onMounted, ref, unref, watch } from 'vue'
import { useClientService, useMessages, useRoute, useRouter, useSpacesStore, useUserStore } from '@opencloud-eu/web-pkg'
import { useCommentGettext } from '../i18n/useCommentGettext'
import { commentMessages as msg } from '../i18n/messages'
import { COMMENT_TAG } from '../constants/tags'
import { collectUserIdentityKeys } from '../utils/userIdentity'
import { CommentsDashboardQuery, DashboardThreadEntry } from '../types'
import { WebdavSidecarDashboardStorage } from '../storage/WebdavSidecarDashboardStorage'
import { loadDashboardSpaces } from '../utils/dashboardSpaces'
import {
  createDefaultDashboardQuery,
  createInitialDashboardQuery,
  hasActiveDashboardFilters
} from '../utils/dashboardQueryDefaults'
import {
  buildDashboardRouteQuery,
  dashboardRouteQueriesEqual,
  parseDashboardQueryFromRoute,
  readDashboardFilterQuery
} from '../utils/dashboardQueryParams'
import { debugLog } from '../utils/debugLog'

export {
  createDefaultDashboardQuery,
  createInitialDashboardQuery,
  hasActiveDashboardFilters
} from '../utils/dashboardQueryDefaults'

export function useCommentsDashboard() {
  const { $gettext } = useCommentGettext()
  const { showErrorMessage } = useMessages()
  const clientService = useClientService()
  const spacesStore = useSpacesStore()
  const userStore = useUserStore()
  const route = useRoute()
  const router = useRouter()
  const api = new WebdavSidecarDashboardStorage(
    clientService.webdav,
    clientService.graphAuthenticated
  )

  const entries = ref<DashboardThreadEntry[]>([])
  const total = ref(0)
  const isLoading = ref(false)
  const error = ref<string>()
  const availableTags = ref<string[]>([])
  const query = ref<CommentsDashboardQuery>(createInitialDashboardQuery())
  let syncingFromRoute = false
  let routeQueryApplied = false

  const currentUserIds = computed(() =>
    collectUserIdentityKeys((userStore.user || undefined) as Record<string, unknown>)
  )

  const filtersActive = computed(() => hasActiveDashboardFilters(unref(query)))

  const applyRouteQueryToFilters = () => {
    const parsed = parseDashboardQueryFromRoute(route?.query)

    // #region agent log
    debugLog(
      'useCommentsDashboard.ts:applyRouteQueryToFilters',
      'apply route filters',
      {
        routeName: route.name,
        routeQuery: route?.query,
        windowSearch: typeof window !== 'undefined' ? window.location.search : undefined,
        parsed,
        currentQuery: unref(query)
      },
      parsed ? 'URL-C' : 'URL-B'
    )
    // #endregion

    if (!parsed) {
      return false
    }

    syncingFromRoute = true
    query.value = parsed
    syncingFromRoute = false
    return true
  }

  const syncFiltersToRoute = () => {
    if (syncingFromRoute || !routeQueryApplied) {
      return
    }

    const nextQuery = buildDashboardRouteQuery(unref(query))
    const currentFilterQuery = readDashboardFilterQuery(route?.query)

    if (dashboardRouteQueriesEqual(currentFilterQuery, nextQuery)) {
      return
    }

    // #region agent log
    debugLog(
      'useCommentsDashboard.ts:syncFiltersToRoute',
      'sync filters to route',
      {
        routeName: route?.name,
        currentFilterQuery,
        nextQuery
      },
      'URL-D'
    )
    // #endregion

    void router.replace({
      name: route?.name ?? 'comments-dashboard',
      params: route?.params ?? {},
      query: nextQuery
    })
  }

  const buildEffectiveQuery = (): CommentsDashboardQuery => {
    const currentQuery = unref(query)

    return {
      ...currentQuery,
      userIds: currentQuery.user === 'me' ? unref(currentUserIds) : undefined
    }
  }

  const resetFilters = () => {
    query.value = createDefaultDashboardQuery()
  }

  const loadAvailableTags = async () => {
    try {
      const tags = new Set<string>([COMMENT_TAG, ...(await clientService.graphAuthenticated.tags.listTags())])

      for (const selectedTag of unref(query).tags ?? []) {
        tags.add(selectedTag)
      }

      availableTags.value = [...tags].sort((left, right) => left.localeCompare(right))
    } catch {
      availableTags.value = [...(unref(query).tags ?? [])]
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
      const result = await api.listThreads(spaces, buildEffectiveQuery())
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
    applyRouteQueryToFilters()
    routeQueryApplied = true
    void loadAvailableTags()
    void loadDashboard()
  })

  watch(
    () => route?.query,
    () => {
      if (applyRouteQueryToFilters() && userStore.user) {
        void loadDashboard()
      }
    }
  )

  watch(
    query,
    () => {
      syncFiltersToRoute()

      if (!syncingFromRoute && userStore.user) {
        void loadDashboard()
      }
    },
    { deep: true }
  )

  watch(
    () => userStore.user,
    (user) => {
      if (user) {
        void loadAvailableTags()
        void loadDashboard()
      }
    }
  )

  watch(currentUserIds, (userIds) => {
    if (userStore.user && unref(query).user === 'me' && userIds.length > 0) {
      void loadDashboard()
    }
  })

  return {
    entries,
    total,
    isLoading,
    error,
    availableTags,
    query,
    filtersActive,
    resetFilters,
    loadDashboard
  }
}
