import { describe, expect, it, vi } from 'vitest'
import {
  COMMENT_SSE_EVENT_TYPES,
  resetCommentSseHubForTests,
  subscribeCommentSse,
  type CommentSseSource
} from '../../src/utils/commentSseHub'

describe('comment SSE hub', () => {
  it('registers one listener per event type and dispatches to subscribers', () => {
    const source: CommentSseSource = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }

    const first = vi.fn()
    const second = vi.fn()

    const unsubscribeFirst = subscribeCommentSse(source, first)
    subscribeCommentSse(source, second)

    expect(source.addEventListener).toHaveBeenCalledTimes(COMMENT_SSE_EVENT_TYPES.length)

    const fileTouchedHandler = vi
      .mocked(source.addEventListener)
      .mock.calls.find(([eventType]) => eventType === COMMENT_SSE_EVENT_TYPES[0])?.[1]

    expect(fileTouchedHandler).toBeTypeOf('function')

    const message = new MessageEvent('message', { data: '{"itemid":"1"}' })
    fileTouchedHandler?.(message)

    expect(first).toHaveBeenCalledWith(COMMENT_SSE_EVENT_TYPES[0], message)
    expect(second).toHaveBeenCalledWith(COMMENT_SSE_EVENT_TYPES[0], message)

    unsubscribeFirst()
    resetCommentSseHubForTests()
  })

  it('unbinds from the source when the last subscriber leaves', () => {
    const source: CommentSseSource = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }

    const unsubscribe = subscribeCommentSse(source, vi.fn())
    unsubscribe()

    expect(source.removeEventListener).toHaveBeenCalledTimes(COMMENT_SSE_EVENT_TYPES.length)
    resetCommentSseHubForTests()
  })
})
