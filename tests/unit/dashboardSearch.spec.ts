import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { mock } from 'vitest-mock-extended'
import {
  findMountpointForStorageId,
  findSpaceForSearchResource,
  rankMountpointCandidates
} from '../../src/utils/dashboardSearch'

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

  it('matches resources via mountpoint spaces for shared storage', () => {
    const mountpointSpace = mock<SpaceResource>({
      id: 'virtual$virtual!owner:remote-space:mount-1',
      driveType: 'mountpoint',
      name: 'Share'
    })
    const resource = mock<Resource>({
      storageId: 'owner$remote-space',
      fileId: 'owner$remote-space!item-1',
      path: '/Testfiel.txt'
    })

    expect(
      findSpaceForSearchResource([personalSpace, mountpointSpace], resource)?.id
    ).toBe(mountpointSpace.id)
  })

  it('prefers folder mountpoints over file and sidecar mounts for the same storage', () => {
    const shareMount = mock<SpaceResource>({
      id: 'virtual$virtual!owner:remote-space:share-mount',
      driveType: 'mountpoint',
      name: 'Share'
    })
    const fileMount = mock<SpaceResource>({
      id: 'virtual$virtual!owner:remote-space:file-mount',
      driveType: 'mountpoint',
      name: 'neu.txt'
    })
    const sidecarMount = mock<SpaceResource>({
      id: 'virtual$virtual!owner:remote-space:sidecar-mount',
      driveType: 'mountpoint',
      name: '.neu.txt.jsco'
    })
    const resource = mock<Resource>({
      storageId: 'owner$remote-space',
      fileId: 'owner$remote-space!item-1',
      name: 'Neue Datei.txt',
      path: '/Neue Datei.txt'
    })

    expect(
      findMountpointForStorageId(
        [fileMount, sidecarMount, shareMount],
        'owner$remote-space',
        resource
      )?.name
    ).toBe('Share')
    expect(rankMountpointCandidates([fileMount, sidecarMount, shareMount], resource)[0].name).toBe(
      'Share'
    )
  })
})
