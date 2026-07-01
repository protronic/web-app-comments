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
  sortThreads,
  touchThread
} from '../utils/comments'
import { CommentTagsGraphClient, syncCommentedTag } from '../utils/commentTags'
import {
  CommentPropertyHttpClient,
  readCommentDocument,
  writeCommentDocument
} from '../utils/commentProperty'
import { syncCommentDocumentTarget } from '../utils/target'

export class WebdavPropertyCommentStorage implements CommentStorage {
  public constructor(
    private readonly webdav: WebDAV,
    private readonly http: CommentPropertyHttpClient,
    private readonly graph?: CommentTagsGraphClient
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
    const document = await readCommentDocument(this.webdav, target)
    await syncCommentedTag(this.graph, this.webdav, target, document)

    return document
  }

  private async saveDocument(target: CommentTarget, document: CommentDocument): Promise<void> {
    const payload = syncCommentDocumentTarget(target, document)

    await writeCommentDocument(this.webdav, this.http, target, payload)
    await syncCommentedTag(this.graph, this.webdav, target, payload)
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
