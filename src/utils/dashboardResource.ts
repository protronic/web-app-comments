import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { DashboardTargetSummary } from '../types'

export function buildDashboardResource(
  space: SpaceResource,
  target: DashboardTargetSummary
): Resource {
  const fileId = target.fileId || target.id
  const extension = target.extension || getExtensionFromTarget(target)

  return {
    id: fileId,
    fileId,
    storageId: space.id,
    path: target.path,
    name: target.name,
    extension: extension || '',
    mimeType: target.mimeType || '',
    isFolder: target.isFolder,
    type: target.isFolder ? 'folder' : 'file',
    canDownload: () => true
  } as Resource
}

export function getExtensionFromTarget(
  target: Pick<DashboardTargetSummary, 'name' | 'path' | 'extension'>
): string | undefined {
  if (target.extension) {
    return target.extension.toLowerCase()
  }

  const name = target.name || target.path

  if (!name) {
    return undefined
  }

  const match = name.match(/\.([^.\\/]+)$/)

  return match?.[1]?.toLowerCase()
}
