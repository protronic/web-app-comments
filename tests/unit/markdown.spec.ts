import { renderCommentMarkdown } from '../../src/utils/markdown'

describe('comment markdown rendering', () => {
  it('renders a small safe markdown subset', () => {
    expect(renderCommentMarkdown('Hello **team** and `code`')).toBe(
      'Hello <strong>team</strong> and <code>code</code>'
    )
  })

  it('escapes html before rendering markdown', () => {
    expect(renderCommentMarkdown('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;'
    )
  })

  it('renders only http links', () => {
    expect(renderCommentMarkdown('[OpenCloud](https://opencloud.eu)')).toBe(
      '<a href="https://opencloud.eu" target="_blank" rel="noopener noreferrer">OpenCloud</a>'
    )
    expect(renderCommentMarkdown('[bad](javascript:alert(1))')).toBe(
      '[bad](javascript:alert(1))'
    )
  })
})
