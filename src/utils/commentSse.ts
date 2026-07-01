import { MESSAGE_TYPE } from '@opencloud-eu/web-client/sse'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import { CommentTarget } from '../types'
import { getCommentSidecarReadPaths, getStableResourceId } from './target'

export const COMMENT_SSE_EVENT_TYPES = [
  MESSAGE_TYPE.FILE_TOUCHED,
  MESSAGE_TYPE.POSTPROCESSING_FINISHED
] as const

export interface CommentSsePayload {
  itemid?: string
  parentitemid?: string
  spaceid?: string
  initiatorid?: string
}

export function parseCommentSsePayload(message: MessageEvent): CommentSsePayload | null {
  try {
    return JSON.parse(message.data) as CommentSsePayload
  } catch {
    return null
  }
}

export function collectCommentTargetFileIds(target: CommentTarget): Set<string> {
  const ids = new Set<string>()

  for (const candidate of [target.resource.fileId, target.resource.id, target.id]) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      ids.add(candidate)
    }
  }

  ids.add(getStableResourceId(target.resource))

  return ids
}

export async function resolveCommentSidecarFileIds(
  webdav: WebDAV,
  target: CommentTarget
): Promise<Set<string>> {
  const ids = collectCommentTargetFileIds(target)

  for (const path of getCommentSidecarReadPaths(target)) {
    try {
      const resource = await webdav.getFileInfo(target.space, { path })

      if (resource.fileId) {
        ids.add(resource.fileId)
      }

      if (resource.id) {
        ids.add(resource.id)
      }
    } catch {
      // Sidecar may not exist yet.
    }
  }

  return ids
}

export function sseEventMatchesCommentTarget(
  payload: CommentSsePayload,
  watchedFileIds: Set<string>
): boolean {
  if (watchedFileIds.size === 0) {
    return false
  }

  for (const itemId of [payload.itemid, payload.parentitemid]) {
    if (itemId && watchedFileIds.has(itemId)) {
      return true
    }
  }

  return false
}

export function countActiveComments(
  threads: Array<{ comments: Array<{ deletedAt?: string }> }>
): number {
  return threads.reduce(
    (total, thread) => total + thread.comments.filter((comment) => !comment.deletedAt).length,
    0
  )
}
