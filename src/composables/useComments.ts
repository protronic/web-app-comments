import { computed, nextTick, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import {
  useCapabilityStore,
  useClientService,
  useMessages,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { useCommentGettext } from '../i18n/useCommentGettext'
import { commentMessages as msg } from '../i18n/messages'
import { userRecordToAuthor, collectUserIdentityKeys } from '../utils/userIdentity'
import { CommentAuthor, CommentStorage, CommentTarget, CommentThread } from '../types'
import { WebdavSidecarCommentStorage } from '../storage/WebdavSidecarCommentStorage'
import { sortThreads } from '../utils/comments'
import {
  countActiveComments,
  isSharedCommentTarget,
  parseCommentSsePayload,
  resolveCommentSidecarFileIds,
  resolveSsePayloadForCommentTarget,
  sseEventMatchesCommentTarget
} from '../utils/commentSse'
import { subscribeCommentSse } from '../utils/commentSseHub'
import { ensureCommentNotificationListener } from './useCommentNotifications'

type LoadCommentsOptions = {
  silent?: boolean
  refreshWatchIds?: boolean
}

const SILENT_RELOAD_DEBOUNCE_MS = 500
const SPACE_SIDEBAR_POLL_INTERVAL_MS = 15_000
const SHARE_SIDEBAR_POLL_INTERVAL_MS = 5_000

export function useComments(target: () => CommentTarget | null) {
  const { $gettext } = useCommentGettext()
  const { showErrorMessage } = useMessages()
  const clientService = useClientService()
  const { webdav } = clientService
  const capabilityStore = useCapabilityStore()
  const userStore = useUserStore()
  const storage: CommentStorage = new WebdavSidecarCommentStorage(webdav, {
    tags: clientService.graphAuthenticated.tags,
    permissions: clientService.graphAuthenticated.permissions
  })

  const threads = ref<CommentThread[]>([])
  const isLoading = ref(false)
  const isRefreshing = ref(false)
  const hasLoadedOnce = ref(false)
  const isSaving = ref(false)
  const error = ref<string>()
  const watchedFileIds = ref<Set<string>>(new Set())
  const scrollToLatest = ref(false)

  const currentUser = computed<CommentAuthor>(() =>
    userRecordToAuthor((userStore.user || {}) as Record<string, unknown>)
  )

  const currentUserIds = computed(() =>
    collectUserIdentityKeys((userStore.user || undefined) as Record<string, unknown>)
  )

  ensureCommentNotificationListener()

  const refreshWatchedFileIds = async (currentTarget: CommentTarget) => {
    watchedFileIds.value = await resolveCommentSidecarFileIds(webdav, currentTarget)
  }

  let silentReloadTimer: ReturnType<typeof setTimeout> | undefined
  let silentReloadInFlight = false
  let unsubscribeCommentSse: (() => void) | undefined
  let sidebarPollTimer: ReturnType<typeof setInterval> | undefined
  let sseEvaluationGeneration = 0

  const loadComments = async (options: LoadCommentsOptions = {}) => {
    const currentTarget = target()

    if (!currentTarget) {
      threads.value = []
      hasLoadedOnce.value = false
      watchedFileIds.value = new Set()
      return
    }

    const silent = options.silent && hasLoadedOnce.value
    const previousCount = countActiveComments(threads.value)

    if (silent) {
      if (isRefreshing.value || silentReloadInFlight) {
        return
      }

      isRefreshing.value = true
      silentReloadInFlight = true
    } else {
      isLoading.value = true
    }

    error.value = undefined

    try {
      if (!silent || options.refreshWatchIds) {
        await refreshWatchedFileIds(currentTarget)
      }

      const nextThreads = sortThreads(await storage.list(currentTarget))
      const nextCount = countActiveComments(nextThreads)

      scrollToLatest.value = silent && nextCount > previousCount
      threads.value = nextThreads
      hasLoadedOnce.value = true
    } catch (e) {
      if (!silent) {
        error.value = $gettext(msg.failedToLoadComments)
        showErrorMessage({ title: error.value, errors: [e] })
      }
    } finally {
      if (silent) {
        silentReloadInFlight = false
      }

      isLoading.value = false
      isRefreshing.value = false
    }
  }

  const scheduleSilentReload = () => {
    if (silentReloadTimer) {
      clearTimeout(silentReloadTimer)
    }

    silentReloadTimer = setTimeout(() => {
      silentReloadTimer = undefined

      if (isSaving.value || !hasLoadedOnce.value) {
        return
      }

      void loadComments({ silent: true, refreshWatchIds: true })
    }, SILENT_RELOAD_DEBOUNCE_MS)
  }

  const evaluateCommentSseEvent = async (message: MessageEvent) => {
    const currentTarget = target()

    if (!currentTarget || !capabilityStore.supportSSE) {
      return
    }

    const data = parseCommentSsePayload(message)

    if (!data?.itemid || data.initiatorid === clientService.initiatorId) {
      return
    }

    const generation = ++sseEvaluationGeneration

    if (sseEventMatchesCommentTarget(data, watchedFileIds.value)) {
      scheduleSilentReload()
      return
    }

    const matchesTarget = await resolveSsePayloadForCommentTarget(
      webdav,
      currentTarget,
      data,
      watchedFileIds.value
    )

    if (generation !== sseEvaluationGeneration) {
      return
    }

    if (!matchesTarget) {
      return
    }

    await refreshWatchedFileIds(currentTarget)
    scheduleSilentReload()
  }

  const onCommentResourceChanged = (_eventType: string, message: MessageEvent) => {
    void evaluateCommentSseEvent(message)
  }

  const getSidebarPollIntervalMs = () => {
    const currentTarget = target()

    if (currentTarget && isSharedCommentTarget(currentTarget)) {
      return SHARE_SIDEBAR_POLL_INTERVAL_MS
    }

    return SPACE_SIDEBAR_POLL_INTERVAL_MS
  }

  const startSidebarPolling = () => {
    stopSidebarPolling()

    sidebarPollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return
      }

      if (isSaving.value || !hasLoadedOnce.value || !target()) {
        return
      }

      void loadComments({ silent: true, refreshWatchIds: true })
    }, getSidebarPollIntervalMs())
  }

  const stopSidebarPolling = () => {
    if (!sidebarPollTimer) {
      return
    }

    clearInterval(sidebarPollTimer)
    sidebarPollTimer = undefined
  }

  const createThread = async (body: string) => {
    await runMutation(async (currentTarget) => {
      await storage.createThread(currentTarget, {
        body,
        format: 'markdown',
        author: unref(currentUser)
      })
    })
  }

  const replyToThread = async (threadId: string, body: string) => {
    await runMutation(async (currentTarget) => {
      await storage.replyToThread(currentTarget, threadId, {
        body,
        format: 'markdown',
        author: unref(currentUser)
      })
    })
  }

  const updateComment = async (threadId: string, commentId: string, body: string) => {
    await runMutation(async (currentTarget) => {
      await storage.updateComment(currentTarget, threadId, commentId, {
        body,
        format: 'markdown',
        author: unref(currentUser)
      })
    })
  }

  const deleteComment = async (threadId: string, commentId: string) => {
    await runMutation(async (currentTarget) => {
      await storage.deleteComment(currentTarget, threadId, commentId, unref(currentUser))
    })
  }

  const setThreadResolved = async (threadId: string, resolved: boolean) => {
    await runMutation(async (currentTarget) => {
      await storage.setThreadResolved(currentTarget, threadId, resolved, unref(currentUser))
    })
  }

  const deleteAllComments = async (): Promise<boolean> => {
    const currentTarget = target()

    if (!currentTarget) {
      return false
    }

    isSaving.value = true
    error.value = undefined

    try {
      await storage.deleteDocument(currentTarget)
      watchedFileIds.value = new Set()
      threads.value = []
      hasLoadedOnce.value = true
      scrollToLatest.value = false
      return true
    } catch (e) {
      error.value = $gettext(msg.failedToDeleteComments)
      showErrorMessage({ title: error.value, errors: [e] })
      return false
    } finally {
      isSaving.value = false
    }
  }

  const runMutation = async (mutation: (currentTarget: CommentTarget) => Promise<void>) => {
    const currentTarget = target()

    if (!currentTarget) {
      return
    }

    isSaving.value = true
    error.value = undefined

    try {
      await mutation(currentTarget)
      await refreshWatchedFileIds(currentTarget)
      threads.value = sortThreads(await storage.list(currentTarget))
      hasLoadedOnce.value = true
      scrollToLatest.value = true
    } catch (e) {
      error.value = $gettext(msg.failedToSaveComment)
      showErrorMessage({ title: error.value, errors: [e] })
    } finally {
      isSaving.value = false
    }
  }

  onMounted(() => {
    startSidebarPolling()

    if (!capabilityStore.supportSSE) {
      return
    }

    unsubscribeCommentSse = subscribeCommentSse(
      clientService.sseAuthenticated,
      onCommentResourceChanged
    )
  })

  onBeforeUnmount(() => {
    stopSidebarPolling()

    if (silentReloadTimer) {
      clearTimeout(silentReloadTimer)
      silentReloadTimer = undefined
    }

    unsubscribeCommentSse?.()
    unsubscribeCommentSse = undefined
  })

  watch(
    target,
    () => {
      if (silentReloadTimer) {
        clearTimeout(silentReloadTimer)
        silentReloadTimer = undefined
      }

      hasLoadedOnce.value = false
      scrollToLatest.value = false
      startSidebarPolling()
      void loadComments()
    },
    { immediate: true }
  )

  const consumeScrollToLatest = async (container: HTMLElement | undefined) => {
    if (!scrollToLatest.value || !container) {
      return
    }

    scrollToLatest.value = false
    await nextTick()
    container.scrollTop = container.scrollHeight
  }

  return {
    threads,
    isLoading,
    isRefreshing,
    hasLoadedOnce,
    isSaving,
    error,
    currentUser,
    currentUserIds,
    loadComments,
    consumeScrollToLatest,
    createThread,
    replyToThread,
    updateComment,
    deleteComment,
    setThreadResolved,
    deleteAllComments
  }
}
