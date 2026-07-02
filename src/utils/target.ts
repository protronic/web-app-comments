import { Resource, SpaceResource, urlJoin } from '@opencloud-eu/web-client'
import { CommentDocument, CommentTarget } from '../types'

export function isSpaceResource(item: unknown): item is SpaceResource {
  return !!item && typeof item === 'object' && 'driveType' in item
}

export function resolveSidebarSpace(panelContext: Record<string, unknown> | undefined): SpaceResource | null {
  const root = unrefMaybe(panelContext?.root)
  if (isSpaceResource(root)) {
    return root
  }

  const parent = unrefMaybe(panelContext?.parent)
  if (isSpaceResource(parent)) {
    return parent
  }

  for (const key of ['space', 'currentSpace', 'activeSpace'] as const) {
    const candidate = unrefMaybe(panelContext?.[key])
    if (isSpaceResource(candidate)) {
      return candidate
    }
  }

  return null
}

function unrefMaybe<T>(value: T | (() => T) | { value: T } | undefined): T | undefined {
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value
  }
  if (typeof value === 'function') {
    return (value as () => T)()
  }
  return value as T | undefined
}

export const COMMENT_SIDECAR_SUFFIX = '.jsco'

export function isCommentSidecarPath(path: string): boolean {
  const name = path.split('/').filter(Boolean).pop() || path

  return name.endsWith(COMMENT_SIDECAR_SUFFIX)
}

export function isCommentSidecarResourceName(name: string | undefined): boolean {
  if (!name) {
    return false
  }

  return name.endsWith(COMMENT_SIDECAR_SUFFIX)
}

export function normalizeResourceNameForSidecar(name: string): string {
  let normalized = name.trim()

  if (normalized.endsWith(COMMENT_SIDECAR_SUFFIX)) {
    normalized = normalized.slice(0, -COMMENT_SIDECAR_SUFFIX.length)
  }

  while (normalized.startsWith('.')) {
    normalized = normalized.slice(1)
  }

  return normalized || 'resource'
}

export function resolveSourceResourceFromSidecar(
  resource: Pick<Resource, 'name' | 'path' | 'isFolder'>
): { name: string; path: string } {
  const resourcePath = resource.path || '/'
  const fileName = resource.name || getNameFromPath(resourcePath) || 'resource'

  if (!isCommentSidecarPath(resourcePath) && !isCommentSidecarResourceName(fileName)) {
    return { name: fileName, path: resourcePath }
  }

  const sidecarPath = isCommentSidecarPath(resourcePath)
    ? resourcePath
    : urlJoin(getCommentContainerPath(resource as Resource), fileName)
  const containerPath = getSidecarContainerPath(sidecarPath) || '/'
  const name = normalizeResourceNameForSidecar(fileName)

  return {
    name,
    path: containerPath === '/' ? `/${name}` : urlJoin(containerPath, name)
  }
}

export function createCommentTarget(space: SpaceResource, resource: Resource): CommentTarget {
  const resolved = resolveSourceResourceFromSidecar(resource)
  const path = resolved.path

  return {
    id: getStableResourceId(resource),
    name: resolved.name,
    path,
    containerPath: getCommentContainerPath({ ...resource, path, name: resolved.name }),
    isFolder: !!resource.isFolder,
    resource,
    space
  }
}

export function getStableResourceId(resource: Resource): string {
  return resource.fileId || resource.id || resource.path || resource.name
}

export function getCommentContainerPath(resource: Resource): string {
  if (resource.isFolder) {
    return resource.path || '/'
  }

  const path = resource.path || '/'
  const index = path.lastIndexOf('/')

  if (index <= 0) {
    return '/'
  }

  return path.slice(0, index)
}

export function getCommentSidecarFileName(target: Pick<CommentTarget, 'name' | 'path'>): string {
  const resourceName = normalizeResourceNameForSidecar(
    target.name || getNameFromPath(target.path) || 'resource'
  )

  return `.${resourceName}${COMMENT_SIDECAR_SUFFIX}`
}

export function getCommentDocumentPath(target: CommentTarget): string {
  return urlJoin(target.containerPath, getCommentSidecarFileName(target))
}

export function getCommentSidecarReadPaths(target: CommentTarget): string[] {
  return [getCommentDocumentPath(target)]
}

export function getSidecarContainerPath(sidecarPath: string): string | undefined {
  if (!sidecarPath.endsWith(COMMENT_SIDECAR_SUFFIX)) {
    return undefined
  }

  const index = sidecarPath.lastIndexOf('/')

  if (index < 0) {
    return undefined
  }

  return sidecarPath.slice(0, index) || '/'
}

export function syncCommentDocumentTarget(
  target: CommentTarget,
  document: CommentDocument
): CommentDocument {
  return {
    ...document,
    target: {
      id: target.id,
      name: target.name,
      path: target.path,
      isFolder: target.isFolder
    }
  }
}

function getNameFromPath(path: string): string | undefined {
  const segments = path.split('/').filter(Boolean)

  return segments[segments.length - 1]
}
