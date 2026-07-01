import { COMMENT_TAG } from '../../src/constants/tags'
import { buildTagSearchPattern } from '../../src/utils/commentTags'

describe('comment tag helpers', () => {
  it('builds a single-tag search pattern', () => {
    expect(buildTagSearchPattern([COMMENT_TAG])).toBe('tag:Kommentiert')
  })

  it('builds an AND search pattern for multiple tags', () => {
    expect(buildTagSearchPattern(['md', COMMENT_TAG])).toBe('tag:md AND tag:Kommentiert')
  })

  it('defaults to the commented tag when no tags are selected', () => {
    expect(buildTagSearchPattern([])).toBe('tag:Kommentiert')
  })
})
