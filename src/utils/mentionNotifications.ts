import { CommentAuthor, CommentDocument, CommentThread } from '../types'
import { getCommentPreviewLine } from './comments'
import { commentMentionsUser, parseUserMentions, threadInvolvesUser } from './mentions'
import { authorMatchesUser, normalizeUserIdentity } from './userIdentity'

const NOTIFIED_MENTIONS_STORAGE_KEY = 'comments-mentioned-notified'
const MAX_NOTIFIED_MENTIONS = 500

const pendingMentionKeys = new Set<string>()

export interface MentionNotificationEvent {
  kind: 'mention' | 'reply'
  threadId: string
  commentId: string
  mentionId: string
  actor: CommentAuthor
  targetName: string
  targetPath: string
  preview: string
}

export function mentionNotificationKey(
  threadId: string,
  commentId: string,
  recipientId: string
): string {
  return `${threadId}:${commentId}:${normalizeUserIdentity(recipientId)}`
}

export { isCommentSidecarPath } from './target'

export function loadNotifiedMentionKeys(): Set<string> {
  if (typeof sessionStorage === 'undefined') {
    return new Set()
  }

  try {
    const raw = sessionStorage.getItem(NOTIFIED_MENTIONS_STORAGE_KEY)

    if (!raw) {
      return new Set()
    }

    const parsed = JSON.parse(raw)

    return new Set(Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [])
  } catch {
    return new Set()
  }
}

export function markMentionsNotified(keys: string[]): void {
  if (typeof sessionStorage === 'undefined' || keys.length === 0) {
    return
  }

  const next = new Set([...loadNotifiedMentionKeys(), ...keys])

  sessionStorage.setItem(
    NOTIFIED_MENTIONS_STORAGE_KEY,
    JSON.stringify([...next].slice(-MAX_NOTIFIED_MENTIONS))
  )

  for (const key of keys) {
    pendingMentionKeys.delete(key)
  }
}

export function reserveFreshMentionKeys(keys: string[]): string[] {
  const notifiedKeys = loadNotifiedMentionKeys()
  const reserved: string[] = []

  for (const key of keys) {
    if (notifiedKeys.has(key) || pendingMentionKeys.has(key)) {
      continue
    }

    pendingMentionKeys.add(key)
    reserved.push(key)
  }

  return reserved
}

export function dedupeMentionEvents(events: MentionNotificationEvent[]): MentionNotificationEvent[] {
  const seen = new Set<string>()

  return events.filter((event) => {
    const key = mentionNotificationKey(event.threadId, event.commentId, event.mentionId)

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export function collectUnreadMentionNotifications(
  document: CommentDocument,
  userIds: string[],
  notifiedKeys: Set<string>
): MentionNotificationEvent[] {
  return collectUnreadCommentNotifications(document, userIds, notifiedKeys).filter(
    (event) => event.kind === 'mention'
  )
}

export function collectUnreadCommentNotifications(
  document: CommentDocument,
  userIds: string[],
  notifiedKeys: Set<string>
): MentionNotificationEvent[] {
  const events: MentionNotificationEvent[] = []

  for (const thread of document.threads) {
    events.push(...collectThreadMentionNotifications(thread, document, userIds, notifiedKeys))
    events.push(...collectThreadReplyNotifications(thread, document, userIds, notifiedKeys))
  }

  return dedupeCommentNotifications(events)
}

function dedupeCommentNotifications(events: MentionNotificationEvent[]): MentionNotificationEvent[] {
  const byComment = new Map<string, MentionNotificationEvent>()

  for (const event of events) {
    const existing = byComment.get(event.commentId)

    if (!existing || (existing.kind === 'reply' && event.kind === 'mention')) {
      byComment.set(event.commentId, event)
    }
  }

  return [...byComment.values()]
}

function collectThreadMentionNotifications(
  thread: CommentThread,
  document: CommentDocument,
  userIds: string[],
  notifiedKeys: Set<string>
): MentionNotificationEvent[] {
  const events: MentionNotificationEvent[] = []

  for (const comment of thread.comments) {
    if (comment.deletedAt || !commentMentionsUser(comment.body, userIds)) {
      continue
    }

    if (authorMatchesUser(comment.author, userIds)) {
      continue
    }

    for (const mention of parseUserMentions(comment.body)) {
      if (!commentMentionsUser(`@[${mention.displayName}](user:${mention.id})`, userIds)) {
        continue
      }

      const key = mentionNotificationKey(thread.id, comment.id, mention.id)

      if (notifiedKeys.has(key)) {
        continue
      }

      events.push({
        kind: 'mention',
        threadId: thread.id,
        commentId: comment.id,
        mentionId: mention.id,
        actor: comment.author,
        targetName: document.target.name,
        targetPath: document.target.path,
        preview: getCommentPreviewLine(comment.body)
      })
    }
  }

  return events
}

function collectThreadReplyNotifications(
  thread: CommentThread,
  document: CommentDocument,
  userIds: string[],
  notifiedKeys: Set<string>
): MentionNotificationEvent[] {
  const events: MentionNotificationEvent[] = []

  for (const [index, comment] of thread.comments.entries()) {
    if (comment.deletedAt || authorMatchesUser(comment.author, userIds)) {
      continue
    }

    const priorComments = thread.comments.slice(0, index).filter((entry) => !entry.deletedAt)

    if (priorComments.length === 0) {
      continue
    }

    const priorThread: CommentThread = {
      ...thread,
      comments: priorComments
    }

    if (!threadInvolvesUser(priorThread, userIds)) {
      continue
    }

    const key = mentionNotificationKey(thread.id, comment.id, 'reply')

    if (notifiedKeys.has(key)) {
      continue
    }

    events.push({
      kind: 'reply',
      threadId: thread.id,
      commentId: comment.id,
      mentionId: 'reply',
      actor: comment.author,
      targetName: document.target.name,
      targetPath: document.target.path,
      preview: getCommentPreviewLine(comment.body)
    })
  }

  return events
}

export function sseAffectedUserMatches(
  affectedUserIds: string[] | null | undefined,
  userIds: string[]
): boolean {
  if (!affectedUserIds?.length) {
    return true
  }

  const normalizedUserIds = new Set(userIds.map(normalizeUserIdentity))

  return affectedUserIds.some((userId) => normalizedUserIds.has(normalizeUserIdentity(userId)))
}
