import { SpaceResource } from '@opencloud-eu/web-client'
import { createLocationSpaces } from '@opencloud-eu/web-pkg'
import type { RouteLocationNamedRaw } from 'vue-router'
import { DashboardTargetSummary, DashboardThreadEntry } from '../types'

export function buildOpenTargetLocation(
  space: SpaceResource,
  entry: Pick<DashboardThreadEntry, 'space' | 'target'>
): RouteLocationNamedRaw {
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

export function getOpenTargetPath(target: DashboardTargetSummary): string {
  if (target.resourceType === 'space' || target.path === '/') {
    return ''
  }

  return target.path
}

export function getOpenTargetFileId(target: DashboardTargetSummary): string | undefined {
  if (target.resourceType !== 'file' || !target.id) {
    return undefined
  }

  return target.id
}
