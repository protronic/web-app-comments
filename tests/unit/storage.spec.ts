import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { WebDAV } from '@opencloud-eu/web-client/webdav'
import { mock } from 'vitest-mock-extended'
import { COMMENT_TAG } from '../../src/constants/tags'
import { CommentTagsGraphClient } from '../../src/utils/commentTags'
import { SidecarPermissionsGraphClient } from '../../src/utils/sidecarPermissions'
import { WebdavSidecarCommentStorage } from '../../src/storage/WebdavSidecarCommentStorage'
import { WebdavSidecarDashboardStorage } from '../../src/storage/WebdavSidecarDashboardStorage'
import {
  createCommentTarget,
  getCommentDocumentPath,
  getLegacyCommentDirectoryPath,
  getLegacyCommentDocumentPath
} from '../../src/utils/target'

describe('webdav sidecar comments', () => {
  const space = mock<SpaceResource>()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-28T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores sidecars as sibling files next to the target resource', () => {
    const resource = mock<Resource>({
      fileId: 'file:1/2',
      name: 'README.md',
      path: '/handbook/README.md',
      isFolder: false
    })
    const target = createCommentTarget(space, resource)

    expect(getCommentDocumentPath(target)).toBe('/handbook/.README.md.jsco')
    expect(getLegacyCommentDirectoryPath(target)).toBe('/handbook/.conflu/comments')
    expect(getLegacyCommentDocumentPath(target)).toBe('/handbook/.conflu/comments/file_1_2.json')
  })

  it('assigns the commented tag when creating a thread', async () => {
    const webdav = mock<WebDAV>()
    const tags = mock<CommentTagsGraphClient>()
    const graph = mock<SidecarPermissionsGraphClient>()
    graph.permissions = {
      listPermissions: vi.fn().mockResolvedValue({ shares: [], allowedActions: [], allowedRoles: [] }),
      listRoleDefinitions: vi.fn().mockResolvedValue([]),
      createInvite: vi.fn(),
      createLink: vi.fn(),
      updatePermission: vi.fn()
    }
    const target = createCommentTarget(
      space,
      mock<Resource>({
        fileId: 'owner$space!file-1',
        name: 'README.md',
        path: '/README.md',
        isFolder: false
      })
    )
    const storage = new WebdavSidecarCommentStorage(webdav, { tags, ...graph })
    webdav.getFileContents.mockRejectedValue({ status: 404 })

    await storage.createThread(target, {
      body: 'Hello',
      format: 'markdown',
      author: { id: 'marie', displayName: 'Marie' }
    })

    expect(tags.assignTags).toHaveBeenCalledWith({
      resourceId: 'owner$space!file-1',
      tags: [COMMENT_TAG]
    })
  })

  it('syncs source file shares to the sidecar after saving', async () => {
    const webdav = mock<WebDAV>()
    const tags = mock<CommentTagsGraphClient>()
    const graph = mock<SidecarPermissionsGraphClient>()
    graph.permissions = {
      listPermissions: vi.fn().mockResolvedValue({ shares: [], allowedActions: [], allowedRoles: [] }),
      listRoleDefinitions: vi.fn().mockResolvedValue([]),
      createInvite: vi.fn(),
      createLink: vi.fn(),
      updatePermission: vi.fn()
    }

    const target = createCommentTarget(
      space,
      mock<Resource>({
        fileId: 'owner$space!source-file',
        name: 'README.md',
        path: '/README.md',
        isFolder: false
      })
    )
    const storage = new WebdavSidecarCommentStorage(webdav, { tags, ...graph })
    webdav.getFileContents.mockRejectedValue({ status: 404 })
    webdav.putFileContents.mockResolvedValue({
      fileId: 'owner$space!sidecar-file',
      id: 'owner$space!sidecar-file',
      name: '.README.md.jsco',
      path: '/.README.md.jsco'
    } as never)

    await storage.createThread(target, {
      body: 'Hello',
      format: 'markdown',
      author: { id: 'marie', displayName: 'Marie' }
    })

    expect(graph.permissions.listPermissions).toHaveBeenCalledWith(
      'owner$space',
      'owner$space!source-file',
      {}
    )
    expect(graph.permissions.listPermissions).toHaveBeenCalledWith(
      'owner$space',
      'owner$space!sidecar-file',
      {}
    )
  })

  it('creates a new thread when no sidecar file exists yet', async () => {
    const webdav = mock<WebDAV>()
    const target = createCommentTarget(
      space,
      mock<Resource>({
        fileId: 'file-1',
        name: 'README.md',
        path: '/README.md',
        isFolder: false
      })
    )
    const storage = new WebdavSidecarCommentStorage(webdav)
    webdav.getFileContents.mockRejectedValue({ status: 404 })

    const thread = await storage.createThread(target, {
      body: 'Hello **world**',
      format: 'markdown',
      author: { id: 'marie', displayName: 'Marie' }
    })

    expect(thread.comments[0].body).toBe('Hello **world**')
    expect(webdav.createFolder).not.toHaveBeenCalled()
    expect(webdav.putFileContents).toHaveBeenCalledWith(
      space,
      expect.objectContaining({
        path: '/.README.md.jsco'
      })
    )
  })

  it('reads legacy sidecars from .conflu/comments when the sibling file is missing', async () => {
    const webdav = mock<WebDAV>()
    const target = createCommentTarget(
      space,
      mock<Resource>({
        fileId: 'file-1',
        name: 'README.md',
        path: '/README.md',
        isFolder: false
      })
    )
    const storage = new WebdavSidecarCommentStorage(webdav)

    webdav.getFileContents.mockImplementation(async (_space, { path }) => {
      if (path === '/.README.md.jsco' || path === '/.README.md.conflu.json') {
        throw { status: 404 }
      }

      if (path === '/.conflu/comments/file-1.json') {
        return {
          body: JSON.stringify({
            version: 1,
            target: { id: target.id, name: target.name, path: target.path, isFolder: false },
            threads: [
              {
                id: 'thread-1',
                targetId: target.id,
                status: 'open',
                createdAt: '2026-06-28T11:00:00.000Z',
                updatedAt: '2026-06-28T11:00:00.000Z',
                comments: [
                  {
                    id: 'comment-1',
                    body: 'Legacy sidecar',
                    format: 'markdown',
                    author: { id: 'marie', displayName: 'Marie' },
                    createdAt: '2026-06-28T11:00:00.000Z'
                  }
                ]
              }
            ]
          })
        } as never
      }

      throw new Error(`unexpected path ${path}`)
    })

    const threads = await storage.list(target)

    expect(threads).toHaveLength(1)
    expect(threads[0]?.comments[0]?.body).toBe('Legacy sidecar')
    expect(webdav.putFileContents).not.toHaveBeenCalled()
  })

  it('marks comments as deleted instead of dropping thread history', async () => {
    const webdav = mock<WebDAV>()
    const target = createCommentTarget(
      space,
      mock<Resource>({
        fileId: 'file-1',
        name: 'README.md',
        path: '/README.md',
        isFolder: false
      })
    )
    const storage = new WebdavSidecarCommentStorage(webdav)

    webdav.getFileContents.mockResolvedValue({
      body: JSON.stringify({
        version: 1,
        target: { id: target.id, name: target.name, path: target.path, isFolder: false },
        threads: [
          {
            id: 'thread-1',
            targetId: target.id,
            status: 'open',
            createdAt: '2026-06-28T11:00:00.000Z',
            updatedAt: '2026-06-28T11:00:00.000Z',
            comments: [
              {
                id: 'comment-1',
                body: 'Draft',
                format: 'markdown',
                author: { id: 'marie', displayName: 'Marie' },
                createdAt: '2026-06-28T11:00:00.000Z'
              }
            ]
          }
        ]
      })
    } as never)

    const thread = await storage.deleteComment(target, 'thread-1', 'comment-1', {
      id: 'marie',
      displayName: 'Marie'
    })

    expect(thread.comments[0].body).toBe('')
    expect(thread.comments[0].deletedAt).toBe('2026-06-28T12:00:00.000Z')
  })

  it('writes the current target name and path into the sidecar on save', async () => {
    const webdav = mock<WebDAV>()
    const target = createCommentTarget(
      space,
      mock<Resource>({
        fileId: 'file-1',
        name: 'Renamed.txt',
        path: '/docs/Renamed.txt',
        isFolder: false
      })
    )
    const storage = new WebdavSidecarCommentStorage(webdav)

    webdav.getFileContents.mockResolvedValue({
      body: JSON.stringify({
        version: 1,
        target: {
          id: target.id,
          name: 'Old.txt',
          path: '/docs/Old.txt',
          isFolder: false
        },
        threads: []
      })
    } as never)

    await storage.createThread(target, {
      body: 'Updated sidecar metadata',
      format: 'markdown',
      author: { id: 'marie', displayName: 'Marie' }
    })

    expect(webdav.putFileContents).toHaveBeenCalledWith(
      space,
      expect.objectContaining({
        content: expect.stringContaining('"name": "Renamed.txt"')
      })
    )
    expect(webdav.putFileContents).toHaveBeenCalledWith(
      space,
      expect.objectContaining({
        content: expect.stringContaining('"path": "/docs/Renamed.txt"')
      })
    )
  })
})
