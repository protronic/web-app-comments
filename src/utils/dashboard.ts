import {
  CommentDocument,
  CommentThread,
  CommentsDashboardQuery,
  CommentsDashboardResult,
  DashboardLastReply,
  DashboardTargetSummary,
  DashboardThreadEntry,
  DashboardSpaceSummary
} from '../types'
import { SpaceResource } from '@opencloud-eu/web-client'
import { getCommentPreviewLine, getLastReplyComment } from './comments'
import { isSpaceRootCommentTarget } from './resolveTarget'

export function enrichDashboardTarget(
  space: SpaceResource,
  target: DashboardTargetSummary
): DashboardTargetSummary {
  if (isSpaceRootCommentTarget(space, target)) {
    return {
      ...target,
      id: target.id || space.id,
      name: space.name || target.name,
      path: '/',
      isFolder: true,
      resourceType: 'space'
    }
  }

  if (target.isFolder && !target.name && target.path && target.path !== '/') {
    const segments = target.path.split('/').filter(Boolean)

    return {
      ...target,
      name: segments[segments.length - 1] || target.path
    }
  }

  return target
}

export function countActiveComments(thread: CommentThread): number {
  return thread.comments.filter((comment) => !comment.deletedAt).length
}

export function isThreadAnswered(thread: CommentThread): boolean {
  return countActiveComments(thread) > 1
}

export function buildDashboardEntry(
  space: SpaceResource,
  thread: CommentThread,
  target: DashboardTargetSummary
): DashboardThreadEntry {
  const lastReplyComment = getLastReplyComment(thread)

  return {
    thread,
    target: enrichDashboardTarget(space, target),
    space: toDashboardSpaceSummary(space),
    replyCount: Math.max(0, countActiveComments(thread) - 1),
    isAnswered: isThreadAnswered(thread),
    lastReply: lastReplyComment ? toDashboardLastReply(lastReplyComment) : undefined
  }
}

export function buildDashboardEntries(
  space: SpaceResource,
  document: CommentDocument,
  target: DashboardTargetSummary
): DashboardThreadEntry[] {
  return document.threads.map((thread) => buildDashboardEntry(space, thread, target))
}

export function filterDashboardEntries(
  entries: DashboardThreadEntry[],
  query: CommentsDashboardQuery = {}
): DashboardThreadEntry[] {
  return entries.filter((entry) => {
    if (query.status === 'open' && entry.thread.status !== 'open') {
      return false
    }

    if (query.status === 'resolved' && entry.thread.status !== 'resolved') {
      return false
    }

    if (query.answered === 'answered' && !entry.isAnswered) {
      return false
    }

    if (query.answered === 'unanswered' && entry.isAnswered) {
      return false
    }

    if (query.spaceId && entry.space.id !== query.spaceId) {
      return false
    }

    if (query.type && query.type !== 'all' && entry.target.resourceType !== query.type) {
      return false
    }

    if (query.tag && query.tag !== 'all' && !entry.target.tags.includes(query.tag)) {
      return false
    }

    return true
  })
}

export function sortDashboardEntries(entries: DashboardThreadEntry[]): DashboardThreadEntry[] {
  return [...entries].sort((a, b) => {
    if (a.thread.status !== b.thread.status) {
      return a.thread.status === 'open' ? -1 : 1
    }

    return new Date(b.thread.updatedAt).getTime() - new Date(a.thread.updatedAt).getTime()
  })
}

export function paginateDashboardEntries(
  entries: DashboardThreadEntry[],
  query: CommentsDashboardQuery = {}
): CommentsDashboardResult {
  const offset = query.offset ?? 0
  const limit = query.limit ?? entries.length

  return {
    entries: entries.slice(offset, offset + limit),
    total: entries.length
  }
}

export function queryDashboardEntries(
  entries: DashboardThreadEntry[],
  query: CommentsDashboardQuery = {}
): CommentsDashboardResult {
  const filtered = filterDashboardEntries(deduplicateDashboardEntries(entries), query)
  const sorted = sortDashboardEntries(filtered)

  return paginateDashboardEntries(sorted, query)
}

function deduplicateDashboardEntries(entries: DashboardThreadEntry[]): DashboardThreadEntry[] {
  const seen = new Set<string>()

  return entries.filter((entry) => {
    const key = `${entry.space.id}:${entry.thread.id}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function toDashboardSpaceSummary(space: SpaceResource): DashboardSpaceSummary {
  return {
    id: space.id,
    name: space.name,
    driveAlias: space.driveAlias,
    driveType: space.driveType
  }
}

function toDashboardLastReply(comment: CommentThread['comments'][number]): DashboardLastReply {
  return {
    author: comment.author,
    body: comment.body,
    preview: getCommentPreviewLine(comment.body),
    createdAt: comment.updatedAt || comment.createdAt
  }
}
