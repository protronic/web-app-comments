import type { Resource, SpaceResource } from '@opencloud-eu/web-client'

export type CommentFormat = 'text' | 'markdown'
export type CommentThreadStatus = 'open' | 'resolved'

export interface CommentAuthor {
  id: string
  displayName: string
}

export interface CommentTarget {
  id: string
  name: string
  path: string
  containerPath: string
  isFolder: boolean
  resource: Resource
  space: SpaceResource
}

export interface CommentMessage {
  id: string
  body: string
  format: CommentFormat
  author: CommentAuthor
  createdAt: string
  updatedAt?: string
  deletedAt?: string
  deletedBy?: CommentAuthor
}

export interface CommentThread {
  id: string
  targetId: string
  status: CommentThreadStatus
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  resolvedBy?: CommentAuthor
  comments: CommentMessage[]
}

export interface CommentDocument {
  version: 1
  target: {
    id: string
    name: string
    path: string
    isFolder: boolean
  }
  threads: CommentThread[]
}

export interface CreateCommentInput {
  body: string
  format: CommentFormat
  author: CommentAuthor
}

export interface UpdateCommentInput {
  body: string
  format?: CommentFormat
  author: CommentAuthor
}

export interface CommentStorage {
  list(target: CommentTarget): Promise<CommentThread[]>
  createThread(target: CommentTarget, input: CreateCommentInput): Promise<CommentThread>
  replyToThread(
    target: CommentTarget,
    threadId: string,
    input: CreateCommentInput
  ): Promise<CommentThread>
  updateComment(
    target: CommentTarget,
    threadId: string,
    commentId: string,
    input: UpdateCommentInput
  ): Promise<CommentThread>
  deleteComment(
    target: CommentTarget,
    threadId: string,
    commentId: string,
    actor: CommentAuthor
  ): Promise<CommentThread>
  setThreadResolved(
    target: CommentTarget,
    threadId: string,
    resolved: boolean,
    actor: CommentAuthor
  ): Promise<CommentThread>
}
