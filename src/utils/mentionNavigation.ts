import { Resource, SpaceResource, urlJoin } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import { CommentDocument, DashboardTargetSummary } from '../types'
import { enrichDashboardTarget, toDashboardSpaceSummary } from './dashboard'
import { enrichTargetLinkFromGraph, GraphDriveItemClient } from './graphTargetLinks'
import { pickSpaceForResource } from './commentNotificationSpaces'
import { resolveCommentDocumentTarget } from './resolveTarget'
import { relativizeMountpointPath } from './mountpointPaths'
import {
  COMMENT_SIDECAR_SUFFIX,
  getSidecarContainerPath,
  LEGACY_COMMENT_SIDECAR_SUFFIX,
  normalizeResourceNameForSidecar,
  resolveSourceResourceFromSidecar
} from './target'

export interface MentionNavigationContext {
  space: SpaceResource
  target: DashboardTargetSummary
}

export function documentTargetToSummary(
  target: CommentDocument['target']
): DashboardTargetSummary {
  return {
    id: target.id,
    name: target.name,
    path: target.path,
    isFolder: target.isFolder,
    resourceType: target.isFolder ? 'folder' : 'file',
    tags: []
  }
}

export function resourceToDashboardTarget(
  resource: Resource,
  space?: SpaceResource
): DashboardTargetSummary {
  const resolved = resolveSourceResourceFromSidecar(resource)
  const path = space ? relativizeMountpointPath(space, resolved.path) : resolved.path

  return {
    id: resource.fileId || resource.id || resource.path || resource.name,
    fileId: resource.fileId || resource.id,
    name: resolved.name,
    path,
    isFolder: !!resource.isFolder,
    resourceType: resource.isFolder ? 'folder' : 'file',
    mimeType: resource.mimeType,
    extension: resource.extension,
    tags: resource.tags ?? []
  }
}

export function getSourcePathFromSidecarPath(sidecarPath: string): string | undefined {
  for (const suffix of [COMMENT_SIDECAR_SUFFIX, LEGACY_COMMENT_SIDECAR_SUFFIX]) {
    if (!sidecarPath.endsWith(suffix)) {
      continue
    }

    const fileName = sidecarPath.split('/').filter(Boolean).pop()

    if (!fileName?.startsWith('.')) {
      return undefined
    }

    const resourceName = normalizeResourceNameForSidecar(fileName)
    const containerPath = getSidecarContainerPath(sidecarPath) || '/'

    return urlJoin(containerPath, resourceName)
  }

  return undefined
}

export async function resolveMentionNavigation(
  webdav: WebDAV,
  graph: GraphDriveItemClient | undefined,
  spaces: SpaceResource[],
  space: SpaceResource,
  document: CommentDocument,
  options: {
    sourceResource?: Resource
    sidecarPath?: string
  } = {}
): Promise<MentionNavigationContext> {
  let activeSpace = space
  let target: DashboardTargetSummary

  if (options.sourceResource && !options.sourceResource.name?.endsWith(COMMENT_SIDECAR_SUFFIX)) {
    activeSpace =
      pickSpaceForResource(spaces, options.sourceResource, space.id) || activeSpace
    target = resourceToDashboardTarget(options.sourceResource, activeSpace)
  } else {
    target = await resolveCommentDocumentTarget(
      webdav,
      activeSpace,
      document,
      options.sidecarPath
    )
  }

  target = enrichDashboardTarget(activeSpace, target)
  target = await enrichTargetLinkFromGraph(graph, activeSpace, target)

  return { space: activeSpace, target }
}

export function toMentionNavigationEntry(context: MentionNavigationContext) {
  return {
    space: toDashboardSpaceSummary(context.space),
    target: context.target
  }
}
