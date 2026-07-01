import {
  commentMentionsUser,
  formatUserMention,
  getActiveMentionQuery,
  insertUserMention,
  parseUserMentions,
  threadInvolvesUser
} from '../../src/utils/mentions'
import { CommentThread } from '../../src/types'

describe('comment mentions', () => {
  it('formats and parses user mentions', () => {
    const token = formatUserMention({ id: 'marie', displayName: 'Marie Curie' })

    expect(token).toBe('@[Marie Curie](user:marie)')
    expect(parseUserMentions(`Please review ${token} today.`)).toEqual([
      { id: 'marie', displayName: 'Marie Curie' }
    ])
    expect(commentMentionsUser(`Ping ${token}`, 'marie')).toBe(true)
    expect(commentMentionsUser(`Ping ${token}`, 'einstein')).toBe(false)
  })

  it('detects active mention queries in the textarea', () => {
    expect(getActiveMentionQuery('Hello @mar', 10)).toEqual({ start: 6, query: 'mar' })
    expect(getActiveMentionQuery('Hello @marie!', 13)).toBeNull()
  })

  it('inserts a mention token at the cursor', () => {
    const result = insertUserMention(
      'Hello @mar',
      6,
      10,
      { id: 'marie', displayName: 'Marie Curie' }
    )

    expect(result.value).toBe('Hello @[Marie Curie](user:marie) ')
    expect(result.cursor).toBe(result.value.length)
  })

  it('matches dashboard user filter for authors and mentions', () => {
    const thread: CommentThread = {
      id: 'thread-1',
      targetId: 'file-1',
      status: 'open',
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-01T10:00:00.000Z',
      comments: [
        {
          id: 'comment-1',
          body: 'Needs review',
          format: 'markdown',
          author: { id: 'alice', displayName: 'Alice' },
          createdAt: '2026-07-01T10:00:00.000Z'
        },
        {
          id: 'comment-2',
          body: 'Please check @[Bob](user:bob)',
          format: 'markdown',
          author: { id: 'alice', displayName: 'Alice' },
          createdAt: '2026-07-01T11:00:00.000Z'
        }
      ]
    }

    expect(threadInvolvesUser(thread, 'alice')).toBe(true)
    expect(threadInvolvesUser(thread, 'bob')).toBe(true)
    expect(threadInvolvesUser(thread, 'charlie')).toBe(false)
  })
})
