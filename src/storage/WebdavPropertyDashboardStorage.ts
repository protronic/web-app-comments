import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import type { Graph } from '@opencloud-eu/web-client/graph'
import { CommentsDashboardApi, CommentsDashboardQuery, CommentsDashboardResult } from '../types'
import { COMMENT_TAG } from '../constants/tags'
import { buildTagSearchPattern } from '../utils/commentTags'
import { readCommentDocument } from '../utils/commentProperty'
import { buildDashboardEntries, queryDashboardEntries } from '../utils/dashboard'
import { findSpaceForSearchResource } from '../utils/dashboardSearch'
import { enrichTargetLinkFromGraph } from '../utils/graphTargetLinks'
import { resolveCommentDocumentTarget } from '../utils/resolveTarget'
import { createCommentTarget } from '../utils/target'

export class WebdavPropertyDashboardStorage implements CommentsDashboardApi {
  public constructor(
    private readonly webdav: WebDAV,
    private readonly graph?: Graph
  ) {}

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
        const document = await readCommentDocument(this.webdav, target)

        if (document.threads.length === 0) {
          continue
        }

        const resolvedTarget = await enrichTargetLinkFromGraph(
          this.graph?.driveItems,
          space,
          await resolveCommentDocumentTarget(this.webdav, space, document)
        )

        entries.push(...buildDashboardEntries(space, document, resolvedTarget))
      } catch {
        continue
      }
    }

    return queryDashboardEntries(entries, query)
  }
}
