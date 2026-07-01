import { SearchResource, SpaceResource } from '@opencloud-eu/web-client'
import { WebDAV } from '@opencloud-eu/web-client/webdav'
import { mock } from 'vitest-mock-extended'
import { COMMENT_TAG } from '../../src/constants/tags'
import { WebdavSidecarDashboardStorage } from '../../src/storage/WebdavSidecarDashboardStorage'

describe('WebdavSidecarDashboardStorage', () => {
  const space = mock<SpaceResource>({
    id: 'owner$space',
    name: 'Marketing',
    driveAlias: 'project/marketing',
    driveType: 'project'
  })

  it('loads sidecars for resources returned by tag search', async () => {
    const webdav = mock<WebDAV>()
    const resource = mock<SearchResource>({
      storageId: 'owner$space',
      fileId: 'owner$space!file-1',
      id: 'owner$space!file-1',
      name: 'Plan.md',
      path: '/Plan.md',
      isFolder: false,
      tags: [COMMENT_TAG],
      highlights: ''
    })
    const storage = new WebdavSidecarDashboardStorage(webdav)

    webdav.search.mockResolvedValue({
      resources: [resource],
      totalResults: 1
    } as never)
    webdav.getFileContents.mockResolvedValue({
      body: JSON.stringify({
        version: 1,
        target: {
          id: 'file-1',
          name: 'Plan.md',
          path: '/Plan.md',
          isFolder: false
        },
        threads: [
          {
            id: 'thread-1',
            targetId: 'file-1',
            status: 'open',
            createdAt: '2026-06-28T10:00:00.000Z',
            updatedAt: '2026-06-28T10:00:00.000Z',
            comments: [
              {
                id: 'comment-1',
                body: 'Needs review',
                format: 'markdown',
                author: { id: 'alice', displayName: 'Alice' },
                createdAt: '2026-06-28T10:00:00.000Z'
              },
              {
                id: 'comment-2',
                body: 'On it',
                format: 'markdown',
                author: { id: 'bob', displayName: 'Bob' },
                createdAt: '2026-06-28T11:00:00.000Z'
              }
            ]
          }
        ]
      })
    } as never)
    webdav.getFileInfo.mockResolvedValue(
      mock({
        fileId: 'owner$space!file-1',
        id: 'owner$space!file-1',
        name: 'Plan.md',
        path: '/Plan.md',
        isFolder: false,
        privateLink: 'https://test.oc/f/owner%24space%21file-1',
        tags: [COMMENT_TAG]
      })
    )

    const result = await storage.listThreads([space], {
      tags: [COMMENT_TAG],
      status: 'all',
      answered: 'all'
    })

    expect(webdav.search).toHaveBeenCalledWith('tag:Kommentiert', { searchLimit: 5000 })
    expect(result.total).toBe(1)
    expect(result.entries[0]?.target.name).toBe('Plan.md')
    expect(result.entries[0]?.target.privateLink).toBe('https://test.oc/f/owner%24space%21file-1')
    expect(result.entries[0]?.isAnswered).toBe(true)
  })
})
