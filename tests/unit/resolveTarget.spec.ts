import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { WebDAV } from '@opencloud-eu/web-client/webdav'
import { mock } from 'vitest-mock-extended'
import { CommentDocument } from '../../src/types'
import {
  resolveCommentDocumentTarget,
  resolveCommentDocumentTargets
} from '../../src/utils/resolveTarget'

describe('resolve comment dashboard targets', () => {
  const space = mock<SpaceResource>()
  const webdav = mock<WebDAV>()

  const document: CommentDocument = {
    version: 1,
    target: {
      id: 'file-1',
      name: 'Old name.md',
      path: '/projects/old-name.md',
      isFolder: false
    },
    threads: []
  }

  it('uses the current resource name and path from webdav', async () => {
    webdav.getFileInfo.mockResolvedValue(
      mock<Resource>({
        fileId: 'file-1',
        name: 'New name.md',
        path: '/projects/new-name.md',
        isFolder: false
      })
    )

    await expect(resolveCommentDocumentTarget(webdav, space, document)).resolves.toEqual({
      id: 'file-1',
      name: 'New name.md',
      path: '/projects/new-name.md',
      isFolder: false
    })
  })

  it('falls back to the sidecar snapshot when lookup fails', async () => {
    webdav.getFileInfo.mockRejectedValue(new Error('not found'))

    await expect(resolveCommentDocumentTarget(webdav, space, document)).resolves.toEqual(
      document.target
    )
  })

  it('deduplicates target lookups per document set', async () => {
    webdav.getFileInfo.mockResolvedValue(
      mock<Resource>({
        fileId: 'file-1',
        name: 'Renamed folder',
        path: '/renamed-folder',
        isFolder: true
      })
    )

    const resolved = await resolveCommentDocumentTargets(webdav, space, [
      { document },
      { document }
    ])

    expect(webdav.getFileInfo).toHaveBeenCalledTimes(1)
    expect(resolved.get('file-1')?.name).toBe('Renamed folder')
  })

  it('resolves renamed folders from the sidecar container path', async () => {
    const folderDocument: CommentDocument = {
      version: 1,
      target: {
        id: 'folder-1',
        name: 'Old folder',
        path: '/Old folder',
        isFolder: true
      },
      threads: []
    }

    webdav.getFileInfo.mockImplementation(async (_space, resource) => {
      if (resource?.fileId === 'folder-1') {
        throw new Error('not found')
      }

      if (resource?.path === '/Renamed folder') {
        return mock<Resource>({
          fileId: 'folder-1',
          name: 'Renamed folder',
          path: '/Renamed folder',
          isFolder: true
        })
      }

      throw new Error('not found')
    })

    await expect(
      resolveCommentDocumentTarget(webdav, space, folderDocument, '/Renamed folder/.conflu/comments/folder-1.json')
    ).resolves.toEqual({
      id: 'folder-1',
      name: 'Renamed folder',
      path: '/Renamed folder',
      isFolder: true
    })
  })

  it('ignores misleading fileId lookups that point folders to the space root', async () => {
    const folderDocument: CommentDocument = {
      version: 1,
      target: {
        id: 'folder-1',
        name: 'Old folder',
        path: '/Old folder',
        isFolder: true
      },
      threads: []
    }

    webdav.getFileInfo.mockImplementation(async (_space, resource) => {
      if (resource?.path === '/Testordner') {
        return mock<Resource>({
          fileId: 'folder-1',
          name: 'Testordner',
          path: '/Testordner',
          isFolder: true
        })
      }

      if (resource?.fileId === 'folder-1') {
        return mock<Resource>({
          fileId: 'folder-1',
          name: 'Testordner',
          path: '/',
          isFolder: true
        })
      }

      throw new Error('not found')
    })

    await expect(
      resolveCommentDocumentTarget(
        webdav,
        space,
        folderDocument,
        '/Testordner/.conflu/comments/folder-1.json'
      )
    ).resolves.toEqual({
      id: 'folder-1',
      name: 'Testordner',
      path: '/Testordner',
      isFolder: true
    })
  })
})
