import {
  CollaboratorShare,
  LinkShare,
  Resource,
  ShareTypes,
  SpaceResource,
  isCollaboratorShare,
  isLinkShare,
  isShareRoot
} from '@opencloud-eu/web-client'
import {
  SidecarPermissionsGraphClient,
  getPermissionsDriveId
} from './sidecarPermissions'

export function isIndividuallySharedCommentTarget(
  space: SpaceResource,
  resource: Resource
): boolean {
  if (resource.isFolder || resource.name?.endsWith('.jsco')) {
    return false
  }

  if (space.driveType === 'mountpoint') {
    if (isShareRoot(resource)) {
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

export function shouldResolveIndividualShareViaGraph(
  space: SpaceResource,
  resource: Resource
): boolean {
  if (isIndividuallySharedCommentTarget(space, resource)) {
    return false
  }

  if (resource.isFolder || resource.name?.endsWith('.jsco')) {
    return false
  }

  if (space.driveType !== 'personal' && space.driveType !== 'project') {
    return false
  }

  if (resource.isMounted?.() || !resource.fileId) {
    return false
  }

  return true
}

export function hasDirectGraphFileShares(
  shares: Array<CollaboratorShare | LinkShare>
): boolean {
  return shares.some(
    (share) => !share.indirect && (isCollaboratorShare(share) || isLinkShare(share))
  )
}

export async function resolveIndividualShareViaGraph(
  graph: SidecarPermissionsGraphClient,
  space: SpaceResource,
  resource: Resource
): Promise<boolean> {
  const fileId = resource.fileId

  if (!fileId) {
    return false
  }

  const driveId = getPermissionsDriveId(space, fileId)

  try {
    const graphRoles = Object.fromEntries(
      (await graph.permissions.listRoleDefinitions()).map((role) => [role.id, role])
    )
    const { shares } = await graph.permissions.listPermissions(driveId, fileId, graphRoles)

    return hasDirectGraphFileShares(shares)
  } catch {
    return false
  }
}
