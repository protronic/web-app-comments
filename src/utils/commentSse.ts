import { Resource, extractNodeId } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import { CommentTarget } from '../types'
import { isCommentSidecarPath } from './target'
import {
  getCommentSidecarFileName,
  getCommentSidecarReadPaths,
  getStableResourceId
} from './target'

export { COMMENT_SSE_EVENT_TYPES } from './commentSseHub'

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

export function fileIdsReferToSameNode(left?: string, right?: string): boolean {
  if (!left || !right) {
    return false
  }

  if (left === right) {
    return true
  }

  const leftNodeId = extractNodeId(left)
  const rightNodeId = extractNodeId(right)

  return leftNodeId.length > 0 && leftNodeId === rightNodeId
}

export function collectCommentTargetFileIds(target: CommentTarget): Set<string> {
  const ids = new Set<string>()
  const resource = target.resource

  for (const candidate of [
    resource.fileId,
    resource.id,
    resource.remoteItemId,
    target.id
  ]) {
    if (typeof candidate === 'string' && candidate.length > 0) {
      ids.add(candidate)
    }
  }

  ids.add(getStableResourceId(resource))

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

      if (resource.remoteItemId) {
        ids.add(resource.remoteItemId)
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
    if (!itemId) {
      continue
    }

    if (watchedFileIds.has(itemId)) {
      return true
    }

    for (const watchedId of watchedFileIds) {
      if (fileIdsReferToSameNode(itemId, watchedId)) {
        return true
      }
    }
  }

  return false
}

export function resourceRelatesToCommentTarget(
  resource: Resource,
  target: CommentTarget
): boolean {
  const targetPath = target.path || '/'
  const resourcePath = resource.path || '/'

  if (resourcePath === targetPath) {
    return true
  }

  if (fileIdsReferToSameNode(resource.fileId, target.resource.fileId)) {
    return true
  }

  if (fileIdsReferToSameNode(resource.remoteItemId, target.resource.fileId)) {
    return true
  }

  if (fileIdsReferToSameNode(resource.fileId, target.resource.remoteItemId)) {
    return true
  }

  if (isCommentSidecarPath(resourcePath)) {
    const sidecarName = getCommentSidecarFileName(target)
    const resourceName = resource.name || resourcePath.split('/').filter(Boolean).pop()

    if (resourceName === sidecarName) {
      return true
    }

    return getCommentSidecarReadPaths(target).includes(resourcePath)
  }

  return false
}

export async function resolveSsePayloadForCommentTarget(
  webdav: WebDAV,
  target: CommentTarget,
  payload: CommentSsePayload,
  watchedFileIds: Set<string>
): Promise<boolean> {
  if (sseEventMatchesCommentTarget(payload, watchedFileIds)) {
    return true
  }

  for (const itemId of [payload.itemid, payload.parentitemid]) {
    if (!itemId) {
      continue
    }

    try {
      const resource = await webdav.getFileInfo(target.space, { fileId: itemId })

      if (resourceRelatesToCommentTarget(resource, target)) {
        return true
      }
    } catch {
      continue
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

export function isSharedCommentTarget(target: CommentTarget): boolean {
  if (target.space.driveType === 'mountpoint') {
    return true
  }

  if (target.resource.isReceivedShare?.()) {
    return true
  }

  if (target.resource.isMounted?.()) {
    return true
  }

  const shareTypes = target.resource.shareTypes ?? []

  return shareTypes.length > 0
}
