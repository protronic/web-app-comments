import { CommentThread } from '../../src/types'
import { getCommentPreviewLine, getLastReplyComment } from '../../src/utils/comments'

describe('comment previews', () => {
  const thread: CommentThread = {
    id: 'thread-1',
    targetId: 'file-1',
    status: 'open',
    createdAt: '2026-06-28T10:00:00.000Z',
    updatedAt: '2026-06-28T12:00:00.000Z',
    comments: [
      {
        id: 'comment-1',
        body: 'Question',
        format: 'markdown',
        author: { id: 'alice', displayName: 'Alice' },
        createdAt: '2026-06-28T10:00:00.000Z'
      },
      {
        id: 'comment-2',
        body: '**Latest** reply',
        format: 'markdown',
        author: { id: 'bob', displayName: 'Bob' },
        createdAt: '2026-06-28T12:00:00.000Z'
      }
    ]
  }

  it('returns the latest reply comment', () => {
    expect(getLastReplyComment(thread)?.id).toBe('comment-2')
  })

  it('strips markdown from previews', () => {
    expect(getCommentPreviewLine('**Latest** reply')).toBe('Latest reply')
  })
})
