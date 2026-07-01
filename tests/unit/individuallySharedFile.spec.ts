import { Resource, ShareTypes, SpaceResource } from '@opencloud-eu/web-client'
import { mock } from 'vitest-mock-extended'
import {
  hasDirectGraphFileShares,
  isIndividuallySharedCommentTarget,
  resolveIndividualShareViaGraph,
  shouldResolveIndividualShareViaGraph
} from '../../src/utils/individuallySharedFile'

describe('individually shared file detection', () => {
  it('detects a single-file mountpoint share', () => {
    const space = mock<SpaceResource>({ driveType: 'mountpoint', name: 'Plan.md' })
    const resource = mock<Resource>({
      name: 'Plan.md',
      path: '/Plan.md',
      isFolder: false,
      isShareRoot: () => true
    })

    expect(isIndividuallySharedCommentTarget(space, resource)).toBe(true)
  })

  it('detects a single-file mountpoint share by space name', () => {
    const space = mock<SpaceResource>({ driveType: 'mountpoint', name: 'Plan.md' })
    const resource = mock<Resource>({
      name: 'Plan.md',
      path: '/Plan.md',
      isFolder: false,
      isShareRoot: () => false
    })

    expect(isIndividuallySharedCommentTarget(space, resource)).toBe(true)
  })

  it('does not flag files inside a shared folder mount', () => {
    const space = mock<SpaceResource>({ driveType: 'mountpoint', name: 'Share' })
    const resource = mock<Resource>({
      name: 'Plan.md',
      path: '/Plan.md',
      isFolder: false,
      isShareRoot: () => false
    })

    expect(isIndividuallySharedCommentTarget(space, resource)).toBe(false)
  })

  it('detects direct outgoing shares on owner files', () => {
    const space = mock<SpaceResource>({ driveType: 'personal' })
    const resource = mock<Resource>({
      name: 'Plan.md',
      path: '/Plan.md',
      isFolder: false,
      shareTypes: [ShareTypes.user.value],
      isMounted: () => false
    })

    expect(isIndividuallySharedCommentTarget(space, resource)).toBe(true)
  })

  it('ignores mounted resources inside shared folders', () => {
    const space = mock<SpaceResource>({ driveType: 'personal' })
    const resource = mock<Resource>({
      name: 'Plan.md',
      path: '/Share/Plan.md',
      isFolder: false,
      shareTypes: [ShareTypes.user.value],
      isMounted: () => true
    })

    expect(isIndividuallySharedCommentTarget(space, resource)).toBe(false)
    expect(shouldResolveIndividualShareViaGraph(space, resource)).toBe(false)
  })

  it('falls back to graph permissions when shareTypes are missing', () => {
    const space = mock<SpaceResource>({ driveType: 'personal', id: 'drive-id' })
    const resource = mock<Resource>({
      name: 'Plan.md',
      path: '/Plan.md',
      isFolder: false,
      fileId: 'drive-id!file-id',
      shareTypes: [],
      isMounted: () => false
    })

    expect(isIndividuallySharedCommentTarget(space, resource)).toBe(false)
    expect(shouldResolveIndividualShareViaGraph(space, resource)).toBe(true)
  })

  it('detects direct graph shares and ignores inherited ones', () => {
    expect(
      hasDirectGraphFileShares([
        { indirect: true, shareType: ShareTypes.user.value, sharedWith: { id: '1' } } as any,
        { indirect: false, shareType: ShareTypes.user.value, sharedWith: { id: '2' } } as any
      ])
    ).toBe(true)

    expect(
      hasDirectGraphFileShares([
        { indirect: true, shareType: ShareTypes.user.value, sharedWith: { id: '1' } } as any
      ])
    ).toBe(false)
  })

  it('resolves direct shares via graph permissions', async () => {
    const space = mock<SpaceResource>({ driveType: 'personal', id: 'drive-id' })
    const resource = mock<Resource>({
      name: 'Plan.md',
      fileId: 'drive-id!file-id',
      isFolder: false
    })

    const graph = {
      permissions: {
        listRoleDefinitions: vi.fn().mockResolvedValue([{ id: 'role-1' }]),
        listPermissions: vi.fn().mockResolvedValue({
          shares: [
            {
              indirect: false,
              shareType: ShareTypes.user.value,
              sharedWith: { id: 'user-1' }
            }
          ]
        })
      }
    }

    await expect(resolveIndividualShareViaGraph(graph as any, space, resource)).resolves.toBe(true)
  })
})
