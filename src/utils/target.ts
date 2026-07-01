import { Resource, SpaceResource } from '@opencloud-eu/web-client'
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

export function createCommentTarget(space: SpaceResource, resource: Resource): CommentTarget {
  const path = resource.path || '/'

  return {
    id: getStableResourceId(resource),
    name: resource.name || path,
    path,
    containerPath: getCommentContainerPath(resource),
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
