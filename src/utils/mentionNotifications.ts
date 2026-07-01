import { CommentAuthor, CommentDocument, CommentThread } from '../types'
import { getCommentPreviewLine } from './comments'
import { commentMentionsUser, parseUserMentions } from './mentions'
import {
  COMMENTS_FOLDER_NAME,
  COMMENT_SIDECAR_SUFFIX,
  LEGACY_COMMENT_SIDECAR_SUFFIX
} from './target'
import { authorMatchesUser, normalizeUserIdentity } from './userIdentity'

const NOTIFIED_MENTIONS_STORAGE_KEY = 'comments-mentioned-notified'
const MAX_NOTIFIED_MENTIONS = 500

export interface MentionNotificationEvent {
  threadId: string
  commentId: string
  mentionId: string
  actor: CommentAuthor
  targetName: string
  targetPath: string
  preview: string
}

export function isCommentSidecarPath(path: string): boolean {
  const name = path.split('/').filter(Boolean).pop() || path

  return (
    name.endsWith(COMMENT_SIDECAR_SUFFIX) ||
    name.endsWith(LEGACY_COMMENT_SIDECAR_SUFFIX) ||
    path.includes(`/${COMMENTS_FOLDER_NAME}/`)
  )
}

export function mentionNotificationKey(
  threadId: string,
  commentId: string,
  mentionId: string
): string {
  return `${threadId}:${commentId}:${normalizeUserIdentity(mentionId)}`
}

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
}

export function collectUnreadMentionNotifications(
  document: CommentDocument,
  userIds: string[],
  notifiedKeys: Set<string>
): MentionNotificationEvent[] {
  const events: MentionNotificationEvent[] = []

  for (const thread of document.threads) {
    events.push(...collectThreadMentionNotifications(thread, document, userIds, notifiedKeys))
  }

  return events
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
