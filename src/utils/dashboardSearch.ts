import { Resource, SpaceResource } from '@opencloud-eu/web-client'

export function findSpaceForSearchResource(
  spaces: SpaceResource[],
  resource: Resource
): SpaceResource | undefined {
  const storageId = resource.storageId || resource.fileId?.split('!')[0]

  if (typeof storageId === 'string' && storageId) {
    const match = spaces.find((space) => space.id === storageId)

    if (match) {
      return match
    }

    const mountpoint = findMountpointForStorageId(spaces, storageId)

    if (mountpoint) {
      return mountpoint
    }
  }

  if (resource.fileId) {
    return spaces.find((space) => resource.fileId?.startsWith(`${space.id}!`))
  }

  return undefined
}

function findMountpointForStorageId(
  spaces: SpaceResource[],
  storageId: string
): SpaceResource | undefined {
  const normalizedStorageId = storageId.replace(/\$/g, ':')

  return spaces.find(
    (space) => space.driveType === 'mountpoint' && space.id.includes(normalizedStorageId)
  )
}
