import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { createLocationSpaces } from '@opencloud-eu/web-pkg'
import type { RouteLocationNamedRaw, Router } from 'vue-router'
import { DashboardTargetSummary, DashboardThreadEntry } from '../types'
import { commentMessages as msg } from '../i18n/messages'
import { isGraphResourceId } from './commentTags'
import { buildDashboardResource } from './dashboardResource'
import { relativizeMountpointPath } from './mountpointPaths'

export interface DashboardFileActions {
  getDefaultAction: (options: {
    space: SpaceResource
    resources: Resource[]
    omitSystemActions?: boolean
  }) => unknown
  triggerDefaultAction: (options: {
    space: SpaceResource
    resources: Resource[]
    omitSystemActions?: boolean
  }) => void
}

export function openDashboardTarget(
  space: SpaceResource,
  entry: Pick<DashboardThreadEntry, 'space' | 'target'>,
  router: Router,
  fileActions?: DashboardFileActions
): void {
  if (entry.target.resourceType === 'file' && fileActions) {
    const resource = buildDashboardResource(space, entry.target)
    const action = fileActions.getDefaultAction({
      space,
      resources: [resource],
      omitSystemActions: true
    })

    if (action) {
      fileActions.triggerDefaultAction({
        space,
        resources: [resource],
        omitSystemActions: true
      })
      return
    }
  }

  void router.push(buildOpenTargetLocation(space, entry))
}

export function getOpenTargetLabel(
  translate: (message: string) => string,
  target: DashboardTargetSummary
): string {
  switch (target.resourceType) {
    case 'space':
      return translate(msg.openSpace)
    case 'folder':
      return translate(msg.openFolder)
    default:
      return translate(msg.openFile)
  }
}

export function buildOpenTargetLocation(
  space: SpaceResource,
  entry: Pick<DashboardThreadEntry, 'space' | 'target'>
): RouteLocationNamedRaw {
  const privateLinkLocation = buildPrivateLinkLocation(entry.target.privateLink)

  if (privateLinkLocation) {
    return privateLinkLocation
  }

  const routeName =
    entry.space.driveType === 'project' ? 'files-spaces-projects' : 'files-spaces-generic'
  const path = getOpenTargetPath(space, entry.target)

  const location: RouteLocationNamedRaw = {
    params: {
      driveAliasAndItem: space.getDriveAliasAndItem({ path })
    }
  }

  const fileId = getOpenTargetFileId(entry.target)

  if (fileId) {
    location.query = { fileId }
  }

  return createLocationSpaces(routeName, location)
}

export function buildPrivateLinkLocation(privateLink?: string): RouteLocationNamedRaw | undefined {
  const fileId = extractPrivateLinkFileId(privateLink)

  if (!fileId) {
    return undefined
  }

  return {
    name: 'resolvePrivateLink',
    params: { fileId }
  }
}

export function extractPrivateLinkFileId(privateLink?: string): string | undefined {
  if (!privateLink) {
    return undefined
  }

  try {
    const url = new URL(privateLink, 'https://opencloud.local')
    const match = url.pathname.match(/^\/f\/(.+)$/)

    if (!match?.[1]) {
      return undefined
    }

    return decodeURIComponent(match[1])
  } catch {
    return undefined
  }
}

export function getOpenTargetPath(space: SpaceResource, target: DashboardTargetSummary): string {
  if (target.resourceType === 'space') {
    return ''
  }

  const path = relativizeMountpointPath(space, target.path)

  if (path === '/') {
    return ''
  }

  return path
}

export function getOpenTargetFileId(target: DashboardTargetSummary): string | undefined {
  if (target.resourceType === 'space') {
    return undefined
  }

  const candidate = target.fileId || target.id

  return isGraphResourceId(candidate) ? candidate : undefined
}
