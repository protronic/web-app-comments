import { unref, watch } from 'vue'
import {
  useAppsStore,
  useCapabilityStore,
  useClientService,
  useFileActions,
  useMessages,
  useRouter,
  useSpacesStore,
  useUserStore
} from '@opencloud-eu/web-pkg'
import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { CommentDocument } from '../types'
import { commentMessages as msg } from '../i18n/messages'
import { useCommentGettext } from '../i18n/useCommentGettext'
import { COMMENT_TAG } from '../constants/tags'
import { WebdavSidecarDashboardStorage } from '../storage/WebdavSidecarDashboardStorage'
import {
  loadNotificationSpaces,
  pickSpaceForResource,
  resolveResourceFromSseItem
} from '../utils/commentNotificationSpaces'
import { isCommentSidecarPath } from '../utils/target'
import {
  MentionNotificationPresenter,
  presentMentionNotifications,
  presentPolledMentionEntries
} from '../utils/mentionNotificationPresenter'
import {
  createCommentTarget,
  getCommentSidecarReadPaths
} from '../utils/target'
import { resolveMentionNavigation, toMentionNavigationEntry } from '../utils/mentionNavigation'
import { openDashboardTargetInEditor, openDashboardTargetInFiles } from '../utils/dashboardNavigation'
import { openResourceWithDefaultEditor } from '../utils/defaultFileEditor'
import { collectUserIdentityKeys } from '../utils/userIdentity'
import { debugLog } from '../utils/debugLog'
import { subscribeCommentSse } from '../utils/commentSseHub'

interface SseFileEvent {
  itemid?: string
  spaceid?: string
  initiatorid?: string
  affecteduserids?: string[] | null
}

const MENTION_POLL_INTERVAL_MS = 20_000

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
  const appsStore = useAppsStore()
  const { getDefaultAction, triggerDefaultAction, openEditor } = useFileActions()
  const { $gettext } = useCommentGettext()
  const dashboard = new WebdavSidecarDashboardStorage(
    clientService.webdav,
    clientService.graphAuthenticated
  )

  const fileActions = {
    getDefaultAction,
    triggerDefaultAction
  }

  const openWithDefaultEditor = (space: SpaceResource, target: DashboardThreadEntry['target']) =>
    openResourceWithDefaultEditor(
      space,
      target,
      unref(appsStore.fileExtensions),
      { getDefaultAction, triggerDefaultAction, openEditor },
      (routeName) => router.hasRoute(routeName)
    )

  const presenter: MentionNotificationPresenter = {
    showMessage,
    translate: (message, values) => $gettext(message, values),
    router,
    openTargetInFiles: (space, entry) => openDashboardTargetInFiles(space, entry, router),
    openTargetInEditor: (space, entry) =>
      openDashboardTargetInEditor(space, entry, router, fileActions, openWithDefaultEditor),
    getEditorOpenLabel: () => $gettext(msg.openFile),
    getFilesViewLabel: () => $gettext(msg.selectFileInFiles)
  }

  const currentUserIds = () =>
    collectUserIdentityKeys((userStore.user || undefined) as Record<string, unknown>)

  const notifyFromDocument = (
    space: SpaceResource,
    document: CommentDocument,
    source: string,
    navigation?: ReturnType<typeof toMentionNavigationEntry>
  ) => {
    presentMentionNotifications(
      presenter,
      space,
      document,
      currentUserIds(),
      source,
      navigation
    )
  }

  const notifyFromSidecar = async (
    space: SpaceResource,
    sidecarPath: string,
    source: string,
    sourceResource?: Resource
  ): Promise<boolean> => {
    try {
      const response = await clientService.webdav.getFileContents(space, { path: sidecarPath })
      const document = JSON.parse(response.body) as CommentDocument
      const spaces = await loadNotificationSpaces(spacesStore, clientService.graphAuthenticated)
      const navigation = await resolveMentionNavigation(
        clientService.webdav,
        clientService.graphAuthenticated.driveItems,
        spaces,
        space,
        document,
        { sourceResource, sidecarPath }
      )

      return presentMentionNotifications(
        presenter,
        navigation.space,
        document,
        currentUserIds(),
        source,
        toMentionNavigationEntry(navigation)
      )
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
      await notifyFromSidecar(activeSpace, path, 'sse', resource)
      return
    }

    const target = createCommentTarget(activeSpace, resource)

    for (const sidecarPath of getCommentSidecarReadPaths(target)) {
      const notified = await notifyFromSidecar(activeSpace, sidecarPath, 'sse', resource)

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

      const pollEntries = result.entries.flatMap((entry) => {
        const space = spaces.find((candidate) => candidate.id === entry.space.id)

        if (!space) {
          return []
        }

        return [{ space, entry }]
      })

      presentPolledMentionEntries(presenter, pollEntries, userIds, 'poll')
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

  let unsubscribeCommentSse: (() => void) | undefined
  let mentionSseInFlight = false
  let mentionSseTimer: ReturnType<typeof setTimeout> | undefined
  const MENTION_SSE_DEBOUNCE_MS = 500

  const runMentionSse = async (eventType: string, message: MessageEvent) => {
    if (mentionSseInFlight) {
      return
    }

    mentionSseInFlight = true

    try {
      await onResourceChanged(eventType, message)
    } finally {
      mentionSseInFlight = false
    }
  }

  const scheduleMentionSse = (eventType: string, message: MessageEvent) => {
    if (mentionSseTimer) {
      clearTimeout(mentionSseTimer)
    }

    mentionSseTimer = setTimeout(() => {
      mentionSseTimer = undefined
      void runMentionSse(eventType, message)
    }, MENTION_SSE_DEBOUNCE_MS)
  }

  const registerSse = () => {
    if (!capabilityStore.supportSSE || !userStore.user || unsubscribeCommentSse) {
      return
    }

    unsubscribeCommentSse = subscribeCommentSse(clientService.sseAuthenticated, scheduleMentionSse)
  }

  const unregisterSse = () => {
    if (mentionSseTimer) {
      clearTimeout(mentionSseTimer)
      mentionSseTimer = undefined
    }

    unsubscribeCommentSse?.()
    unsubscribeCommentSse = undefined
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
