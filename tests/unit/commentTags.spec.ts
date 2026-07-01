import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { WebDAV } from '@opencloud-eu/web-client/webdav'
import { mock } from 'vitest-mock-extended'
import { COMMENT_TAG } from '../../src/constants/tags'
import {
  isGraphResourceId,
  resolveGraphResourceId,
  syncCommentedTag
} from '../../src/utils/commentTags'
import { createCommentTarget } from '../../src/utils/target'

describe('comment tag helpers', () => {
  const space = mock<SpaceResource>()

  it('builds a single-tag search pattern', async () => {
    const { buildTagSearchPattern } = await import('../../src/utils/commentTags')
    expect(buildTagSearchPattern([COMMENT_TAG])).toBe('tag:Kommentiert')
  })

  it('builds an AND search pattern for multiple tags', async () => {
    const { buildTagSearchPattern } = await import('../../src/utils/commentTags')
    expect(buildTagSearchPattern(['md', COMMENT_TAG])).toBe('tag:md AND tag:Kommentiert')
  })

  it('defaults to the commented tag when no tags are selected', async () => {
    const { buildTagSearchPattern } = await import('../../src/utils/commentTags')
    expect(buildTagSearchPattern([])).toBe('tag:Kommentiert')
  })

  it('detects graph resource ids', () => {
    expect(isGraphResourceId('owner$space!item-1')).toBe(true)
    expect(isGraphResourceId('file-1')).toBe(false)
  })

  it('resolves graph resource ids from webdav when the sidebar resource is incomplete', async () => {
    const webdav = mock<WebDAV>()
    const target = createCommentTarget(
      space,
      mock<Resource>({
        id: 'sidebar-id',
        name: 'Plan.md',
        path: '/Plan.md',
        isFolder: false
      })
    )

    webdav.getFileInfo.mockResolvedValue(
      mock<Resource>({
        fileId: 'owner$space!item-1',
        path: '/Plan.md'
      })
    )

    await expect(resolveGraphResourceId(webdav, target)).resolves.toBe('owner$space!item-1')
  })

  it('assigns the commented tag using a resolved resource id', async () => {
    const webdav = mock<WebDAV>()
    const graph = mock<import('../../src/utils/commentTags').CommentTagsGraphClient>()
    const target = createCommentTarget(
      space,
      mock<Resource>({
        id: 'sidebar-id',
        name: 'Plan.md',
        path: '/Plan.md',
        isFolder: false
      })
    )

    webdav.getFileInfo.mockResolvedValue(
      mock<Resource>({
        fileId: 'owner$space!item-1',
        path: '/Plan.md'
      })
    )

    await syncCommentedTag(graph, webdav, target, {
      version: 1,
      target: {
        id: target.id,
        name: target.name,
        path: target.path,
        isFolder: target.isFolder
      },
      threads: [
        {
          id: 'thread-1',
          targetId: target.id,
          status: 'open',
          createdAt: '2026-06-28T10:00:00.000Z',
          updatedAt: '2026-06-28T10:00:00.000Z',
          comments: []
        }
      ]
    })

    expect(graph.assignTags).toHaveBeenCalledWith({
      resourceId: 'owner$space!item-1',
      tags: [COMMENT_TAG]
    })
  })
})
