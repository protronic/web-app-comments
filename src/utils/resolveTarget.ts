import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import { CommentDocument, DashboardTargetSummary } from '../types'
import { getSidecarContainerPath, getStableResourceId, isCommentSidecarResourceName, normalizeResourceNameForSidecar } from './target'
import { isGraphResourceId } from './commentTags'
import { relativizeMountpointPath } from './mountpointPaths'

export interface CommentDocumentRef {
  document: CommentDocument
  sidecarPath?: string
}

export async function resolveCommentDocumentTarget(
  webdav: WebDAV,
  space: SpaceResource,
  document: CommentDocument,
  sidecarPath?: string
): Promise<DashboardTargetSummary> {
  const fallback = document.target
  const containerPath = sidecarPath ? getSidecarContainerPath(sidecarPath) : undefined

  if (isSpaceLevelSidecarTarget(fallback, containerPath, space, sidecarPath)) {
    return mapSpaceRootTargetSummary(fallback, space)
  }

  if (fallback.isFolder && containerPath && containerPath !== '/') {
    try {
      const resource = await webdav.getFileInfo(space, { path: containerPath })
      return mapResourceToTargetSummary(resource, fallback, space)
    } catch {
      // Fall back to the lookups below.
    }
  }

  if (fallback.id) {
    try {
      const resource = await webdav.getFileInfo(space, { fileId: fallback.id })
      const resolved = mapResourceToTargetSummary(resource, fallback, space)

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
      return mapResourceToTargetSummary(resource, fallback, space)
    } catch {
      // Fall back to sidecar container lookup below.
    }
  }

  if (containerPath) {
    try {
      const resource = await webdav.getFileInfo(space, { path: containerPath })

      if (fallback.isFolder || resource.isFolder) {
        return mapResourceToTargetSummary(resource, fallback, space)
      }

      if (fallback.id) {
        try {
          const fileResource = await webdav.getFileInfo(space, { fileId: fallback.id })
          return mapResourceToTargetSummary(fileResource, fallback, space)
        } catch {
          // Keep trying with the sidecar snapshot below.
        }
      }
    } catch {
      // Keep the sidecar snapshot when the resource no longer exists.
    }
  }

  return mapFallbackTargetSummary(fallback, space)
}

export async function resolveCommentDocumentTargets(
  webdav: WebDAV,
  space: SpaceResource,
  refs: CommentDocumentRef[]
): Promise<Map<string, DashboardTargetSummary>> {
  const resolved = new Map<string, DashboardTargetSummary>()
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
  target: Pick<DashboardTargetSummary, 'id' | 'path' | 'isFolder'>
): boolean {
  if (!target.isFolder || target.path !== '/') {
    return false
  }

  return target.id === space.id || normalizeResourceId(target.id) === normalizeResourceId(space.id)
}

function isSpaceLevelSidecarTarget(
  fallback: CommentDocument['target'],
  containerPath: string | undefined,
  space: SpaceResource,
  sidecarPath?: string
): boolean {
  if (containerPath !== '/') {
    return false
  }

  if (isSpaceRootCommentTarget(space, fallback)) {
    return true
  }

  if (!sidecarPath || !space.name?.trim()) {
    return false
  }

  const fileName = sidecarPath.split('/').filter(Boolean).pop() || ''

  return (
    isCommentSidecarResourceName(fileName) &&
    normalizeResourceNameForSidecar(fileName) === space.name.trim()
  )
}

function mapSpaceRootTargetSummary(
  fallback: CommentDocument['target'],
  space: SpaceResource
): DashboardTargetSummary {
  return {
    id: space.id,
    name: space.name || fallback.name,
    path: '/',
    isFolder: true,
    resourceType: 'space',
    fileId: typeof space.fileId === 'string' ? space.fileId : space.id,
    privateLink: typeof space.privateLink === 'string' ? space.privateLink : undefined,
    tags: []
  }
}

function normalizeResourceId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function mapResourceToTargetSummary(
  resource: Resource,
  fallback: CommentDocument['target'],
  space: SpaceResource
): DashboardTargetSummary {
  const isFolder = resource.isFolder ?? fallback.isFolder
  let path = resource.path || fallback.path
  let name = resource.name || fallback.name

  if (isFolder && path === '/' && fallback.path && fallback.path !== '/') {
    path = fallback.path
  }

  if (isFolder && !name) {
    name = getNameFromPath(path) || fallback.name
  }

  const summary: DashboardTargetSummary = {
    id: getStableResourceId(resource) || fallback.id,
    name,
    path: relativizeMountpointPath(space, path),
    isFolder,
    resourceType: getResourceTypeFromResource(resource, isFolder),
    mimeType: typeof resource.mimeType === 'string' ? resource.mimeType : undefined,
    extension: getResourceExtension(resource, name),
    fileId: getGraphFileId(resource),
    privateLink: typeof resource.privateLink === 'string' ? resource.privateLink : undefined,
    tags: Array.isArray(resource.tags) ? [...resource.tags] : []
  }

  return applySpaceRootMetadata(space, summary)
}

export function mapFallbackTargetSummary(
  fallback: CommentDocument['target'],
  space: SpaceResource
): DashboardTargetSummary {
  const summary: DashboardTargetSummary = {
    id: fallback.id,
    name: fallback.name,
    path: relativizeMountpointPath(space, fallback.path),
    isFolder: fallback.isFolder,
    resourceType: fallback.isFolder ? 'folder' : 'file',
    tags: []
  }

  return applySpaceRootMetadata(space, summary)
}

function applySpaceRootMetadata(
  space: SpaceResource,
  target: DashboardTargetSummary
): DashboardTargetSummary {
  if (!isSpaceRootCommentTarget(space, target)) {
    return target
  }

  return {
    ...target,
    resourceType: 'space',
    isFolder: true,
    path: '/'
  }
}

function getGraphFileId(resource: Resource): string | undefined {
  const candidate = resource.fileId || resource.id

  return isGraphResourceId(candidate) ? candidate : undefined
}

function getResourceExtension(resource: Resource, name: string): string | undefined {
  if (typeof resource.extension === 'string' && resource.extension.length > 0) {
    return resource.extension.toLowerCase()
  }

  const match = name.match(/\.([^.\\/]+)$/)

  return match?.[1]?.toLowerCase()
}

function getResourceTypeFromResource(
  resource: Resource,
  isFolder: boolean
): DashboardTargetSummary['resourceType'] {
  if (resource.type === 'folder' || isFolder) {
    return 'folder'
  }

  return 'file'
}

function shouldRetryFolderLookup(
  resolved: DashboardTargetSummary,
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
