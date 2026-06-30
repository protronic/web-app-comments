import { SpaceResource } from '@opencloud-eu/web-client'
import { Graph } from '@opencloud-eu/web-client/graph'
import { useSpacesStore } from '@opencloud-eu/web-pkg'
import { unref } from 'vue'

const DASHBOARD_DRIVE_TYPES = new Set(['personal', 'project'])

export async function loadDashboardSpaces(
  spacesStore: ReturnType<typeof useSpacesStore>,
  graphClient: Graph
): Promise<SpaceResource[]> {
  if (!unref(spacesStore.spaces).length) {
    await spacesStore.loadSpaces({ graphClient })
  }

  const merged = new Map<string, SpaceResource>()

  try {
    const drives = await graphClient.drives.listMyDrives({}, {})

    for (const space of drives) {
      if (isDashboardSpace(space)) {
        merged.set(space.id, space)
      }
    }
  } catch {
    // Fall back to the spaces store below.
  }

  for (const space of unref(spacesStore.spaces)) {
    if (isDashboardSpace(space)) {
      merged.set(space.id, space)
    }
  }

  return [...merged.values()]
}

function isDashboardSpace(space: SpaceResource): boolean {
  if (!DASHBOARD_DRIVE_TYPES.has(space.driveType)) {
    return false
  }

  if (space.disabled || space.root?.deleted?.state === 'trashed') {
    return false
  }

  return true
}
