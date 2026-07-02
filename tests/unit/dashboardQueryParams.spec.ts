import {
  buildDashboardRouteQuery,
  dashboardRouteQueriesEqual,
  parseDashboardQueryFromRoute,
  readDashboardFilterQuery
} from '../../src/utils/dashboardQueryParams'
import { createInitialDashboardQuery } from '../../src/utils/dashboardQueryDefaults'

describe('dashboard query params', () => {
  it('parses filter values from the route query', () => {
    expect(
      parseDashboardQueryFromRoute({
        status: 'resolved',
        answered: 'unanswered',
        type: 'file',
        user: 'all',
        tags: 'Kommentiert,Review'
      })
    ).toEqual({
      status: 'resolved',
      answered: 'unanswered',
      type: 'file',
      user: 'all',
      tags: ['Kommentiert', 'Review']
    })
  })

  it('returns null when no dashboard filter params are present', () => {
    expect(parseDashboardQueryFromRoute({})).toBeNull()
    expect(parseDashboardQueryFromRoute({ details: 'comments' })).toBeNull()
  })

  it('builds route query params only for non-default filter values', () => {
    expect(buildDashboardRouteQuery(createInitialDashboardQuery())).toEqual({})
    expect(
      buildDashboardRouteQuery({
        status: 'resolved',
        answered: 'all',
        type: 'space',
        user: 'me',
        tags: ['Kommentiert']
      })
    ).toEqual({
      status: 'resolved',
      answered: 'all',
      type: 'space'
    })
  })

  it('handles undefined route.query and falls back to window search', () => {
    expect(parseDashboardQueryFromRoute(undefined, '?status=all&user=all')).toEqual({
      status: 'all',
      answered: 'answered',
      type: 'all',
      user: 'all',
      tags: ['Kommentiert']
    })
    expect(parseDashboardQueryFromRoute(undefined, '?status=all&answered=all&user=all')).toEqual({
      status: 'all',
      answered: 'all',
      type: 'all',
      user: 'all',
      tags: ['Kommentiert']
    })
    expect(readDashboardFilterQuery(undefined, '?type=space')).toEqual({ type: 'space' })
  })

  it('falls back to window search when route.query is empty', () => {
    expect(
      parseDashboardQueryFromRoute({}, '?type=space&status=resolved')
    ).toEqual({
      status: 'resolved',
      answered: 'answered',
      type: 'space',
      user: 'me',
      tags: ['Kommentiert']
    })
    expect(readDashboardFilterQuery({}, '?user=all&type=file')).toEqual({
      user: 'all',
      type: 'file'
    })
  })

  it('compares route queries by dashboard filter keys', () => {
    expect(
      dashboardRouteQueriesEqual(
        { status: 'open', answered: 'answered', user: 'me' },
        { status: 'open', answered: 'answered', user: 'me', details: 'comments' }
      )
    ).toBe(true)
    expect(
      dashboardRouteQueriesEqual(
        { status: 'open' },
        { status: 'resolved' }
      )
    ).toBe(false)
  })
})
