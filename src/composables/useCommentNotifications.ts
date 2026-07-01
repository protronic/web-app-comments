import { unref, watch } from 'vue'
import {
  useCapabilityStore,
  useClientService,
  useMessages,
  useRouter,
  useSpacesStore,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { MESSAGE_TYPE } from '@opencloud-eu/web-client/sse'
import { CommentDocument } from '../types'
import { useCommentGettext } from '../i18n/useCommentGettext'
import { COMMENT_TAG } from '../constants/tags'
import { WebdavSidecarDashboardStorage } from '../storage/WebdavSidecarDashboardStorage'
import {
  loadNotificationSpaces,
  pickSpaceForResource,
  resolveResourceFromSseItem
} from '../utils/commentNotificationSpaces'
import { isCommentSidecarPath } from '../utils/mentionNotifications'
import {
  MentionNotificationPresenter,
  presentMentionNotifications
} from '../utils/mentionNotificationPresenter'
import {
  createCommentTarget,
  getCommentSidecarReadPaths
} from '../utils/target'
import { collectUserIdentityKeys } from '../utils/userIdentity'
import { debugLog } from '../utils/debugLog'

interface SseFileEvent {
  itemid?: string
  spaceid?: string
  initiatorid?: string
  affecteduserids?: string[] | null
}

const MENTION_POLL_INTERVAL_MS = 20_000
const MENTION_SSE_EVENT_TYPES = [
  MESSAGE_TYPE.FILE_TOUCHED,
  MESSAGE_TYPE.POSTPROCESSING_FINISHED
] as const

let listenerActive = false
let pollTimer: ReturnType<typeof setInterval> | undefined

export function useCommentNotifications() {
  ensureCommentNotificationListener()
}

export function ensureCommentNotificationListener(): void {
  if (listenerActive || typeof window === 'undefined') {
    // #region agent log
    debugLog(
      'useCommentNotifications.ts:ensureCommentNotificationListener',
      'listener skipped',
      { listenerActive, hasWindow: typeof window !== 'undefined' },
      'A'
    )
    // #endregion
    return
  }

  listenerActive = true
  // #region agent log
  debugLog(
    'useCommentNotifications.ts:ensureCommentNotificationListener',
    'listener started',
    {},
    'A'
  )
  // #endregion

  const clientService = useClientService()
  const capabilityStore = useCapabilityStore()
  const userStore = useUserStore()
  const spacesStore = useSpacesStore()
  const router = useRouter()
  const { showMessage } = useMessages()
  const { $gettext } = useCommentGettext()
  const dashboard = new WebdavSidecarDashboardStorage(
    clientService.webdav,
    clientService.graphAuthenticated
  )

  const presenter: MentionNotificationPresenter = {
    showMessage,
    translate: (message, values) => $gettext(message, values),
    router
  }

  const currentUserIds = () =>
    collectUserIdentityKeys((userStore.user || undefined) as Record<string, unknown>)

  const notifyFromDocument = (space: SpaceResource, document: CommentDocument, source: string) => {
    presentMentionNotifications(presenter, space, document, currentUserIds(), source)
  }

  const notifyFromSidecar = async (
    space: SpaceResource,
    sidecarPath: string,
    source: string
  ): Promise<boolean> => {
    try {
      const response = await clientService.webdav.getFileContents(space, { path: sidecarPath })
      const document = JSON.parse(response.body) as CommentDocument

      return presentMentionNotifications(presenter, space, document, currentUserIds(), source)
    } catch {
      return false
    }
  }

  const tryNotifyFromResource = async (
    space: SpaceResource,
    resource: Resource,
    spaceId?: string
  ) => {
    const spaces = await loadNotificationSpaces(spacesStore, clientService.graphAuthenticated)
    const activeSpace = pickSpaceForResource(spaces, resource, spaceId) || space
    const path = resource.path || '/'

    if (isCommentSidecarPath(path)) {
      await notifyFromSidecar(activeSpace, path, 'sse')
      return
    }

    const target = createCommentTarget(activeSpace, resource)

    for (const sidecarPath of getCommentSidecarReadPaths(target)) {
      const notified = await notifyFromSidecar(activeSpace, sidecarPath, 'sse')

      if (notified) {
        break
      }
    }
  }

  const pollForMentions = async () => {
    if (!userStore.user) {
      return
    }

    const userIds = currentUserIds()

    if (userIds.length === 0) {
      return
    }

    try {
      const spaces = await loadNotificationSpaces(spacesStore, clientService.graphAuthenticated)
      const result = await dashboard.listThreads(spaces, {
        status: 'all',
        answered: 'all',
        user: 'me',
        userIds,
        tags: [COMMENT_TAG]
      })

      // #region agent log
      debugLog(
        'useCommentNotifications.ts:pollForMentions',
        'poll result',
        {
          entryCount: result.entries.length,
          spaceCount: spaces.length,
          userIdCount: userIds.length,
          targets: result.entries.map((e) => e.target.name)
        },
        'B'
      )
      // #endregion

      for (const entry of result.entries) {
        const space = spaces.find((candidate) => candidate.id === entry.space.id)

        if (!space) {
          continue
        }

        notifyFromDocument(
          space,
          {
            version: 1,
            target: {
              id: entry.target.id,
              name: entry.target.name,
              path: entry.target.path,
              isFolder: entry.target.isFolder
            },
            threads: [entry.thread]
          },
          'poll'
        )
      }
    } catch (error) {
      // #region agent log
      debugLog(
        'useCommentNotifications.ts:pollForMentions',
        'poll error',
        { error: String(error) },
        'B'
      )
      // #endregion
    }
  }

  const onResourceChanged = async (eventType: string, message: MessageEvent) => {
    if (!userStore.user) {
      return
    }

    const data = parseSsePayload(message)

    if (!data?.itemid || data.initiatorid === clientService.initiatorId) {
      // #region agent log
      debugLog(
        'useCommentNotifications.ts:onResourceChanged',
        'sse skipped',
        {
          eventType,
          hasItemId: Boolean(data?.itemid),
          sameInitiator: data?.initiatorid === clientService.initiatorId
        },
        'E'
      )
      // #endregion
      return
    }

    try {
      const spaces = await loadNotificationSpaces(spacesStore, clientService.graphAuthenticated)
      const resolved = await resolveResourceFromSseItem(
        clientService.webdav,
        clientService.graphAuthenticated,
        spaces,
        data.itemid,
        data.spaceid
      )

      if (!resolved) {
        // #region agent log
        debugLog(
          'useCommentNotifications.ts:onResourceChanged',
          'sse resource unresolved',
          { eventType, itemid: data.itemid, spaceid: data.spaceid },
          'E'
        )
        // #endregion
        return
      }

      // #region agent log
      debugLog(
        'useCommentNotifications.ts:onResourceChanged',
        'sse handling resource',
        {
          eventType,
          path: resolved.resource.path,
          spaceId: resolved.space.id
        },
        'E'
      )
      // #endregion

      await tryNotifyFromResource(resolved.space, resolved.resource, data.spaceid)
    } catch (error) {
      // #region agent log
      debugLog(
        'useCommentNotifications.ts:onResourceChanged',
        'sse error',
        { eventType, error: String(error) },
        'E'
      )
      // #endregion
    }
  }

  const sseHandlers = new Map<string, (message: MessageEvent) => void>()

  const bindSseHandler = (eventType: string) => {
    const handler = (message: MessageEvent) => {
      void onResourceChanged(eventType, message)
    }

    sseHandlers.set(eventType, handler)
    clientService.sseAuthenticated.addEventListener(eventType, handler)
  }

  const unbindSseHandler = (eventType: string) => {
    const handler = sseHandlers.get(eventType)

    if (!handler) {
      return
    }

    clientService.sseAuthenticated.removeEventListener(eventType, handler)
    sseHandlers.delete(eventType)
  }

  const startPolling = () => {
    if (pollTimer) {
      return
    }

    void pollForMentions()
    pollTimer = setInterval(() => {
      void pollForMentions()
    }, MENTION_POLL_INTERVAL_MS)
  }

  const stopPolling = () => {
    if (!pollTimer) {
      return
    }

    clearInterval(pollTimer)
    pollTimer = undefined
  }

  const registerSse = () => {
    if (!capabilityStore.supportSSE || !userStore.user) {
      return
    }

    for (const eventType of MENTION_SSE_EVENT_TYPES) {
      bindSseHandler(eventType)
    }
  }

  const unregisterSse = () => {
    for (const eventType of MENTION_SSE_EVENT_TYPES) {
      unbindSseHandler(eventType)
    }
  }

  watch(
    () => userStore.user,
    (user) => {
      if (user) {
        // #region agent log
        debugLog(
          'useCommentNotifications.ts:userWatch',
          'user logged in, starting listeners',
          {
            userIds: currentUserIds(),
            sseSupported: capabilityStore.supportSSE
          },
          'A'
        )
        // #endregion
        registerSse()
        startPolling()
        return
      }

      unregisterSse()
      stopPolling()
    },
    { immediate: true }
  )
}

function parseSsePayload(message: MessageEvent): SseFileEvent | null {
  try {
    return JSON.parse(message.data) as SseFileEvent
  } catch {
    return null
  }
}
