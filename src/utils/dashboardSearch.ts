import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'

type SearchResourceLike = Pick<Resource, 'name' | 'path' | 'fileId' | 'storageId'>

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

    const mountpoint = findMountpointForStorageId(spaces, storageId, resource)

    if (mountpoint) {
      return mountpoint
    }
  }

  if (resource.fileId) {
    return spaces.find((space) => resource.fileId?.startsWith(`${space.id}!`))
  }

  return undefined
}

export async function resolveSpaceForSearchResource(
  webdav: WebDAV,
  spaces: SpaceResource[],
  resource: Resource
): Promise<SpaceResource | undefined> {
  const storageId = resource.storageId || resource.fileId?.split('!')[0]
  const mountCandidates =
    typeof storageId === 'string' && storageId
      ? getMountpointCandidates(spaces, storageId)
      : []

  if (mountCandidates.length > 1 && resource.fileId) {
    for (const space of rankMountpointCandidates(mountCandidates, resource)) {
      try {
        await webdav.getFileInfo(space, { fileId: resource.fileId })

        return space
      } catch {
        continue
      }
    }
  }

  return findSpaceForSearchResource(spaces, resource)
}

export function findMountpointForStorageId(
  spaces: SpaceResource[],
  storageId: string,
  resource?: SearchResourceLike
): SpaceResource | undefined {
  const candidates = getMountpointCandidates(spaces, storageId)

  if (candidates.length === 0) {
    return undefined
  }

  if (candidates.length === 1) {
    return candidates[0]
  }

  return rankMountpointCandidates(candidates, resource)[0]
}

export function getMountpointCandidates(
  spaces: SpaceResource[],
  storageId: string
): SpaceResource[] {
  const normalizedStorageId = storageId.replace(/\$/g, ':')

  return spaces.filter(
    (space) => space.driveType === 'mountpoint' && space.id.includes(normalizedStorageId)
  )
}

export function rankMountpointCandidates(
  candidates: SpaceResource[],
  resource?: SearchResourceLike
): SpaceResource[] {
  return [...candidates].sort((left, right) => {
    const scoreDelta = scoreMountpointCandidate(right, resource) - scoreMountpointCandidate(left, resource)

    if (scoreDelta !== 0) {
      return scoreDelta
    }

    return (left.name || '').localeCompare(right.name || '')
  })
}

function scoreMountpointCandidate(space: SpaceResource, resource?: SearchResourceLike): number {
  let score = 0
  const name = space.name || ''

  if (isSidecarMount(name)) {
    score -= 1000
  }

  if (name.endsWith('.jsco')) {
    score -= 500
  }

  if (resource?.name) {
    if (name === resource.name) {
      score += 100
    } else if (looksLikeSingleFileMount(name) && name !== resource.name) {
      score -= 200
    }
  }

  if (resource?.path) {
    const segments = resource.path.split('/').filter(Boolean)

    if (segments.length > 1 && segments[0] === name) {
      score += 50
    }
  }

  if (!name.includes('.')) {
    score += 10
  }

  return score
}

function isSidecarMount(name: string): boolean {
  return name.startsWith('.') && (name.endsWith('.jsco') || name.endsWith('.conflu.json'))
}

function looksLikeSingleFileMount(name: string): boolean {
  return /\.(txt|md|pdf|docx?|xlsx?|jsco)$/i.test(name) && !name.startsWith('.')
}
