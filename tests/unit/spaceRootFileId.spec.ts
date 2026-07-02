import { mock } from 'vitest-mock-extended'
import { SpaceResource } from '@opencloud-eu/web-client'
import {
  deriveSpaceNavigationFileId,
  deriveSpaceRootFileId,
  deriveSpaceRootFileIdFromSpaceId,
  deriveSpaceScrollToFileId
} from '../../src/utils/spaceRootFileId'

describe('space root file id helpers', () => {
  it('derives the drive item id from a storage id', () => {
    const spaceId =
      '1e53dbf6-f9a8-4bb1-ba12-4a8209682afa$4d4cc1c3-6811-4cbc-89b6-d3bae478679f'

    expect(deriveSpaceRootFileIdFromSpaceId(spaceId)).toBe(
      '1e53dbf6-f9a8-4bb1-ba12-4a8209682afa$4d4cc1c3-6811-4cbc-89b6-d3bae478679f!4d4cc1c3-6811-4cbc-89b6-d3bae478679f'
    )
  })

  it('prefers an existing graph file id from the space root', () => {
    const space = mock<SpaceResource>({
      id: 'owner$space',
      fileId: 'owner$space!space-root'
    })

    expect(deriveSpaceRootFileId(space)).toBe('owner$space!space-root')
  })

  it('derives a graph file id when only the storage id is known', () => {
    const space = mock<SpaceResource>({
      id: 'owner$space'
    })

    expect(deriveSpaceRootFileId(space)).toBe('owner$space!space')
  })

  it('uses the storage segment for navigation fileId and the space root item for scrollTo', () => {
    const spaceId =
      '1e53dbf6-f9a8-4bb1-ba12-4a8209682afa$4d4cc1c3-6811-4cbc-89b6-d3bae478679f'
    const space = mock<SpaceResource>({
      id: spaceId,
      fileId: `${spaceId}!b70c6f75-4c08-45ba-a7d1-0f3d1204acbb`
    })

    expect(deriveSpaceNavigationFileId(space)).toBe(`${spaceId}!4d4cc1c3-6811-4cbc-89b6-d3bae478679f`)
    expect(deriveSpaceScrollToFileId(space)).toBe(`${spaceId}!b70c6f75-4c08-45ba-a7d1-0f3d1204acbb`)
    expect(deriveSpaceRootFileId(space)).toBe(`${spaceId}!b70c6f75-4c08-45ba-a7d1-0f3d1204acbb`)
  })
})
