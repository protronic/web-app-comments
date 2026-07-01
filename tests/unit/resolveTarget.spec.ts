import { beforeEach, vi } from 'vitest'
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

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const document: CommentDocument = {
    version: 1,
    target: {
      id: 'owner$space!file-1',
      name: 'Old name.md',
      path: '/projects/old-name.md',
      isFolder: false
    },
    threads: []
  }

  it('uses the current resource name and path from webdav', async () => {
    webdav.getFileInfo.mockResolvedValue(
      mock<Resource>({
        fileId: 'owner$space!file-1',
        id: 'owner$space!file-1',
        name: 'New name.md',
        path: '/projects/new-name.md',
        type: 'file',
        mimeType: 'text/markdown',
        extension: 'md',
        privateLink: 'https://test.oc/f/owner%24space%21file-1',
        tags: ['draft'],
        isFolder: false
      })
    )

    await expect(resolveCommentDocumentTarget(webdav, space, document)).resolves.toEqual({
      id: 'owner$space!file-1',
      name: 'New name.md',
      path: '/projects/new-name.md',
      isFolder: false,
      resourceType: 'file',
      mimeType: 'text/markdown',
      fileId: 'owner$space!file-1',
      extension: 'md',
      privateLink: 'https://test.oc/f/owner%24space%21file-1',
      tags: ['draft']
    })
  })

  it('falls back to the sidecar snapshot when lookup fails', async () => {
    webdav.getFileInfo.mockRejectedValue(new Error('not found'))

    await expect(resolveCommentDocumentTarget(webdav, space, document)).resolves.toEqual({
      id: 'owner$space!file-1',
      name: 'Old name.md',
      path: '/projects/old-name.md',
      isFolder: false,
      resourceType: 'file',
      fileId: 'owner$space!file-1',
      tags: []
    })
  })

  it('derives folder paths from the sidecar name when webdav only reports the space root', async () => {
    webdav.getFileInfo.mockRejectedValue(new Error('not found'))

    const folderDocument: CommentDocument = {
      version: 1,
      target: {
        id: 'folder-1',
        name: 'Testordner',
        path: '/Testordner',
        isFolder: true
      },
      threads: []
    }

    await expect(resolveCommentDocumentTarget(webdav, space, folderDocument)).resolves.toEqual({
      id: 'folder-1',
      name: 'Testordner',
      path: '/Testordner',
      isFolder: true,
      resourceType: 'folder',
      tags: []
    })
  })

  it('deduplicates target lookups per document set', async () => {
    webdav.getFileInfo.mockResolvedValue(
      mock<Resource>({
        fileId: 'owner$space!file-1',
        name: 'Renamed folder',
        path: '/renamed-folder',
        type: 'folder',
        isFolder: true
      })
    )

    const resolved = await resolveCommentDocumentTargets(webdav, space, [
      { document },
      { document }
    ])

    expect(webdav.getFileInfo).toHaveBeenCalledTimes(1)
    expect(resolved.get('owner$space!file-1')?.name).toBe('Renamed folder')
    expect(resolved.get('owner$space!file-1')?.resourceType).toBe('folder')
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
      if (resource && 'fileId' in resource && resource.fileId === 'folder-1') {
        throw new Error('not found')
      }

      if (resource && 'path' in resource && resource.path === '/Renamed folder') {
        return mock<Resource>({
          fileId: 'folder-1',
          name: 'Renamed folder',
          path: '/Renamed folder',
          type: 'folder',
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
      isFolder: true,
      resourceType: 'folder',
      tags: []
    })
  })

  it('resolves sibling space-root sidecars by space name', async () => {
    const projectSpace = mock<SpaceResource>({
      id: 'space-root$id',
      name: 'New space',
      driveAlias: 'project/new-space',
      driveType: 'project'
    })

    const spaceDocument: CommentDocument = {
      version: 1,
      target: {
        id: 'space-root$id',
        name: 'New space',
        path: '/New space',
        isFolder: true
      },
      threads: []
    }

    await expect(
      resolveCommentDocumentTarget(
        webdav,
        projectSpace,
        spaceDocument,
        '/.New space.jsco'
      )
    ).resolves.toEqual({
      id: 'space-root$id',
      name: 'New space',
      path: '/',
      isFolder: true,
      resourceType: 'space',
      fileId: 'space-root$id',
      privateLink: undefined,
      tags: []
    })

    expect(webdav.getFileInfo).not.toHaveBeenCalled()
  })

  it('resolves space-root comments from the space sidecar container', async () => {
    const projectSpace = mock<SpaceResource>({
      id: 'space-root$id',
      name: 'Project space',
      driveAlias: 'project/project-space',
      driveType: 'project'
    })

    const spaceDocument: CommentDocument = {
      version: 1,
      target: {
        id: 'space-root$id',
        name: 'Old space name',
        path: '/',
        isFolder: true
      },
      threads: []
    }

    await expect(
      resolveCommentDocumentTarget(
        webdav,
        projectSpace,
        spaceDocument,
        '/.conflu/comments/space-root_id.json'
      )
    ).resolves.toEqual({
      id: 'space-root$id',
      name: 'Project space',
      path: '/',
      isFolder: true,
      resourceType: 'space',
      fileId: 'space-root$id',
      privateLink: undefined,
      tags: []
    })

    expect(webdav.getFileInfo).not.toHaveBeenCalled()
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
          type: 'folder',
          isFolder: true
        })
      }

      if (resource?.fileId === 'folder-1') {
        return mock<Resource>({
          fileId: 'folder-1',
          name: 'Testordner',
          path: '/',
          type: 'folder',
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
      isFolder: true,
      resourceType: 'folder',
      tags: []
    })
  })
})
