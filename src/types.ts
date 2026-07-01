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

export type DashboardStatusFilter = 'all' | 'open' | 'resolved'
export type DashboardAnsweredFilter = 'all' | 'answered' | 'unanswered'
export type DashboardResourceType = 'file' | 'folder' | 'space'
export type DashboardTypeFilter = 'all' | DashboardResourceType

export interface CommentsDashboardQuery {
  status?: DashboardStatusFilter
  answered?: DashboardAnsweredFilter
  type?: DashboardTypeFilter
  tags?: string[]
  spaceId?: string
  limit?: number
  offset?: number
}

export interface DashboardTargetSummary {
  id: string
  name: string
  path: string
  isFolder: boolean
  resourceType: DashboardResourceType
  mimeType?: string
  tags: string[]
}

export interface DashboardSpaceSummary {
  id: string
  name: string
  driveAlias: string
  driveType?: string
}

export interface DashboardLastReply {
  author: CommentAuthor
  body: string
  preview: string
  createdAt: string
}

export interface DashboardThreadEntry {
  thread: CommentThread
  target: DashboardTargetSummary
  space: DashboardSpaceSummary
  replyCount: number
  isAnswered: boolean
  lastReply?: DashboardLastReply
}

export interface CommentsDashboardResult {
  entries: DashboardThreadEntry[]
  total: number
}

export interface CommentsDashboardApi {
  listThreads(
    spaces: SpaceResource[],
    query?: CommentsDashboardQuery
  ): Promise<CommentsDashboardResult>
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
