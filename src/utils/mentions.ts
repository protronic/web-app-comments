import { CommentAuthor, CommentThread } from '../types'
import { authorMatchesUser, normalizeUserIdentity } from './userIdentity'

const MENTION_PATTERN = /@\[([^\]]+)\]\(user:([^)]+)\)/g
const MENTION_TOKEN_PATTERN = /@\[([^\]]+)\]\(user:([^)]+)\)/

export function formatUserMention(user: CommentAuthor): string {
  return `@[${user.displayName}](user:${user.id})`
}

export function parseUserMentions(body: string): CommentAuthor[] {
  const mentions: CommentAuthor[] = []
  const seen = new Set<string>()

  for (const match of body.matchAll(MENTION_PATTERN)) {
    const displayName = match[1]?.trim()
    const id = match[2]?.trim()

    if (!displayName || !id || seen.has(id)) {
      continue
    }

    seen.add(id)
    mentions.push({ id, displayName })
  }

  return mentions
}

export function commentMentionsUser(body: string, userIds: string | string[]): boolean {
  const candidates = new Set(
    (Array.isArray(userIds) ? userIds : [userIds])
      .map(normalizeUserIdentity)
      .filter(Boolean)
  )

  if (candidates.size === 0) {
    return false
  }

  return parseUserMentions(body).some((mention) => candidates.has(normalizeUserIdentity(mention.id)))
}

export function threadInvolvesUser(thread: CommentThread, userIds: string | string[]): boolean {
  const ids = Array.isArray(userIds) ? userIds : [userIds]

  if (ids.length === 0 || ids.every((id) => !id.trim())) {
    return false
  }

  if (thread.resolvedBy && authorMatchesUser(thread.resolvedBy, ids)) {
    return true
  }

  for (const comment of thread.comments) {
    if (comment.deletedAt) {
      continue
    }

    if (authorMatchesUser(comment.author, ids) || commentMentionsUser(comment.body, ids)) {
      return true
    }
  }

  return false
}

export function getActiveMentionQuery(
  value: string,
  cursor: number
): { start: number; query: string } | null {
  const beforeCursor = value.slice(0, cursor)
  const match = beforeCursor.match(/(?:^|\s)@([\p{L}\p{N}@._-]*)$/u)

  if (!match) {
    return null
  }

  return {
    start: cursor - match[1].length - 1,
    query: match[1]
  }
}

export function insertUserMention(
  value: string,
  start: number,
  cursor: number,
  user: CommentAuthor
): { value: string; cursor: number } {
  const mention = formatUserMention(user)
  const nextValue = `${value.slice(0, start)}${mention} ${value.slice(cursor)}`

  return {
    value: nextValue,
    cursor: start + mention.length + 1
  }
}

export function renderMentionHtml(displayName: string): string {
  return `<span class="comment-mention">@${escapeHtml(displayName)}</span>`
}

export function replaceMentionsWithHtml(value: string): string {
  return value.replace(MENTION_TOKEN_PATTERN, (_match, displayName: string) =>
    renderMentionHtml(displayName)
  )
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
