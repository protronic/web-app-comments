import {
  collectUnreadMentionNotifications,
  isCommentSidecarPath,
  loadNotifiedMentionKeys,
  markMentionsNotified,
  mentionNotificationKey,
  sseAffectedUserMatches
} from '../../src/utils/mentionNotifications'
import { CommentDocument } from '../../src/types'

describe('mention notifications', () => {
  const document: CommentDocument = {
    version: 1,
    target: {
      id: 'file-1',
      name: 'Testfiel.txt',
      path: '/Testfiel.txt',
      isFolder: false
    },
    threads: [
      {
        id: 'thread-1',
        targetId: 'file-1',
        status: 'open',
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-01T10:00:00.000Z',
        comments: [
          {
            id: 'comment-1',
            body: 'Please review @[Dennis Ritchie](user:dennis)',
            format: 'markdown',
            author: { id: 'admin', displayName: 'Admin' },
            createdAt: '2026-07-01T10:00:00.000Z'
          }
        ]
      }
    ]
  }

  beforeEach(() => {
    sessionStorage.clear()
  })

  it('detects comment sidecar paths', () => {
    expect(isCommentSidecarPath('/Testordner/.Plan.md.jsco')).toBe(true)
    expect(isCommentSidecarPath('/Testordner/.Plan.md.conflu.json')).toBe(true)
    expect(isCommentSidecarPath('/Testordner/.conflu/comments/file-1.json')).toBe(true)
    expect(isCommentSidecarPath('/Testordner/Plan.md')).toBe(false)
  })

  it('collects unread mention notifications for the current user', () => {
    const events = collectUnreadMentionNotifications(document, ['dennis'], new Set())

    expect(events).toHaveLength(1)
    expect(events[0]?.actor.displayName).toBe('Admin')
    expect(events[0]?.targetName).toBe('Testfiel.txt')
  })

  it('skips self-mentions and already notified keys', () => {
    const key = mentionNotificationKey('thread-1', 'comment-1', 'dennis')

    expect(collectUnreadMentionNotifications(document, ['admin'], new Set())).toHaveLength(0)
    expect(collectUnreadMentionNotifications(document, ['dennis'], new Set([key]))).toHaveLength(0)
  })

  it('persists notified mention keys in session storage', () => {
    markMentionsNotified([mentionNotificationKey('thread-1', 'comment-1', 'dennis')])

    expect(loadNotifiedMentionKeys().has(mentionNotificationKey('thread-1', 'comment-1', 'dennis'))).toBe(
      true
    )
  })

  it('matches affected SSE users when the list is present', () => {
    expect(sseAffectedUserMatches(['dennis'], ['dennis', 'dennis@example.com'])).toBe(true)
    expect(sseAffectedUserMatches(['admin'], ['dennis'])).toBe(false)
    expect(sseAffectedUserMatches(undefined, ['dennis'])).toBe(true)
  })
})
