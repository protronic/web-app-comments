import {
  buildOpenTargetLocation,
  buildPrivateLinkLocation,
  COMMENTS_SIDEBAR_PANEL,
  extractPrivateLinkFileId,
  getOpenTargetFileId,
  getOpenTargetLabel,
  getOpenTargetPath,
  openDashboardTarget,
  openDashboardTargetInEditor,
  openDashboardTargetInFiles
} from '../../src/utils/dashboardNavigation'
import { DashboardTargetSummary } from '../../src/types'
import { mock } from 'vitest-mock-extended'
import { SpaceResource } from '@opencloud-eu/web-client'
import { vi } from 'vitest'

describe('dashboard navigation helpers', () => {
  const space = mock<SpaceResource>({
    id: 'owner$space',
    driveType: 'personal',
    driveAlias: 'personal/admin',
    getDriveAliasAndItem: ({ path }) => `personal/admin${path ? `/${path.replace(/^\//, '')}` : ''}`
  })

  it('builds private link locations with the comments sidebar', () => {
    const target: DashboardTargetSummary = {
      id: 'owner$space!file-1',
      fileId: 'owner$space!file-1',
      privateLink: 'https://test.oc:9200/f/owner%24space%21file-1',
      name: 'Plan.md',
      path: '/Projects/Plan.md',
      isFolder: false,
      resourceType: 'file',
      tags: []
    }

    expect(extractPrivateLinkFileId(target.privateLink)).toBe('owner$space!file-1')
    expect(buildPrivateLinkLocation(target.privateLink)).toEqual({
      name: 'resolvePrivateLink',
      params: { fileId: 'owner$space!file-1' },
      query: { details: COMMENTS_SIDEBAR_PANEL }
    })
  })

  it('opens files in the parent folder with comments sidebar query params', () => {
    const target: DashboardTargetSummary = {
      id: 'owner$space!file-1',
      fileId: 'owner$space!file-1',
      name: 'Plan.md',
      path: '/Projects/Plan.md',
      isFolder: false,
      resourceType: 'file',
      tags: []
    }

    expect(getOpenTargetPath(space, target)).toBe('/Projects/Plan.md')
    expect(getOpenTargetFileId(space, target)).toBe('owner$space!file-1')
    expect(buildOpenTargetLocation(space, { space, target })).toEqual({
      name: 'files-spaces-generic',
      params: {
        driveAliasAndItem: 'personal/admin/Projects'
      },
      query: {
        fileId: 'owner$space!file-1',
        scrollTo: 'owner$space!file-1',
        details: COMMENTS_SIDEBAR_PANEL
      }
    })
  })

  it('opens folders by path with comments sidebar query params', () => {
    const target: DashboardTargetSummary = {
      id: 'owner$space!folder-1',
      fileId: 'owner$space!folder-1',
      name: 'Projects',
      path: '/Projects',
      isFolder: true,
      resourceType: 'folder',
      tags: []
    }

    expect(buildOpenTargetLocation(space, { space, target })).toEqual({
      name: 'files-spaces-generic',
      params: {
        driveAliasAndItem: 'personal/admin/Projects'
      },
      query: {
        scrollTo: 'owner$space!folder-1',
        details: COMMENTS_SIDEBAR_PANEL
      }
    })
  })

  it('opens folders with a space-root webdav path via the folder name', () => {
    const target: DashboardTargetSummary = {
      id: 'owner$space!folder-1',
      fileId: 'owner$space!folder-1',
      name: 'Testordner',
      path: '/',
      isFolder: true,
      resourceType: 'folder',
      tags: []
    }

    expect(getOpenTargetPath(space, target)).toBe('/Testordner')
    expect(buildOpenTargetLocation(space, { space, target })).toEqual({
      name: 'files-spaces-generic',
      params: {
        driveAliasAndItem: 'personal/admin/Testordner'
      },
      query: {
        scrollTo: 'owner$space!folder-1',
        details: COMMENTS_SIDEBAR_PANEL
      }
    })
  })

  it('opens mountpoint share folders at the mount root instead of duplicating the folder name', () => {
    const mountSpace = mock<SpaceResource>({
      id: 'mount',
      driveType: 'mountpoint',
      name: 'Share',
      driveAlias: 'mountpoint/share',
      getDriveAliasAndItem: ({ path }) =>
        `mountpoint/share${path ? `/${path.replace(/^\//, '')}` : ''}`
    })
    const target: DashboardTargetSummary = {
      id: 'owner$space!folder-1',
      fileId: 'owner$space!folder-1',
      name: 'Share',
      path: '/Share',
      isFolder: true,
      resourceType: 'folder',
      tags: []
    }

    expect(getOpenTargetPath(mountSpace, target)).toBe('')
    expect(buildOpenTargetLocation(mountSpace, { space: mountSpace, target })).toEqual({
      name: 'files-spaces-generic',
      params: {
        driveAliasAndItem: 'mountpoint/share'
      },
      query: {
        fileId: 'owner$space!folder-1',
        scrollTo: 'owner$space!folder-1',
        details: COMMENTS_SIDEBAR_PANEL
      }
    })
  })

  it('opens folders via space path navigation even when a private link is present', () => {
    const target: DashboardTargetSummary = {
      id: 'owner$space!folder-1',
      fileId: 'owner$space!folder-1',
      privateLink: 'https://test.oc:9200/f/owner%24space%21folder-1',
      name: 'Projects',
      path: '/Projects',
      isFolder: true,
      resourceType: 'folder',
      tags: []
    }

    expect(buildOpenTargetLocation(space, { space, target })).toEqual({
      name: 'files-spaces-generic',
      params: {
        driveAliasAndItem: 'personal/admin/Projects'
      },
      query: {
        scrollTo: 'owner$space!folder-1',
        details: COMMENTS_SIDEBAR_PANEL
      }
    })
  })

  it('opens project spaces inside the drive instead of the spaces overview', () => {
    const spaceId = '1e53dbf6-f9a8-4bb1-ba12-4a8209682afa$b0e5bd75-d31a-4198-ab43-ba645d1870f4'
    const projectSpace = mock<SpaceResource>({
      id: spaceId,
      driveType: 'project',
      driveAlias: 'project/demo',
      fileId: `${spaceId}!b0e5bd75-d31a-4198-ab43-ba645d1870f4`,
      getDriveAliasAndItem: ({ path }) => `project/demo${path ? `/${path.replace(/^\//, '')}` : ''}`
    })
    const target: DashboardTargetSummary = {
      id: spaceId,
      fileId: `${spaceId}!b0e5bd75-d31a-4198-ab43-ba645d1870f4`,
      name: 'Demo',
      path: '/',
      isFolder: true,
      resourceType: 'space',
      tags: []
    }

    expect(buildOpenTargetLocation(projectSpace, { space: projectSpace, target })).toEqual({
      name: 'files-spaces-generic',
      params: {
        driveAliasAndItem: 'project/demo'
      },
      query: {
        details: COMMENTS_SIDEBAR_PANEL,
        fileId: `${spaceId}!b0e5bd75-d31a-4198-ab43-ba645d1870f4`,
        scrollTo: `${spaceId}!b0e5bd75-d31a-4198-ab43-ba645d1870f4`
      }
    })
  })

  it('opens personal spaces with space-root fileId and scrollTo like folders', () => {
    const spaceId = '1e53dbf6-f9a8-4bb1-ba12-4a8209682afa$4d4cc1c3-6811-4cbc-89b6-d3bae478679f'
    const personalSpace = mock<SpaceResource>({
      id: spaceId,
      driveType: 'personal',
      driveAlias: 'personal/admin',
      fileId: `${spaceId}!b70c6f75-4c08-45ba-a7d1-0f3d1204acbb`,
      getDriveAliasAndItem: ({ path }) => `personal/admin${path ? `/${path.replace(/^\//, '')}` : ''}`
    })
    const target: DashboardTargetSummary = {
      id: spaceId,
      fileId: `${spaceId}!b70c6f75-4c08-45ba-a7d1-0f3d1204acbb`,
      name: 'Admin',
      path: '/',
      isFolder: true,
      resourceType: 'space',
      tags: []
    }

    expect(buildOpenTargetLocation(personalSpace, { space: personalSpace, target })).toEqual({
      name: 'files-spaces-generic',
      params: {
        driveAliasAndItem: 'personal/admin'
      },
      query: {
        details: COMMENTS_SIDEBAR_PANEL,
        fileId: `${spaceId}!b70c6f75-4c08-45ba-a7d1-0f3d1204acbb`,
        scrollTo: `${spaceId}!b70c6f75-4c08-45ba-a7d1-0f3d1204acbb`
      }
    })
  })

  it('opens spaces at the space root with comments sidebar', () => {
    const projectSpace = mock<SpaceResource>({
      id: 'owner$space',
      driveType: 'project',
      driveAlias: 'project/demo',
      privateLink: 'https://test.oc:9200/f/owner%24space',
      getDriveAliasAndItem: ({ path }) => `project/demo${path ? `/${path.replace(/^\//, '')}` : ''}`
    })
    const target: DashboardTargetSummary = {
      id: 'owner$space',
      fileId: 'owner$space',
      privateLink: 'https://test.oc:9200/f/owner%24space',
      name: 'Demo',
      path: '/',
      isFolder: true,
      resourceType: 'space',
      tags: []
    }

    expect(buildOpenTargetLocation(projectSpace, { space: projectSpace, target })).toEqual({
      name: 'files-spaces-generic',
      params: {
        driveAliasAndItem: 'project/demo'
      },
      query: {
        details: COMMENTS_SIDEBAR_PANEL,
        fileId: 'owner$space!space',
        scrollTo: 'owner$space!space'
      }
    })
  })

  it('opens files via default action when available', () => {
    const push = vi.fn()
    const triggerDefaultAction = vi.fn()
    const target: DashboardTargetSummary = {
      id: 'owner$space!file-1',
      fileId: 'owner$space!file-1',
      name: 'Plan.md',
      path: '/Projects/Plan.md',
      isFolder: false,
      resourceType: 'file',
      tags: []
    }
    const fileActions = {
      getDefaultAction: vi.fn(() => ({ name: 'editor-text-editor' })),
      triggerDefaultAction
    }

    openDashboardTarget(space, { space, target }, { push } as never, fileActions)

    expect(triggerDefaultAction).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('opens files in the files app when no default file action is available', () => {
    const push = vi.fn()
    const target: DashboardTargetSummary = {
      id: 'owner$space!file-1',
      fileId: 'owner$space!file-1',
      privateLink: 'https://test.oc:9200/f/owner%24space%21file-1',
      name: 'Plan.md',
      path: '/Projects/Plan.md',
      isFolder: false,
      resourceType: 'file',
      tags: []
    }
    const fileActions = {
      getDefaultAction: vi.fn(() => undefined),
      triggerDefaultAction: vi.fn()
    }

    openDashboardTarget(space, { space, target }, { push } as never, fileActions)

    expect(push).toHaveBeenCalledWith({
      name: 'files-spaces-generic',
      params: {
        driveAliasAndItem: 'personal/admin/Projects'
      },
      query: {
        fileId: 'owner$space!file-1',
        scrollTo: 'owner$space!file-1',
        details: COMMENTS_SIDEBAR_PANEL
      }
    })
  })

  it('opens files via triggerDefaultAction for Datei öffnen', () => {
    const push = vi.fn()
    const triggerDefaultAction = vi.fn()
    const target: DashboardTargetSummary = {
      id: 'owner$space!file-1',
      fileId: 'owner$space!file-1',
      name: 'Neue Datei.odg',
      path: '/Neue Datei.odg',
      isFolder: false,
      resourceType: 'file',
      extension: 'odg',
      tags: []
    }
    const fileActions = {
      getDefaultAction: vi.fn(() => ({ name: 'editor-draw-io' })),
      triggerDefaultAction
    }

    const opened = openDashboardTargetInEditor(
      space,
      { space, target },
      { push } as never,
      fileActions,
      () => {
        triggerDefaultAction()
        return true
      }
    )

    expect(opened).toBe(true)
    expect(triggerDefaultAction).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('opens folders and spaces via the files view helper', () => {
    const push = vi.fn()
    const target: DashboardTargetSummary = {
      id: 'owner$space!folder-1',
      fileId: 'owner$space!folder-1',
      name: 'Projects',
      path: '/Projects',
      isFolder: true,
      resourceType: 'folder',
      tags: []
    }

    openDashboardTargetInFiles(space, { space, target }, { push } as never)

    expect(push).toHaveBeenCalledWith({
      name: 'files-spaces-generic',
      params: {
        driveAliasAndItem: 'personal/admin/Projects'
      },
      query: {
        scrollTo: 'owner$space!folder-1',
        details: COMMENTS_SIDEBAR_PANEL
      }
    })
  })

  it('returns open labels by resource type', () => {
    const translate = (message: string) => message

    expect(
      getOpenTargetLabel(translate, {
        id: '1',
        name: 'Space',
        path: '/',
        isFolder: true,
        resourceType: 'space',
        tags: []
      })
    ).toBe('Open space')
  })
})
