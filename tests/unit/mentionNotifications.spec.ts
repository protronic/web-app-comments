import {
  collectUnreadCommentNotifications,
  collectUnreadMentionNotifications,
  dedupeMentionEvents,
  loadNotifiedMentionKeys,
  markMentionsNotified,
  mentionNotificationKey,
  reserveFreshMentionKeys,
  sseAffectedUserMatches
} from '../../src/utils/mentionNotifications'
import { isCommentSidecarPath } from '../../src/utils/target'
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
    expect(isCommentSidecarPath('/Testordner/Plan.md')).toBe(false)
  })

  it('collects unread mention notifications for the current user', () => {
    const events = collectUnreadCommentNotifications(document, ['dennis'], new Set())

    expect(events).toHaveLength(1)
    expect(events[0]?.kind).toBe('mention')
    expect(events[0]?.actor.displayName).toBe('Admin')
    expect(events[0]?.targetName).toBe('Testfiel.txt')
  })

  it('collects reply notifications for thread participants', () => {
    const replyDocument: CommentDocument = {
      ...document,
      threads: [
        {
          id: 'thread-reply',
          targetId: 'file-1',
          status: 'open',
          createdAt: '2026-07-01T10:00:00.000Z',
          updatedAt: '2026-07-01T11:00:00.000Z',
          comments: [
            {
              id: 'comment-1',
              body: 'Initial question',
              format: 'markdown',
              author: { id: 'dennis', displayName: 'Dennis' },
              createdAt: '2026-07-01T10:00:00.000Z'
            },
            {
              id: 'comment-2',
              body: 'Here is the answer',
              format: 'markdown',
              author: { id: 'admin', displayName: 'Admin' },
              createdAt: '2026-07-01T11:00:00.000Z'
            }
          ]
        }
      ]
    }

    const events = collectUnreadCommentNotifications(replyDocument, ['dennis'], new Set())

    expect(events).toHaveLength(1)
    expect(events[0]?.kind).toBe('reply')
    expect(events[0]?.commentId).toBe('comment-2')
  })

  it('skips self-mentions and already notified keys', () => {
    const key = mentionNotificationKey('thread-1', 'comment-1', 'dennis')

    expect(collectUnreadMentionNotifications(document, ['admin'], new Set())).toHaveLength(0)
    expect(collectUnreadMentionNotifications(document, ['dennis'], new Set([key]))).toHaveLength(0)
  })

  it('reserves mention keys while a toast is being shown', () => {
    const keys = [
      mentionNotificationKey('thread-1', 'comment-1', 'dennis'),
      mentionNotificationKey('thread-1', 'comment-1', 'dennis')
    ]

    expect(reserveFreshMentionKeys(keys)).toEqual([
      mentionNotificationKey('thread-1', 'comment-1', 'dennis')
    ])
    expect(reserveFreshMentionKeys(keys)).toEqual([])
  })

  it('deduplicates mention events by thread, comment, and mention id', () => {
    const event = {
      threadId: 'thread-1',
      commentId: 'comment-1',
      mentionId: 'dennis',
      actor: { id: 'admin', displayName: 'Admin' },
      targetName: 'Test',
      targetPath: '/Test.txt',
      preview: 'Hi'
    }

    expect(dedupeMentionEvents([event, event])).toEqual([event])
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
