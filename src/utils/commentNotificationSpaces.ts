import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import type { Graph } from '@opencloud-eu/web-client/graph'
import { useSpacesStore } from '@opencloud-eu/web-pkg'
import { findSpaceForSearchResource, findMountpointForStorageId } from './dashboardSearch'
import { loadDashboardSpaces } from './dashboardSpaces'

export async function resolveResourceFromSseItem(
  webdav: WebDAV,
  graph: Graph,
  spaces: SpaceResource[],
  itemId: string,
  spaceId?: string
): Promise<{ space: SpaceResource; resource: Resource } | null> {
  const candidates = buildSpaceCandidates(spaces, spaceId)

  for (const space of candidates) {
    try {
      const resource = await webdav.getFileInfo(space, { fileId: itemId })

      return { space, resource }
    } catch {
      continue
    }
  }

  return null
}

export async function loadNotificationSpaces(
  spacesStore: ReturnType<typeof useSpacesStore>,
  graph: Graph
): Promise<SpaceResource[]> {
  return loadDashboardSpaces(spacesStore, graph)
}

function buildSpaceCandidates(spaces: SpaceResource[], spaceId?: string): SpaceResource[] {
  const ordered: SpaceResource[] = []
  const seen = new Set<string>()

  const add = (space: SpaceResource | undefined) => {
    if (!space || seen.has(space.id)) {
      return
    }

    seen.add(space.id)
    ordered.push(space)
  }

  if (spaceId) {
    add(spaces.find((space) => space.id === spaceId))
    add(findMountpointForStorageId(spaces, spaceId))
  }

  for (const space of spaces) {
    add(space)
  }

  return ordered
}

export function pickSpaceForResource(
  spaces: SpaceResource[],
  resource: Resource,
  spaceId?: string
): SpaceResource | undefined {
  if (spaceId) {
    const direct = spaces.find((space) => space.id === spaceId)

    if (direct) {
      return direct
    }

    const mountpoint = findMountpointForStorageId(spaces, spaceId)

    if (mountpoint) {
      return mountpoint
    }
  }

  return findSpaceForSearchResource(spaces, resource)
}
