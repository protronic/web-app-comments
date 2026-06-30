import {
  CommentAuthor,
  CommentDocument,
  CommentMessage,
  CommentTarget,
  CommentThread
} from '../types'

export function createEmptyCommentDocument(target: CommentTarget): CommentDocument {
  return {
    version: 1,
    target: {
      id: target.id,
      name: target.name,
      path: target.path,
      isFolder: target.isFolder
    },
    threads: []
  }
}

export function createCommentMessage({
  body,
  format,
  author,
  now = new Date().toISOString()
}: Pick<CommentMessage, 'body' | 'format' | 'author'> & { now?: string }): CommentMessage {
  return {
    id: createId('comment'),
    body,
    format,
    author,
    createdAt: now
  }
}

export function createCommentThread(
  target: CommentTarget,
  comment: CommentMessage,
  now = new Date().toISOString()
): CommentThread {
  return {
    id: createId('thread'),
    targetId: target.id,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    comments: [comment]
  }
}

export function touchThread(thread: CommentThread, now = new Date().toISOString()): void {
  thread.updatedAt = now
}

export function createDeletedCommentPlaceholder(
  comment: CommentMessage,
  actor: CommentAuthor,
  now = new Date().toISOString()
): CommentMessage {
  return {
    ...comment,
    body: '',
    updatedAt: now,
    deletedAt: now,
    deletedBy: actor
  }
}

export function sortThreads(threads: CommentThread[]): CommentThread[] {
  return [...threads].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'open' ? -1 : 1
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export function getThreadTitleLine(thread: CommentThread): string | undefined {
  const firstComment = thread.comments.find(
    (comment) => !comment.deletedAt && comment.body.trim().length > 0
  )

  if (!firstComment) {
    return undefined
  }

  const firstLine = firstComment.body.split(/\r?\n/, 1)[0]?.trim()

  return firstLine || undefined
}

function createId(prefix: string): string {
  if ('crypto' in globalThis && typeof globalThis.crypto.randomUUID === 'function') {
    return `${prefix}:${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`
}
