import {
  CollaboratorShare,
  LinkShare,
  ShareRole,
  ShareTypes,
  SpaceResource
} from '@opencloud-eu/web-client'
import { WebDAV } from '@opencloud-eu/web-client/webdav'
import { mock } from 'vitest-mock-extended'
import { createCommentTarget } from '../../src/utils/target'
import {
  getPermissionsDriveId,
  parseDriveIdFromFileId,
  SidecarPermissionsGraphClient,
  syncSidecarPermissions
} from '../../src/utils/sidecarPermissions'

describe('sidecar permissions', () => {
  const space = mock<SpaceResource>({
    id: 'owner$space'
  })

  it('parses drive ids from graph file ids', () => {
    expect(parseDriveIdFromFileId('owner$space!file-1')).toBe('owner$space')
    expect(getPermissionsDriveId(space, 'owner$space!file-1')).toBe('owner$space')
    expect(getPermissionsDriveId(space, 'invalid')).toBe('owner$space')
  })

  it('copies collaborator and link shares from the source file to the sidecar', async () => {
    const webdav = mock<WebDAV>()
    const permissions = {
      listPermissions: vi.fn(),
      listRoleDefinitions: vi.fn().mockResolvedValue([]),
      createInvite: vi.fn(),
      createLink: vi.fn(),
      updatePermission: vi.fn()
    }
    const graph = mock<SidecarPermissionsGraphClient>({ permissions })

    const target = createCommentTarget(
      space,
      mock({
        fileId: 'owner$space!source-file',
        name: 'Neue Datei.md',
        path: '/Neue Datei.md',
        isFolder: false
      })
    )

    const editorRole = mock<ShareRole>({ id: 'role-editor' })
    const sourceShare = mock<CollaboratorShare>({
      id: 'share-1',
      shareType: ShareTypes.user.value,
      role: editorRole,
      sharedWith: { id: 'user-dennis', displayName: 'Dennis Ritchie' }
    })
    const sourceLink = mock<LinkShare>({
      id: 'link-1',
      type: 'view',
      displayName: 'Read link',
      isQuickLink: false
    })

    permissions.listPermissions.mockImplementation(async (_driveId, itemId) => {
      if (itemId === 'owner$space!source-file') {
        return { shares: [sourceShare, sourceLink], allowedActions: [], allowedRoles: [] }
      }

      return { shares: [], allowedActions: [], allowedRoles: [] }
    })

    await syncSidecarPermissions(graph, webdav, space, target, {
      fileId: 'owner$space!sidecar-file',
      id: 'owner$space!sidecar-file',
      name: '.Neue Datei.md.jsco',
      path: '/.Neue Datei.md.jsco'
    })

    expect(permissions.createInvite).toHaveBeenCalledWith(
      'owner$space',
      'owner$space!sidecar-file',
      {
        recipients: [{ objectId: 'user-dennis', '@libre.graph.recipient.type': 'user' }],
        roles: ['role-editor'],
        expirationDateTime: expect.anything()
      },
      {}
    )
    expect(permissions.createLink).toHaveBeenCalledWith(
      'owner$space',
      'owner$space!sidecar-file',
      expect.objectContaining({
        type: 'view',
        displayName: 'Read link',
        '@libre.graph.quickLink': false
      })
    )
  })

  it('updates collaborator shares when the source role changed', async () => {
    const webdav = mock<WebDAV>()
    const permissions = {
      listPermissions: vi.fn(),
      listRoleDefinitions: vi.fn().mockResolvedValue([]),
      createInvite: vi.fn(),
      createLink: vi.fn(),
      updatePermission: vi.fn()
    }
    const graph = mock<SidecarPermissionsGraphClient>({ permissions })

    const target = createCommentTarget(
      space,
      mock({
        fileId: 'owner$space!source-file',
        name: 'Neue Datei.md',
        path: '/Neue Datei.md',
        isFolder: false
      })
    )

    const viewerRole = mock<ShareRole>({ id: 'role-viewer' })
    const editorRole = mock<ShareRole>({ id: 'role-editor' })
    const sourceShare = mock<CollaboratorShare>({
      id: 'share-1',
      shareType: ShareTypes.user.value,
      role: editorRole,
      sharedWith: { id: 'user-dennis', displayName: 'Dennis Ritchie' }
    })
    const sidecarShare = mock<CollaboratorShare>({
      id: 'share-sidecar',
      shareType: ShareTypes.user.value,
      role: viewerRole,
      sharedWith: { id: 'user-dennis', displayName: 'Dennis Ritchie' }
    })

    permissions.listPermissions.mockImplementation(async (_driveId, itemId) => {
      if (itemId === 'owner$space!source-file') {
        return { shares: [sourceShare], allowedActions: [], allowedRoles: [] }
      }

      return { shares: [sidecarShare], allowedActions: [], allowedRoles: [] }
    })

    await syncSidecarPermissions(graph, webdav, space, target, {
      fileId: 'owner$space!sidecar-file',
      id: 'owner$space!sidecar-file',
      name: '.Neue Datei.md.jsco',
      path: '/.Neue Datei.md.jsco'
    })

    expect(permissions.createInvite).not.toHaveBeenCalled()
    expect(permissions.updatePermission).toHaveBeenCalledWith(
      'owner$space',
      'owner$space!sidecar-file',
      'share-sidecar',
      expect.objectContaining({
        roles: ['role-editor']
      }),
      {}
    )
  })
})
