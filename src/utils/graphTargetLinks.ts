import { SpaceResource } from '@opencloud-eu/web-client'
import { DashboardTargetSummary } from '../types'
import { isGraphResourceId } from './commentTags'

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
