import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { WebDAV } from '@opencloud-eu/web-client/webdav'
import { mock } from 'vitest-mock-extended'
import { COMMENT_TAG } from '../../src/constants/tags'
import { COMMENT_PROPERTY_NAME } from '../../src/utils/commentProperty'
import { CommentTagsGraphClient } from '../../src/utils/commentTags'
import { WebdavPropertyCommentStorage } from '../../src/storage/WebdavPropertyCommentStorage'
import { createCommentTarget } from '../../src/utils/target'

describe('webdav property comments', () => {
  const space = mock<SpaceResource>({
    webDavPath: '/spaces/owner$space'
  })

  const http = {
    request: vi.fn().mockResolvedValue({ status: 207 })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-28T12:00:00.000Z'))
    http.request.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('assigns the commented tag when creating a thread', async () => {
    const webdav = mock<WebDAV>()
    const graph = mock<CommentTagsGraphClient>()
    const target = createCommentTarget(
      space,
      mock<Resource>({
        fileId: 'owner$space!file-1',
        name: 'README.md',
        path: '/README.md',
        isFolder: false
      })
    )
    const storage = new WebdavPropertyCommentStorage(webdav, http, graph)
    webdav.getFileInfo.mockRejectedValue({ status: 404 })

    await storage.createThread(target, {
      body: 'Hello',
      format: 'markdown',
      author: { id: 'marie', displayName: 'Marie' }
    })

    expect(graph.assignTags).toHaveBeenCalledWith({
      resourceId: 'owner$space!file-1',
      tags: [COMMENT_TAG]
    })
  })

  it('creates a new thread when no comment property exists yet', async () => {
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
    const storage = new WebdavPropertyCommentStorage(webdav, http)
    webdav.getFileInfo.mockRejectedValue({ status: 404 })

    const thread = await storage.createThread(target, {
      body: 'Hello **world**',
      format: 'markdown',
      author: { id: 'marie', displayName: 'Marie' }
    })

    expect(thread.comments[0].body).toBe('Hello **world**')
    expect(webdav.registerExtraProp).toHaveBeenCalledWith(COMMENT_PROPERTY_NAME)
    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PROPPATCH',
        url: '/remote.php/dav/spaces/owner$space/README.md'
      })
    )
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
    const storage = new WebdavPropertyCommentStorage(webdav, http)

    webdav.getFileInfo.mockResolvedValue(
      mock<Resource>({
        extraProps: {
          [COMMENT_PROPERTY_NAME]: JSON.stringify({
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
        }
      })
    )

    const thread = await storage.deleteComment(target, 'thread-1', 'comment-1', {
      id: 'marie',
      displayName: 'Marie'
    })

    expect(thread.comments[0].body).toBe('')
    expect(thread.comments[0].deletedAt).toBe('2026-06-28T12:00:00.000Z')
  })

  it('writes the current target name and path into the document on save', async () => {
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
    const storage = new WebdavPropertyCommentStorage(webdav, http)

    webdav.getFileInfo.mockResolvedValue(
      mock<Resource>({
        extraProps: {
          [COMMENT_PROPERTY_NAME]: JSON.stringify({
            version: 1,
            target: {
              id: target.id,
              name: 'Old.txt',
              path: '/docs/Old.txt',
              isFolder: false
            },
            threads: []
          })
        }
      })
    )

    await storage.createThread(target, {
      body: 'Updated document metadata',
      format: 'markdown',
      author: { id: 'marie', displayName: 'Marie' }
    })

    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('Renamed.txt')
      })
    )
    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.stringContaining('/docs/Renamed.txt')
      })
    )
  })
})
