import {
  CollaboratorShare,
  LinkShare,
  Resource,
  ShareRole,
  ShareTypes,
  SpaceResource,
  isCollaboratorShare,
  isLinkShare
} from '@opencloud-eu/web-client'
import type { GraphPermissions } from '@opencloud-eu/web-client/graph'
import { CommentTarget } from '../types'
import { isGraphResourceId, resolveGraphResourceId } from './commentTags'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'

export interface SidecarPermissionsGraphClient {
  permissions: Pick<
    GraphPermissions,
    | 'listPermissions'
    | 'listRoleDefinitions'
    | 'createInvite'
    | 'createLink'
    | 'updatePermission'
  >
}

export function parseDriveIdFromFileId(fileId: string): string | undefined {
  const separatorIndex = fileId.lastIndexOf('!')

  if (separatorIndex <= 0) {
    return undefined
  }

  return fileId.slice(0, separatorIndex)
}

export function getPermissionsDriveId(space: SpaceResource, fileId: string): string {
  return parseDriveIdFromFileId(fileId) || space.id
}

function collaboratorShareKey(share: CollaboratorShare): string {
  return `${share.shareType}:${share.sharedWith?.id || ''}`
}

function linkShareKey(share: LinkShare): string {
  return `${share.type}:${share.displayName || ''}:${share.isQuickLink ? 'quick' : 'regular'}`
}

function recipientTypeForShare(share: CollaboratorShare): string | undefined {
  if (ShareTypes.isCollective(ShareTypes.getByValue(share.shareType))) {
    return 'group'
  }

  if (ShareTypes.isIndividual(ShareTypes.getByValue(share.shareType))) {
    return 'user'
  }

  return undefined
}

export async function syncSidecarPermissions(
  graph: SidecarPermissionsGraphClient | undefined,
  webdav: WebDAV,
  space: SpaceResource,
  target: CommentTarget,
  sidecarResource: Resource
): Promise<void> {
  if (!graph?.permissions) {
    return
  }

  const sourceFileId = await resolveGraphResourceId(webdav, target)
  const sidecarFileId = sidecarResource.fileId || sidecarResource.id

  if (!isGraphResourceId(sourceFileId) || !isGraphResourceId(sidecarFileId)) {
    return
  }

  const driveId = getPermissionsDriveId(space, sourceFileId)
  const { permissions } = graph

  try {
    const graphRoles = Object.fromEntries(
      (await permissions.listRoleDefinitions()).map((role) => [role.id, role])
    )
    const [sourcePermissions, sidecarPermissions] = await Promise.all([
      permissions.listPermissions(driveId, sourceFileId, graphRoles),
      permissions.listPermissions(driveId, sidecarFileId, graphRoles)
    ])

    await syncCollaboratorShares(
      permissions,
      driveId,
      sidecarFileId,
      graphRoles,
      sourcePermissions.shares,
      sidecarPermissions.shares
    )
    await syncLinkShares(
      permissions,
      driveId,
      sidecarFileId,
      sourcePermissions.shares,
      sidecarPermissions.shares
    )
  } catch {
    // Permission sync is best-effort and must not block comment storage.
  }
}

async function syncCollaboratorShares(
  permissions: SidecarPermissionsGraphClient['permissions'],
  driveId: string,
  sidecarFileId: string,
  graphRoles: Record<string, ShareRole>,
  sourceShares: Array<CollaboratorShare | LinkShare>,
  sidecarShares: Array<CollaboratorShare | LinkShare>
): Promise<void> {
  const sourceCollaborators = sourceShares.filter(isCollaboratorShare).filter((share) => share.sharedWith?.id)
  const sidecarByRecipient = new Map(
    sidecarShares
      .filter(isCollaboratorShare)
      .map((share) => [collaboratorShareKey(share), share] as const)
  )

  for (const share of sourceCollaborators) {
    const recipientId = share.sharedWith.id
    const existing = sidecarByRecipient.get(collaboratorShareKey(share))

    if (!existing) {
      await permissions.createInvite(
        driveId,
        sidecarFileId,
        {
          recipients: [
            {
              objectId: recipientId,
              '@libre.graph.recipient.type': recipientTypeForShare(share)
            }
          ],
          roles: share.role?.id ? [share.role.id] : undefined,
          expirationDateTime: share.expirationDateTime
        },
        graphRoles
      )
      continue
    }

    const roleChanged = share.role?.id && existing.role?.id !== share.role.id
    const expirationChanged = share.expirationDateTime !== existing.expirationDateTime

    if (roleChanged || expirationChanged) {
      await permissions.updatePermission(
        driveId,
        sidecarFileId,
        existing.id,
        {
          roles: share.role?.id ? [share.role.id] : undefined,
          expirationDateTime: share.expirationDateTime
        },
        graphRoles
      )
    }
  }
}

async function syncLinkShares(
  permissions: SidecarPermissionsGraphClient['permissions'],
  driveId: string,
  sidecarFileId: string,
  sourceShares: Array<CollaboratorShare | LinkShare>,
  sidecarShares: Array<CollaboratorShare | LinkShare>
): Promise<void> {
  const sourceLinks = sourceShares.filter(isLinkShare)
  const sidecarByKey = new Map(
    sidecarShares.filter(isLinkShare).map((share) => [linkShareKey(share), share] as const)
  )

  for (const share of sourceLinks) {
    if (sidecarByKey.has(linkShareKey(share))) {
      continue
    }

    await permissions.createLink(driveId, sidecarFileId, {
      type: share.type,
      expirationDateTime: share.expirationDateTime,
      displayName: share.displayName,
      '@libre.graph.quickLink': share.isQuickLink
    })
  }
}
