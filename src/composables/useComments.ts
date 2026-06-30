import { computed, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue'
import {
  useCapabilityStore,
  useClientService,
  useMessages,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { MESSAGE_TYPE } from '@opencloud-eu/web-client/sse'
import { useGettext } from 'vue3-gettext'
import { CommentAuthor, CommentStorage, CommentTarget, CommentThread } from '../types'
import { WebdavSidecarCommentStorage } from '../storage/WebdavSidecarCommentStorage'
import { sortThreads } from '../utils/comments'

export function useComments(target: () => CommentTarget | null) {
  const { $gettext } = useGettext()
  const { showErrorMessage } = useMessages()
  const clientService = useClientService()
  const { webdav } = clientService
  const capabilityStore = useCapabilityStore()
  const userStore = useUserStore()
  const storage: CommentStorage = new WebdavSidecarCommentStorage(webdav)

  const threads = ref<CommentThread[]>([])
  const isLoading = ref(false)
  const isSaving = ref(false)
  const error = ref<string>()

  const currentUser = computed<CommentAuthor>(() => {
    const user = (userStore.user || {}) as Record<string, unknown>
    const id = String(user.id || user.onPremisesSamAccountName || user.userName || 'current-user')
    const displayName = String(user.displayName || user.name || user.userName || id)

    return { id, displayName }
  })

  const loadComments = async () => {
    const currentTarget = target()

    if (!currentTarget) {
      threads.value = []
      return
    }

    isLoading.value = true
    error.value = undefined

    try {
      threads.value = await storage.list(currentTarget)
    } catch (e) {
      error.value = $gettext('Failed to load comments')
      showErrorMessage({ title: error.value, errors: [e] })
    } finally {
      isLoading.value = false
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
      threads.value = sortThreads(await storage.list(currentTarget))
    } catch (e) {
      error.value = $gettext('Failed to save comment')
      showErrorMessage({ title: error.value, errors: [e] })
    } finally {
      isSaving.value = false
    }
  }

  const onCommentSidecarTouched = (msg: MessageEvent) => {
    const data = parseSsePayload(msg)

    if (data?.initiatorid === clientService.initiatorId) {
      return
    }

    return loadComments()
  }

  onMounted(() => {
    if (!capabilityStore.supportSSE) {
      return
    }

    clientService.sseAuthenticated.addEventListener(
      MESSAGE_TYPE.FILE_TOUCHED,
      onCommentSidecarTouched
    )
  })

  onBeforeUnmount(() => {
    if (!capabilityStore.supportSSE) {
      return
    }

    clientService.sseAuthenticated.removeEventListener(
      MESSAGE_TYPE.FILE_TOUCHED,
      onCommentSidecarTouched
    )
  })

  watch(target, () => loadComments(), { immediate: true })

  return {
    threads,
    isLoading,
    isSaving,
    error,
    currentUser,
    loadComments,
    createThread,
    replyToThread,
    updateComment,
    deleteComment,
    setThreadResolved
  }
}

function parseSsePayload(msg: MessageEvent): { initiatorid?: string } | null {
  try {
    return JSON.parse(msg.data)
  } catch {
    return null
  }
}
