import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import type { Graph } from '@opencloud-eu/web-client/graph'
import {
  CommentDocument,
  CommentsDashboardApi,
  CommentsDashboardQuery,
  CommentsDashboardResult,
  DashboardThreadEntry
} from '../types'
import { COMMENT_TAG } from '../constants/tags'
import { buildTagSearchPattern } from '../utils/commentTags'
import { buildDashboardEntries, queryDashboardEntries } from '../utils/dashboard'
import { resolveSpaceForSearchResource } from '../utils/dashboardSearch'
import { enrichTargetLinkFromGraph } from '../utils/graphTargetLinks'
import { resolveCommentDocumentTarget } from '../utils/resolveTarget'
import { createCommentTarget, getCommentSidecarReadPaths, getSpaceRootSidecarReadPaths, isDashboardSpaceRoot } from '../utils/target'

export class WebdavSidecarDashboardStorage implements CommentsDashboardApi {
  public constructor(
    private readonly webdav: WebDAV,
    private readonly graph?: Graph
  ) {}

  public async listThreads(
    spaces: SpaceResource[],
    query: CommentsDashboardQuery = {}
  ): Promise<CommentsDashboardResult> {
    const entries: DashboardThreadEntry[] = []
    const searchTags = query.tags?.length ? query.tags : [COMMENT_TAG]
    const pattern = buildTagSearchPattern(searchTags)

    let resources: Resource[] = []

    try {
      const result = await this.webdav.search(pattern, { searchLimit: 5000 })
      resources = result.resources
    } catch {
      resources = []
    }

    for (const resource of resources) {
      const space = await resolveSpaceForSearchResource(this.webdav, spaces, resource)

      if (!space) {
        continue
      }

      if (query.spaceId && space.id !== query.spaceId) {
        continue
      }

      try {
        const target = createCommentTarget(space, resource)
        const loaded = await this.loadDocumentForTarget(space, target)

        if (!loaded || loaded.document.threads.length === 0) {
          continue
        }

        const resolvedTarget = await enrichTargetLinkFromGraph(
          this.graph?.driveItems,
          space,
          await resolveCommentDocumentTarget(
            this.webdav,
            space,
            loaded.document,
            loaded.sidecarPath
          )
        )

        entries.push(...buildDashboardEntries(space, loaded.document, resolvedTarget))
      } catch {
        continue
      }
    }

    for (const space of spaces) {
      if (!isDashboardSpaceRoot(space)) {
        continue
      }

      if (query.spaceId && space.id !== query.spaceId) {
        continue
      }

      try {
        await this.loadSpaceRootThreads(space, entries)
      } catch {
        continue
      }
    }

    return queryDashboardEntries(entries, withoutTagRefilter(query))
  }

  private async loadSpaceRootThreads(
    space: SpaceResource,
    entries: DashboardThreadEntry[]
  ): Promise<void> {
    for (const sidecarPath of getSpaceRootSidecarReadPaths(space)) {
      try {
        const document = await this.loadDocument(space, sidecarPath)

        if (document.threads.length === 0) {
          continue
        }

        const resolvedTarget = await enrichTargetLinkFromGraph(
          this.graph?.driveItems,
          space,
          await resolveCommentDocumentTarget(this.webdav, space, document, sidecarPath)
        )

        entries.push(...buildDashboardEntries(space, document, resolvedTarget))
        return
      } catch {
        continue
      }
    }
  }

  private async loadDocumentForTarget(
    space: SpaceResource,
    target: ReturnType<typeof createCommentTarget>
  ): Promise<{ document: CommentDocument; sidecarPath: string } | null> {
    for (const sidecarPath of getCommentSidecarReadPaths(target)) {
      try {
        return {
          document: await this.loadDocument(space, sidecarPath),
          sidecarPath
        }
      } catch {
        continue
      }
    }

    return null
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

function withoutTagRefilter(query: CommentsDashboardQuery): CommentsDashboardQuery {
  if (!query.tags?.length) {
    return query
  }

  // Tag search above already matched these resources. Re-filtering by
  // entry.target.tags drops mountpoint/shared hits because WebDAV often omits tags there.
  return {
    ...query,
    tags: undefined
  }
}
