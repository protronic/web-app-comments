import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { mock } from 'vitest-mock-extended'
import { findSpaceForSearchResource } from '../../src/utils/dashboardSearch'

describe('findSpaceForSearchResource', () => {
  const personalSpace = mock<SpaceResource>({
    id: 'owner$personal',
    driveType: 'personal'
  })

  const projectSpace = mock<SpaceResource>({
    id: 'owner$project',
    driveType: 'project'
  })

  const spaces = [personalSpace, projectSpace]

  it('matches resources by storage id', () => {
    const resource = mock<Resource>({
      storageId: 'owner$project',
      fileId: 'owner$project!item-1',
      path: '/Docs/plan.md'
    })

    expect(findSpaceForSearchResource(spaces, resource)?.id).toBe('owner$project')
  })

  it('matches resources by file id prefix', () => {
    const resource = mock<Resource>({
      fileId: 'owner$personal!item-2',
      path: '/Notes.md'
    })

    expect(findSpaceForSearchResource(spaces, resource)?.id).toBe('owner$personal')
  })
})
