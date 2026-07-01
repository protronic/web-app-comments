import { Resource, SpaceResource } from '@opencloud-eu/web-client'

export function findSpaceForSearchResource(
  spaces: SpaceResource[],
  resource: Resource
): SpaceResource | undefined {
  const storageId = resource.storageId || resource.fileId?.split('!')[0]

  if (storageId) {
    const match = spaces.find((space) => space.id === storageId)

    if (match) {
      return match
    }
  }

  if (resource.fileId) {
    return spaces.find((space) => resource.fileId?.startsWith(`${space.id}!`))
  }

  return undefined
}
