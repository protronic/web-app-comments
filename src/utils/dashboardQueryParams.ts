import type { LocationQueryRaw } from 'vue-router'
import { COMMENT_TAG } from '../constants/tags'
import {
  CommentsDashboardQuery,
  DashboardAnsweredFilter,
  DashboardStatusFilter,
  DashboardTypeFilter,
  DashboardUserFilter
} from '../types'
import { createInitialDashboardQuery, tagsEqual } from './dashboardQueryDefaults'
import { debugLog } from './debugLog'

export const DASHBOARD_FILTER_QUERY_KEYS = [
  'status',
  'answered',
  'type',
  'user',
  'tags'
] as const

const STATUS_VALUES: DashboardStatusFilter[] = ['all', 'open', 'resolved']
const ANSWERED_VALUES: DashboardAnsweredFilter[] = ['all', 'answered', 'unanswered']
const TYPE_VALUES: DashboardTypeFilter[] = ['all', 'file', 'folder', 'space']
const USER_VALUES: DashboardUserFilter[] = ['all', 'me']

function readQueryValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined
  }

  return typeof value === 'string' ? value : undefined
}

function isStatusFilter(value: string | undefined): value is DashboardStatusFilter {
  return STATUS_VALUES.includes(value as DashboardStatusFilter)
}

function isAnsweredFilter(value: string | undefined): value is DashboardAnsweredFilter {
  return ANSWERED_VALUES.includes(value as DashboardAnsweredFilter)
}

function isTypeFilter(value: string | undefined): value is DashboardTypeFilter {
  return TYPE_VALUES.includes(value as DashboardTypeFilter)
}

function isUserFilter(value: string | undefined): value is DashboardUserFilter {
  return USER_VALUES.includes(value as DashboardUserFilter)
}

export function readDashboardFilterQuery(
  routeQuery: LocationQueryRaw | undefined | null,
  search = typeof window !== 'undefined' ? window.location.search : ''
): LocationQueryRaw {
  const normalizedRouteQuery = routeQuery ?? {}
  const merged: LocationQueryRaw = { ...normalizedRouteQuery }
  let hasRouteFilter = DASHBOARD_FILTER_QUERY_KEYS.some((key) =>
    readQueryValue(normalizedRouteQuery[key])
  )

  if (hasRouteFilter) {
    return merged
  }

  if (!search) {
    return merged
  }

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)

  for (const key of DASHBOARD_FILTER_QUERY_KEYS) {
    const value = params.get(key)

    if (value) {
      merged[key] = value
      hasRouteFilter = true
    }
  }

  // #region agent log
  debugLog(
    'dashboardQueryParams.ts:readDashboardFilterQuery',
    'resolved dashboard filter query',
    {
      routeQuery,
      search,
      merged,
      usedWindowFallback:
        hasRouteFilter &&
        !DASHBOARD_FILTER_QUERY_KEYS.some((key) => readQueryValue(normalizedRouteQuery[key]))
    },
    'URL-A'
  )
  // #endregion

  return merged
}

export function parseDashboardQueryFromRoute(
  routeQuery: LocationQueryRaw | undefined | null,
  search?: string
): CommentsDashboardQuery | null {
  const resolvedQuery = readDashboardFilterQuery(routeQuery, search)
  const status = readQueryValue(resolvedQuery.status)
  const answered = readQueryValue(resolvedQuery.answered)
  const type = readQueryValue(resolvedQuery.type)
  const user = readQueryValue(resolvedQuery.user)
  const tagsParam = readQueryValue(resolvedQuery.tags)

  if (!status && !answered && !type && !user && !tagsParam) {
    // #region agent log
    debugLog(
      'dashboardQueryParams.ts:parseDashboardQueryFromRoute',
      'no dashboard filter params found',
      { routeQuery, resolvedQuery, search },
      'URL-B'
    )
    // #endregion
    return null
  }

  const defaults = createInitialDashboardQuery()
  const parsed = {
    status: isStatusFilter(status) ? status : defaults.status,
    answered: isAnsweredFilter(answered) ? answered : defaults.answered,
    type: isTypeFilter(type) ? type : defaults.type,
    user: isUserFilter(user) ? user : defaults.user,
    tags: parseTagsParam(tagsParam) ?? defaults.tags
  }

  // #region agent log
  debugLog(
    'dashboardQueryParams.ts:parseDashboardQueryFromRoute',
    'parsed dashboard filters',
    { routeQuery, resolvedQuery, parsed },
    'URL-C'
  )
  // #endregion

  return parsed
}

export function buildDashboardRouteQuery(query: CommentsDashboardQuery | undefined): LocationQueryRaw {
  if (!query) {
    return {}
  }

  const defaults = createInitialDashboardQuery()
  const next: LocationQueryRaw = {}

  if (query.status && query.status !== defaults.status) {
    next.status = query.status
  }

  if (query.answered && query.answered !== defaults.answered) {
    next.answered = query.answered
  }

  if (query.type && query.type !== defaults.type) {
    next.type = query.type
  }

  if (query.user && query.user !== defaults.user) {
    next.user = query.user
  }

  const tags = query.tags ?? [COMMENT_TAG]

  if (!tagsEqual(tags, defaults.tags)) {
    next.tags = tags.join(',')
  }

  return next
}

export function dashboardRouteQueriesEqual(
  left: LocationQueryRaw,
  right: LocationQueryRaw
): boolean {
  const filterKeys = ['status', 'answered', 'type', 'user', 'tags'] as const

  return filterKeys.every((key) => readQueryValue(left?.[key]) === readQueryValue(right?.[key]))
}

function parseTagsParam(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined
  }

  const tags = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

  return tags.length > 0 ? tags : undefined
}
