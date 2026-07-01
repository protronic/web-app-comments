import type { WebDAV } from '@opencloud-eu/web-client/webdav'
import {
  CommentAuthor,
  CommentDocument,
  CommentStorage,
  CommentTarget,
  CommentThread,
  CreateCommentInput,
  UpdateCommentInput
} from '../types'
import {
  createCommentMessage,
  createCommentThread,
  createDeletedCommentPlaceholder,
  createEmptyCommentDocument,
  sortThreads,
  touchThread
} from '../utils/comments'
import { CommentTagsGraphClient, isGraphResourceId, syncCommentedTag } from '../utils/commentTags'
import { SidecarPermissionsGraphClient, syncSidecarPermissions } from '../utils/sidecarPermissions'
import {
  getCommentDocumentPath,
  getCommentSidecarReadPaths,
  syncCommentDocumentTarget
} from '../utils/target'

export interface SidecarGraphClient extends SidecarPermissionsGraphClient {
  tags?: CommentTagsGraphClient
}

export class WebdavSidecarCommentStorage implements CommentStorage {
  public constructor(
    private readonly webdav: WebDAV,
    private readonly graph?: SidecarGraphClient
  ) {}

  public async list(target: CommentTarget): Promise<CommentThread[]> {
    const document = await this.loadDocument(target)
    return sortThreads(document.threads)
  }

  public async createThread(
    target: CommentTarget,
    input: CreateCommentInput
  ): Promise<CommentThread> {
    const document = await this.loadDocument(target)
    const now = new Date().toISOString()
    const comment = createCommentMessage({ ...input, now })
    const thread = createCommentThread(target, comment, now)

    document.threads.push(thread)
    await this.saveDocument(target, document)

    return thread
  }

  public async replyToThread(
    target: CommentTarget,
    threadId: string,
    input: CreateCommentInput
  ): Promise<CommentThread> {
    const document = await this.loadDocument(target)
    const thread = findThread(document, threadId)
    const now = new Date().toISOString()

    thread.comments.push(createCommentMessage({ ...input, now }))
    touchThread(thread, now)
    await this.saveDocument(target, document)

    return thread
  }

  public async updateComment(
    target: CommentTarget,
    threadId: string,
    commentId: string,
    input: UpdateCommentInput
  ): Promise<CommentThread> {
    const document = await this.loadDocument(target)
    const thread = findThread(document, threadId)
    const comment = findComment(thread, commentId)
    const now = new Date().toISOString()

    comment.body = input.body
    comment.format = input.format || comment.format
    comment.updatedAt = now
    touchThread(thread, now)
    await this.saveDocument(target, document)

    return thread
  }

  public async deleteComment(
    target: CommentTarget,
    threadId: string,
    commentId: string,
    actor: CommentAuthor
  ): Promise<CommentThread> {
    const document = await this.loadDocument(target)
    const thread = findThread(document, threadId)
    const index = thread.comments.findIndex((comment) => comment.id === commentId)

    if (index < 0) {
      throw new Error(`Comment "${commentId}" was not found.`)
    }

    const now = new Date().toISOString()
    thread.comments[index] = createDeletedCommentPlaceholder(thread.comments[index], actor, now)
    touchThread(thread, now)
    await this.saveDocument(target, document)

    return thread
  }

  public async setThreadResolved(
    target: CommentTarget,
    threadId: string,
    resolved: boolean,
    actor: CommentAuthor
  ): Promise<CommentThread> {
    const document = await this.loadDocument(target)
    const thread = findThread(document, threadId)
    const now = new Date().toISOString()

    thread.status = resolved ? 'resolved' : 'open'
    thread.resolvedAt = resolved ? now : undefined
    thread.resolvedBy = resolved ? actor : undefined
    touchThread(thread, now)
    await this.saveDocument(target, document)

    return thread
  }

  private async loadDocument(target: CommentTarget): Promise<CommentDocument> {
    for (const path of getCommentSidecarReadPaths(target)) {
      try {
        const response = await this.webdav.getFileContents(target.space, { path })
        const document = normalizeCommentDocument(target, JSON.parse(response.body))
        await syncCommentedTag(this.graph?.tags, this.webdav, target, document)

        return document
      } catch (error) {
        if (!isNotFoundError(error)) {
          throw error
        }
      }
    }

    return createEmptyCommentDocument(target)
  }

  private async saveDocument(target: CommentTarget, document: CommentDocument): Promise<void> {
    const payload = syncCommentDocumentTarget(target, document)

    const sidecarPath = getCommentDocumentPath(target)
    let sidecarResource = await this.webdav.putFileContents(target.space, {
      path: sidecarPath,
      content: JSON.stringify(payload, null, 2)
    })

    if (
      !sidecarResource ||
      (!isGraphResourceId(sidecarResource.fileId) && !isGraphResourceId(sidecarResource.id))
    ) {
      try {
        sidecarResource = await this.webdav.getFileInfo(target.space, { path: sidecarPath })
      } catch {
        sidecarResource = undefined
      }
    }

    await syncCommentedTag(this.graph?.tags, this.webdav, target, payload)

    if (
      sidecarResource &&
      (isGraphResourceId(sidecarResource.fileId) || isGraphResourceId(sidecarResource.id))
    ) {
      await syncSidecarPermissions(this.graph, this.webdav, target.space, target, sidecarResource)
    }
  }
}

function normalizeCommentDocument(target: CommentTarget, value: unknown): CommentDocument {
  const document = value as Partial<CommentDocument>

  if (!document || document.version !== 1 || !Array.isArray(document.threads)) {
    return createEmptyCommentDocument(target)
  }

  return {
    version: 1,
    target: {
      id: target.id,
      name: target.name,
      path: target.path,
      isFolder: target.isFolder
    },
    threads: document.threads
  }
}

function findThread(document: CommentDocument, threadId: string): CommentThread {
  const thread = document.threads.find((thread) => thread.id === threadId)

  if (!thread) {
    throw new Error(`Thread "${threadId}" was not found.`)
  }

  return thread
}

function findComment(thread: CommentThread, commentId: string) {
  const comment = thread.comments.find((comment) => comment.id === commentId)

  if (!comment) {
    throw new Error(`Comment "${commentId}" was not found.`)
  }

  return comment
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
