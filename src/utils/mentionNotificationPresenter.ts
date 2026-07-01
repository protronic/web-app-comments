import type { Router } from 'vue-router'
import type { RouteLocationNamedRaw } from 'vue-router'
import { SpaceResource } from '@opencloud-eu/web-client'
import { CommentDocument, DashboardThreadEntry } from '../types'
import { commentMessages as msg } from '../i18n/messages'
import { getOpenTargetLabel, openDashboardTarget } from './dashboardNavigation'
import {
  collectUnreadCommentNotifications,
  dedupeMentionEvents,
  loadNotifiedMentionKeys,
  markMentionsNotified,
  mentionNotificationKey,
  MentionNotificationEvent,
  reserveFreshMentionKeys
} from './mentionNotifications'
import { documentTargetToSummary, toMentionNavigationEntry } from './mentionNavigation'
import { debugLog } from './debugLog'

export const COMMENT_DASHBOARD_ROUTE = 'comments-dashboard'

export interface MentionNotificationPresenter {
  showMessage: (data: {
    title: string
    desc?: string
    status?: 'primary'
    timeout?: number
    actions?: Array<{
      name: string
      label: () => string
      isVisible: () => boolean
      handler: () => void
    }>
  }) => unknown
  translate: (message: string, values?: Record<string, string>) => string
  router: Router
  openTarget: (
    space: SpaceResource,
    entry: Pick<DashboardThreadEntry, 'space' | 'target'>
  ) => void
}

interface MentionToastItem {
  event: MentionNotificationEvent
  space: SpaceResource
  navigation: Pick<DashboardThreadEntry, 'space' | 'target'>
}

export function buildCommentDashboardLocation(): RouteLocationNamedRaw {
  return { name: COMMENT_DASHBOARD_ROUTE }
}

export function presentMentionNotifications(
  presenter: MentionNotificationPresenter,
  space: SpaceResource,
  document: CommentDocument,
  userIds: string[],
  source = 'unknown',
  navigation?: Pick<DashboardThreadEntry, 'space' | 'target'>
): boolean {
  if (userIds.length === 0) {
    return false
  }

  const notifiedKeys = loadNotifiedMentionKeys()
  const events = dedupeMentionEvents(
    collectUnreadCommentNotifications(document, userIds, notifiedKeys)
  )

  // #region agent log
  debugLog(
    'mentionNotificationPresenter.ts:presentMentionNotifications',
    'mention check',
    {
      source,
      userIdCount: userIds.length,
      eventCount: events.length,
      targetName: document.target.name
    },
    events.length === 0 ? 'C' : 'D'
  )
  // #endregion

  if (events.length === 0) {
    return false
  }

  const navigationEntry =
    navigation ??
    toMentionNavigationEntry({
      space,
      target: documentTargetToSummary(document.target)
    })

  return presentMentionToastBatch(
    presenter,
    events.map((event) => ({
      event,
      space,
      navigation: navigationEntry
    })),
    source
  )
}

export function presentPolledMentionEntries(
  presenter: MentionNotificationPresenter,
  entries: Array<{
    space: SpaceResource
    entry: Pick<DashboardThreadEntry, 'space' | 'target' | 'thread'>
  }>,
  userIds: string[],
  source = 'poll'
): boolean {
  if (userIds.length === 0 || entries.length === 0) {
    return false
  }

  const notifiedKeys = loadNotifiedMentionKeys()
  const items: MentionToastItem[] = []

  for (const { space, entry } of entries) {
    const document: CommentDocument = {
      version: 1,
      target: {
        id: entry.target.id,
        name: entry.target.name,
        path: entry.target.path,
        isFolder: entry.target.isFolder
      },
      threads: [entry.thread]
    }

    for (const event of collectUnreadCommentNotifications(document, userIds, notifiedKeys)) {
      items.push({
        event,
        space,
        navigation: { space: entry.space, target: entry.target }
      })
    }
  }

  const events = dedupeMentionEvents(items.map((item) => item.event))

  // #region agent log
  debugLog(
    'mentionNotificationPresenter.ts:presentPolledMentionEntries',
    'poll mention batch',
    {
      source,
      entryCount: entries.length,
      uniqueEventCount: events.length
    },
    events.length === 0 ? 'C' : 'D'
  )
  // #endregion

  if (events.length === 0) {
    return false
  }

  const itemByKey = new Map(
    items.map((item) => [
      mentionNotificationKey(item.event.threadId, item.event.commentId, item.event.mentionId),
      item
    ])
  )

  const batchItems = events.flatMap((event) => {
    const item = itemByKey.get(
      mentionNotificationKey(event.threadId, event.commentId, event.mentionId)
    )

    return item ? [item] : []
  })

  return presentMentionToastBatch(presenter, batchItems, source)
}

function presentMentionToastBatch(
  presenter: MentionNotificationPresenter,
  items: MentionToastItem[],
  source: string
): boolean {
  const keys = items.map((item) =>
    mentionNotificationKey(item.event.threadId, item.event.commentId, item.event.mentionId)
  )
  const freshKeys = reserveFreshMentionKeys(keys)

  if (freshKeys.length === 0) {
    return false
  }

  const freshKeySet = new Set(freshKeys)
  const freshItems = items.filter((item) =>
    freshKeySet.has(
      mentionNotificationKey(item.event.threadId, item.event.commentId, item.event.mentionId)
    )
  )

  markMentionsNotified(freshKeys)
  showMentionToast(presenter, freshItems)

  // #region agent log
  debugLog(
    'mentionNotificationPresenter.ts:presentMentionToastBatch',
    'toast shown',
    {
      source,
      toastCount: 1,
      mentionCount: freshItems.length,
      targetName: freshItems[0]?.event.targetName
    },
    'D'
  )
  // #endregion

  return true
}

function showMentionToast(
  presenter: MentionNotificationPresenter,
  items: MentionToastItem[]
): void {
  if (items.length === 0) {
    return
  }

  const first = items[0].event
  const title =
    items.length === 1
      ? getNotificationTitle(presenter, first)
      : presenter.translate(msg.commentNotificationBatchTitle, {
          count: String(items.length)
        })

  presenter.showMessage({
    title,
    desc: first.preview || undefined,
    status: 'primary',
    timeout: 12_000,
    actions: buildMentionToastActions(presenter, items)
  })
}

function buildMentionToastActions(
  presenter: MentionNotificationPresenter,
  items: MentionToastItem[]
) {
  const actions = [
    {
      name: 'open-comment-dashboard',
      label: () => presenter.translate(msg.openCommentDashboard),
      isVisible: () => true,
      handler: () => {
        void presenter.router.push(buildCommentDashboardLocation())
      }
    }
  ]

  if (items.length === 1) {
    const item = items[0]

    actions.push({
      name: 'open-mentioned-resource',
      label: () => getOpenTargetLabel(presenter.translate, item.navigation.target),
      isVisible: () => true,
      handler: () => {
        presenter.openTarget(item.space, item.navigation)
      }
    })
  }

  return actions
}

function getNotificationTitle(
  presenter: MentionNotificationPresenter,
  event: MentionNotificationEvent
): string {
  if (event.kind === 'reply') {
    return presenter.translate(msg.replyNotificationTitle, {
      author: event.actor.displayName,
      resource: event.targetName
    })
  }

  return presenter.translate(msg.mentionNotificationTitle, {
    author: event.actor.displayName,
    resource: event.targetName
  })
}
