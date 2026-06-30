import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { WebDAV } from '@opencloud-eu/web-client/webdav'
import { mock } from 'vitest-mock-extended'
import { WebdavSidecarCommentStorage } from '../../src/storage/WebdavSidecarCommentStorage'
import {
  createCommentTarget,
  getCommentDirectoryPath,
  getCommentDocumentPath
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

  it('stores sidecars in a .conflu comments folder next to files', () => {
    const resource = mock<Resource>({
      fileId: 'file:1/2',
      name: 'README.md',
      path: '/handbook/README.md',
      isFolder: false
    })
    const target = createCommentTarget(space, resource)

    expect(getCommentDirectoryPath(target)).toBe('/handbook/.conflu/comments')
    expect(getCommentDocumentPath(target)).toBe('/handbook/.conflu/comments/file_1_2.json')
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
    expect(webdav.createFolder).toHaveBeenCalledWith(space, { path: '/.conflu' })
    expect(webdav.createFolder).toHaveBeenCalledWith(space, { path: '/.conflu/comments' })
    expect(webdav.putFileContents).toHaveBeenCalledWith(
      space,
      expect.objectContaining({
        path: '/.conflu/comments/file-1.json'
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
})
