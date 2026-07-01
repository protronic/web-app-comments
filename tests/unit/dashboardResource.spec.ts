import { mock } from 'vitest-mock-extended'
import { SpaceResource } from '@opencloud-eu/web-client'
import { buildDashboardResource, getExtensionFromTarget } from '../../src/utils/dashboardResource'
import { DashboardTargetSummary } from '../../src/types'

describe('dashboard resource helpers', () => {
  const space = mock<SpaceResource>({ id: 'owner$space' })

  it('builds a resource with extension and mime type for app routing', () => {
    const target: DashboardTargetSummary = {
      id: 'owner$space!file-1',
      fileId: 'owner$space!file-1',
      name: 'part.stl',
      path: '/Models/part.stl',
      extension: 'stl',
      mimeType: 'model/stl',
      isFolder: false,
      resourceType: 'file',
      tags: []
    }

    expect(buildDashboardResource(space, target)).toMatchObject({
      fileId: 'owner$space!file-1',
      storageId: 'owner$space',
      path: '/Models/part.stl',
      name: 'part.stl',
      extension: 'stl',
      mimeType: 'model/stl',
      isFolder: false,
      type: 'file'
    })
  })

  it('derives extension from the file name when missing', () => {
    expect(
      getExtensionFromTarget({
        name: 'Plan.md',
        path: '/Projects/Plan.md'
      })
    ).toBe('md')
  })
})
