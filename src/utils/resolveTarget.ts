import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import { CommentDocument } from '../types'
import { getSidecarContainerPath, getStableResourceId } from './target'

export interface CommentDocumentRef {
  document: CommentDocument
  sidecarPath?: string
}

export async function resolveCommentDocumentTarget(
  webdav: WebDAV,
  space: SpaceResource,
  document: CommentDocument,
  sidecarPath?: string
): Promise<CommentDocument['target']> {
  const fallback = document.target
  const containerPath = sidecarPath ? getSidecarContainerPath(sidecarPath) : undefined

  if (fallback.isFolder && containerPath && containerPath !== '/') {
    try {
      const resource = await webdav.getFileInfo(space, { path: containerPath })
      return mapResourceToTargetSummary(resource, fallback)
    } catch {
      // Fall back to the lookups below.
    }
  }

  if (fallback.id) {
    try {
      const resource = await webdav.getFileInfo(space, { fileId: fallback.id })
      const resolved = mapResourceToTargetSummary(resource, fallback)

      if (!shouldRetryFolderLookup(resolved, fallback)) {
        return resolved
      }
    } catch {
      // Fall back to path lookup below.
    }
  }

  if (fallback.path) {
    try {
      const resource = await webdav.getFileInfo(space, { path: fallback.path })
      return mapResourceToTargetSummary(resource, fallback)
    } catch {
      // Fall back to sidecar container lookup below.
    }
  }

  if (containerPath) {
    try {
      const resource = await webdav.getFileInfo(space, { path: containerPath })

      if (fallback.isFolder || resource.isFolder) {
        return mapResourceToTargetSummary(resource, fallback)
      }

      if (fallback.id) {
        try {
          const fileResource = await webdav.getFileInfo(space, { fileId: fallback.id })
          return mapResourceToTargetSummary(fileResource, fallback)
        } catch {
          // Keep trying with the sidecar snapshot below.
        }
      }
    } catch {
      // Keep the sidecar snapshot when the resource no longer exists.
    }
  }

  return fallback
}

export async function resolveCommentDocumentTargets(
  webdav: WebDAV,
  space: SpaceResource,
  refs: CommentDocumentRef[]
): Promise<Map<string, CommentDocument['target']>> {
  const resolved = new Map<string, CommentDocument['target']>()
  const targetIds = [...new Set(refs.map((ref) => ref.document.target.id))]

  for (const targetId of targetIds) {
    const ref = refs.find((entry) => entry.document.target.id === targetId)

    if (!ref) {
      continue
    }

    resolved.set(
      targetId,
      await resolveCommentDocumentTarget(webdav, space, ref.document, ref.sidecarPath)
    )
  }

  return resolved
}

export function isSpaceRootCommentTarget(
  space: SpaceResource,
  target: CommentDocument['target']
): boolean {
  if (!target.isFolder || target.path !== '/') {
    return false
  }

  return target.id === space.id
}

function mapResourceToTargetSummary(
  resource: Resource,
  fallback: CommentDocument['target']
): CommentDocument['target'] {
  const isFolder = resource.isFolder ?? fallback.isFolder
  let path = resource.path || fallback.path
  let name = resource.name || fallback.name

  if (isFolder && path === '/' && fallback.path && fallback.path !== '/') {
    path = fallback.path
  }

  if (isFolder && !name) {
    name = getNameFromPath(path) || fallback.name
  }

  return {
    id: getStableResourceId(resource) || fallback.id,
    name,
    path,
    isFolder
  }
}

function shouldRetryFolderLookup(
  resolved: CommentDocument['target'],
  fallback: CommentDocument['target']
): boolean {
  if (!fallback.isFolder) {
    return false
  }

  if (resolved.path === '/' && fallback.path !== '/') {
    return true
  }

  return !resolved.name && !!fallback.name
}

function getNameFromPath(path: string): string | undefined {
  const segments = path.split('/').filter(Boolean)

  return segments[segments.length - 1]
}
