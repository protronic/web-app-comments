import { beforeEach, vi } from 'vitest'
import { SpaceResource } from '@opencloud-eu/web-client'
import { mock } from 'vitest-mock-extended'
import {
  buildCommentDashboardLocation,
  presentMentionNotifications,
  presentPolledMentionEntries
} from '../../src/utils/mentionNotificationPresenter'
import { openDashboardTargetInEditor, openDashboardTargetInFiles } from '../../src/utils/dashboardNavigation'
import { CommentDocument } from '../../src/types'

describe('mention notification presenter', () => {
  const document: CommentDocument = {
    version: 1,
    target: {
      id: 'file-1',
      name: 'Neue Datei.txt',
      path: '/Neue Datei.txt',
      isFolder: false
    },
    threads: [
      {
        id: 'thread-1',
        targetId: 'file-1',
        status: 'open',
        createdAt: '2026-07-01T10:00:00.000Z',
        updatedAt: '2026-07-01T10:00:00.000Z',
        comments: [
          {
            id: 'comment-1',
            body: 'Please review @[Dennis Ritchie](user:dennis)',
            format: 'markdown',
            author: { id: 'admin', displayName: 'Admin' },
            createdAt: '2026-07-01T10:00:00.000Z'
          }
        ]
      }
    ]
  }

  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('builds the comment dashboard route location', () => {
    expect(buildCommentDashboardLocation()).toEqual({ name: 'comments-dashboard' })
  })

  it('shows one toast with dashboard and resource actions', () => {
    const push = vi.fn()
    const showMessage = vi.fn()
    const space = mock<SpaceResource>({
      id: 'mount',
      driveType: 'mountpoint',
      name: 'Share',
      driveAlias: 'mount/Share',
      getDriveAliasAndItem: ({ path }) => `mount/Share${path ? `/${path.replace(/^\//, '')}` : ''}`
    })

    presentMentionNotifications(
      {
        showMessage,
        translate: (message) => message,
        router: { push } as never,
        openTargetInFiles: (space, entry) =>
          openDashboardTargetInFiles(space, entry, { push } as never),
        openTargetInEditor: (space, entry) =>
          openDashboardTargetInEditor(space, entry, { push } as never, {
            getDefaultAction: () => ({ name: 'editor-text-editor' }),
            triggerDefaultAction: vi.fn()
          }),
        getEditorOpenLabel: () => 'Open file',
        getFilesViewLabel: () => 'Show in files'
      },
      space,
      document,
      ['dennis'],
      'sse',
      {
        space: {
          id: 'mount',
          name: 'Share',
          driveAlias: 'mount/Share',
          driveType: 'mountpoint'
        },
        target: {
          id: 'owner$space!file-1',
          fileId: 'owner$space!file-1',
          privateLink: 'https://test.oc:9200/f/owner%24space%21file-1',
          name: 'Neue Datei.txt',
          path: '/Neue Datei.txt',
          isFolder: false,
          resourceType: 'file',
          tags: []
        }
      }
    )

    expect(showMessage).toHaveBeenCalledTimes(1)
    const toast = showMessage.mock.calls[0]?.[0]
    expect(toast?.actions?.map((action: { name: string }) => action.name)).toEqual([
      'open-comment-dashboard',
      'open-mentioned-resource-files',
      'open-mentioned-resource-editor'
    ])
    toast?.actions?.[0]?.handler()
    expect(push).toHaveBeenCalledWith({ name: 'comments-dashboard' })
  })

  it('shows one toast for duplicate poll entries', () => {
    const showMessage = vi.fn()
    const space = mock<SpaceResource>({ id: 'mount', driveType: 'mountpoint', name: 'Share' })
    const entry = {
      space: { id: 'mount', name: 'Share', driveAlias: 'mount/Share', driveType: 'mountpoint' as const },
      target: {
        id: 'file-1',
        name: 'Neue Datei.txt',
        path: '/Neue Datei.txt',
        isFolder: false,
        resourceType: 'file' as const,
        tags: []
      },
      thread: document.threads[0]
    }

    presentPolledMentionEntries(
      {
        showMessage,
        translate: (message) => message,
        router: { push: vi.fn() } as never,
        openTargetInFiles: (space, entry) =>
          openDashboardTargetInFiles(space, entry, { push: vi.fn() } as never)
      },
      [
        { space, entry },
        { space, entry },
        { space, entry }
      ],
      ['dennis'],
      'poll'
    )

    expect(showMessage).toHaveBeenCalledTimes(1)
  })
})
