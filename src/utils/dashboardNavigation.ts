import { SpaceResource } from '@opencloud-eu/web-client'
import { createLocationSpaces } from '@opencloud-eu/web-pkg'
import type { RouteLocationNamedRaw } from 'vue-router'
import { DashboardTargetSummary, DashboardThreadEntry } from '../types'

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
  const path = getOpenTargetPath(entry.target)

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

export function getOpenTargetPath(target: DashboardTargetSummary): string {
  if (target.resourceType === 'space' || target.path === '/') {
    return ''
  }

  return target.path
}

export function getOpenTargetFileId(target: DashboardTargetSummary): string | undefined {
  if (target.resourceType === 'file') {
    return target.fileId || target.id || undefined
  }

  return undefined
}
