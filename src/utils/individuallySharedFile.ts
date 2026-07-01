import { Resource, ShareTypes, SpaceResource } from '@opencloud-eu/web-client'

export function isIndividuallySharedCommentTarget(
  space: SpaceResource,
  resource: Resource
): boolean {
  if (resource.isFolder || resource.name?.endsWith('.jsco')) {
    return false
  }

  if (space.driveType === 'mountpoint') {
    if (resource.isShareRoot?.()) {
      return true
    }

    const pathSegments = (resource.path || '/').split('/').filter(Boolean)

    return pathSegments.length === 1 && space.name === resource.name
  }

  if (space.driveType === 'personal' || space.driveType === 'project') {
    const shareTypes = resource.shareTypes ?? []

    if (shareTypes.length === 0 || resource.isMounted?.()) {
      return false
    }

    return ShareTypes.containsAnyValue(ShareTypes.all, shareTypes)
  }

  return false
}
