import { SpaceResource } from '@opencloud-eu/web-client'
import { DashboardTargetSummary } from '../types'
import { isGraphResourceId } from './commentTags'
import { deriveSpaceRootFileId } from './spaceRootFileId'

export interface GraphDriveItemClient {
  getDriveItem(
    driveId: string,
    itemId: string,
    requestOptions?: unknown
  ): Promise<{ id?: string; webUrl?: string }>
}

export async function enrichTargetLinkFromGraph(
  graph: GraphDriveItemClient | undefined,
  space: SpaceResource,
  target: DashboardTargetSummary
): Promise<DashboardTargetSummary> {
  if (target.resourceType === 'space') {
    const fileId = deriveSpaceRootFileId(space, target)

    if (!fileId) {
      return target
    }

    const enriched = {
      ...target,
      fileId
    }

    if (target.privateLink || !graph) {
      return enriched
    }

    try {
      const itemId = fileId.includes('!') ? fileId.split('!').pop()! : fileId
      const driveItem = await graph.getDriveItem(space.id, itemId)

      return {
        ...enriched,
        fileId: driveItem.id || fileId,
        privateLink: driveItem.webUrl || target.privateLink
      }
    } catch {
      return enriched
    }
  }

  if (target.privateLink || !graph || !isGraphResourceId(target.id)) {
    return target
  }

  try {
    const driveItem = await graph.getDriveItem(space.id, target.id)

    return {
      ...target,
      fileId: driveItem.id || target.fileId || target.id,
      privateLink: driveItem.webUrl || target.privateLink
    }
  } catch {
    return target
  }
}
