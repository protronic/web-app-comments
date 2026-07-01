import { Resource, SpaceResource } from '@opencloud-eu/web-client'
import { mock } from 'vitest-mock-extended'
import { findMountpointForStorageId } from '../../src/utils/dashboardSearch'
import { pickSpaceForResource } from '../../src/utils/commentNotificationSpaces'

describe('comment notification spaces', () => {
  it('finds mountpoint spaces for shared storage ids', () => {
    const mountpoint = mock<SpaceResource>({
      id: 'virtual$virtual!owner:remote-space:mount-1',
      driveType: 'mountpoint'
    })

    expect(findMountpointForStorageId([mountpoint], 'owner$remote-space')?.id).toBe(mountpoint.id)
  })

  it('prefers mountpoints when resolving tagged resources from another drive', () => {
    const personal = mock<SpaceResource>({
      id: 'owner$personal',
      driveType: 'personal'
    })
    const mountpoint = mock<SpaceResource>({
      id: 'virtual$virtual!owner:remote-space:mount-1',
      driveType: 'mountpoint'
    })
    const resource = mock<Resource>({
      storageId: 'owner$remote-space',
      fileId: 'owner$remote-space!item-1',
      path: '/Testfiel.txt',
      name: 'Testfiel.txt'
    })

    expect(
      pickSpaceForResource([personal, mountpoint], resource, 'owner$remote-space')?.id
    ).toBe(mountpoint.id)
  })
})
