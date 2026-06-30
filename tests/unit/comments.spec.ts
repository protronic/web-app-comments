import { mock } from 'vitest-mock-extended'
import { createCommentMessage, createCommentThread, getThreadTitleLine } from '../../src/utils/comments'
import { CommentTarget } from '../../src/types'

describe('getThreadTitleLine', () => {
  const target = mock<CommentTarget>({ id: 'file-1' })

  it('returns the first line of the first comment', () => {
    const thread = createCommentThread(
      target,
      createCommentMessage({
        body: 'First line title\nSecond line ignored',
        format: 'markdown',
        author: { id: 'u1', displayName: 'Alice' }
      })
    )

    expect(getThreadTitleLine(thread)).toBe('First line title')
  })

  it('skips deleted comments', () => {
    const thread = createCommentThread(
      target,
      createCommentMessage({
        body: '',
        format: 'markdown',
        author: { id: 'u1', displayName: 'Alice' }
      })
    )
    thread.comments[0].deletedAt = new Date().toISOString()
    thread.comments.push(
      createCommentMessage({
        body: 'Visible title',
        format: 'markdown',
        author: { id: 'u2', displayName: 'Bob' }
      })
    )

    expect(getThreadTitleLine(thread)).toBe('Visible title')
  })

  it('returns undefined when no usable comment exists', () => {
    const thread = createCommentThread(
      target,
      createCommentMessage({
        body: '   ',
        format: 'markdown',
        author: { id: 'u1', displayName: 'Alice' }
      })
    )

    expect(getThreadTitleLine(thread)).toBeUndefined()
  })
})
