import { SpaceResource, urlJoin } from '@opencloud-eu/web-client'
import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import {
  CommentDocument,
  CommentsDashboardApi,
  CommentsDashboardQuery,
  CommentsDashboardResult
} from '../types'
import { buildDashboardEntries, queryDashboardEntries } from '../utils/dashboard'
import { CommentDocumentRef, mapFallbackTargetSummary, resolveCommentDocumentTargets } from '../utils/resolveTarget'
import { COMMENTS_FOLDER_NAME } from '../utils/target'

export class WebdavSidecarDashboardStorage implements CommentsDashboardApi {
  public constructor(private readonly webdav: WebDAV) {}

  public async listThreads(
    spaces: SpaceResource[],
    query: CommentsDashboardQuery = {}
  ): Promise<CommentsDashboardResult> {
    const entries = []

    for (const space of spaces) {
      try {
        const refs = await this.collectDocuments(space)
        const resolvedTargets = await resolveCommentDocumentTargets(this.webdav, space, refs)

        for (const ref of refs) {
          const target =
            resolvedTargets.get(ref.document.target.id) ||
            mapFallbackTargetSummary(ref.document.target, space)

          entries.push(...buildDashboardEntries(space, ref.document, target))
        }
      } catch {
        // Skip spaces that cannot be scanned instead of failing the whole dashboard.
        continue
      }
    }

    return queryDashboardEntries(entries, query)
  }

  private async collectDocuments(space: SpaceResource): Promise<CommentDocumentRef[]> {
    const refs: CommentDocumentRef[] = []
    await this.walkDirectory(space, '/', refs)
    return refs
  }

  private async walkDirectory(
    space: SpaceResource,
    path: string,
    refs: CommentDocumentRef[]
  ): Promise<void> {
    await this.tryLoadCommentsAtContainer(space, path, refs)

    let result

    try {
      result = await this.webdav.listFiles(space, { path }, { depth: 1 })
    } catch (error) {
      if (isNotFoundError(error)) {
        return
      }

      throw error
    }

    for (const child of result.children || []) {
      if (!child.isFolder || child.name === '.conflu' || child.name.startsWith('.')) {
        continue
      }

      await this.walkDirectory(space, child.path || urlJoin(path, child.name), refs)
    }
  }

  private async tryLoadCommentsAtContainer(
    space: SpaceResource,
    containerPath: string,
    refs: CommentDocumentRef[]
  ): Promise<void> {
    const commentsPath = urlJoin(containerPath, COMMENTS_FOLDER_NAME)

    try {
      await this.loadDocumentsFromCommentsPath(space, commentsPath, refs)
    } catch (error) {
      if (isNotFoundError(error)) {
        return
      }

      throw error
    }
  }

  private async loadDocumentsFromCommentsPath(
    space: SpaceResource,
    commentsPath: string,
    refs: CommentDocumentRef[]
  ): Promise<void> {
    const result = await this.webdav.listFiles(space, { path: commentsPath }, { depth: 1 })

    for (const file of result.children || []) {
      if (file.isFolder || !file.name.endsWith('.json')) {
        continue
      }

      const sidecarPath = file.path || urlJoin(commentsPath, file.name)
      const document = await this.loadDocument(space, sidecarPath)

      if (document.threads.length > 0) {
        refs.push({ document, sidecarPath })
      }
    }
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

function isNotFoundError(error: unknown): boolean {
  const responseStatus = (
    error as { status?: number; statusCode?: number; response?: { status?: number } }
  )?.response?.status
  const statusCode =
    responseStatus ||
    (error as { status?: number; statusCode?: number })?.status ||
    (error as { status?: number; statusCode?: number })?.statusCode
  const message = (error as Error)?.message || ''

  return statusCode === 404 || message.includes('404') || message.includes('Not Found')
}
