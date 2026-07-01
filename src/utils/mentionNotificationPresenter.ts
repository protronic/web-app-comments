import type { Router } from 'vue-router'
import { SpaceResource } from '@opencloud-eu/web-client'
import { CommentDocument } from '../types'
import { commentMessages as msg } from '../i18n/messages'
import { buildOpenTargetLocation } from './dashboardNavigation'
import {
  collectUnreadMentionNotifications,
  loadNotifiedMentionKeys,
  markMentionsNotified,
  mentionNotificationKey,
  MentionNotificationEvent
} from './mentionNotifications'
import { debugLog } from './debugLog'

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
}

export function presentMentionNotifications(
  presenter: MentionNotificationPresenter,
  space: SpaceResource,
  document: CommentDocument,
  userIds: string[],
  source = 'unknown'
): boolean {
  if (userIds.length === 0) {
    return false
  }

  const notifiedKeys = loadNotifiedMentionKeys()
  const events = collectUnreadMentionNotifications(document, userIds, notifiedKeys)

  // #region agent log
  debugLog(
    'mentionNotificationPresenter.ts:presentMentionNotifications',
    'mention check',
    {
      source,
      userIdCount: userIds.length,
      eventCount: events.length,
      notifiedKeyCount: notifiedKeys.size,
      targetName: document.target.name
    },
    events.length === 0 ? 'C' : 'D'
  )
  // #endregion

  if (events.length === 0) {
    return false
  }

  for (const event of events) {
    presentMentionNotification(presenter, space, document, event)
    // #region agent log
    debugLog(
      'mentionNotificationPresenter.ts:presentMentionNotification',
      'toast shown',
      { targetName: event.targetName, author: event.actor.displayName },
      'D'
    )
    // #endregion
  }

  markMentionsNotified(
    events.map((event) => mentionNotificationKey(event.threadId, event.commentId, event.mentionId))
  )

  return true
}

function presentMentionNotification(
  presenter: MentionNotificationPresenter,
  space: SpaceResource,
  document: CommentDocument,
  event: MentionNotificationEvent
): void {
  presenter.showMessage({
    title: presenter.translate(msg.mentionNotificationTitle, {
      author: event.actor.displayName,
      resource: event.targetName
    }),
    desc: event.preview || undefined,
    status: 'primary',
    timeout: 12_000,
    actions: [
      {
        name: 'open-mentioned-resource',
        label: () => presenter.translate(msg.openThread),
        isVisible: () => true,
        handler: () => {
          void presenter.router.push(
            buildOpenTargetLocation(space, {
              space: {
                id: space.id,
                name: space.name,
                driveAlias: space.driveAlias,
                driveType: space.driveType
              },
              target: {
                id: document.target.id,
                name: document.target.name,
                path: document.target.path,
                isFolder: document.target.isFolder,
                resourceType: document.target.isFolder ? 'folder' : 'file',
                tags: []
              }
            })
          )
        }
      }
    ]
  })
}
