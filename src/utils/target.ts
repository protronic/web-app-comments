import { Resource, SpaceResource, urlJoin } from '@opencloud-eu/web-client'
import { CommentTarget } from '../types'

export const COMMENTS_FOLDER_NAME = '.conflu/comments'

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

export function getCommentDirectoryPath(target: CommentTarget): string {
  return urlJoin(target.containerPath, COMMENTS_FOLDER_NAME)
}

export function getCommentDocumentPath(target: CommentTarget): string {
  return urlJoin(getCommentDirectoryPath(target), `${toSafeFileName(target.id)}.json`)
}

export function toSafeFileName(value: string): string {
  const safeName = value.replace(/[^a-zA-Z0-9._-]/g, '_')
  return safeName || 'unknown'
}
