import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import {
  CommentDocument,
  CommentsDashboardApi,
  CommentsDashboardQuery,
  CommentsDashboardResult
} from '../types'
import { COMMENT_TAG } from '../constants/tags'
import { buildTagSearchPattern } from '../utils/commentTags'
import { buildDashboardEntries, queryDashboardEntries } from '../utils/dashboard'
import { findSpaceForSearchResource } from '../utils/dashboardSearch'
import { resolveCommentDocumentTarget } from '../utils/resolveTarget'
import { createCommentTarget, getCommentDocumentPath } from '../utils/target'

export class WebdavSidecarDashboardStorage implements CommentsDashboardApi {
  public constructor(private readonly webdav: WebDAV) {}

  public async listThreads(
    spaces: SpaceResource[],
    query: CommentsDashboardQuery = {}
  ): Promise<CommentsDashboardResult> {
    const entries = []
    const searchTags = query.tags?.length ? query.tags : [COMMENT_TAG]
    const pattern = buildTagSearchPattern(searchTags)

    let resources: Resource[] = []

    try {
      const result = await this.webdav.search(pattern, { searchLimit: 5000 })
      resources = result.resources
    } catch {
      return queryDashboardEntries([], query)
    }

    for (const resource of resources) {
      const space = findSpaceForSearchResource(spaces, resource)

      if (!space) {
        continue
      }

      if (query.spaceId && space.id !== query.spaceId) {
        continue
      }

      try {
        const target = createCommentTarget(space, resource)
        const sidecarPath = getCommentDocumentPath(target)
        const document = await this.loadDocument(space, sidecarPath)

        if (document.threads.length === 0) {
          continue
        }

        const resolvedTarget = await resolveCommentDocumentTarget(
          this.webdav,
          space,
          document,
          sidecarPath
        )

        entries.push(...buildDashboardEntries(space, document, resolvedTarget))
      } catch {
        continue
      }
    }

    return queryDashboardEntries(entries, query)
  }

  private async loadDocument(space: SpaceResource, path: string): Promise<CommentDocument> {
    const response = await this.webdav.getFileContents(space, { path })
    const document = JSON.parse(response.body) as Partial<CommentDocument>

    if (!document || document.version !== 1 || !Array.isArray(document.threads)) {
      return {
        version: 1,
        target: {
          id: path,
          name: path.split('/').pop() || path,
          path,
          isFolder: false
        },
        threads: []
      }
    }

    return {
      version: 1,
      target: {
        id: document.target?.id || path,
        name: document.target?.name || path,
        path: document.target?.path || path,
        isFolder: document.target?.isFolder ?? false
      },
      threads: document.threads
    }
  }
}
