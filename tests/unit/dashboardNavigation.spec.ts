import {
  buildOpenTargetLocation,
  buildPrivateLinkLocation,
  extractPrivateLinkFileId,
  getOpenTargetFileId,
  getOpenTargetLabel,
  getOpenTargetPath,
  openDashboardTarget
} from '../../src/utils/dashboardNavigation'
import { DashboardTargetSummary } from '../../src/types'
import { mock } from 'vitest-mock-extended'
import { SpaceResource } from '@opencloud-eu/web-client'

describe('dashboard navigation helpers', () => {
  const space = mock<SpaceResource>({
    id: 'owner$space',
    driveType: 'personal',
    driveAlias: 'personal/admin',
    getDriveAliasAndItem: ({ path }) => `personal/admin${path ? `/${path.replace(/^\//, '')}` : ''}`
  })

  it('prefers graph/web private links over path navigation', () => {
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
      params: { fileId: 'owner$space!file-1' }
    })
    expect(buildOpenTargetLocation(space, { space, target })).toEqual({
      name: 'resolvePrivateLink',
      params: { fileId: 'owner$space!file-1' }
    })
  })

  it('adds fileId query when opening a file without private link', () => {
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
    expect(getOpenTargetFileId(target)).toBe('owner$space!file-1')
    expect(buildOpenTargetLocation(space, { space, target })).toEqual({
      name: 'files-spaces-generic',
      params: {
        driveAliasAndItem: 'personal/admin/Projects/Plan.md'
      },
      query: {
        fileId: 'owner$space!file-1'
      }
    })
  })

  it('adds fileId query when opening a folder with a graph id', () => {
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
        fileId: 'owner$space!folder-1'
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
        fileId: 'owner$space!folder-1'
      }
    })
  })

  it('opens files via private link when no default file action is available', () => {
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

    openDashboardTarget(space, { space, target }, { push } as never)

    expect(push).toHaveBeenCalledWith({
      name: 'resolvePrivateLink',
      params: { fileId: 'owner$space!file-1' }
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
