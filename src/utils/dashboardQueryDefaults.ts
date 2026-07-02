import { COMMENT_TAG } from '../constants/tags'
import { CommentsDashboardQuery } from '../types'

export function createDefaultDashboardQuery(): CommentsDashboardQuery {
  return {
    status: 'all',
    answered: 'all',
    type: 'all',
    user: 'all',
    tags: [COMMENT_TAG]
  }
}

export function createInitialDashboardQuery(): CommentsDashboardQuery {
  return {
    status: 'open',
    answered: 'answered',
    type: 'all',
    user: 'me',
    tags: [COMMENT_TAG]
  }
}

export function hasActiveDashboardFilters(query: CommentsDashboardQuery | undefined): boolean {
  if (!query) {
    return false
  }

  const defaults = createDefaultDashboardQuery()

  return (
    query.status !== defaults.status ||
    query.answered !== defaults.answered ||
    query.type !== defaults.type ||
    query.user !== defaults.user ||
    !tagsEqual(query.tags, defaults.tags)
  )
}

export function tagsEqual(left: string[] | undefined, right: string[] | undefined): boolean {
  const a = [...(left ?? [])].sort()
  const b = [...(right ?? [])].sort()

  return a.length === b.length && a.every((tag, index) => tag === b[index])
}
