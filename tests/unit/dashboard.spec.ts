import { mock } from 'vitest-mock-extended'
import { SpaceResource } from '@opencloud-eu/web-client'
import {
  createDefaultDashboardQuery,
  createInitialDashboardQuery,
  hasActiveDashboardFilters
} from '../../src/composables/useCommentsDashboard'
import { COMMENT_TAG } from '../../src/constants/tags'
import {
  buildDashboardEntry,
  enrichDashboardTarget,
  filterDashboardEntries,
  isThreadAnswered,
  queryDashboardEntries
} from '../../src/utils/dashboard'
import { CommentDocument, CommentThread, DashboardTargetSummary } from '../../src/types'

describe('comments dashboard api helpers', () => {
  const space = mock<SpaceResource>({
    id: 'space-1',
    name: 'Marketing',
    driveAlias: 's/marketing',
    driveType: 'project'
  })

  const target: DashboardTargetSummary = {
    id: 'file-1',
    name: 'Plan.md',
    path: '/projects/plan.md',
    isFolder: false,
    resourceType: 'file',
    mimeType: 'text/markdown',
    tags: ['review']
  }

  const document: CommentDocument = {
    version: 1,
    target: {
      id: target.id,
      name: target.name,
      path: target.path,
      isFolder: target.isFolder
    },
    threads: [
      {
        id: 'thread-open-unanswered',
        targetId: 'file-1',
        status: 'open',
        createdAt: '2026-06-28T10:00:00.000Z',
        updatedAt: '2026-06-28T10:00:00.000Z',
        comments: [
          {
            id: 'comment-1',
            body: 'Needs review',
            format: 'markdown',
            author: { id: 'alice', displayName: 'Alice' },
            createdAt: '2026-06-28T10:00:00.000Z'
          }
        ]
      },
      {
        id: 'thread-open-answered',
        targetId: 'file-1',
        status: 'open',
        createdAt: '2026-06-28T11:00:00.000Z',
        updatedAt: '2026-06-28T12:00:00.000Z',
        comments: [
          {
            id: 'comment-2',
            body: 'Question',
            format: 'markdown',
            author: { id: 'alice', displayName: 'Alice' },
            createdAt: '2026-06-28T11:00:00.000Z'
          },
          {
            id: 'comment-3',
            body: 'Answer',
            format: 'markdown',
            author: { id: 'bob', displayName: 'Bob' },
            createdAt: '2026-06-28T12:00:00.000Z'
          }
        ]
      },
      {
        id: 'thread-resolved',
        targetId: 'file-1',
        status: 'resolved',
        createdAt: '2026-06-27T09:00:00.000Z',
        updatedAt: '2026-06-27T15:00:00.000Z',
        comments: [
          {
            id: 'comment-4',
            body: 'Done',
            format: 'markdown',
            author: { id: 'alice', displayName: 'Alice' },
            createdAt: '2026-06-27T09:00:00.000Z'
          }
        ]
      }
    ]
  }

  it('detects answered threads by reply count', () => {
    expect(isThreadAnswered(document.threads[0])).toBe(false)
    expect(isThreadAnswered(document.threads[1])).toBe(true)
  })

  it('builds dashboard entries with space and reply metadata', () => {
    const entry = buildDashboardEntry(space, document.threads[1], target)

    expect(entry.space.name).toBe('Marketing')
    expect(entry.replyCount).toBe(1)
    expect(entry.isAnswered).toBe(true)
    expect(entry.lastReply?.author.displayName).toBe('Bob')
    expect(entry.lastReply?.preview).toBe('Answer')
    expect(entry.target.tags).toEqual(['review'])
  })

  it('uses the current space name for space-root comment targets', () => {
    const projectSpace = mock<SpaceResource>({
      id: 'space-root',
      name: 'Renamed space',
      driveAlias: 'project/renamed-space',
      driveType: 'project'
    })

    const enriched = enrichDashboardTarget(projectSpace, {
      id: 'space-root',
      name: 'Old space',
      path: '/',
      isFolder: true,
      resourceType: 'space',
      tags: []
    })

    expect(enriched.name).toBe('Renamed space')
    expect(enriched.path).toBe('/')
    expect(enriched.resourceType).toBe('space')
  })

  it('keeps folder names when webdav reports the space root path', () => {
    const personalSpace = mock<SpaceResource>({
      id: 'space-root',
      name: 'Admin',
      driveAlias: 'personal/admin',
      driveType: 'personal'
    })

    const enriched = enrichDashboardTarget(personalSpace, {
      id: 'folder-1',
      name: 'Testordner',
      path: '/',
      isFolder: true,
      resourceType: 'folder',
      tags: []
    })

    expect(enriched.name).toBe('Testordner')
    expect(enriched.path).toBe('/')
  })

  it('derives folder names from the path when the name is missing', () => {
    const enriched = enrichDashboardTarget(mock<SpaceResource>(), {
      id: 'folder-1',
      name: '',
      path: '/Projects/Demo',
      isFolder: true,
      resourceType: 'folder',
      tags: []
    })

    expect(enriched.name).toBe('Demo')
  })

  it('filters open and unanswered threads', () => {
    const entries = document.threads.map((thread) => buildDashboardEntry(space, thread, target))
    const filtered = filterDashboardEntries(entries, {
      status: 'open',
      answered: 'unanswered'
    })

    expect(filtered.map((entry) => entry.thread.id)).toEqual(['thread-open-unanswered'])
  })

  it('filters threads by current user involvement and mentions', () => {
    const entries = document.threads.map((thread) => buildDashboardEntry(space, thread, target))
    const mentionedThread = buildDashboardEntry(space, {
      ...document.threads[0],
      id: 'thread-mentioned',
      comments: [
        {
          id: 'comment-mentioned',
          body: 'Please review @[Alice](user:alice)',
          format: 'markdown',
          author: { id: 'bob', displayName: 'Bob' },
          createdAt: '2026-06-28T10:00:00.000Z'
        }
      ]
    }, target)

    const filtered = filterDashboardEntries([...entries, mentionedThread], {
      user: 'me',
      userIds: ['alice']
    })

    expect(filtered.map((entry) => entry.thread.id)).toEqual([
      'thread-open-unanswered',
      'thread-open-answered',
      'thread-resolved',
      'thread-mentioned'
    ])
  })

  it('filters by resource type and tag from opencloud metadata', () => {
    const entries = [
      buildDashboardEntry(space, document.threads[0], target),
      buildDashboardEntry(
        space,
        document.threads[0],
        {
          ...target,
          id: 'folder-1',
          name: 'Specs',
          path: '/Specs',
          isFolder: true,
          resourceType: 'folder',
          mimeType: undefined,
          tags: []
        }
      ),
      buildDashboardEntry(
        space,
        document.threads[0],
        {
          id: 'space-root',
          name: 'Marketing',
          path: '/',
          isFolder: true,
          resourceType: 'space',
          tags: []
        }
      )
    ]

    expect(filterDashboardEntries(entries, { type: 'folder' })).toHaveLength(1)
    expect(filterDashboardEntries(entries, { type: 'space' })).toHaveLength(1)
    expect(filterDashboardEntries(entries, { tags: ['review'] })).toHaveLength(1)
  })

  it('applies pagination after filtering and sorting', () => {
    const entries = document.threads.map((thread: CommentThread) =>
      buildDashboardEntry(space, thread, target)
    )
    const result = queryDashboardEntries(entries, {
      status: 'open',
      limit: 1,
      offset: 0
    })

    expect(result.total).toBe(2)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].thread.id).toBe('thread-open-answered')
  })
})

describe('dashboard filter defaults', () => {
  it('detects active filters against the reset defaults', () => {
    expect(hasActiveDashboardFilters(createDefaultDashboardQuery())).toBe(false)
    expect(hasActiveDashboardFilters(createInitialDashboardQuery())).toBe(true)
  })

  it('resets to permissive defaults while keeping the commented tag', () => {
    expect(createDefaultDashboardQuery()).toEqual({
      status: 'all',
      answered: 'all',
      type: 'all',
      user: 'all',
      tags: [COMMENT_TAG]
    })
  })
})
