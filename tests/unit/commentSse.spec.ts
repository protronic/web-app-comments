import { Resource, ShareTypes, SpaceResource } from '@opencloud-eu/web-client'
import { mock } from 'vitest-mock-extended'
import { createCommentTarget } from '../../src/utils/target'
import {
  collectCommentTargetFileIds,
  countActiveComments,
  fileIdsReferToSameNode,
  isSharedCommentTarget,
  sseEventMatchesCommentTarget
} from '../../src/utils/commentSse'

describe('comment SSE helpers', () => {
  const space = mock<SpaceResource>()

  it('collects resource ids for the active comment target', () => {
    const target = createCommentTarget(
      space,
      mock<Resource>({
        fileId: 'owner$space!file-1',
        id: 'owner$space!file-1',
        name: 'Plan.md',
        path: '/Plan.md',
        isFolder: false
      })
    )

    expect(collectCommentTargetFileIds(target)).toEqual(new Set(['owner$space!file-1']))
  })

  it('matches sidecar or source file ids from SSE payloads', () => {
    const watched = new Set(['owner$space!file-1', 'owner$space!sidecar-1'])

    expect(
      sseEventMatchesCommentTarget({ itemid: 'owner$space!sidecar-1' }, watched)
    ).toBe(true)
    expect(
      sseEventMatchesCommentTarget({ parentitemid: 'owner$space!file-1' }, watched)
    ).toBe(true)
    expect(
      sseEventMatchesCommentTarget({ itemid: 'owner$space!other-file' }, watched)
    ).toBe(false)
  })

  it('matches ids that share the same node id', () => {
    expect(
      fileIdsReferToSameNode(
        'storage-a!node-1',
        'storage-b!node-1'
      )
    ).toBe(true)

    expect(
      sseEventMatchesCommentTarget(
        { itemid: 'owner$space!sidecar-1' },
        new Set(['other$space!sidecar-1'])
      )
    ).toBe(true)
  })

  it('detects shared comment targets', () => {
    const mountpoint = mock<SpaceResource>({ driveType: 'mountpoint' })
    const project = mock<SpaceResource>({ driveType: 'project' })

    expect(
      isSharedCommentTarget(
        createCommentTarget(
          mountpoint,
          mock<Resource>({ name: 'Plan.md', path: '/Plan.md', isFolder: false })
        )
      )
    ).toBe(true)

    expect(
      isSharedCommentTarget(
        createCommentTarget(
          project,
          mock<Resource>({
            name: 'Plan.md',
            path: '/Plan.md',
            isFolder: false,
            isReceivedShare: () => false,
            isMounted: () => false,
            shareTypes: []
          })
        )
      )
    ).toBe(false)

    expect(
      isSharedCommentTarget(
        createCommentTarget(
          project,
          mock<Resource>({
            name: 'Plan.md',
            path: '/Plan.md',
            isFolder: false,
            shareTypes: [ShareTypes.user.value],
            isReceivedShare: () => false,
            isMounted: () => false
          })
        )
      )
    ).toBe(true)
  })

  it('counts only active comments', () => {
    expect(
      countActiveComments([
        {
          comments: [{}, { deletedAt: '2026-01-01T00:00:00.000Z' }, {}]
        }
      ])
    ).toBe(2)
  })
})
