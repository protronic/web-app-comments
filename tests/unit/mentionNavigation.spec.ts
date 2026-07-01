import { beforeEach, vi } from 'vitest'
import { SpaceResource } from '@opencloud-eu/web-client'
import { WebDAV } from '@opencloud-eu/web-client/webdav'
import { mock } from 'vitest-mock-extended'
import { getSourcePathFromSidecarPath, resolveMentionNavigation } from '../../src/utils/mentionNavigation'
import { openDashboardTarget } from '../../src/utils/dashboardNavigation'
import {
  buildCommentDashboardLocation,
  presentMentionNotifications
} from '../../src/utils/mentionNotificationPresenter'
import { CommentDocument } from '../../src/types'

describe('mention navigation helpers', () => {
  it('derives the source file path from a sidecar path', () => {
    expect(getSourcePathFromSidecarPath('/Share/.Neue Datei.txt.jsco')).toBe('/Share/Neue Datei.txt')
    expect(getSourcePathFromSidecarPath('/.Neue Datei.txt.jsco')).toBe('/Neue Datei.txt')
  })

  it('resolves space-root sidecars as spaces like the dashboard', async () => {
    const webdav = mock<WebDAV>()
    const space = mock<SpaceResource>({
      id: 'space-root$id',
      name: 'New space',
      driveType: 'project',
      driveAlias: 'project/new-space'
    })
    const document: CommentDocument = {
      version: 1,
      target: {
        id: 'space-root$id',
        name: 'New space',
        path: '/',
        isFolder: true
      },
      threads: []
    }

    await expect(
      resolveMentionNavigation(webdav, undefined, [space], space, document, {
        sidecarPath: '/.New space.jsco'
      })
    ).resolves.toEqual({
      space,
      target: {
        id: 'space-root$id',
        name: 'New space',
        path: '/',
        isFolder: true,
        resourceType: 'space',
        fileId: 'space-root$id',
        tags: []
      }
    })

    expect(webdav.getFileInfo).not.toHaveBeenCalled()
  })
})

describe('mention notification presenter', () => {
  const document: CommentDocument = {
    version: 1,
    target: {
      id: 'owner$space!file-1',
      name: 'Neue Datei.txt',
      path: '/Share/Neue Datei.txt',
      isFolder: false
    },
    threads: [
      {
        id: 'thread-1',
        targetId: 'owner$space!file-1',
        status: 'open',
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-01T10:00:00.000Z',
        comments: [
          {
            id: 'comment-1',
            body: 'Please review @[Dennis Ritchie](user:dennis)',
            format: 'markdown',
            author: { id: 'admin', displayName: 'Admin' },
            createdAt: '2026-07-01T10:00:00.000Z'
          }
        ]
      }
    ]
  }

  beforeEach(() => {
    sessionStorage.clear()
  })

  it('opens shared files via private link when dashboard navigation is provided', () => {
    const push = vi.fn()
    const showMessage = vi.fn()
    const space = mock<SpaceResource>({
      id: 'mount',
      driveType: 'mountpoint',
      name: 'Share',
      driveAlias: 'mount/Share',
      getDriveAliasAndItem: ({ path }) => `mount/Share${path ? `/${path.replace(/^\//, '')}` : ''}`
    })

    presentMentionNotifications(
      {
        showMessage,
        translate: (message) => message,
        router: { push } as never,
        openTarget: (space, entry) => openDashboardTarget(space, entry, { push } as never)
      },
      space,
      document,
      ['dennis'],
      'poll',
      {
        space: {
          id: 'mount',
          name: 'Share',
          driveAlias: 'mount/Share',
          driveType: 'mountpoint'
        },
        target: {
          id: 'owner$space!file-1',
          fileId: 'owner$space!file-1',
          privateLink: 'https://test.oc:9200/f/owner%24space%21file-1',
          name: 'Neue Datei.txt',
          path: '/Neue Datei.txt',
          isFolder: false,
          resourceType: 'file',
          tags: []
        }
      }
    )

    expect(showMessage).toHaveBeenCalledTimes(1)
    const actions = showMessage.mock.calls[0]?.[0]?.actions ?? []
    expect(actions.map((action: { name: string }) => action.name)).toEqual([
      'open-comment-dashboard',
      'open-mentioned-resource'
    ])
    actions[0]?.handler()
    expect(push).toHaveBeenCalledWith(buildCommentDashboardLocation())
    actions[1]?.handler()
    expect(push).toHaveBeenLastCalledWith({
      name: 'resolvePrivateLink',
      params: { fileId: 'owner$space!file-1' }
    })
  })
})
