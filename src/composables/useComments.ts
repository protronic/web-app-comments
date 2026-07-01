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
  COMMENT_SSE_EVENT_TYPES,
  countActiveComments,
  parseCommentSsePayload,
  resolveCommentSidecarFileIds,
  sseEventMatchesCommentTarget
} from '../utils/commentSse'
import { ensureCommentNotificationListener } from './useCommentNotifications'

type LoadCommentsOptions = {
  silent?: boolean
}

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
      isRefreshing.value = true
    } else {
      isLoading.value = true
    }

    error.value = undefined

    try {
      await refreshWatchedFileIds(currentTarget)
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
      isLoading.value = false
      isRefreshing.value = false
    }
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

  const sseHandlers = new Map<string, (message: MessageEvent) => void>()

  const onCommentResourceChanged = (message: MessageEvent) => {
    const currentTarget = target()

    if (!currentTarget) {
      return
    }

    const data = parseCommentSsePayload(message)

    if (!data?.itemid || data.initiatorid === clientService.initiatorId) {
      return
    }

    if (!sseEventMatchesCommentTarget(data, watchedFileIds.value)) {
      return
    }

    void loadComments({ silent: true })
  }

  const registerSse = () => {
    if (!capabilityStore.supportSSE) {
      return
    }

    for (const eventType of COMMENT_SSE_EVENT_TYPES) {
      if (sseHandlers.has(eventType)) {
        continue
      }

      const handler = (message: MessageEvent) => {
        onCommentResourceChanged(message)
      }

      sseHandlers.set(eventType, handler)
      clientService.sseAuthenticated.addEventListener(eventType, handler)
    }
  }

  const unregisterSse = () => {
    for (const [eventType, handler] of sseHandlers) {
      clientService.sseAuthenticated.removeEventListener(eventType, handler)
    }

    sseHandlers.clear()
  }

  onMounted(() => {
    registerSse()
  })

  onBeforeUnmount(() => {
    unregisterSse()
  })

  watch(
    target,
    () => {
      hasLoadedOnce.value = false
      scrollToLatest.value = false
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
    setThreadResolved
  }
}
